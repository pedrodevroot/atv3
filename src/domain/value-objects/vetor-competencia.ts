import { garantir } from '../comum/erro-dominio.js';

export function normalizarNomeCompetencia(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export class VetorCompetencia {
  readonly magnitude: number;

  private constructor(private readonly valores: ReadonlyMap<string, number>) {
    let somaQuadrados = 0;
    for (const valor of valores.values()) {
      somaQuadrados += valor * valor;
    }
    this.magnitude = Math.sqrt(somaQuadrados);
  }

  static de(
    entradas: Iterable<readonly [string, number]> | Record<string, number>,
  ): VetorCompetencia {
    const pares = Symbol.iterator in entradas ? entradas : Object.entries(entradas);
    const valores = new Map<string, number>();
    for (const [nome, valor] of pares) {
      garantir(
        Number.isFinite(valor) && valor >= 0,
        `Valor da competência "${nome}" deve ser maior ou igual a zero.`,
      );
      const chave = normalizarNomeCompetencia(nome);
      garantir(chave.length > 0, 'Nome da competência é obrigatório.');
      valores.set(chave, Math.max(valores.get(chave) ?? 0, valor));
    }
    return new VetorCompetencia(valores);
  }

  get dimensoes(): string[] {
    return [...this.valores.keys()];
  }

  get vazio(): boolean {
    return this.magnitude === 0;
  }

  valor(nome: string): number {
    return this.valores.get(normalizarNomeCompetencia(nome)) ?? 0;
  }

  produtoEscalar(outro: VetorCompetencia): number {
    const [menor, maior] =
      this.valores.size <= outro.valores.size
        ? [this.valores, outro.valores]
        : [outro.valores, this.valores];
    let soma = 0;
    for (const [chave, valor] of menor) {
      soma += valor * (maior.get(chave) ?? 0);
    }
    return soma;
  }

  aderenciaA(ideal: VetorCompetencia): number {
    if (ideal.vazio) {
      return 0;
    }
    return Math.min(1, this.produtoEscalar(ideal) / (ideal.magnitude * ideal.magnitude));
  }

  similaridadeCosseno(outro: VetorCompetencia): number {
    if (this.vazio || outro.vazio) {
      return 0;
    }
    return this.produtoEscalar(outro) / (this.magnitude * outro.magnitude);
  }
}
