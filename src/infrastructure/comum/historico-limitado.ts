export class HistoricoLimitado<T> {
  private readonly itens: T[] = [];

  constructor(private readonly capacidade = 1_000) {}

  adicionar(item: T): void {
    this.itens.push(item);
    if (this.itens.length > this.capacidade) {
      this.itens.shift();
    }
  }

  get todos(): readonly T[] {
    return [...this.itens];
  }

  get total(): number {
    return this.itens.length;
  }
}
