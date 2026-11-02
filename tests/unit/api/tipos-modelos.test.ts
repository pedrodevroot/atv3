import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../../src/app.js';
import { corpoProjetoDemonstracao, criarAppMemoria } from '../../fixtures/api.js';

interface Rodada {
  projeto: {
    id: string;
    titulo: string;
    tipoCaptacao: string;
    estrategia: string;
    orcamento: number;
    detalhes: Record<string, unknown>;
    requisitos: { papel: string; peso: number }[];
  };
}

describe('API de tipos e modelos de projeto', () => {
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

  const doModelo = (modeloId: string, corpo: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: `/modelos-projeto/${modeloId}/projetos`,
      payload: {
        titulo: 'Projeto do modelo',
        produtorId: 'produtor-9',
        dataInicio: '2026-10-01T00:00:00.000Z',
        dataEntrega: '2026-12-01T00:00:00.000Z',
        ...corpo,
      },
    });

  it('GET /tipos-projeto lista as fábricas registradas e o recomendador de cada uma', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/tipos-projeto' });

    expect(resposta.statusCode).toBe(200);
    expect(
      resposta
        .json<{ tipo: string; recomendador: { nome: string } }[]>()
        .map((tipo) => [tipo.tipo, tipo.recomendador.nome]),
    ).toEqual([
      ['DOCUMENTARIO', 'recomendador-documentario'],
      ['ANIMACAO', 'recomendador-animacao'],
      ['PUBLICITARIO', 'recomendador-publicitario'],
      ['FICCAO', 'recomendador-ficcao'],
    ]);
  });

  it('GET /modelos-projeto lista os protótipos com os detalhes de cada tipo', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/modelos-projeto' });
    const modelos = resposta.json<{ id: string; detalhes: object; duracaoDias: number }[]>();

    expect(modelos).toHaveLength(4);
    expect(modelos[1]).toMatchObject({
      id: 'animacao-3d-curta',
      detalhes: { tecnica: '3D', softwares: ['Blender', 'Maya'], quadrosPorSegundo: 24 },
      duracaoDias: 180,
    });
  });

  it('POST /modelos-projeto/:id/projetos clona o modelo, aplica os ajustes e recomenda', async () => {
    const resposta = await doModelo('animacao-3d-curta', { orcamento: 320_000 });
    const { projeto } = resposta.json<Rodada>();

    expect(resposta.statusCode).toBe(201);
    expect(projeto).toMatchObject({
      titulo: 'Projeto do modelo',
      tipoCaptacao: 'ANIMACAO',
      estrategia: 'recomendador-animacao',
      orcamento: 320_000,
      detalhes: { tecnica: '3D' },
    });
    expect(projeto.requisitos.map((requisito) => requisito.papel)).toContain('EFEITOS_VISUAIS');
  });

  it('o modelo de documentário exige que o produtor informe os entrevistados', async () => {
    const semEntrevistados = await doModelo('documentario-entrevistas');
    const completo = await doModelo('documentario-entrevistas', {
      detalhes: { tema: 'Rios do cerrado', entrevistados: ['Seu Tião'] },
    });

    expect(semEntrevistados.statusCode).toBe(422);
    expect(semEntrevistados.json()).toMatchObject({ codigo: 'RESTRICAO_VIOLADA' });
    expect(completo.statusCode).toBe(201);
    expect(completo.json<Rodada>().projeto.detalhes).toEqual({
      tema: 'Rios do cerrado',
      entrevistados: ['Seu Tião'],
    });
  });

  it('orçamento reduzido no clone troca a estratégia sugerida para regras de orçamento', async () => {
    const resposta = await doModelo('publicitario-digital', { orcamento: 40_000 });

    expect(resposta.json<Rodada>().projeto.estrategia).toBe('regras-orcamento');
  });

  it('modelo desconhecido devolve 404', async () => {
    const resposta = await doModelo('novela');

    expect(resposta.statusCode).toBe(404);
  });

  it('POST /projetos aceita PUBLICITARIO com detalhes e usa o recomendador do tipo', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao({
        tipoCaptacao: 'PUBLICITARIO',
        estrategia: undefined,
        detalhes: { marca: 'Café Serrano', veiculacao: ['TV'], pecas: 2 },
      }),
    });
    await ambiente.barramento.aguardarEntregas();
    const mensagens = await app.inject({ method: 'GET', url: '/mensagens/produtor-1' });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json<Rodada>().projeto).toMatchObject({
      tipoCaptacao: 'PUBLICITARIO',
      estrategia: 'recomendador-publicitario',
      detalhes: { marca: 'Café Serrano', veiculacao: ['TV'], pecas: 2 },
    });
    expect(mensagens.json<{ assunto: string }[]>().map((mensagem) => mensagem.assunto)).toEqual([
      'Publicitário: equipe sugerida para a campanha',
    ]);
  });

  it('detalhes inválidos para o tipo são recusados com 422', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao({
        tipoCaptacao: 'PUBLICITARIO',
        detalhes: { marca: 'Café Serrano', veiculacao: ['RADIO'] },
      }),
    });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toMatchObject({
      codigo: 'VALOR_INVALIDO',
      mensagem: 'Veiculação deve conter apenas: TV, DIGITAL, CINEMA.',
    });
  });
});
