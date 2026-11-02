import type { EventoRecomendacao, TipoEvento } from '../../domain/eventos/evento-recomendacao.js';
import type { CaixaMensagens } from '../ports/canais-saida.js';
import type { Observador } from '../ports/observador.js';

export interface MensagemDoTipo {
  readonly assunto: string;
  readonly corpo: string;
}

export abstract class NotificadorTipoProjeto implements Observador {
  abstract readonly nome: string;
  readonly interesses: readonly TipoEvento[] = ['RECOMENDACAO_GERADA', 'EQUIPE_FORMADA'];

  constructor(private readonly caixa: CaixaMensagens) {}

  async atualizar(evento: EventoRecomendacao): Promise<void> {
    const mensagem = this.mensagemPara(evento);
    if (mensagem) {
      await this.caixa.entregar([
        {
          destinatarioId: evento.dados.produtorId,
          tipoDestinatario: 'PRODUTOR',
          assunto: mensagem.assunto,
          corpo: mensagem.corpo,
          eventoId: evento.id,
        },
      ]);
    }
  }

  protected abstract aoRecomendar(projetoId: string, sugeridos: number): MensagemDoTipo;

  protected abstract aoFormarEquipe(projetoId: string): MensagemDoTipo;

  private mensagemPara(evento: EventoRecomendacao): MensagemDoTipo | undefined {
    if (evento.tipo === 'RECOMENDACAO_GERADA') {
      return this.aoRecomendar(evento.dados.projetoId, evento.dados.profissionais.length);
    }
    if (evento.tipo === 'EQUIPE_FORMADA') {
      return this.aoFormarEquipe(evento.dados.projetoId);
    }
    return undefined;
  }
}
