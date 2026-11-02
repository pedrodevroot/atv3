import { NotificadorTipoProjeto, type MensagemDoTipo } from '../notificador-tipo-projeto.js';

export class NotificadorDocumentario extends NotificadorTipoProjeto {
  readonly nome = 'notificador-documentario';

  protected aoRecomendar(projetoId: string, sugeridos: number): MensagemDoTipo {
    return {
      assunto: 'Documentário: equipe sugerida para as entrevistas',
      corpo: `${sugeridos} profissional(is) sugerido(s) para o documentário ${projetoId}. Antes de convidar, alinhe a agenda das entrevistas e a captação de som direto.`,
    };
  }

  protected aoFormarEquipe(projetoId: string): MensagemDoTipo {
    return {
      assunto: 'Documentário: equipe formada',
      corpo: `A equipe do documentário ${projetoId} está completa. Próximo passo: colher as autorizações de uso de imagem dos entrevistados.`,
    };
  }
}
