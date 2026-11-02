import { mesmoTexto } from '../../domain/comum/texto.js';
import type { Avaliacao } from '../../domain/entidades/avaliacao.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Papel } from '../../domain/enums/papel.js';
import {
  NomeEstrategia,
  type EstrategiaRecomendacao,
  type RankingPorPapel,
} from './estrategia-recomendacao.js';
import { FILTROS_PADRAO, type FiltroCandidato } from './filtros-candidato.js';
import type { ParametrosColaborativa, ParametrosRecomendacao } from './parametros-recomendacao.js';
import { formatar, normalizarNota } from './pontuacao.js';
import { ranquearPorPapel } from './ranqueador.js';

export class FiltragemColaborativa implements EstrategiaRecomendacao {
  readonly nome = NomeEstrategia.FILTRAGEM_COLABORATIVA;
  readonly descricao =
    'Média bayesiana das avaliações históricas, com mais peso para projetos parecidos com o atual.';

  constructor(private readonly filtros: readonly FiltroCandidato[] = FILTROS_PADRAO) {}

  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel {
    const configuracao = parametros.colaborativa;
    return ranquearPorPapel({
      projeto,
      profissionais,
      parametros,
      filtros: this.filtros,
      folgaTeto: parametros.folgaTetoPapel,
      avaliadorPara: ({ papel }) => {
        const componentes = (profissional: Profissional) => {
          let somaPesos = 0;
          let somaNotas = 0;
          let similares = 0;
          for (const avaliacao of profissional.avaliacoes) {
            const peso = pesoDaAvaliacao(avaliacao, projeto, papel, configuracao);
            somaPesos += peso;
            somaNotas += peso * avaliacao.nota;
            if (peso > 1) {
              similares += 1;
            }
          }
          const pesoTotal = configuracao.pesoPriori + somaPesos;
          const mediaBayesiana =
            pesoTotal === 0
              ? configuracao.mediaPriori
              : (configuracao.pesoPriori * configuracao.mediaPriori + somaNotas) / pesoTotal;
          return { mediaBayesiana, similares };
        };
        return {
          pontuar: (profissional) => normalizarNota(componentes(profissional).mediaBayesiana),
          justificar: (profissional) => {
            const { mediaBayesiana, similares } = componentes(profissional);
            return `média bayesiana ${formatar(mediaBayesiana)} de ${profissional.totalAvaliacoes} avaliação(ões), ${similares} em projetos similares`;
          },
        };
      },
    });
  }
}

function pesoDaAvaliacao(
  avaliacao: Avaliacao,
  projeto: Projeto,
  papel: Papel,
  configuracao: ParametrosColaborativa,
): number {
  const mesmoGenero = mesmoTexto(avaliacao.genero, projeto.genero);
  return (
    1 +
    (mesmoGenero ? configuracao.bonusMesmoGenero : 0) +
    (avaliacao.tipoCaptacao === projeto.tipoCaptacao ? configuracao.bonusMesmoTipo : 0) +
    (avaliacao.papel === papel ? configuracao.bonusMesmoPapel : 0) +
    (avaliacao.produtorId === projeto.produtorId ? configuracao.bonusMesmoProdutor : 0)
  );
}
