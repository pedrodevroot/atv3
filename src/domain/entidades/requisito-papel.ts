import { garantir } from '../comum/erro-dominio.js';
import type { Papel } from '../enums/papel.js';

export const PESO_MAXIMO = 10;

export class RequisitoPapel {
  private constructor(
    readonly papel: Papel,
    readonly peso: number,
  ) {}

  static criar(papel: Papel, peso: number): RequisitoPapel {
    garantir(
      Number.isFinite(peso) && peso > 0 && peso <= PESO_MAXIMO,
      `Peso de ${papel} deve ser maior que 0 e no máximo ${PESO_MAXIMO}.`,
    );
    return new RequisitoPapel(papel, peso);
  }
}
