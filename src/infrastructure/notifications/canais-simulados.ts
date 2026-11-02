import type {
  CaixaMensagens,
  EntradaAuditoria,
  MensagemIntegracao,
  Notificacao,
  PublicadorExterno,
  RegistroAuditoria,
  ServicoEmail,
} from '../../application/ports/canais-saida.js';
import type { Logger } from '../../application/ports/logger.js';
import { HistoricoLimitado } from '../comum/historico-limitado.js';

export class ServicoEmailSimulado implements ServicoEmail {
  readonly enviados = new HistoricoLimitado<Notificacao>();

  constructor(private readonly logger?: Logger) {}

  enviar(notificacao: Notificacao): Promise<void> {
    this.enviados.adicionar(notificacao);
    this.logger?.info({ canal: 'email', ...notificacao }, 'E-mail enviado');
    return Promise.resolve();
  }
}

export class CaixaMensagensMemoria implements CaixaMensagens {
  private readonly porDestinatario = new Map<string, HistoricoLimitado<Notificacao>>();

  entregar(notificacoes: readonly Notificacao[]): Promise<void> {
    for (const notificacao of notificacoes) {
      const caixa =
        this.porDestinatario.get(notificacao.destinatarioId) ??
        new HistoricoLimitado<Notificacao>(100);
      caixa.adicionar(notificacao);
      this.porDestinatario.set(notificacao.destinatarioId, caixa);
    }
    return Promise.resolve();
  }

  mensagensDe(destinatarioId: string): readonly Notificacao[] {
    return [...(this.porDestinatario.get(destinatarioId)?.todos ?? [])].reverse();
  }
}

export class RegistroAuditoriaLog implements RegistroAuditoria {
  readonly entradas = new HistoricoLimitado<EntradaAuditoria>();

  constructor(private readonly logger?: Logger) {}

  registrar(entrada: EntradaAuditoria): Promise<void> {
    this.entradas.adicionar(entrada);
    this.logger?.info({ auditoria: entrada }, `Auditoria: ${entrada.tipo}`);
    return Promise.resolve();
  }
}

export class PublicadorExternoMemoria implements PublicadorExterno {
  readonly publicadas = new HistoricoLimitado<MensagemIntegracao>();

  constructor(private readonly logger?: Logger) {}

  publicar(mensagem: MensagemIntegracao): Promise<void> {
    this.publicadas.adicionar(mensagem);
    this.logger?.info(
      { topico: mensagem.topico, chave: mensagem.chave },
      'Evento publicado para outro microsserviço',
    );
    return Promise.resolve();
  }
}
