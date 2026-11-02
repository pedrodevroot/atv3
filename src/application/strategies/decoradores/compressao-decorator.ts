import { gunzipSync, gzipSync } from 'node:zlib';
import type { Profissional } from '../../../domain/entidades/profissional.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import type { Papel } from '../../../domain/enums/papel.js';
import type { CandidatoRanqueado, RankingPorPapel } from '../estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from '../parametros-recomendacao.js';
import { DecoradorRecomendacao } from './decorador-recomendacao.js';

interface CandidatoSerializado {
  readonly profissionalId: string;
  readonly score: number;
  readonly custoEstimado: number;
  readonly justificativa: string;
}

type RankingSerializado = readonly (readonly [Papel, readonly CandidatoSerializado[]])[];

export class RankingComprimido implements ReadonlyMap<Papel, readonly CandidatoRanqueado[]> {
  readonly carga: Buffer;
  readonly tamanhoOriginal: number;
  private readonly papeis: readonly Papel[];
  private readonly profissionais: ReadonlyMap<string, Profissional>;

  constructor(ranking: RankingPorPapel) {
    const candidatos = [...ranking.values()].flat();
    const serializado: RankingSerializado = [...ranking].map(([papel, lista]) => [
      papel,
      lista.map((candidato) => ({
        profissionalId: candidato.profissional.id,
        score: candidato.score,
        custoEstimado: candidato.custoEstimado,
        justificativa: candidato.justificativa,
      })),
    ]);
    const original = Buffer.from(JSON.stringify(serializado));
    this.carga = gzipSync(original);
    this.tamanhoOriginal = original.length;
    this.papeis = [...ranking.keys()];
    this.profissionais = new Map(
      candidatos.map((candidato) => [candidato.profissional.id, candidato.profissional]),
    );
  }

  get tamanhoComprimido(): number {
    return this.carga.length;
  }

  get size(): number {
    return this.papeis.length;
  }

  get(papel: Papel): readonly CandidatoRanqueado[] | undefined {
    return this.descomprimir().get(papel);
  }

  has(papel: Papel): boolean {
    return this.papeis.includes(papel);
  }

  forEach(
    callback: (
      value: readonly CandidatoRanqueado[],
      key: Papel,
      map: ReadonlyMap<Papel, readonly CandidatoRanqueado[]>,
    ) => void,
  ): void {
    for (const [papel, lista] of this.descomprimir()) {
      callback(lista, papel, this);
    }
  }

  entries(): MapIterator<[Papel, readonly CandidatoRanqueado[]]> {
    return this.descomprimir().entries();
  }

  keys(): MapIterator<Papel> {
    return this.descomprimir().keys();
  }

  values(): MapIterator<readonly CandidatoRanqueado[]> {
    return this.descomprimir().values();
  }

  [Symbol.iterator](): MapIterator<[Papel, readonly CandidatoRanqueado[]]> {
    return this.entries();
  }

  private descomprimir(): Map<Papel, readonly CandidatoRanqueado[]> {
    const serializado = JSON.parse(gunzipSync(this.carga).toString()) as RankingSerializado;
    return new Map(
      serializado.map(([papel, lista]) => [
        papel,
        lista.map(({ profissionalId, ...candidato }) => ({
          ...candidato,
          papel,
          profissional: this.profissionais.get(profissionalId) as Profissional,
        })),
      ]),
    );
  }
}

export class CompressaoDecorator extends DecoradorRecomendacao {
  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingComprimido {
    return new RankingComprimido(this.interno.recomendar(projeto, profissionais, parametros));
  }
}
