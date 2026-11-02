import { NotificadorTipoProjeto, type MensagemDoTipo } from '../notificador-tipo-projeto.js';

export class NotificadorPublicitario extends NotificadorTipoProjeto {
  readonly nome = 'notificador-publicitario';

  protected aoRecomendar(projetoId: string, sugeridos: number): MensagemDoTipo {
    return {
      assunto: 'Publicitário: equipe sugerida para a campanha',
      corpo: `${sugeridos} profissional(is) sugerido(s) para a campanha ${projetoId}. Valide com a agência o cronograma de aprovação do cliente antes dos convites.`,
    };
  }

  protected aoFormarEquipe(projetoId: string): MensagemDoTipo {
    return {
      assunto: 'Publicitário: equipe formada',
      corpo: `A equipe da campanha ${projetoId} está completa. Próximo passo: enviar o briefing final da marca.`,
    };
  }
}
