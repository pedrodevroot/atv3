import { readFileSync } from 'node:fs';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_AUDITORIA_RECOMENDADOR } from '../../src/application/strategies/decoradores/auditoria-decorator.js';
import { RankingComprimido } from '../../src/application/strategies/decoradores/compressao-decorator.js';
import { NomeEstrategia } from '../../src/application/strategies/estrategia-recomendacao.js';
import { resolverParametros } from '../../src/application/strategies/parametros-recomendacao.js';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';
import { RequisitoPapel } from '../../src/domain/entidades/requisito-papel.js';
import { PAPEIS } from '../../src/domain/enums/papel.js';
import { criarLogger } from '../../src/infrastructure/logging/opcoes-logger.js';
import { RepositorioProfissionaisTypeorm } from '../../src/infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { cadastroDaApi, corpoProjetoDemonstracao } from '../fixtures/api.js';
import { gerarCadastroSintetico, medirMelhorTempo } from '../fixtures/cadastro-sintetico.js';
import { criarProjeto } from '../fixtures/dominio.js';
import { relogioFixo } from '../fixtures/orquestracao.js';
import { limparTabelas, prepararBanco } from './banco.js';

const PILHA_COMPLETA = ['cache', 'auditoria', 'compressao'] as const;

interface Rodada {
  projeto: { id: string; estrategia: string; equipes: { id: string }[] };
  ranking: Record<string, { profissionalId: string; score: number }[]>;
}

