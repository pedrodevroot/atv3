import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Localizacao } from '../../domain/value-objects/localizacao.js';
import { NomeEstrategia } from './estrategia-recomendacao.js';
import type { ContextoPapel } from './filtros-candidato.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';
import { formatar, limitarEntreZeroEUm, mediaPonderada, normalizarNota } from './pontuacao.js';
import type { Avaliador } from './ranqueador.js';
import { RecomendadorBase } from './recomendador-base.js';

const NOTA_NEUTRA = 0.5;

export class RegrasOrcamento extends RecomendadorBase {
  readonly nome = NomeEstrategia.REGRAS_ORCAMENTO;
  readonly descricao =
    'Regras para orçamento reduzido: teto por papel proporcional ao peso, custo-benefício e preferência por profissionais locais.';

  protected override folgaTeto(parametros: ParametrosRecomendacao): number {
    return parametros.orcamento.folgaTeto;
  }

  protected criarAvaliador({ projeto, teto, parametros }: ContextoPapel): Avaliador {
    const regras = parametros.orcamento;
    const componentes = (profissional: Profissional) => {
      const custo = profissional.faixaPreco.precoNegociado(teto);
      const economia = teto > 0 ? limitarEntreZeroEUm(1 - custo / teto) : 0;
      const nota =
        profissional.totalAvaliacoes === 0 ? NOTA_NEUTRA : normalizarNota(profissional.notaMedia);
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
