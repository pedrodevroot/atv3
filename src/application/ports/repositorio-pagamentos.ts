import type { Papel } from '../../domain/enums/papel.js';

export interface RegistroPagamento {
  readonly id: string;
  readonly projetoId: string;
  readonly equipeId: string;
  readonly papel: Papel;
  readonly profissionalId: string;
  readonly valor: number;
  readonly provedor: string;
  readonly criadoEm: Date;
  readonly cancelado: boolean;
}

export interface RepositorioPagamentos {
  registrar(pagamento: RegistroPagamento): Promise<void>;
  obter(id: string): Promise<RegistroPagamento | undefined>;
  ativoDoPapel(equipeId: string, papel: Papel): Promise<RegistroPagamento | undefined>;
  marcarCancelado(id: string): Promise<void>;
}
