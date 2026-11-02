import { describe, expect, it } from 'vitest';
import { ErroAplicacao } from '../../../../src/application/erros/erro-aplicacao.js';
import { AJUSTES_PERFIL_ANIMACAO } from '../../../../src/application/familias/animacao/recomendador-animacao.js';
import { AJUSTES_PERFIL_DOCUMENTARIO } from '../../../../src/application/familias/documentario/recomendador-documentario.js';
import { CatalogoPerfis } from '../../../../src/application/strategies/catalogo-perfis.js';
import type { EstrategiaRecomendacao } from '../../../../src/application/strategies/estrategia-recomendacao.js';
import {
  FILTROS_PADRAO,
  FiltroAtivo,
  FiltroDisponibilidade,
  FiltroEspecialidade,
  FiltroPreco,
  type ContextoPapel,
} from '../../../../src/application/strategies/filtros-candidato.js';
import {
  PARAMETROS_PADRAO,
  VALOR_MAXIMO_PARAMETRO,
  resolverParametros,
} from '../../../../src/application/strategies/parametros-recomendacao.js';
import {
  arredondar,
  formatar,
  limitarEntreZeroEUm,
  mediaPonderada,
  normalizarNota,
} from '../../../../src/application/strategies/pontuacao.js';
import {
  calcularTetoPapel,
  ranquearPorPapel,
} from '../../../../src/application/strategies/ranqueador.js';
import { RegistroEstrategias } from '../../../../src/application/strategies/registro-estrategias.js';
import { ORCAMENTO_MAXIMO } from '../../../../src/domain/entidades/projeto.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { FaixaPreco } from '../../../../src/domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../../../src/domain/value-objects/intervalo.js';
import { criarRegistroEstrategias } from '../../../../src/container.js';
import { criarProfissional, criarProjeto } from '../../../fixtures/dominio.js';

describe('resolverParametros', () => {
  it('usa os padrões e mescla parâmetros parciais por grupo', () => {
    const parametros = resolverParametros({ topN: 3, cosseno: { pesoExperiencia: 0.5 } });

    expect(parametros.topN).toBe(3);
    expect(parametros.cosseno).toEqual({ ...PARAMETROS_PADRAO.cosseno, pesoExperiencia: 0.5 });
    expect(parametros.orcamento).toEqual(PARAMETROS_PADRAO.orcamento);
    expect(resolverParametros()).toEqual(PARAMETROS_PADRAO);
  });

  it('valida os parâmetros de orquestração', () => {
    expect(() => resolverParametros({ orquestracao: { numeroSugestoes: 11 } })).toThrow(
      'orquestracao.numeroSugestoes deve ser inteiro entre 1 e 10',
    );
    expect(() => resolverParametros({ orquestracao: { scoreMinimo: 1.5 } })).toThrow(
      'orquestracao.scoreMinimo deve ser um número entre 0 e 1',
    );
    expect(() => resolverParametros({ orquestracao: { custoMinimoPorPapel: -1 } })).toThrow(
      `orquestracao.custoMinimoPorPapel deve ser um número entre 0 e ${ORCAMENTO_MAXIMO}`,
    );
    expect(() => resolverParametros({ orquestracao: { numeroSugestoes: -1 } })).toThrow(
      'Parâmetros inválidos: orquestracao.numeroSugestoes deve ser inteiro entre 1 e 10.',
    );
  });

  it('mantém a média a priori na escala das notas e limita os demais números', () => {
    expect(() => resolverParametros({ colaborativa: { mediaPriori: 0 } })).toThrow(
      'colaborativa.mediaPriori deve ser um número entre 1 e 5',
    );
    expect(() => resolverParametros({ colaborativa: { mediaPriori: 5.5 } })).toThrow(
      'colaborativa.mediaPriori deve ser um número entre 1 e 5',
    );
    expect(() =>
      resolverParametros({ colaborativa: { pesoPriori: VALOR_MAXIMO_PARAMETRO + 1 } }),
    ).toThrow(`colaborativa.pesoPriori deve ser um número entre 0 e ${VALOR_MAXIMO_PARAMETRO}`);
    expect(() => resolverParametros({ cosseno: { pesoSimilaridade: 1e308 } })).toThrow(
      'cosseno.pesoSimilaridade deve ser um número entre 0',
    );
    expect(() => resolverParametros({ folgaTetoPapel: Number.POSITIVE_INFINITY })).toThrow(
      'folgaTetoPapel deve ser um número entre 0',
    );
    expect(() =>
      resolverParametros({ orcamento: { limiteOrcamentoReduzido: ORCAMENTO_MAXIMO + 1 } }),
    ).toThrow(`orcamento.limiteOrcamentoReduzido deve ser um número entre 0 e ${ORCAMENTO_MAXIMO}`);
    expect(
      resolverParametros({
        folgaTetoPapel: VALOR_MAXIMO_PARAMETRO,
        colaborativa: { mediaPriori: 1, pesoPriori: VALOR_MAXIMO_PARAMETRO },
        orcamento: { limiteOrcamentoReduzido: ORCAMENTO_MAXIMO },
        orquestracao: { scoreMinimo: 1, custoMinimoPorPapel: ORCAMENTO_MAXIMO },
      }).colaborativa.mediaPriori,
    ).toBe(1);
  });

  it('rejeita topN, números negativos e pesos todos zerados', () => {
    const erro = () =>
      resolverParametros({
        topN: 0,
        folgaTetoPapel: -1,
        cosseno: { pesoSimilaridade: 0, pesoAderencia: 0, pesoExperiencia: 0 },
        orcamento: { pesoEconomia: 0, pesoNota: 0, pesoProximidade: 0 },
      });

    expect(erro).toThrow(ErroAplicacao);
    expect(erro).toThrow(/topN.*folgaTetoPapel.*cosseno.*orcamento/);
  });
});

