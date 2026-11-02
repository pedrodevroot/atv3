import type { EventoRecomendacao } from '../../domain/eventos/evento-recomendacao.js';
import type { CaixaMensagens } from '../ports/canais-saida.js';
import type { Observador } from '../ports/observador.js';
import { EVENTOS_NOTIFICAVEIS, comporNotificacoes } from './compositor-notificacoes.js';

export class NotificadorInterno implements Observador {
  readonly nome = 'notificador-interno';
  readonly interesses = EVENTOS_NOTIFICAVEIS;

  constructor(private readonly caixa: CaixaMensagens) {}

  async atualizar(evento: EventoRecomendacao): Promise<void> {
    const notificacoes = comporNotificacoes(evento);
    if (notificacoes.length > 0) {
      await this.caixa.entregar(notificacoes);
    }
  }
}
