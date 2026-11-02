import { NotificadorTipoProjeto, type MensagemDoTipo } from '../notificador-tipo-projeto.js';

export class NotificadorAnimacao extends NotificadorTipoProjeto {
  readonly nome = 'notificador-animacao';

  protected aoRecomendar(projetoId: string, sugeridos: number): MensagemDoTipo {
    return {
      assunto: 'Animação: equipe sugerida para o pipeline',
      corpo: `${sugeridos} profissional(is) sugerido(s) para a animação ${projetoId}. Confirme com efeitos visuais os softwares de modelagem 3D e a estimativa de renderização.`,
    };
  }

  protected aoFormarEquipe(projetoId: string): MensagemDoTipo {
    return {
      assunto: 'Animação: equipe formada',
      corpo: `A equipe da animação ${projetoId} está completa. Próximo passo: reservar a capacidade de renderização.`,
    };
  }
}