describe('Decorator: comportamentos transversais com PostgreSQL real', () => {
  let banco: DataSource;
  let container: Container;
  let app: App;

  async function auditoriasDo(projetoId: string) {
    const entradas = await container.casos.consultas.listarAuditoria(projetoId);
    return entradas.filter((entrada) => entrada.tipo === TIPO_AUDITORIA_RECOMENDADOR);
  }

  async function criarPorApi(sobrescritas: Record<string, unknown> = {}) {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao(sobrescritas),
    });
    expect(resposta.statusCode, resposta.body).toBe(201);
    return resposta.json<Rodada>();
  }

  beforeAll(async () => {
    banco = await prepararBanco();
    await limparTabelas(banco);
    await new RepositorioProfissionaisTypeorm(banco).salvarTodos(cadastroDaApi());
    const config = carregarConfig();
    container = criarContainer(config, criarLogger(config), { relogio: relogioFixo });
    await container.dataSource.initialize();
    app = await construirApp(container);
  });

  beforeEach(() => {
    container.cacheRecomendacoes.limpar();
  });

  afterAll(async () => {
    await app.close();
    await container.encerrar();
    await banco.destroy();
  });

  describe('com 10 mil profissionais', () => {
    const cadastro = gerarCadastroSintetico(10_000);
    const parametros = resolverParametros();
    const projeto = criarProjeto({
      orcamento: 400_000,
      requisitos: PAPEIS.map((papel, indice) => RequisitoPapel.criar(papel, indice + 1)),
    });

    it('o cache reduz o tempo de resposta de requisições repetidas', () => {
      const base = container.registroEstrategias.obter(NomeEstrategia.SIMILARIDADE_COSSENO);
      const recomendar = vi.spyOn(base, 'recomendar');
      const comCache = container.decoradores.montar(base, ['cache']);

      const inicio = performance.now();
      comCache.recomendar(projeto, cadastro, parametros);
      const primeira = performance.now() - inicio;
      const repetida = medirMelhorTempo(3, () => {
        comCache.recomendar(projeto, cadastro, parametros);
      });

      expect(recomendar).toHaveBeenCalledTimes(1);
      expect(repetida).toBeLessThan(primeira / 2);
    });

    it('a compressão reduz o tamanho dos dados sem alterar o ranking', () => {
      const base = container.registroEstrategias.obter(NomeEstrategia.REGRAS_ORCAMENTO);
      const original = base.recomendar(projeto, cadastro, parametros);

      const comprimido = container.decoradores
        .montar(base, ['compressao'])
        .recomendar(projeto, cadastro, parametros) as RankingComprimido;

      expect(comprimido).toBeInstanceOf(RankingComprimido);
      expect(comprimido.tamanhoComprimido).toBeLessThan(comprimido.tamanhoOriginal / 2);
      expect([...comprimido]).toEqual([...original]);
    });

    it('a pilha completa responde dentro do limite de 2 s (RNF01)', () => {
      const base = container.registroEstrategias.obter(NomeEstrategia.FILTRAGEM_COLABORATIVA);
      const decorado = container.decoradores.montar(base, ['auditoria', 'compressao']);

      const duracao = medirMelhorTempo(3, () => {
        decorado.recomendar(projeto, cadastro, parametros);
      });

      expect(duracao).toBeLessThan(2_000);
    });
  });

  it('a auditoria grava no banco cada chamada, com estratégia e tempo de resposta', async () => {
    const { projeto } = await criarPorApi({ decoradores: ['auditoria'] });
    await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/recomendacoes`,
      payload: { decoradores: ['auditoria'] },
    });

    await vi.waitFor(async () => {
      expect(await auditoriasDo(projeto.id)).toHaveLength(2);
    });
    const [entrada] = await auditoriasDo(projeto.id);
    expect(entrada?.tipoAtor).toBe('SISTEMA');
    expect(entrada?.dados).toMatchObject({
      estrategia: 'similaridade-cosseno',
      sucesso: true,
      candidatos: expect.any(Number) as number,
      duracaoMs: expect.any(Number) as number,
    });
  });

  it.each([
    ['cache, auditoria e compressão', ['cache', 'auditoria', 'compressao']],
    ['compressão, auditoria e cache', ['compressao', 'auditoria', 'cache']],
    ['auditoria, compressão e cache', ['auditoria', 'compressao', 'cache']],
    ['só cache', ['cache']],
    ['nenhum', []],
  ])('o resultado da API é igual ao do recomendador base com %s', async (_nome, decoradores) => {
    const puro = await criarPorApi({ decoradores: [] });

    const decorado = await criarPorApi({ decoradores });

    expect(decorado.ranking).toEqual(puro.ranking);
    expect(decorado.projeto.estrategia).toBe(puro.projeto.estrategia);
  });

  it('a pilha funciona também com o recomendador do tipo do projeto', async () => {
    const resposta = await criarPorApi({
      decoradores: PILHA_COMPLETA,
      estrategia: 'recomendador-ficcao',
    });

    expect(resposta.projeto.estrategia).toBe('recomendador-ficcao');
    expect(Object.keys(resposta.ranking).length).toBeGreaterThan(0);
  });

  it('o cache é reaproveitado entre projetos parecidos pela API', async () => {
    await criarPorApi({ decoradores: ['cache'] });
    const acertosAntes = container.cacheRecomendacoes.acertos;

    await criarPorApi({ decoradores: ['cache'] });

    expect(container.cacheRecomendacoes.acertos).toBe(acertosAntes + 1);
  });

  it('a substituição aceita a pilha e não reaproveita o ranking de outra lista de candidatos', async () => {
    const { projeto } = await criarPorApi({ decoradores: ['cache'] });
    const equipeId = projeto.equipes[0]?.id ?? '';
    await app.inject({
      method: 'DELETE',
      url: `/projetos/${projeto.id}/equipes/${equipeId}/membros/EDITOR`,
    });
    const falhasAntes = container.cacheRecomendacoes.falhas;

    const substituicao = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/equipes/${equipeId}/membros/EDITOR/substituicao`,
      payload: { decoradores: ['cache', 'auditoria'] },
    });

    expect(substituicao.statusCode, substituicao.body).toBe(200);
    expect(container.cacheRecomendacoes.falhas).toBe(falhasAntes + 1);
  });

  it('a pilha padrão vem da configuração e o produtor pode sobrescrever por requisição', async () => {
    const config = carregarConfig({ ...process.env, DECORADORES: 'auditoria' });
    const comPolitica = criarContainer(config, criarLogger(config), { relogio: relogioFixo });
    await comPolitica.dataSource.initialize();
    const appPolitica = await construirApp(comPolitica);
    try {
      const padrao = await appPolitica.inject({
        method: 'POST',
        url: '/projetos',
        payload: corpoProjetoDemonstracao(),
      });
      const semPilha = await appPolitica.inject({
        method: 'POST',
        url: '/projetos',
        payload: corpoProjetoDemonstracao({ decoradores: [] }),
      });

      await vi.waitFor(async () => {
        expect(await auditoriasDo(padrao.json<Rodada>().projeto.id)).toHaveLength(1);
      });
      expect(await auditoriasDo(semPilha.json<Rodada>().projeto.id)).toEqual([]);
    } finally {
      await appPolitica.close();
      await comPolitica.encerrar();
    }
  });

  it.each([
    ['decorador desconhecido', ['magia']],
    ['decorador repetido', ['cache', 'cache']],
  ])('a API recusa %s com 400', async (_nome, decoradores) => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao({ decoradores }),
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('SistemaRecomendacao e os recomendadores não conhecem nenhum decorador', () => {
    const arquivos = [
      'src/application/sistema-recomendacao.ts',
      'src/application/strategies/recomendador-base.ts',
      'src/application/strategies/similaridade-cosseno.ts',
      'src/application/strategies/filtragem-colaborativa.ts',
      'src/application/strategies/regras-orcamento.ts',
      'src/application/orchestration/orquestrador-equipe.ts',
    ];
    for (const arquivo of arquivos) {
      expect(readFileSync(arquivo, 'utf8')).not.toMatch(/decorador|Decorator/i);
    }
  });
});
