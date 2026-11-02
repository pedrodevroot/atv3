import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { EstrategiaRecomendacao } from '../strategies/estrategia-recomendacao.js';
import { FILTROS_PADRAO, type ContextoPapel } from '../strategies/filtros-candidato.js';
import type { ParametrosRecomendacao } from '../strategies/parametros-recomendacao.js';
import { calcularTetoPapel } from '../strategies/ranqueador.js';

export function precisaoEmK(
  recomendados: readonly string[],
  relevantes: ReadonlySet<string>,
  k: number,
): number {
  if (k <= 0) {
    return 0;
  }
  const acertos = recomendados.slice(0, k).filter((id) => relevantes.has(id)).length;
  return acertos / k;
}

export interface CandidatoAvaliado {
  readonly profissional: Profissional;
  readonly qualidade: number;
}

export interface ConfiguracaoAvaliada {
  readonly rotulo: string;
  readonly estrategia: EstrategiaRecomendacao;
  readonly parametros: ParametrosRecomendacao;
}

export interface ResultadoPrecisao {
  readonly rotulo: string;
  readonly precisao: number;
  readonly amostras: number;
}

export interface OpcoesAvaliacaoPrecisao {
  readonly cadastro: readonly CandidatoAvaliado[];
  readonly projetos: readonly Projeto[];
  readonly configuracoes: readonly ConfiguracaoAvaliada[];
  readonly k: number;
  readonly fracaoRelevantes: number;
}

export function avaliarPrecisao(opcoes: OpcoesAvaliacaoPrecisao): ResultadoPrecisao[] {
  const profissionais = opcoes.cadastro.map((candidato) => candidato.profissional);
  const qualidade = new Map(
    opcoes.cadastro.map((candidato) => [candidato.profissional.id, candidato.qualidade]),
  );

  return opcoes.configuracoes.map(({ rotulo, estrategia, parametros }) => {
    let soma = 0;
    let amostras = 0;
    for (const projeto of opcoes.projetos) {
      const ranking = estrategia.recomendar(projeto, profissionais, parametros);
      for (const papel of projeto.papeisObrigatorios) {
        const contexto: ContextoPapel = {
          projeto,
          papel,
          teto: calcularTetoPapel(projeto, papel, parametros.folgaTetoPapel),
          parametros,
        };
        const elegiveis = profissionais.filter((profissional) =>
          FILTROS_PADRAO.every((filtro) => filtro.aceita(profissional, contexto)),
        );
        if (elegiveis.length < opcoes.k) {
          continue;
        }
        const quantidadeRelevantes = Math.max(
          opcoes.k,
          Math.round(elegiveis.length * opcoes.fracaoRelevantes),
        );
        const relevantes = new Set(
          [...elegiveis]
            .sort((a, b) => (qualidade.get(b.id) ?? 0) - (qualidade.get(a.id) ?? 0))
            .slice(0, quantidadeRelevantes)
            .map((profissional) => profissional.id),
        );
        const recomendados = (ranking.get(papel) ?? []).map(
          (candidato) => candidato.profissional.id,
        );
        soma += precisaoEmK(recomendados, relevantes, opcoes.k);
        amostras += 1;
      }
    }
    return { rotulo, precisao: amostras === 0 ? 0 : soma / amostras, amostras };
  });
}
