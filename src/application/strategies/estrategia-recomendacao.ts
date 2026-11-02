import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';

export const NomeEstrategia = {
  SIMILARIDADE_COSSENO: 'similaridade-cosseno',
  FILTRAGEM_COLABORATIVA: 'filtragem-colaborativa',
  REGRAS_ORCAMENTO: 'regras-orcamento',
} as const;

export type NomeEstrategia = (typeof NomeEstrategia)[keyof typeof NomeEstrategia];

export interface CandidatoRanqueado {
  readonly profissional: Profissional;
  readonly papel: Papel;
  readonly score: number;
  readonly custoEstimado: number;
  readonly justificativa: string;
}

export type RankingPorPapel = ReadonlyMap<Papel, readonly CandidatoRanqueado[]>;

export interface EstrategiaRecomendacao {
  readonly nome: string;
  readonly descricao: string;
  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel;
}
