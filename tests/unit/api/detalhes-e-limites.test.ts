import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../../src/app.js';
import { ORCAMENTO_MAXIMO } from '../../../src/domain/entidades/projeto.js';
import { corpoProjetoDemonstracao, criarAppMemoria } from '../../fixtures/api.js';

interface Rodada {
  projeto: {
    id: string;
    detalhes: Record<string, unknown>;
    equipes: { id: string }[];
  };
}

const documentario = (detalhes: object = { tema: 'Rios', entrevistados: ['Seu Tião'] }) =>
  corpoProjetoDemonstracao({
    tipoCaptacao: 'DOCUMENTARIO',
    requisitos: [
      { papel: 'DIRETOR', peso: 5 },
      { papel: 'EDITOR', peso: 3 },
      { papel: 'SONOPLASTA', peso: 2 },
    ],
    detalhes,
  });

describe('Detalhes do tipo e limites da API', () => {
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

  const criar = (payload: object) => app.inject({ method: 'POST', url: '/projetos', payload });
  const ajustar = (projetoId: string, detalhes: object) =>
    app.inject({ method: 'PATCH', url: `/projetos/${projetoId}/detalhes`, payload: { detalhes } });

  it('PATCH /projetos/:id/detalhes completa os detalhes e registra a ação na auditoria', async () => {
    const { projeto } = (await criar(documentario())).json<Rodada>();

    const resposta = await ajustar(projeto.id, { entrevistados: ['Seu Tião', 'Dona Lia'] });
    await ambiente.barramento.aguardarEntregas();
    const auditoria = await app.inject({ method: 'GET', url: `/projetos/${projeto.id}/auditoria` });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json<Rodada['projeto']>().detalhes).toEqual({
      tema: 'Rios',
      entrevistados: ['Seu Tião', 'Dona Lia'],
    });
    expect(auditoria.json<{ tipo: string }[]>().map((entrada) => entrada.tipo)).toContain(
      'DETALHES_ATUALIZADOS',
    );
  });

  it('projeto antigo sem entrevistados: substituição continua funcionando e o PATCH libera novas rodadas', async () => {
    const { projeto } = (await criar(documentario())).json<Rodada>();
    const salvo = await ambiente.casos.consultas.obterProjeto(projeto.id);
    salvo.ajustarDetalhes({ entrevistados: [] });
    await ambiente.projetos.salvar(salvo);
    const equipeId = projeto.equipes[0]?.id ?? '';

    const novaRodadaBloqueada = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/recomendacoes`,
      payload: {},
    });
    const substituicao = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/equipes/${equipeId}/membros/EDITOR/substituicao`,
      payload: {},
    });
    await ajustar(projeto.id, { entrevistados: ['Seu Tião'] });
    const novaRodada = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/recomendacoes`,
      payload: {},
    });

    expect(novaRodadaBloqueada.json()).toMatchObject({
      codigo: 'RESTRICAO_VIOLADA',
      mensagem: 'Documentário precisa de ao menos um entrevistado.',
    });
    expect(substituicao.statusCode).toBe(200);
    expect(novaRodada.statusCode).toBe(201);
  });

  it('PATCH recusa detalhes que o tipo não conhece e projeto inexistente', async () => {
    const { projeto } = (await criar(documentario())).json<Rodada>();

    const desconhecido = await ajustar(projeto.id, { tecnica: '3D' });
    const inexistente = await ajustar('nao-existe', { tema: 'x' });

    expect(desconhecido.statusCode).toBe(422);
    expect(desconhecido.json()).toMatchObject({
      codigo: 'VALOR_INVALIDO',
      mensagem:
        'Detalhes não reconhecidos para DOCUMENTARIO: tecnica. Aceitos: tema, entrevistados.',
    });
    expect(inexistente.statusCode).toBe(404);
  });

  it('criação recusa detalhes desconhecidos, inclusive na ficção, e listas grandes demais', async () => {
    const ficcao = await criar(corpoProjetoDemonstracao({ detalhes: { tema: 'x' } }));
    const documentarioComTecnica = await criar(
      documentario({ tema: 'Rios', entrevistados: ['A'], tecnica: '3D' }),
    );
    const muitosEntrevistados = await criar(
      documentario({
        tema: 'Rios',
        entrevistados: Array.from({ length: 51 }, (_, indice) => `Pessoa ${indice}`),
      }),
    );
    const temaLongo = await criar(documentario({ tema: 't'.repeat(201), entrevistados: ['A'] }));
    const muitasChaves = await criar(
      documentario(
        Object.fromEntries(Array.from({ length: 21 }, (_, indice) => [`c${indice}`, 1])),
      ),
    );

    expect(ficcao.json()).toMatchObject({
      codigo: 'VALOR_INVALIDO',
      mensagem: 'Detalhes não reconhecidos para FICCAO: tema. Aceitos: nenhum.',
    });
    expect(documentarioComTecnica.statusCode).toBe(422);
    expect(muitosEntrevistados.json()).toMatchObject({
      mensagem: 'Entrevistados deve ter no máximo 50 itens.',
    });
    expect(temaLongo.json()).toMatchObject({
      mensagem: 'Tema do documentário deve ter no máximo 200 caracteres.',
    });
    expect(muitasChaves.statusCode).toBe(400);
  });

  it('orçamento e duração acima do suportado são recusados na validação, não com erro 500', async () => {
    const orcamento = await criar(corpoProjetoDemonstracao({ orcamento: ORCAMENTO_MAXIMO + 1 }));
    const duracao = await criar(corpoProjetoDemonstracao({ duracaoMinutos: 100_001 }));
    const { projeto } = (await criar(corpoProjetoDemonstracao())).json<Rodada>();
    const reavaliacao = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/reavaliacao`,
      payload: { orcamento: 1e15 },
    });
    const noLimite = await criar(corpoProjetoDemonstracao({ orcamento: ORCAMENTO_MAXIMO }));

    expect(orcamento.statusCode).toBe(400);
    expect(duracao.statusCode).toBe(400);
    expect(reavaliacao.statusCode).toBe(400);
    expect(noLimite.statusCode).toBe(201);
  });

  it('parâmetros da recomendação: sem NaN com pesoPriori zero e recusa de valores fora da faixa', async () => {
    const semPriori = await criar(
      corpoProjetoDemonstracao({
        estrategia: 'filtragem-colaborativa',
        parametros: { colaborativa: { pesoPriori: 0 }, orquestracao: { scoreMinimo: 0 } },
      }),
    );
    const pesoEnorme = await criar(
      corpoProjetoDemonstracao({ parametros: { cosseno: { pesoSimilaridade: 1e308 } } }),
    );
    const mediaForaDaEscala = await criar(
      corpoProjetoDemonstracao({ parametros: { colaborativa: { mediaPriori: 0 } } }),
    );
    const justificativas = Object.values(
      semPriori.json<{ ranking: Record<string, { justificativa: string }[]> }>().ranking,
    )
      .flat()
      .map((candidato) => candidato.justificativa);

    expect(semPriori.statusCode).toBe(201);
    expect(justificativas).toContain(
      'média bayesiana 3.00 de 0 avaliação(ões), 0 em projetos similares',
    );
    expect(semPriori.body).not.toMatch(/NaN|Infinity/);
    expect(pesoEnorme.statusCode).toBe(400);
    expect(pesoEnorme.json()).toMatchObject({ codigo: 'PARAMETROS_INVALIDOS' });
    expect(mediaForaDaEscala.json()).toMatchObject({
      codigo: 'PARAMETROS_INVALIDOS',
      mensagem: 'Parâmetros inválidos: colaborativa.mediaPriori deve ser um número entre 1 e 5.',
    });
  });
});
