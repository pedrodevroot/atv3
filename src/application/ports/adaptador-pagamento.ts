export const StatusPagamento = {
  APROVADO: 'APROVADO',
  CANCELADO: 'CANCELADO',
} as const;

export type StatusPagamento = (typeof StatusPagamento)[keyof typeof StatusPagamento];

export interface AdaptadorPagamento {
  readonly provedor: string;
  efetuarPagamento(valor: number, origem: string, destino: string): Promise<string>;
  cancelarPagamento(id: string): Promise<boolean>;
  verificarPagamento(id: string): Promise<StatusPagamento>;
}
