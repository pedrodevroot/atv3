import type { EventoRecomendacao } from '../../domain/eventos/evento-recomendacao.js';
import type { ServicoEmail } from '../ports/canais-saida.js';
import type { Observador } from '../ports/observador.js';
import { EVENTOS_NOTIFICAVEIS, entregarNotificacoes } from './compositor-notificacoes.js';

export class NotificadorEmail implements Observador {
  readonly nome = 'notificador-email';
  readonly interesses = EVENTOS_NOTIFICAVEIS;

  constructor(private readonly email: ServicoEmail) {}

  atualizar(evento: EventoRecomendacao): Promise<void> {
    return entregarNotificacoes(evento, (notificacao) => this.email.enviar(notificacao));
  }
}
