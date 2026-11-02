import { EventEmitter } from 'node:events';
import {
  TODOS_OS_EVENTOS,
  type Observador,
  type Sujeito,
} from '../../application/ports/observador.js';
import type { EventoRecomendacao } from '../../domain/eventos/evento-recomendacao.js';

export interface FalhaObservador {
  readonly observador: string;
  readonly evento: EventoRecomendacao;
  readonly erro: unknown;
}

export type TratadorFalhaObservador = (falha: FalhaObservador) => void;

interface Inscricao {
  readonly canais: readonly string[];
  readonly ouvinte: (evento: EventoRecomendacao) => void;
}

export class BarramentoEventosEmMemoria implements Sujeito {
  private readonly emissor = new EventEmitter();
  private readonly inscricoes = new Map<Observador, Inscricao>();
  private readonly pendentes = new Set<Promise<void>>();

  constructor(private readonly aoFalhar: TratadorFalhaObservador = () => undefined) {
    this.emissor.setMaxListeners(0);
  }

  get observadores(): string[] {
    return [...this.inscricoes.keys()].map((observador) => observador.nome);
  }

  get entregasPendentes(): number {
    return this.pendentes.size;
  }

  adicionarObservador(observador: Observador): void {
    if (this.inscricoes.has(observador)) {
      return;
    }
    const canais =
      observador.interesses === TODOS_OS_EVENTOS ? [TODOS_OS_EVENTOS] : [...observador.interesses];
    const ouvinte = (evento: EventoRecomendacao) => {
      this.entregar(observador, evento);
    };
    for (const canal of canais) {
      this.emissor.on(canal, ouvinte);
    }
    this.inscricoes.set(observador, { canais, ouvinte });
  }

  removerObservador(observador: Observador): void {
    const inscricao = this.inscricoes.get(observador);
    if (!inscricao) {
      return;
    }
    for (const canal of inscricao.canais) {
      this.emissor.off(canal, inscricao.ouvinte);
    }
    this.inscricoes.delete(observador);
  }

  notificarObservadores(evento: EventoRecomendacao): void {
    this.emissor.emit(evento.tipo, evento);
    this.emissor.emit(TODOS_OS_EVENTOS, evento);
  }

  notificarObservador(observador: Observador, evento: EventoRecomendacao): void {
    if (observador.interesses === TODOS_OS_EVENTOS || observador.interesses.includes(evento.tipo)) {
      this.entregar(observador, evento);
    }
  }

  async aguardarEntregas(): Promise<void> {
    while (this.pendentes.size > 0) {
      await Promise.allSettled([...this.pendentes]);
    }
  }

  private entregar(observador: Observador, evento: EventoRecomendacao): void {
    const entrega: Promise<void> = new Promise<void>((resolver) => setImmediate(resolver))
      .then(() => observador.atualizar(evento))
      .catch((erro: unknown) => {
        this.relatarFalha({ observador: observador.nome, evento, erro });
      })
      .finally(() => {
        this.pendentes.delete(entrega);
      });
    this.pendentes.add(entrega);
  }

  private relatarFalha(falha: FalhaObservador): void {
    try {
      this.aoFalhar(falha);
    } catch {
      return;
    }
  }
}
