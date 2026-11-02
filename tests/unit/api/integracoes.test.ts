import { beforeEach, describe, expect, it } from 'vitest';
import { SistemaRecomendacao } from '../../../src/application/sistema-recomendacao.js';
import { resolverParametros } from '../../../src/application/strategies/parametros-recomendacao.js';
import type { App } from '../../../src/app.js';
import { criarRegistroEstrategias, criarRegistroFabricas } from '../../../src/container.js';
import {
  criarAdaptadorArmazenamento,
  criarAdaptadorPagamento,
  criarAdaptadorProfissional,
} from '../../../src/infrastructure/adaptadores/criar-adaptadores.js';
import { DepositoObjetosMemoria } from '../../../src/infrastructure/externos/armazenamento-externo.js';
import { LivroTransacoesMemoria } from '../../../src/infrastructure/externos/gateway-pagamento.js';
import { BarramentoEventosEmMemoria } from '../../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import { CaixaMensagensMemoria } from '../../../src/infrastructure/notifications/canais-simulados.js';
import { RepositorioPagamentosMemoria } from '../../../src/infrastructure/repositories/repositorio-pagamentos-memoria.js';
import { RepositorioProfissionaisMemoria } from '../../../src/infrastructure/repositories/repositorio-profissionais-memoria.js';
import { corpoProjetoDemonstracao, criarAppMemoria } from '../../fixtures/api.js';
import { criarProjeto } from '../../fixtures/dominio.js';
import { relogioFixo } from '../../fixtures/orquestracao.js';
import { Papel } from '../../../src/domain/enums/papel.js';

interface Rodada {
  projeto: { id: string; equipes: { id: string }[] };
}

describe('Rotas de arquivos e pagamentos', () => {
  let app: App;

  beforeEach(async () => {
    ({ app } = await criarAppMemoria());
  });

  async function criar(): Promise<Rodada> {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao(),
    });
    return resposta.json<Rodada>();
  }

  it('responde 404 para arquivos de projeto inexistente', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/projetos/nada/arquivos' });

    expect(resposta.statusCode).toBe(404);
  });

  it('responde 404 para arquivo que não existe no projeto', async () => {
    const { projeto } = await criar();

    const resposta = await app.inject({
      method: 'GET',
      url: `/projetos/${projeto.id}/arquivos/conteudo`,
      query: { id: 's3://cinebridge-midia/projetos/outro/a.txt' },
    });

    expect(resposta.statusCode).toBe(404);
  });

  it.each([
    ['base64 inválido', { nome: 'a', tipoConteudo: 'text/plain', conteudoBase64: '%%%' }],
    ['conteúdo vazio', { nome: 'a', tipoConteudo: 'text/plain', conteudoBase64: '' }],
    ['nome ausente', { tipoConteudo: 'text/plain', conteudoBase64: 'YQ==' }],
  ])('recusa %s com 400', async (_nome, payload) => {
    const { projeto } = await criar();

    const resposta = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/arquivos`,
      payload,
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('um nome de arquivo com caminho não escapa da pasta do projeto', async () => {
    const { projeto } = await criar();

    const anexo = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/arquivos`,
      payload: { nome: '../../outro/a.txt', tipoConteudo: 'text/plain', conteudoBase64: 'YQ==' },
    });
    const { id } = anexo.json<{ id: string }>();

    expect(id).toContain(`/projetos/${projeto.id}/`);
    expect(id.split(`/projetos/${projeto.id}/`)[1]).not.toContain('/');
  });

  it('responde 404 para pagamento inexistente e papel sem membro na equipe', async () => {
    const { projeto } = await criar();

    const consulta = await app.inject({
      method: 'GET',
      url: `/projetos/${projeto.id}/pagamentos/nada`,
    });
    const cancelamento = await app.inject({
      method: 'DELETE',
      url: `/projetos/${projeto.id}/pagamentos/nada`,
    });
    const papelInvalido = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/equipes/nada/membros/DIRETOR/pagamento`,
    });

    expect(consulta.statusCode).toBe(404);
    expect(cancelamento.statusCode).toBe(404);
    expect(papelInvalido.statusCode).toBe(404);
  });
});

describe('SistemaRecomendacao.configurarAdaptadores', () => {
  function sistemaSemAdaptadores() {
    return new SistemaRecomendacao({
      repositorio: new RepositorioProfissionaisMemoria(),
      fabricas: criarRegistroFabricas({ caixa: new CaixaMensagensMemoria() }),
      estrategias: criarRegistroEstrategias(),
      sujeito: new BarramentoEventosEmMemoria(),
      parametros: resolverParametros(),
      relogio: relogioFixo,
    });
  }

  it('recusa o uso de um adaptador antes da configuração', () => {
    const sistema = sistemaSemAdaptadores();

    expect(() => sistema.armazenamento).toThrow('armazenamento');
    expect(() => sistema.pagamento).toThrow('pagamento');
    expect(() => sistema.profissional).toThrow('profissional');
  });

  it('expõe os adaptadores configurados e passa a buscar candidatos pelo novo cadastro', async () => {
    const sistema = sistemaSemAdaptadores();
    const armazenamento = criarAdaptadorArmazenamento('s3', new DepositoObjetosMemoria(), '');
    const pagamento = criarAdaptadorPagamento('paypal', new LivroTransacoesMemoria());
    const profissional = criarAdaptadorProfissional(
      'indeed',
      new RepositorioProfissionaisMemoria(),
    );
    const projeto = criarProjeto({ orcamento: 200_000 });

    const antes = await sistema.recomendar(projeto);
    sistema.configurarAdaptadores(armazenamento, pagamento, profissional);
    const depois = await sistema.recomendar(projeto);

    expect(sistema.armazenamento).toBe(armazenamento);
    expect(sistema.pagamento).toBe(pagamento);
    expect(sistema.profissional).toBe(profissional);
    expect(antes.ranking.get(Papel.DIRETOR)).toEqual([]);
    expect(depois.ranking.get(Papel.DIRETOR)?.[0]?.profissional.id).toMatch(/^indeed:/);
  });
});

describe('RepositorioPagamentosMemoria', () => {
  const pagamento = {
    id: 'p1',
    projetoId: 'projeto',
    equipeId: 'equipe',
    papel: Papel.EDITOR,
    profissionalId: 'ana',
    valor: 10,
    provedor: 'stripe',
    criadoEm: new Date(),
    cancelado: false,
  };

  it('só aceita um pagamento ativo por papel e libera o papel ao cancelar', async () => {
    const repositorio = new RepositorioPagamentosMemoria();

    await repositorio.registrar(pagamento);
    await expect(repositorio.registrar({ ...pagamento, id: 'p2' })).rejects.toMatchObject({
      codigo: 'CONFLITO_CONCORRENCIA',
    });

    await repositorio.marcarCancelado('p1');
    await repositorio.marcarCancelado('inexistente');
    await repositorio.registrar({ ...pagamento, id: 'p2' });

    expect((await repositorio.obter('p1'))?.cancelado).toBe(true);
    expect((await repositorio.ativoDoPapel('equipe', Papel.EDITOR))?.id).toBe('p2');
  });
});
