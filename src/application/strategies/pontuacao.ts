import { NOTA_MAXIMA, NOTA_MINIMA } from '../../domain/entidades/avaliacao.js';

export function limitarEntreZeroEUm(valor: number): number {
  if (Number.isNaN(valor)) {
    return 0;
  }
  return Math.min(1, Math.max(0, valor));
}

export function arredondar(valor: number, casas = 4): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

export function mediaPonderada(
  termos: readonly (readonly [valor: number, peso: number])[],
): number {
  let somaPesos = 0;
  let soma = 0;
  for (const [valor, peso] of termos) {
    soma += valor * peso;
    somaPesos += peso;
  }
  return somaPesos === 0 ? 0 : soma / somaPesos;
}

export function normalizarNota(nota: number): number {
  return limitarEntreZeroEUm((nota - NOTA_MINIMA) / (NOTA_MAXIMA - NOTA_MINIMA));
}

export function formatar(valor: number): string {
  return arredondar(valor, 2).toFixed(2);
}
