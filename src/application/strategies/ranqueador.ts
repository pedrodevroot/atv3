import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { CandidatoRanqueado, RankingPorPapel } from './estrategia-recomendacao.js';
import type { ContextoPapel, FiltroCandidato } from './filtros-candidato.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';
import { arredondar, limitarEntreZeroEUm } from './pontuacao.js';

export interface Avaliador {
  pontuar(profissional: Profissional): number;
  justificar(profissional: Profissional): string;
}

export interface OpcoesRanqueamento {
  readonly projeto: Projeto;
  readonly profissionais: readonly Profissional[];
  readonly parametros: ParametrosRecomendacao;
  readonly filtros: readonly FiltroCandidato[];
  readonly folgaTeto: number;
  avaliadorPara(contexto: ContextoPapel): Avaliador;
}

interface Pontuado {
  readonly profissional: Profissional;
  readonly score: number;
  readonly custo: number;
}

export function calcularTetoPapel(projeto: Projeto, papel: Papel, folga: number): number {
  return projeto.orcamento * projeto.pesoNormalizado(papel) * (1 + folga);
}

export function ranquearPorPapel(opcoes: OpcoesRanqueamento): RankingPorPapel {
  const { projeto, parametros, filtros } = opcoes;
  const ranking = new Map<Papel, CandidatoRanqueado[]>();
  const porPapel = agruparPorPapel(opcoes.profissionais, projeto.papeisObrigatorios);

  for (const papel of projeto.papeisObrigatorios) {
    const contexto: ContextoPapel = {
      projeto,
      papel,
      teto: calcularTetoPapel(projeto, papel, opcoes.folgaTeto),
      parametros,
    };
    const avaliador = opcoes.avaliadorPara(contexto);
    const melhores: Pontuado[] = [];

    for (const profissional of porPapel.get(papel) ?? []) {
      if (!filtros.every((filtro) => filtro.aceita(profissional, contexto))) {
        continue;
      }
      inserirSeEntreMelhores(
        melhores,
        {
          profissional,
          score: arredondar(limitarEntreZeroEUm(avaliador.pontuar(profissional))),
          custo: arredondar(profissional.faixaPreco.precoNegociado(contexto.teto), 2),
        },
        parametros.topN,
      );
    }

    ranking.set(
      papel,
      melhores.map((pontuado) => ({
        profissional: pontuado.profissional,
        papel,
        score: pontuado.score,
        custoEstimado: pontuado.custo,
        justificativa: avaliador.justificar(pontuado.profissional),
      })),
    );
  }

  return ranking;
}

function inserirSeEntreMelhores(melhores: Pontuado[], candidato: Pontuado, limite: number): void {
  const ultimo = melhores.at(-1);
  if (melhores.length >= limite && ultimo && compararPontuados(candidato, ultimo) >= 0) {
    return;
  }
  let posicao = melhores.length;
  while (posicao > 0 && compararPontuados(candidato, melhores[posicao - 1] as Pontuado) < 0) {
    posicao -= 1;
  }
  melhores.splice(posicao, 0, candidato);
  if (melhores.length > limite) {
    melhores.pop();
  }
}

function agruparPorPapel(
  profissionais: readonly Profissional[],
  papeis: readonly Papel[],
): Map<Papel, Profissional[]> {
  const grupos = new Map<Papel, Profissional[]>(papeis.map((papel) => [papel, []]));
  for (const profissional of profissionais) {
    for (const papel of profissional.especialidades) {
      grupos.get(papel)?.push(profissional);
    }
  }
  return grupos;
}

function compararPontuados(a: Pontuado, b: Pontuado): number {
  return (
    b.score - a.score || a.custo - b.custo || compararIds(a.profissional.id, b.profissional.id)
  );
}

function compararIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
