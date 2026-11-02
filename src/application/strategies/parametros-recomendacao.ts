import { NOTA_MAXIMA, NOTA_MINIMA } from '../../domain/entidades/avaliacao.js';
import { ORCAMENTO_MAXIMO } from '../../domain/entidades/projeto.js';
import { ErroAplicacao } from '../erros/erro-aplicacao.js';

export const VALOR_MAXIMO_PARAMETRO = 1_000_000;

interface Limite {
  readonly minimo: number;
  readonly maximo: number;
  readonly inteiro?: boolean;
}

const LIMITE_PADRAO: Limite = { minimo: 0, maximo: VALOR_MAXIMO_PARAMETRO };

const LIMITES = new Map<string, Limite>([
  ['topN', { minimo: 1, maximo: 100, inteiro: true }],
  ['colaborativa.mediaPriori', { minimo: NOTA_MINIMA, maximo: NOTA_MAXIMA }],
  ['orcamento.limiteOrcamentoReduzido', { minimo: 0, maximo: ORCAMENTO_MAXIMO }],
  ['orquestracao.numeroSugestoes', { minimo: 1, maximo: 10, inteiro: true }],
  ['orquestracao.scoreMinimo', { minimo: 0, maximo: 1 }],
  ['orquestracao.custoMinimoPorPapel', { minimo: 0, maximo: ORCAMENTO_MAXIMO }],
]);

export interface ParametrosCosseno {
  pesoSimilaridade: number;
  pesoAderencia: number;
  pesoExperiencia: number;
  experienciaSaturacao: number;
}

export interface ParametrosColaborativa {
  mediaPriori: number;
  pesoPriori: number;
  bonusMesmoGenero: number;
  bonusMesmoTipo: number;
  bonusMesmoPapel: number;
  bonusMesmoProdutor: number;
}

export interface ParametrosOrcamento {
  folgaTeto: number;
  pesoEconomia: number;
  pesoNota: number;
  pesoProximidade: number;
  raioKm: number;
  limiteOrcamentoReduzido: number;
}

export interface ParametrosOrquestracao {
  numeroSugestoes: number;
  scoreMinimo: number;
  custoMinimoPorPapel: number;
}

export interface ParametrosRecomendacao {
  topN: number;
  folgaTetoPapel: number;
  cosseno: ParametrosCosseno;
  colaborativa: ParametrosColaborativa;
  orcamento: ParametrosOrcamento;
  orquestracao: ParametrosOrquestracao;
}

export interface ParametrosRecomendacaoParciais {
  topN?: number;
  folgaTetoPapel?: number;
  cosseno?: Partial<ParametrosCosseno>;
  colaborativa?: Partial<ParametrosColaborativa>;
  orcamento?: Partial<ParametrosOrcamento>;
  orquestracao?: Partial<ParametrosOrquestracao>;
}

export const PARAMETROS_PADRAO: Readonly<ParametrosRecomendacao> = Object.freeze({
  topN: 5,
  folgaTetoPapel: 0.5,
  cosseno: {
    pesoSimilaridade: 0.3,
    pesoAderencia: 0.5,
    pesoExperiencia: 0.2,
    experienciaSaturacao: 5,
  },
  colaborativa: {
    mediaPriori: 3,
    pesoPriori: 5,
    bonusMesmoGenero: 1,
    bonusMesmoTipo: 1,
    bonusMesmoPapel: 1,
    bonusMesmoProdutor: 0.5,
  },
  orcamento: {
    folgaTeto: 0,
    pesoEconomia: 0.5,
    pesoNota: 0.3,
    pesoProximidade: 0.2,
    raioKm: 300,
    limiteOrcamentoReduzido: 50_000,
  },
  orquestracao: {
    numeroSugestoes: 3,
    scoreMinimo: 0.05,
    custoMinimoPorPapel: 1_000,
  },
});

export function resolverParametros(
  parciais: ParametrosRecomendacaoParciais = {},
): ParametrosRecomendacao {
  const parametros: ParametrosRecomendacao = {
    topN: parciais.topN ?? PARAMETROS_PADRAO.topN,
    folgaTetoPapel: parciais.folgaTetoPapel ?? PARAMETROS_PADRAO.folgaTetoPapel,
    cosseno: { ...PARAMETROS_PADRAO.cosseno, ...parciais.cosseno },
    colaborativa: { ...PARAMETROS_PADRAO.colaborativa, ...parciais.colaborativa },
    orcamento: { ...PARAMETROS_PADRAO.orcamento, ...parciais.orcamento },
    orquestracao: { ...PARAMETROS_PADRAO.orquestracao, ...parciais.orquestracao },
  };
  validarParametros(parametros);
  return parametros;
}

function validarParametros(parametros: ParametrosRecomendacao): void {
  const problemas: string[] = [];
  const valores: [string, number][] = [
    ['topN', parametros.topN],
    ['folgaTetoPapel', parametros.folgaTetoPapel],
    ...prefixar('cosseno', parametros.cosseno),
    ...prefixar('colaborativa', parametros.colaborativa),
    ...prefixar('orcamento', parametros.orcamento),
    ...prefixar('orquestracao', parametros.orquestracao),
  ];
  for (const [nome, valor] of valores) {
    const { minimo, maximo, inteiro = false } = LIMITES.get(nome) ?? LIMITE_PADRAO;
    const numerico = inteiro ? Number.isInteger(valor) : Number.isFinite(valor);
    if (!numerico || valor < minimo || valor > maximo) {
      problemas.push(
        `${nome} deve ser ${inteiro ? 'inteiro' : 'um número'} entre ${minimo} e ${maximo}`,
      );
    }
  }
  const somasDePesos: [string, number][] = [
    [
      'cosseno',
      parametros.cosseno.pesoSimilaridade +
        parametros.cosseno.pesoAderencia +
        parametros.cosseno.pesoExperiencia,
    ],
    [
      'orcamento',
      parametros.orcamento.pesoEconomia +
        parametros.orcamento.pesoNota +
        parametros.orcamento.pesoProximidade,
    ],
  ];
  for (const [grupo, soma] of somasDePesos) {
    if (soma <= 0) {
      problemas.push(`os pesos de ${grupo} não podem ser todos zero`);
    }
  }
  if (problemas.length > 0) {
    throw new ErroAplicacao(
      'PARAMETROS_INVALIDOS',
      `Parâmetros inválidos: ${problemas.join('; ')}.`,
    );
  }
}

function prefixar(grupo: string, valores: object): [string, number][] {
  return Object.entries(valores).map(([chave, valor]) => [`${grupo}.${chave}`, Number(valor)]);
}
