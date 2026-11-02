import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Localizacao } from '../../domain/value-objects/localizacao.js';
import {
  NomeEstrategia,
  type EstrategiaRecomendacao,
  type RankingPorPapel,
} from './estrategia-recomendacao.js';
import { FILTROS_PADRAO, type FiltroCandidato } from './filtros-candidato.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';
import { formatar, limitarEntreZeroEUm, mediaPonderada, normalizarNota } from './pontuacao.js';
import { ranquearPorPapel } from './ranqueador.js';

const NOTA_NEUTRA = 0.5;

export class RegrasOrcamento implements EstrategiaRecomendacao {
  readonly nome = NomeEstrategia.REGRAS_ORCAMENTO;
  readonly descricao =
    'Regras para orçamento reduzido: teto por papel proporcional ao peso, custo-benefício e preferência por profissionais locais.';

  constructor(private readonly filtros: readonly FiltroCandidato[] = FILTROS_PADRAO) {}

  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel {
    const regras = parametros.orcamento;
    return ranquearPorPapel({
      projeto,
      profissionais,
      parametros,
      filtros: this.filtros,
      folgaTeto: regras.folgaTeto,
      avaliadorPara: ({ teto }) => {
        const componentes = (profissional: Profissional) => {
          const custo = profissional.faixaPreco.precoNegociado(teto);
          const economia = teto > 0 ? limitarEntreZeroEUm(1 - custo / teto) : 0;
          const nota =
            profissional.totalAvaliacoes === 0
              ? NOTA_NEUTRA
              : normalizarNota(profissional.notaMedia);
          const proximidade = calcularProximidade(
            profissional.localizacao,
            projeto.localizacao,
            regras.raioKm,
          );
          return { custo, economia, nota, proximidade };
        };
        return {
          pontuar: (profissional) => {
            const { economia, nota, proximidade } = componentes(profissional);
            return mediaPonderada([
              [economia, regras.pesoEconomia],
              [nota, regras.pesoNota],
              [proximidade, regras.pesoProximidade],
            ]);
          },
          justificar: (profissional) => {
            const { custo, nota, proximidade } = componentes(profissional);
            return `custo ${formatar(custo)} de teto ${formatar(teto)}; nota ${formatar(nota)}; proximidade ${formatar(proximidade)}`;
          },
        };
      },
    });
  }
}

function calcularProximidade(origem: Localizacao, destino: Localizacao, raioKm: number): number {
  if (origem.mesmaCidade(destino)) {
    return 1;
  }
  if (raioKm === 0) {
    return 0;
  }
  return limitarEntreZeroEUm(1 - origem.distanciaKm(destino) / raioKm);
}
