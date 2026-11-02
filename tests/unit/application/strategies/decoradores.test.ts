import { describe, expect, it, vi } from 'vitest';
import type {
  EntradaAuditoria,
  RegistroAuditoria,
} from '../../../../src/application/ports/canais-saida.js';
import {
  AuditoriaDecorator,
  TIPO_AUDITORIA_RECOMENDADOR,
} from '../../../../src/application/strategies/decoradores/auditoria-decorator.js';
import {
  CacheDecorator,
  CacheRecomendacoes,
} from '../../../../src/application/strategies/decoradores/cache-decorator.js';
import {
  CompressaoDecorator,
  RankingComprimido,
} from '../../../../src/application/strategies/decoradores/compressao-decorator.js';
import { MontadorDecoradores } from '../../../../src/application/strategies/decoradores/montador-decoradores.js';
import { NomeEstrategia } from '../../../../src/application/strategies/estrategia-recomendacao.js';
import { resolverParametros } from '../../../../src/application/strategies/parametros-recomendacao.js';
import { RecomendadorBase } from '../../../../src/application/strategies/recomendador-base.js';
import { criarRegistroEstrategias, criarRegistroFabricas } from '../../../../src/container.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { CaixaMensagensMemoria } from '../../../../src/infrastructure/notifications/canais-simulados.js';
import {
  criarCadastroDemonstracao,
  criarProjetoDemonstracao,
} from '../../../fixtures/cadastro-demonstracao.js';
import { criarProjeto } from '../../../fixtures/dominio.js';

const parametros = resolverParametros();

function ambiente() {
  const estrategias = criarRegistroEstrategias();
  const base = estrategias.obter(NomeEstrategia.SIMILARIDADE_COSSENO);
  const recomendar = vi.spyOn(base, 'recomendar');
  const cache = new CacheRecomendacoes({ ttlMs: 1_000, maximo: 10 });
  const entradas: EntradaAuditoria[] = [];
  const auditoria: RegistroAuditoria = {
    registrar: (entrada) => {
      entradas.push(entrada);
      return Promise.resolve();
    },
  };
  return {
    estrategias,
    base,
    recomendar,
    cache,
    entradas,
    auditoria,
    projeto: criarProjetoDemonstracao(),
    cadastro: criarCadastroDemonstracao(),
  };
}

function resumo(
  ranking: Iterable<[Papel, readonly { profissional: { id: string }; score: number }[]]>,
) {
  return [...ranking].map(([papel, candidatos]) => [
    papel,
    candidatos.map((candidato) => [candidato.profissional.id, candidato.score]),
  ]);
}

describe('RecomendadorBase', () => {
  it('é a base de todas as estratégias da ATVI', () => {
    for (const estrategia of criarRegistroEstrategias().listar()) {
      expect(estrategia).toBeInstanceOf(RecomendadorBase);
    }
  });
});

describe('CacheDecorator', () => {
  it('responde a segunda chamada sem acionar o recomendador interno', () => {
    const { base, recomendar, cache, projeto, cadastro } = ambiente();
    const decorado = new CacheDecorator(base, cache);

    const primeira = decorado.recomendar(projeto, cadastro, parametros);
    const segunda = decorado.recomendar(projeto, cadastro, parametros);

    expect(segunda).toBe(primeira);
    expect(recomendar).toHaveBeenCalledTimes(1);
    expect(cache.acertos).toBe(1);
    expect(cache.falhas).toBe(1);
  });

  it('reaproveita o resultado entre projetos com as mesmas características', () => {
    const { base, recomendar, cache, cadastro } = ambiente();
    const decorado = new CacheDecorator(base, cache);

    decorado.recomendar(criarProjetoDemonstracao(), cadastro, parametros);
    decorado.recomendar(criarProjetoDemonstracao(), cadastro, parametros);

    expect(recomendar).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['o orçamento', { orcamento: 90_000 }],
    ['o gênero', { genero: 'comédia' }],
    ['o produtor', { produtorId: 'outro-produtor' }],
  ])('não reaproveita quando %s muda', (_campo, sobrescrita) => {
    const { base, recomendar, cache, projeto, cadastro } = ambiente();
    const decorado = new CacheDecorator(base, cache);

    decorado.recomendar(projeto, cadastro, parametros);
    decorado.recomendar(
      criarProjeto({ requisitos: projeto.requisitos, ...sobrescrita }),
      cadastro,
      parametros,
    );

    expect(recomendar).toHaveBeenCalledTimes(2);
  });

  it('não reaproveita quando a lista de candidatos ou os parâmetros mudam', () => {
    const { base, recomendar, cache, projeto, cadastro } = ambiente();
    const decorado = new CacheDecorator(base, cache);

    decorado.recomendar(projeto, cadastro, parametros);
    decorado.recomendar(projeto, cadastro.slice(1), parametros);
    decorado.recomendar(projeto, cadastro, resolverParametros({ topN: 2 }));

    expect(recomendar).toHaveBeenCalledTimes(3);
  });

  it('expira a entrada depois do TTL', () => {
    let agora = 0;
    const { base, recomendar, projeto, cadastro } = ambiente();
    const cache = new CacheRecomendacoes({
      ttlMs: 100,
      maximo: 10,
      relogio: () => new Date(agora),
    });
    const decorado = new CacheDecorator(base, cache);

    decorado.recomendar(projeto, cadastro, parametros);
    agora = 101;
    decorado.recomendar(projeto, cadastro, parametros);

    expect(recomendar).toHaveBeenCalledTimes(2);
  });

  it('respeita o máximo de entradas descartando a mais antiga', () => {
    const cache = new CacheRecomendacoes({ ttlMs: 1_000, maximo: 2 });
    const ranking = new Map();

    cache.guardar('a', ranking);
    cache.guardar('b', ranking);
    cache.guardar('c', ranking);

    expect(cache.tamanho).toBe(2);
    expect(cache.obter('a')).toBeUndefined();
    expect(cache.obter('c')).toBe(ranking);

    cache.limpar();
    expect(cache.tamanho).toBe(0);
  });
});

