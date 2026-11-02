import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../../src/app.js';
import { criarAppMemoria, corpoProjetoDemonstracao } from '../../fixtures/api.js';
import { IDS_DEMONSTRACAO } from '../../fixtures/cadastro-demonstracao.js';
import { executarFluxoCompleto } from '../../fixtures/fluxo-api.js';
import { ID_EDITOR_ECONOMICO } from '../../fixtures/orquestracao.js';

interface ProjetoCriado {
  projeto: {
    id: string;
    estrategia: string;
    equipes: { id: string; membros: { papel: string; profissional: { id: string } }[] }[];
  };
  parcial: boolean;
  papeisSemCandidatos: string[];
}

describe('API REST (repositórios em memória)', () => {
  let ambiente: Awaited<ReturnType<typeof criarAppMemoria>>;
  let app: App;

  beforeEach(async () => {
    ambiente = await criarAppMemoria();
    app = ambiente.app;
  });

  afterEach(async () => {
    await ambiente.barramento.aguardarEntregas();
    await app.close();
  });

  const criarProjeto = async (sobrescritas: Record<string, unknown> = {}) => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao(sobrescritas),
    });
    return { resposta, corpo: resposta.json<ProjetoCriado>() };
  };

  it('executa o fluxo completo: recomendar, convidar, recusar, substituir, finalizar e auditar', async () => {
    await executarFluxoCompleto(app, () => ambiente.barramento.aguardarEntregas());

    expect(ambiente.canais.publicador.publicadas.todos.map((mensagem) => mensagem.topico)).toEqual([
      'gerenciamento-projetos.equipe-formada',
      'financeiro.equipe-formada',
    ]);
    expect(ambiente.canais.email.enviados.total).toBeGreaterThan(5);
  });

  it('sugere regras de orçamento quando o produtor não escolhe estratégia e o orçamento é baixo', async () => {
    const { resposta, corpo } = await criarProjeto({ estrategia: undefined, orcamento: 40_000 });

    expect(resposta.statusCode).toBe(201);
    expect(corpo.projeto.estrategia).toBe('regras-orcamento');
  });

  it('nova rodada com outra estratégia muda o diretor sugerido', async () => {
    const { corpo } = await criarProjeto();

    const resposta = await app.inject({
      method: 'POST',
      url: `/projetos/${corpo.projeto.id}/recomendacoes`,
      payload: {
        estrategia: 'regras-orcamento',
        parametros: { orquestracao: { numeroSugestoes: 1 } },
      },
    });
    const novaRodada = resposta.json<ProjetoCriado>();

    expect(resposta.statusCode).toBe(201);
    expect(novaRodada.projeto.estrategia).toBe('regras-orcamento');
    expect(novaRodada.projeto.equipes).toHaveLength(1);
    expect(
      novaRodada.projeto.equipes[0]?.membros.find((membro) => membro.papel === 'DIRETOR')
        ?.profissional.id,
    ).toBe(IDS_DEMONSTRACAO.DIRETOR_LOCAL);
  });

  it('reavaliação significativa refaz a equipe; pequena só atualiza o projeto', async () => {
    const { corpo } = await criarProjeto();
    const reavaliar = (payload: object) =>
      app.inject({ method: 'POST', url: `/projetos/${corpo.projeto.id}/reavaliacao`, payload });

    const pequena = (await reavaliar({ orcamento: 105_000 })).json<{ novaRodada?: object }>();
    const grande = await reavaliar({ orcamento: 60_000, dataEntrega: '2027-01-30T00:00:00.000Z' });

    expect(pequena.novaRodada).toBeUndefined();
    expect(grande.statusCode).toBe(200);
    expect(grande.json()).toMatchObject({
      reavaliacao: { significativa: true },
      novaRodada: { rodada: 2 },
      projeto: { orcamento: 60_000 },
    });
  });

  it('rejeitar deixa o papel vago e a substituição traz outro profissional', async () => {
    const { corpo } = await criarProjeto();
    const [equipe] = corpo.projeto.equipes;
    const base = `/projetos/${corpo.projeto.id}/equipes/${equipe?.id ?? ''}/membros/EDITOR`;

    const rejeitado = await app.inject({ method: 'DELETE', url: base });
    const substituido = await app.inject({
      method: 'POST',
      url: `${base}/substituicao`,
      payload: {},
    });

    expect(rejeitado.statusCode).toBe(200);
    expect(
      rejeitado
        .json<ProjetoCriado['projeto']>()
        .equipes[0]?.membros.some((membro) => membro.papel === 'EDITOR'),
    ).toBe(false);
    expect(substituido.statusCode).toBe(200);
    expect(
      substituido
        .json<ProjetoCriado>()
        .projeto.equipes[0]?.membros.find((membro) => membro.papel === 'EDITOR')?.profissional.id,
    ).toBe(ID_EDITOR_ECONOMICO);
  });

  it('relatório do projeto inteiro usa os três visitantes', async () => {
    const { corpo } = await criarProjeto();

    const resposta = await app.inject({
      method: 'GET',
      url: `/projetos/${corpo.projeto.id}/relatorio`,
    });

    expect(resposta.json()).toMatchObject({
      validacao: {
        valido: true,
        problemas: [
          {
            codigo: 'COMPETENCIA_DO_TIPO',
            severidade: 'ALERTA',
            papel: 'DIRETOR',
            profissionalId: IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
          },
        ],
      },
      relatorio: expect.stringContaining('# Relatório do projeto "Vozes do Sertão"') as string,
    });
  });

  it('marca resultado parcial quando falta candidato para um papel', async () => {
    const { corpo } = await criarProjeto({
      requisitos: [
        { papel: 'DIRETOR', peso: 5 },
        { papel: 'SONOPLASTA', peso: 2 },
      ],
    });

    expect(corpo.parcial).toBe(true);
    expect(corpo.papeisSemCandidatos).toEqual(['SONOPLASTA']);
  });

  describe('erros padronizados', () => {
    it.each([
      ['GET', '/projetos/inexistente', undefined, 404, 'NAO_ENCONTRADO'],
      ['POST', '/convites/inexistente/resposta', { aceito: true }, 404, 'NAO_ENCONTRADO'],
      ['GET', '/projetos/inexistente/recomendacoes', undefined, 404, 'NAO_ENCONTRADO'],
      ['GET', '/projetos/inexistente/auditoria', undefined, 404, 'NAO_ENCONTRADO'],
      ['POST', '/projetos', { titulo: 'x' }, 400, 'REQUISICAO_INVALIDA'],
      [
        'POST',
        '/projetos',
        corpoProjetoDemonstracao({ estrategia: 'aleatoria' }),
        400,
        'ESTRATEGIA_DESCONHECIDA',
      ],
      [
        'POST',
        '/projetos',
        corpoProjetoDemonstracao({ orcamento: 1_500 }),
        422,
        'RESTRICAO_VIOLADA',
      ],
      [
        'POST',
        '/projetos',
        corpoProjetoDemonstracao({ dataEntrega: '2026-09-01T00:00:00.000Z' }),
        422,
        'VALOR_INVALIDO',
      ],
    ] as const)('%s %s responde %i', async (method, url, payload, status, codigo) => {
      const resposta = await app.inject({ method, url, ...(payload ? { payload } : {}) });

      expect(resposta.statusCode).toBe(status);
      expect(resposta.json()).toMatchObject({ codigo });
    });

    it('409 ao aceitar de novo um membro já convidado e 422 ao finalizar equipe incompleta', async () => {
      const { corpo } = await criarProjeto();
      const equipeId = corpo.projeto.equipes[0]?.id ?? '';
      const aceite = `/projetos/${corpo.projeto.id}/equipes/${equipeId}/membros/DIRETOR/aceite`;
      await app.inject({ method: 'POST', url: aceite });

      const repetido = await app.inject({ method: 'POST', url: aceite });
      const finalizar = await app.inject({
        method: 'POST',
        url: `/projetos/${corpo.projeto.id}/equipes/${equipeId}/finalizacao`,
      });

      expect(repetido.statusCode).toBe(409);
      expect(repetido.json()).toMatchObject({ codigo: 'TRANSICAO_INVALIDA' });
      expect(finalizar.statusCode).toBe(422);
      expect(finalizar.json()).toMatchObject({ codigo: 'REGRA_VIOLADA' });
    });
  });
});
