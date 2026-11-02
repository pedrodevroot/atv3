import type { Profissional } from '../../domain/entidades/profissional.js';
import { CatalogoPerfis } from './catalogo-perfis.js';
import { NomeEstrategia } from './estrategia-recomendacao.js';
import type { ContextoPapel, FiltroCandidato } from './filtros-candidato.js';
import { formatar, mediaPonderada } from './pontuacao.js';
import type { Avaliador } from './ranqueador.js';
import { RecomendadorBase } from './recomendador-base.js';

export class SimilaridadeCosseno extends RecomendadorBase {
  readonly nome = NomeEstrategia.SIMILARIDADE_COSSENO;
  readonly descricao =
    'Compara o vetor de competências do profissional com o perfil ideal do papel.';

  constructor(
    private readonly catalogo: CatalogoPerfis = new CatalogoPerfis(),
    filtros?: readonly FiltroCandidato[],
  ) {
    super(filtros);
  }

  protected criarAvaliador({ papel, parametros }: ContextoPapel): Avaliador {
    const { pesoSimilaridade, pesoAderencia, pesoExperiencia, experienciaSaturacao } =
      parametros.cosseno;
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
  }
}
