import {
  StatusPagamento,
  type AdaptadorPagamento,
} from '../../../application/ports/adaptador-pagamento.js';
import type { GatewayPagamento, PerfilGateway } from '../../externos/gateway-pagamento.js';

export const PERFIL_PAGSEGURO: PerfilGateway = {
  sistema: 'pagseguro',
  prefixoId: 'PAGS-',
  unidade: 'REAIS',
  statusAprovado: '3',
  statusEstornado: '7',
};

export class AdaptadorPagSeguro implements AdaptadorPagamento {
  readonly provedor = 'pagseguro';

  constructor(private readonly gateway: GatewayPagamento) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    const transacao = await this.gateway.processarPagamento(Number(valor.toFixed(2)), {
      pagador: origem,
      recebedor: destino,
      moeda: 'BRL',
    });
    return transacao.id;
  }

  cancelarPagamento(id: string): Promise<boolean> {
    return this.gateway.estornarPagamento(id);
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    const status = await this.gateway.consultarStatus(id);
    return status === PERFIL_PAGSEGURO.statusEstornado
      ? StatusPagamento.CANCELADO
      : StatusPagamento.APROVADO;
  }
}
