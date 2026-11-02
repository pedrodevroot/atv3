import { createHash } from 'node:crypto';
import type { Profissional } from '../../../domain/entidades/profissional.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import { relogioDoSistema, type Relogio } from '../../ports/relogio.js';
import type { RankingPorPapel, RecomendacaoStrategy } from '../estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from '../parametros-recomendacao.js';
import { DecoradorRecomendacao } from './decorador-recomendacao.js';

export interface OpcoesCacheRecomendacoes {
  readonly ttlMs: number;
  readonly maximo: number;
  readonly relogio?: Relogio;
}

interface EntradaCache {
  readonly ranking: RankingPorPapel;
  readonly expiraEm: number;
}

export class CacheRecomendacoes {
  private readonly entradas = new Map<string, EntradaCache>();
  private _acertos = 0;
  private _falhas = 0;

  constructor(private readonly opcoes: OpcoesCacheRecomendacoes) {}

  get acertos(): number {
    return this._acertos;
  }

  get falhas(): number {
    return this._falhas;
  }

  get tamanho(): number {
    return this.entradas.size;
  }

  obter(chave: string): RankingPorPapel | undefined {
    const entrada = this.entradas.get(chave);
    if (entrada && entrada.expiraEm > this.agora()) {
      this._acertos += 1;
      return entrada.ranking;
    }
    this.entradas.delete(chave);
    this._falhas += 1;
    return undefined;
  }

  guardar(chave: string, ranking: RankingPorPapel): void {
    if (this.entradas.size >= this.opcoes.maximo) {
      const maisAntiga = this.entradas.keys().next();
      if (!maisAntiga.done) {
        this.entradas.delete(maisAntiga.value);
      }
    }
    this.entradas.set(chave, { ranking, expiraEm: this.agora() + this.opcoes.ttlMs });
  }

  limpar(): void {
    this.entradas.clear();
  }

  private agora(): number {
    return (this.opcoes.relogio ?? relogioDoSistema)().getTime();
  }
}

export class CacheDecorator extends DecoradorRecomendacao {
  constructor(
    interno: RecomendacaoStrategy,
    private readonly cache: CacheRecomendacoes,
  ) {
    super(interno);
  }

  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel {
    const chave = this.chaveDe(projeto, profissionais, parametros);
    const guardado = this.cache.obter(chave);
    if (guardado) {
      return guardado;
    }
    const ranking = this.interno.recomendar(projeto, profissionais, parametros);
    this.cache.guardar(chave, ranking);
    return ranking;
  }

  private chaveDe(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): string {
    const hash = createHash('sha256').update(
      JSON.stringify({
        estrategia: this.nome,
        tipo: projeto.tipoCaptacao,
        produtor: projeto.produtorId,
        genero: projeto.genero,
        duracao: projeto.duracaoMinutos,
        orcamento: projeto.orcamento,
        inicio: projeto.periodo.inicio,
        fim: projeto.periodo.fim,
        cidade: projeto.localizacao.cidade,
        uf: projeto.localizacao.uf,
        latitude: projeto.localizacao.latitude,
        longitude: projeto.localizacao.longitude,
        requisitos: projeto.requisitos.map(({ papel, peso }) => [papel, peso]),
        detalhes: projeto.detalhes,
        parametros,
      }),
    );
    for (const profissional of profissionais) {
      hash.update(`${profissional.id}:${profissional.totalAvaliacoes};`);
    }
    return hash.digest('hex');
  }
}