describe('Filtros de candidato', () => {
  const projeto = criarProjeto();
  const contexto: ContextoPapel = {
    projeto,
    papel: Papel.DIRETOR,
    teto: 20_000,
    parametros: PARAMETROS_PADRAO,
  };

  it('cada filtro verifica uma única regra', () => {
    expect(new FiltroAtivo().aceita(criarProfissional({ ativo: false }))).toBe(false);
    expect(
      new FiltroEspecialidade().aceita(
        criarProfissional({ especialidades: [Papel.EDITOR] }),
        contexto,
      ),
    ).toBe(false);
    expect(
      new FiltroPreco().aceita(
        criarProfissional({ faixaPreco: FaixaPreco.criar(20_001, 30_000) }),
        contexto,
      ),
    ).toBe(false);
    expect(
      new FiltroDisponibilidade().aceita(
        criarProfissional({
          disponibilidades: [Intervalo.criar(new Date('2026-10-01'), new Date('2026-11-01'))],
        }),
        contexto,
      ),
    ).toBe(false);
    expect(FILTROS_PADRAO.every((filtro) => filtro.aceita(criarProfissional(), contexto))).toBe(
      true,
    );
    expect(FILTROS_PADRAO.map((filtro) => filtro.nome)).toEqual([
      'ativo',
      'especialidade',
      'preco',
      'disponibilidade',
    ]);
  });
});

describe('ranquearPorPapel', () => {
  it('calcula o teto do papel pelo peso normalizado e pela folga', () => {
    const projeto = criarProjeto();

    expect(calcularTetoPapel(projeto, Papel.DIRETOR, 0)).toBe(62_500);
    expect(calcularTetoPapel(projeto, Papel.EDITOR, 0.5)).toBe(56_250);
  });

  it('desempata por menor custo e depois por id', () => {
    const projeto = criarProjeto();
    const caro = criarProfissional({ id: 'b-caro', faixaPreco: FaixaPreco.criar(30_000, 30_000) });
    const baratoB = criarProfissional({
      id: 'b-barato',
      faixaPreco: FaixaPreco.criar(10_000, 10_000),
    });
    const baratoA = criarProfissional({
      id: 'a-barato',
      faixaPreco: FaixaPreco.criar(10_000, 10_000),
    });

    const ranking = ranquearPorPapel({
      projeto,
      profissionais: [caro, baratoB, baratoA],
      parametros: PARAMETROS_PADRAO,
      filtros: FILTROS_PADRAO,
      folgaTeto: 0,
      avaliadorPara: () => ({ pontuar: () => 1.7, justificar: () => 'fixo' }),
    });

    const diretores = ranking.get(Papel.DIRETOR) ?? [];
    expect(diretores.map((candidato) => candidato.profissional.id)).toEqual([
      'a-barato',
      'b-barato',
      'b-caro',
    ]);
    expect(diretores[0]?.score).toBe(1);
  });
});

