import { conflitoConcorrencia } from '../../application/erros/erro-aplicacao.js';
import type {
  RegistroPagamento,
  RepositorioPagamentos,
} from '../../application/ports/repositorio-pagamentos.js';
import type { Papel } from '../../domain/enums/papel.js';

export class RepositorioPagamentosMemoria implements RepositorioPagamentos {
  private readonly pagamentos = new Map<string, RegistroPagamento>();

  async registrar(pagamento: RegistroPagamento): Promise<void> {
    if (await this.ativoDoPapel(pagamento.equipeId, pagamento.papel)) {
      throw conflitoConcorrencia('Pagamento', `de ${pagamento.papel}`);
    }
    this.pagamentos.set(pagamento.id, pagamento);
  }

  obter(id: string): Promise<RegistroPagamento | undefined> {
    return Promise.resolve(this.pagamentos.get(id));
  }

  ativoDoPapel(equipeId: string, papel: Papel): Promise<RegistroPagamento | undefined> {
    return Promise.resolve(
      [...this.pagamentos.values()].find(
        (pagamento) =>
          pagamento.equipeId === equipeId && pagamento.papel === papel && !pagamento.cancelado,
      ),
    );
  }

  marcarCancelado(id: string): Promise<void> {
    const pagamento = this.pagamentos.get(id);
    if (pagamento) {
      this.pagamentos.set(id, { ...pagamento, cancelado: true });
    }
    return Promise.resolve();
  }
}
