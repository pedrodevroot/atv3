import { garantir } from '../comum/erro-dominio.js';

export class FaixaPreco {
  private constructor(
    readonly minimo: number,
    readonly maximo: number,
  ) {}

  static criar(minimo: number, maximo: number): FaixaPreco {
    garantir(
      Number.isFinite(minimo) && minimo >= 0,
      'Preço mínimo deve ser um número maior ou igual a zero.',
    );
    garantir(
      Number.isFinite(maximo) && maximo >= minimo,
      'Preço máximo deve ser maior ou igual ao mínimo.',
    );
    return new FaixaPreco(minimo, maximo);
  }

  get media(): number {
    return (this.minimo + this.maximo) / 2;
  }

  contem(valor: number): boolean {
    return valor >= this.minimo && valor <= this.maximo;
  }

  cabeNoOrcamento(teto: number): boolean {
    return this.minimo <= teto;
  }

  precoNegociado(teto: number): number {
    return Math.min(this.media, Math.max(this.minimo, teto));
  }
}
