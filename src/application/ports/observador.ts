import type { EventoRecomendacao, TipoEvento } from '../../domain/eventos/evento-recomendacao.js';

export const TODOS_OS_EVENTOS = '*';

export type InteresseObservador = readonly TipoEvento[] | typeof TODOS_OS_EVENTOS;

export interface Observador {
  readonly nome: string;
  readonly interesses: InteresseObservador;
  atualizar(evento: EventoRecomendacao): Promise<void>;
}

export interface Sujeito {
  adicionarObservador(observador: Observador): void;
  removerObservador(observador: Observador): void;
  notificarObservadores(evento: EventoRecomendacao): void;
  notificarObservador(observador: Observador, evento: EventoRecomendacao): void;
}
