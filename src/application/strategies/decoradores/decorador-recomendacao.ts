import type { Profissional } from '../../../domain/entidades/profissional.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import type { RankingPorPapel, RecomendacaoStrategy } from '../estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from '../parametros-recomendacao.js';

export abstract class DecoradorRecomendacao implements RecomendacaoStrategy {
  constructor(protected readonly interno: RecomendacaoStrategy) {}

  get nome(): string {
    return this.interno.nome;
  }

  get descricao(): string {
    return this.interno.descricao;
  }

  abstract recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel;
}