describe('AuditoriaDecorator', () => {
  it('registra cada chamada com o tempo de resposta e o resultado', () => {
    const { base, entradas, auditoria, projeto, cadastro } = ambiente();
    const decorado = new AuditoriaDecorator(base, auditoria);

    decorado.recomendar(projeto, cadastro, parametros);
    decorado.recomendar(projeto, cadastro, parametros);

    expect(entradas).toHaveLength(2);
    expect(entradas[0]).toMatchObject({
      tipo: TIPO_AUDITORIA_RECOMENDADOR,
      projetoId: projeto.id,
      tipoAtor: 'SISTEMA',
      dados: {
        estrategia: NomeEstrategia.SIMILARIDADE_COSSENO,
        candidatos: cadastro.length,
        sucesso: true,
      },
    });
    expect((entradas[0]?.dados as { duracaoMs: number }).duracaoMs).toBeGreaterThanOrEqual(0);
  });

  it('registra a falha e repassa o erro', () => {
    const { base, entradas, auditoria, projeto, cadastro } = ambiente();
    vi.spyOn(base, 'recomendar').mockImplementation(() => {
      throw new Error('falhou');
    });
    const decorado = new AuditoriaDecorator(base, auditoria);

    expect(() => decorado.recomendar(projeto, cadastro, parametros)).toThrow('falhou');
    expect(entradas[0]?.dados).toMatchObject({ sucesso: false, erro: 'falhou' });
  });

  it('uma falha ao gravar a auditoria não derruba a recomendação', async () => {
    const { base, projeto, cadastro } = ambiente();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const decorado = new AuditoriaDecorator(
      base,
      { registrar: () => Promise.reject(new Error('banco fora')) },
      undefined,
      logger,
    );

    expect(decorado.recomendar(projeto, cadastro, parametros).size).toBeGreaterThan(0);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });
});

describe('CompressaoDecorator', () => {
  it('reduz o tamanho e mantém o conteúdo idêntico ao do recomendador base', () => {
    const { base, projeto, cadastro } = ambiente();
    const original = base.recomendar(projeto, cadastro, parametros);

    const comprimido = new CompressaoDecorator(base).recomendar(projeto, cadastro, parametros);

    expect(comprimido).toBeInstanceOf(RankingComprimido);
    expect(comprimido.tamanhoComprimido).toBeLessThan(comprimido.tamanhoOriginal);
    expect(comprimido.carga).toHaveLength(comprimido.tamanhoComprimido);
    expect([...comprimido]).toEqual([...original]);
  });

  it('implementa a interface completa de um mapa somente leitura', () => {
    const { base, projeto, cadastro } = ambiente();
    const original = base.recomendar(projeto, cadastro, parametros);
    const comprimido = new CompressaoDecorator(base).recomendar(projeto, cadastro, parametros);
    const visitados: Papel[] = [];

    comprimido.forEach((_lista, papel) => visitados.push(papel));

    expect(comprimido.size).toBe(original.size);
    expect(comprimido.has(Papel.DIRETOR)).toBe(true);
    expect(comprimido.has(Papel.ROTEIRISTA)).toBe(original.has(Papel.ROTEIRISTA));
    expect(comprimido.get(Papel.DIRETOR)).toEqual(original.get(Papel.DIRETOR));
    expect([...comprimido.keys()]).toEqual([...original.keys()]);
    expect([...comprimido.values()]).toEqual([...original.values()]);
    expect([...comprimido.entries()]).toEqual([...original.entries()]);
    expect(visitados).toEqual([...original.keys()]);
  });
});

