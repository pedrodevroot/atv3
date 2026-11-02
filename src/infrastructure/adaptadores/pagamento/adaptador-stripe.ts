import {
  StatusPagamento,
  type AdaptadorPagamento,
} from '../../../application/ports/adaptador-pagamento.js';
import type { GatewayPagamento, PerfilGateway } from '../../externos/gateway-pagamento.js';

export const PERFIL_STRIPE: PerfilGateway = {
  sistema: 'stripe',
  prefixoId: 'ch_',
  unidade: 'CENTAVOS',
  statusAprovado: 'succeeded',
  statusEstornado: 'refunded',
};

export class AdaptadorStripe implements AdaptadorPagamento {
  readonly provedor = 'stripe';

  constructor(private readonly gateway: GatewayPagamento) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    const transacao = await this.gateway.processarPagamento(Math.round(valor * 100), {
      pagador: origem,
      recebedor: destino,
      moeda: 'brl',
    });
    return transacao.id;
  }

  cancelarPagamento(id: string): Promise<boolean> {
    return this.gateway.estornarPagamento(id);
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    const status = await this.gateway.consultarStatus(id);
    return status === PERFIL_STRIPE.statusEstornado
      ? StatusPagamento.CANCELADO
      : StatusPagamento.APROVADO;
  }
}
