import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { RankingPorPapel, RecomendacaoStrategy } from './estrategia-recomendacao.js';
import { FILTROS_PADRAO, type ContextoPapel, type FiltroCandidato } from './filtros-candidato.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';
import { ranquearPorPapel, type Avaliador } from './ranqueador.js';

export abstract class RecomendadorBase implements RecomendacaoStrategy {
  abstract readonly nome: string;
  abstract readonly descricao: string;

  constructor(private readonly filtros: readonly FiltroCandidato[] = FILTROS_PADRAO) {}

  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel {
    return ranquearPorPapel({
      projeto,
      profissionais,
      parametros,
      filtros: this.filtros,
      folgaTeto: this.folgaTeto(parametros),
      avaliadorPara: (contexto) => this.criarAvaliador(contexto),
    });
  }

  protected folgaTeto(parametros: ParametrosRecomendacao): number {
    return parametros.folgaTetoPapel;
  }

  protected abstract criarAvaliador(contexto: ContextoPapel): Avaliador;
}