describe('MontadorDecoradores', () => {
  function montador(padrao: readonly ('cache' | 'auditoria' | 'compressao')[] = []) {
    const contexto = ambiente();
    return {
      ...contexto,
      montador: new MontadorDecoradores(
        {
          cache: contexto.cache,
          auditoria: contexto.auditoria,
          fabricas: criarRegistroFabricas({ caixa: new CaixaMensagensMemoria() }),
          estrategias: contexto.estrategias,
        },
        padrao,
      ),
    };
  }

  it('o decorador mantém o nome e a descrição do recomendador interno', () => {
    const { montador: pilhas, base } = montador();

    const decorado = pilhas.montar(base, ['cache', 'auditoria', 'compressao']);

    expect(decorado).not.toBe(base);
    expect(decorado.nome).toBe(base.nome);
    expect(decorado.descricao).toBe(base.descricao);
  });

  it('o primeiro item é aplicado primeiro e fica mais perto do recomendador', () => {
    const { montador: pilhas, base } = montador();

    expect(pilhas.montar(base, ['cache', 'compressao'])).toBeInstanceOf(CompressaoDecorator);
    expect(pilhas.montar(base, ['compressao', 'cache'])).toBeInstanceOf(CacheDecorator);
  });

  it('sem decoradores devolve o próprio recomendador', () => {
    const { montador: pilhas, base } = montador();

    expect(pilhas.montar(base)).toBe(base);
  });

  it('recusa pilha com itens repetidos', () => {
    const { montador: pilhas, base } = montador();

    expect(() => pilhas.montar(base, ['cache', 'cache'])).toThrow('não pode repetir');
    expect(() => montador(['auditoria', 'auditoria'])).toThrow('não pode repetir');
  });

  it('sem pilha, paraProjeto mantém o pedido original por nome', () => {
    const { montador: pilhas, projeto } = montador();

    expect(pilhas.paraProjeto(projeto, {})).toBeUndefined();
    expect(pilhas.paraProjeto(projeto, { estrategia: 'regras-orcamento' })).toBe(
      'regras-orcamento',
    );
  });

  it('com pilha, paraProjeto decora a estratégia pedida, a do projeto ou a do tipo', () => {
    const { montador: pilhas, projeto } = montador(['auditoria']);

    const pedida = pilhas.paraProjeto(projeto, { estrategia: 'regras-orcamento' });
    const doProjeto = pilhas.paraProjeto(projeto, {});
    const doTipo = pilhas.paraProjeto(projeto, { estrategia: 'recomendador-ficcao' });

    expect(pedida).toMatchObject({ nome: 'regras-orcamento' });
    expect(doProjeto).toMatchObject({ nome: projeto.estrategia });
    expect(doTipo).toMatchObject({ nome: 'recomendador-ficcao' });
  });

  it('a preferência do pedido prevalece sobre a política padrão', () => {
    const { montador: pilhas, projeto } = montador(['auditoria']);

    expect(pilhas.paraProjeto(projeto, { decoradores: [] })).toBeUndefined();
    expect(pilhas.paraProjeto(projeto, { decoradores: ['compressao'] })).toBeInstanceOf(
      CompressaoDecorator,
    );
  });

  it('todas as ordens produzem o mesmo ranking do recomendador base', () => {
    const { montador: pilhas, base, projeto, cadastro } = montador();
    const esperado = resumo(base.recomendar(projeto, cadastro, parametros));
    const ordens = [
      ['cache', 'auditoria', 'compressao'],
      ['cache', 'compressao', 'auditoria'],
      ['auditoria', 'cache', 'compressao'],
      ['auditoria', 'compressao', 'cache'],
      ['compressao', 'cache', 'auditoria'],
      ['compressao', 'auditoria', 'cache'],
    ] as const;

    for (const ordem of ordens) {
      const decorado = pilhas.montar(base, ordem);
      expect(resumo(decorado.recomendar(projeto, cadastro, parametros))).toEqual(esperado);
    }
  });

  it('a ordem muda o comportamento: auditoria por fora registra os acertos do cache', () => {
    const fora = montador();
    const auditoriaPorFora = fora.montador.montar(fora.base, ['cache', 'auditoria']);
    auditoriaPorFora.recomendar(fora.projeto, fora.cadastro, parametros);
    auditoriaPorFora.recomendar(fora.projeto, fora.cadastro, parametros);

    const dentro = montador();
    const auditoriaPorDentro = dentro.montador.montar(dentro.base, ['auditoria', 'cache']);
    auditoriaPorDentro.recomendar(dentro.projeto, dentro.cadastro, parametros);
    auditoriaPorDentro.recomendar(dentro.projeto, dentro.cadastro, parametros);

    expect(fora.entradas).toHaveLength(2);
    expect(dentro.entradas).toHaveLength(1);
  });
});
