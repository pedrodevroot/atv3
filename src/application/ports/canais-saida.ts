export type TipoDestinatario = 'PRODUTOR' | 'PROFISSIONAL';

export interface Notificacao {
  readonly destinatarioId: string;
  readonly tipoDestinatario: TipoDestinatario;
  readonly assunto: string;
  readonly corpo: string;
  readonly eventoId: string;
}

export interface ServicoEmail {
  enviar(notificacao: Notificacao): Promise<void>;
}

export interface CaixaMensagens {
  entregar(notificacoes: readonly Notificacao[]): Promise<void>;
}

export interface EntradaAuditoria {
  readonly eventoId: string;
  readonly tipo: string;
  readonly ocorridoEm: string;
  readonly origem: string;
  readonly correlacaoId?: string;
  readonly projetoId: string;
  readonly atorId: string;
  readonly tipoAtor: TipoDestinatario | 'SISTEMA';
  readonly dados: object;
}

export interface RegistroAuditoria {
  registrar(entrada: EntradaAuditoria): Promise<void>;
}

export interface MensagemIntegracao {
  readonly topico: string;
  readonly chave: string;
  readonly conteudo: object;
}

export interface PublicadorExterno {
  publicar(mensagem: MensagemIntegracao): Promise<void>;
}
