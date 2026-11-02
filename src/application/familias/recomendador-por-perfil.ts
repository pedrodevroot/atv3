import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import { CatalogoPerfis, type AjustesPerfil } from '../strategies/catalogo-perfis.js';
import type {
  EstrategiaRecomendacao,
  RankingPorPapel,
} from '../strategies/estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from '../strategies/parametros-recomendacao.js';
import { SimilaridadeCosseno } from '../strategies/similaridade-cosseno.js';

export class RecomendadorPorPerfil implements EstrategiaRecomendacao {
  private readonly cosseno: SimilaridadeCosseno;

  constructor(
    readonly nome: string,
    readonly descricao: string,
    readonly ajustes: AjustesPerfil,
  ) {
    this.cosseno = new SimilaridadeCosseno(new CatalogoPerfis(ajustes));
  }

  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel {
    const ajustes = this.ajustesPara?.(projeto) ?? this.ajustes;
    const estrategia =
      ajustes === this.ajustes
        ? this.cosseno
        : new SimilaridadeCosseno(new CatalogoPerfis(ajustes));
    return estrategia.recomendar(projeto, profissionais, parametros);
  }

  protected ajustesPara?(projeto: Projeto): AjustesPerfil;
}