describe('Pontuação', () => {
  it('limita, arredonda, pondera e normaliza', () => {
    expect(limitarEntreZeroEUm(-0.2)).toBe(0);
    expect(limitarEntreZeroEUm(Number.NaN)).toBe(0);
    expect(arredondar(0.123456)).toBe(0.1235);
    expect(
      mediaPonderada([
        [1, 3],
        [0, 1],
      ]),
    ).toBe(0.75);
    expect(mediaPonderada([[1, 0]])).toBe(0);
    expect(normalizarNota(3)).toBe(0.5);
    expect(formatar(1 / 3)).toBe('0.33');
  });
});

describe('CatalogoPerfis', () => {
  it('aplica os ajustes recebidos sem valores negativos e reaproveita o cache', () => {
    const catalogo = new CatalogoPerfis(AJUSTES_PERFIL_DOCUMENTARIO);
    const documentario = catalogo.perfilPara(Papel.DIRETOR);

    expect(documentario.valor('entrevista')).toBeCloseTo(0.9);
    expect(documentario.valor('direcao-de-atores')).toBeCloseTo(0.4);
    expect(catalogo.perfilPara(Papel.DIRETOR)).toBe(documentario);
    expect(catalogo.perfilPara(Papel.EDITOR).valor('montagem')).toBe(1);
    expect(
      new CatalogoPerfis(AJUSTES_PERFIL_ANIMACAO)
        .perfilPara(Papel.DIRETOR)
        .valor('direcao-de-atores'),
    ).toBeCloseTo(0.4);
  });

  it('sem ajustes devolve o perfil base, que não depende do tipo de projeto', () => {
    expect(new CatalogoPerfis().perfilPara(Papel.DIRETOR).valor('direcao-de-atores')).toBe(1);
    expect(new CatalogoPerfis().perfilPara(Papel.DIRETOR).valor('entrevista')).toBe(0);
  });
});

describe('RegistroEstrategias', () => {
  const registro = criarRegistroEstrategias();

  it('lista as três estratégias do PDF', () => {
    expect(registro.nomes).toEqual([
      'similaridade-cosseno',
      'filtragem-colaborativa',
      'regras-orcamento',
    ]);
    expect(registro.listar()).toHaveLength(3);
    expect(registro.existe('regras-orcamento')).toBe(true);
    expect(registro.existe('aleatoria')).toBe(false);
  });

  it('falha com mensagem útil para estratégia desconhecida', () => {
    expect(() => registro.obter('aleatoria')).toThrow(
      expect.objectContaining({ codigo: 'ESTRATEGIA_DESCONHECIDA' }) as Error,
    );
    expect(() => registro.obter('aleatoria')).toThrow(/Disponíveis: similaridade-cosseno/);
  });

  it('sugere regras de orçamento para orçamento reduzido', () => {
    expect(registro.sugerirPara(30_000, PARAMETROS_PADRAO)).toBe('regras-orcamento');
    expect(registro.sugerirPara(500_000, PARAMETROS_PADRAO)).toBe('similaridade-cosseno');
  });

  it('aceita novas estratégias sem alterar código existente e impede nomes duplicados', () => {
    const aleatoria: EstrategiaRecomendacao = {
      nome: 'aleatoria',
      descricao: 'estratégia de exemplo para extensão',
      recomendar: () => new Map(),
    };
    const estendido = new RegistroEstrategias([...registro.listar(), aleatoria]);

    expect(estendido.obter('aleatoria')).toBe(aleatoria);
    expect(() => new RegistroEstrategias([aleatoria, aleatoria])).toThrow('mais de uma vez');
  });
});
