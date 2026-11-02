import type { Logger } from '../../application/ports/logger.js';
import { relogioDoSistema, type Relogio } from '../../application/ports/relogio.js';
import type {
  CriteriosBusca,
  FonteCadastroProfissionais,
  RepositorioProfissionais,
  ResultadoBusca,
} from '../../application/ports/repositorio-profissionais.js';
import type { VerificadorDependencia } from '../../application/ports/verificador-dependencia.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Papel } from '../../domain/enums/papel.js';
import {
  comTempoLimite,
  type DisjuntorCircuito,
  type EstadoCircuito,
} from '../resiliencia/disjuntor.js';
import { atendeCriterios } from './filtro-candidatos.js';

export interface OpcoesCadastroResiliente {
  readonly ttlMs: number;
  readonly timeoutMs: number;
  readonly variacaoTtl?: number;
  readonly aleatorio?: () => number;
}

interface Snapshot {
  readonly porPapel: ReadonlyMap<Papel, readonly Profissional[]>;
  readonly total: number;
  readonly carregadoEm: number;
  readonly expiraEm: number;
}

export interface EstadoCadastro {
  readonly circuito: EstadoCircuito;
  readonly profissionaisEmCache: number;
  readonly idadeCacheMs: number | null;
  readonly degradado: boolean;
}

export class RepositorioProfissionaisResiliente
  implements RepositorioProfissionais, VerificadorDependencia
{
  readonly nome = 'cadastro-profissionais';
  private snapshot: Snapshot | undefined;
  private recarga: Promise<Snapshot> | undefined;
  private degradado = false;

  constructor(
    private readonly fonte: FonteCadastroProfissionais,
    private readonly disjuntor: DisjuntorCircuito,
    private readonly opcoes: OpcoesCadastroResiliente,
    private readonly relogio: Relogio = relogioDoSistema,
    private readonly logger?: Logger,
  ) {}

  get estado(): EstadoCadastro {
    return {
      circuito: this.disjuntor.estado,
      profissionaisEmCache: this.snapshot?.total ?? 0,
      idadeCacheMs: this.snapshot ? this.agora() - this.snapshot.carregadoEm : null,
      degradado: this.degradado,
    };
  }

  async aquecer(): Promise<boolean> {
    try {
      const snapshot = await this.recarregar();
      this.logger?.info({ profissionais: snapshot.total }, 'Cache do cadastro carregado');
      return true;
    } catch (erro) {
      this.logger?.warn({ err: erro }, 'Não foi possível carregar o cache do cadastro');
      return false;
    }
  }

  invalidar(): void {
    this.snapshot = undefined;
  }

  verificar(): Promise<boolean> {
    if (this.snapshot === undefined) {
      this.recarregarEmSegundoPlano();
    }
    return Promise.resolve(this.snapshot !== undefined && this.disjuntor.estado !== 'ABERTO');
  }

  async buscarCandidatos(criterios: CriteriosBusca): Promise<ResultadoBusca> {
    const atual = this.snapshot;
    if (atual) {
      if (this.agora() >= atual.expiraEm) {
        this.recarregarEmSegundoPlano();
      }
      return this.responder(atual, criterios);
    }
    try {
      return this.responder(await this.recarregar(), criterios);
    } catch (erro) {
      return {
        profissionais: [],
        parcial: true,
        avisos: [
          `Cadastro de profissionais indisponível (${mensagemDe(erro)}); nenhuma recomendação pôde ser calculada.`,
        ],
      };
    }
  }

  private responder(snapshot: Snapshot, criterios: CriteriosBusca): ResultadoBusca {
    const excluidos = new Set(criterios.excluirIds ?? []);
    const vistos = new Set<string>();
    const profissionais: Profissional[] = [];
    for (const papel of criterios.papeis) {
      for (const profissional of snapshot.porPapel.get(papel) ?? []) {
        if (
          !vistos.has(profissional.id) &&
          !excluidos.has(profissional.id) &&
          atendeCriterios(profissional, criterios)
        ) {
          vistos.add(profissional.id);
          profissionais.push(profissional);
        }
      }
    }
    const avisos = this.degradado
      ? [
          `Repositório de profissionais indisponível; usando cadastro em cache de ${new Date(snapshot.carregadoEm).toISOString()}.`,
        ]
      : [];
    return { profissionais, parcial: this.degradado, avisos };
  }

  private recarregar(): Promise<Snapshot> {
    this.recarga ??= this.disjuntor
      .executar(() =>
        comTempoLimite(this.fonte.listarAtivos(), this.opcoes.timeoutMs, 'Carga do cadastro'),
      )
      .then((profissionais) => {
        const agora = this.agora();
        this.snapshot = indexar(profissionais, agora, agora + this.ttlComVariacao());
        this.degradado = false;
        return this.snapshot;
      })
      .catch((erro: unknown) => {
        this.degradado = this.snapshot !== undefined;
        throw erro;
      })
      .finally(() => {
        this.recarga = undefined;
      });
    return this.recarga;
  }

  private recarregarEmSegundoPlano(): void {
    this.recarregar().catch((erro: unknown) => {
      this.logger?.warn({ err: erro }, 'Falha ao atualizar o cache do cadastro; mantendo snapshot');
    });
  }

  private agora(): number {
    return this.relogio().getTime();
  }

  private ttlComVariacao(): number {
    const variacao = this.opcoes.variacaoTtl ?? 0.2;
    const sorteio = (this.opcoes.aleatorio ?? Math.random)();
    return this.opcoes.ttlMs * (1 - variacao + 2 * variacao * sorteio);
  }
}

function indexar(
  profissionais: readonly Profissional[],
  carregadoEm: number,
  expiraEm: number,
): Snapshot {
  const porPapel = new Map<Papel, Profissional[]>();
  for (const profissional of profissionais) {
    for (const papel of profissional.especialidades) {
      const lista = porPapel.get(papel) ?? [];
      lista.push(profissional);
      porPapel.set(papel, lista);
    }
  }
  return { porPapel, total: profissionais.length, carregadoEm, expiraEm };
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
