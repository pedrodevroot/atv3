import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import { CatalogoPerfis } from './catalogo-perfis.js';
import {
  NomeEstrategia,
  type EstrategiaRecomendacao,
  type RankingPorPapel,
} from './estrategia-recomendacao.js';
import { FILTROS_PADRAO, type FiltroCandidato } from './filtros-candidato.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';
import { formatar, mediaPonderada } from './pontuacao.js';
import { ranquearPorPapel } from './ranqueador.js';

export class SimilaridadeCosseno implements EstrategiaRecomendacao {
  readonly nome = NomeEstrategia.SIMILARIDADE_COSSENO;
  readonly descricao =
    'Compara o vetor de competências do profissional com o perfil ideal do papel.';

  constructor(
    private readonly catalogo: CatalogoPerfis = new CatalogoPerfis(),
    private readonly filtros: readonly FiltroCandidato[] = FILTROS_PADRAO,
  ) {}

  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel {
    const { pesoSimilaridade, pesoAderencia, pesoExperiencia, experienciaSaturacao } =
      parametros.cosseno;
    return ranquearPorPapel({
      projeto,
      profissionais,
      parametros,
      filtros: this.filtros,
      folgaTeto: parametros.folgaTetoPapel,
      avaliadorPara: ({ papel }) => {
        const perfilIdeal = this.catalogo.perfilPara(papel);
        const componentes = (profissional: Profissional) => {
          const similaridade = perfilIdeal.similaridadeCosseno(profissional.vetorCompetencias);
          const aderencia = profissional.vetorCompetencias.aderenciaA(perfilIdeal);
          const projetosNoPapel = profissional.experienciaComo(papel);
          const experiencia = Math.min(1, projetosNoPapel / Math.max(1, experienciaSaturacao));
          return { similaridade, aderencia, projetosNoPapel, experiencia };
        };
        return {
          pontuar: (profissional) => {
            const { similaridade, aderencia, experiencia } = componentes(profissional);
            return mediaPonderada([
              [similaridade, pesoSimilaridade],
              [aderencia, pesoAderencia],
              [experiencia, pesoExperiencia],
            ]);
          },
          justificar: (profissional) => {
            const { similaridade, aderencia, projetosNoPapel } = componentes(profissional);
            return `cosseno ${formatar(similaridade)}; aderência ${formatar(aderencia)}; ${projetosNoPapel} projeto(s) como ${papel}`;
          },
        };
      },
    });
  }
}
