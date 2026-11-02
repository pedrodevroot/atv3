import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { StatusConvite, StatusMembro } from '../../src/domain/enums/status.js';
import { criarLogger } from '../../src/infrastructure/logging/opcoes-logger.js';
import { RepositorioProfissionaisTypeorm } from '../../src/infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { cadastroDaApi, corpoProjetoDemonstracao } from '../fixtures/api.js';
import { AGORA } from '../fixtures/orquestracao.js';
import { limparTabelas, prepararBanco } from './banco.js';

interface Rodada {
  projeto: { id: string; equipes: { id: string; membros: { papel: string; custo: number }[] }[] };
}

describe('Correções de robustez com PostgreSQL real', () => {
  let banco: DataSource;
  let container: Container;
  let app: App;
  let agora = AGORA.getTime();

  beforeAll(async () => {
    banco = await prepararBanco();
    const config = carregarConfig();
    container = criarContainer(config, criarLogger(config), {
      relogio: () => new Date(agora),
    });
    await container.dataSource.initialize();
    app = await construirApp(container);
  });

  beforeEach(async () => {
    agora = AGORA.getTime();
    await limparTabelas(banco);
    await new RepositorioProfissionaisTypeorm(banco).salvarTodos(cadastroDaApi());
    container.cadastroProfissionais.invalidar();
  });

  afterAll(async () => {
    await app.close();
    await container.encerrar();
    await banco.destroy();
  });

  const criarProjeto = async (sobrescritas: Record<string, unknown> = {}) => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao(sobrescritas),
    });
    return resposta.json<Rodada>().projeto;
  };

  const convidarEditor = async (projetoId: string, equipeId: string) => {
    const aceite = await app.inject({
      method: 'POST',
      url: `/projetos/${projetoId}/equipes/${equipeId}/membros/EDITOR/aceite`,
    });
    return aceite.json<{ convite: { id: string } }>().convite.id;
  };

  it('recusa sem orçamento para substituto fica gravada e o produtor é avisado', async () => {
    const projeto = await criarProjeto();
    const equipe = projeto.equipes[0];
    if (!equipe) throw new Error('sem equipe');
    const custoDiretor = equipe.membros.find((membro) => membro.papel === 'DIRETOR')?.custo ?? 1;
    const conviteId = await convidarEditor(projeto.id, equipe.id);
    await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/reavaliacao`,
      payload: { orcamento: custoDiretor, limiar: 0.99 },
    });

    await app.inject({
      method: 'POST',
      url: `/convites/${conviteId}/resposta`,
      payload: { aceito: false },
    });
    await container.barramento.aguardarEntregas();

    const relido = await container.repositorioProjetos.obter(projeto.id);
    const auditoria = await container.canais.auditoria.listarPorProjeto(projeto.id);
    const mensagens = await container.canais.caixa.mensagensDe('produtor-1');
    expect((await container.repositorioConvites.obter(conviteId))?.status).toBe(
      StatusConvite.RECUSADO,
    );
    expect(relido?.equipe(equipe.id).membro(Papel.EDITOR)?.status).toBe(StatusMembro.RECUSADO);
    expect(auditoria.map((entrada) => entrada.tipo)).toContain('SUBSTITUICAO_INDISPONIVEL');
    expect(mensagens.map((mensagem) => mensagem.assunto)).toContain(
      'Sem substituto automático para EDITOR',
    );
  });

  it('x-request-id longo não derruba a auditoria', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      headers: { 'x-request-id': 'r'.repeat(100) },
      payload: corpoProjetoDemonstracao(),
    });
    await container.barramento.aguardarEntregas();
    const { projeto } = resposta.json<Rodada>();

    const auditoria = await container.canais.auditoria.listarPorProjeto(projeto.id);
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]?.correlacaoId).toBe(resposta.headers['x-request-id']);
    expect(auditoria[0]?.correlacaoId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('orçamento acima do suportado pelo banco é recusado com 400', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao({ orcamento: 1e15 }),
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('detalhes ajustados pelo PATCH são gravados no banco', async () => {
    const projeto = await criarProjeto({
      tipoCaptacao: 'DOCUMENTARIO',
      requisitos: [
        { papel: 'DIRETOR', peso: 5 },
        { papel: 'EDITOR', peso: 3 },
        { papel: 'SONOPLASTA', peso: 2 },
      ],
      detalhes: { tema: 'Rios', entrevistados: ['Seu Tião'] },
    });
    const ajustar = (detalhes: object) =>
      app.inject({
        method: 'PATCH',
        url: `/projetos/${projeto.id}/detalhes`,
        payload: { detalhes },
      });

    await ajustar({ entrevistados: ['Seu Tião', 'Dona Lia'] });
    const segundo = await ajustar({ tema: 'Rios do cerrado' });

    expect(segundo.statusCode).toBe(200);
    expect((await container.repositorioProjetos.obter(projeto.id))?.detalhes).toEqual({
      tema: 'Rios do cerrado',
      entrevistados: ['Seu Tião', 'Dona Lia'],
    });
  });

  it('nova rodada cancela no banco o convite pendente da equipe descartada', async () => {
    const projeto = await criarProjeto();
    const equipe = projeto.equipes[0];
    if (!equipe) throw new Error('sem equipe');
    const conviteId = await convidarEditor(projeto.id, equipe.id);

    await app.inject({ method: 'POST', url: `/projetos/${projeto.id}/recomendacoes`, payload: {} });
    const resposta = await app.inject({
      method: 'POST',
      url: `/convites/${conviteId}/resposta`,
      payload: { aceito: true },
    });

    expect((await container.repositorioConvites.obter(conviteId))?.status).toBe(
      StatusConvite.CANCELADO,
    );
    expect(resposta.statusCode).toBe(409);
  });

  it('formar a equipe cancela no banco os convites pendentes das outras sugestões', async () => {
    const projeto = await criarProjeto();
    const [principal, outra] = projeto.equipes;
    if (!principal || !outra) throw new Error('precisa de duas equipes');
    const conviteDaOutra = await convidarEditor(projeto.id, outra.id);
    for (const papel of ['DIRETOR', 'EDITOR']) {
      const aceite = await app.inject({
        method: 'POST',
        url: `/projetos/${projeto.id}/equipes/${principal.id}/membros/${papel}/aceite`,
      });
      await app.inject({
        method: 'POST',
        url: `/convites/${aceite.json<{ convite: { id: string } }>().convite.id}/resposta`,
        payload: { aceito: true },
      });
      await container.barramento.aguardarEntregas();
    }

    const final = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/equipes/${principal.id}/finalizacao`,
    });

    expect(final.statusCode).toBe(200);
    expect((await container.repositorioConvites.obter(conviteDaOutra))?.status).toBe(
      StatusConvite.CANCELADO,
    );
  });

  it('convite vencido é expirado no banco uma única vez e libera o papel', async () => {
    const projeto = await criarProjeto();
    const equipe = projeto.equipes[0];
    if (!equipe) throw new Error('sem equipe');
    const conviteId = await convidarEditor(projeto.id, equipe.id);
    agora += 73 * 3_600_000;

    const [primeira, segunda] = await Promise.all([
      container.casos.expirarConvites.executar({}),
      container.casos.expirarConvites.executar({}),
    ]);
    await container.barramento.aguardarEntregas();

    expect([...primeira, ...segunda].map((convite) => convite.id)).toEqual([conviteId]);
    expect((await container.repositorioConvites.obter(conviteId))?.status).toBe(
      StatusConvite.EXPIRADO,
    );
    const relido = await container.repositorioProjetos.obter(projeto.id);
    expect(relido?.equipe(equipe.id).membro(Papel.EDITOR)?.status).toBe(StatusMembro.SUGERIDO);
    expect(relido?.equipe(equipe.id).rodada).toBe(2);
  });
});
