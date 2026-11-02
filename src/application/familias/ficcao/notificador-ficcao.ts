import { NotificadorTipoProjeto, type MensagemDoTipo } from '../notificador-tipo-projeto.js';

export class NotificadorFiccao extends NotificadorTipoProjeto {
  readonly nome = 'notificador-ficcao';

  protected aoRecomendar(projetoId: string, sugeridos: number): MensagemDoTipo {
    return {
      assunto: 'Ficção: equipe técnica sugerida',
      corpo: `${sugeridos} profissional(is) sugerido(s) para a ficção ${projetoId}. Marque a leitura de roteiro com a direção antes dos convites.`,
    };
  }

  protected aoFormarEquipe(projetoId: string): MensagemDoTipo {
    return {
      assunto: 'Ficção: equipe formada',
      corpo: `A equipe da ficção ${projetoId} está completa. Próximo passo: fechar o plano de filmagem.`,
    };
  }
}
