import { garantir, garantirTexto } from '../../comum/erro-dominio.js';
import { chaveTexto } from '../../comum/texto.js';
import type { DetalhesProjeto } from '../projeto.js';

export const TAMANHO_MAXIMO_TEXTO = 200;
export const ITENS_MAXIMOS_LISTA = 50;

export function garantirCamposConhecidos(
  detalhes: DetalhesProjeto,
  aceitos: readonly string[],
  tipo: string,
): void {
  const desconhecidos = Object.keys(detalhes).filter((campo) => !aceitos.includes(campo));
  garantir(
    desconhecidos.length === 0,
    `Detalhes não reconhecidos para ${tipo}: ${desconhecidos.join(', ')}. Aceitos: ${aceitos.join(', ') || 'nenhum'}.`,
  );
}

export function textoLimitado(valor: string, rotulo: string): string {
  const texto = garantirTexto(valor, rotulo);
  garantir(
    texto.length <= TAMANHO_MAXIMO_TEXTO,
    `${rotulo} deve ter no máximo ${TAMANHO_MAXIMO_TEXTO} caracteres.`,
  );
  return texto;
}

export function lerTexto(detalhes: DetalhesProjeto, campo: string, rotulo: string): string {
  const valor = detalhes[campo];
  garantir(typeof valor === 'string', `${rotulo} é obrigatório.`);
  return textoLimitado(valor, rotulo);
}

export function textosUnicos(valores: readonly string[], rotulo: string): string[] {
  garantir(
    valores.length <= ITENS_MAXIMOS_LISTA,
    `${rotulo} deve ter no máximo ${ITENS_MAXIMOS_LISTA} itens.`,
  );
  const textos = valores.map((valor) => textoLimitado(valor, rotulo));
  garantir(
    new Set(textos.map((texto) => chaveTexto(texto))).size === textos.length,
    `${rotulo} não pode ter itens repetidos.`,
  );
  return textos;
}

export function lerListaDeTextos(
  detalhes: DetalhesProjeto,
  campo: string,
  rotulo: string,
): string[] {
  const valor = detalhes[campo] ?? [];
  garantir(
    Array.isArray(valor) && valor.every((item) => typeof item === 'string'),
    `${rotulo} deve ser uma lista de textos.`,
  );
  return textosUnicos(valor, rotulo);
}

export function lerInteiro(
  detalhes: DetalhesProjeto,
  campo: string,
  rotulo: string,
  limites: { minimo: number; maximo: number; padrao: number },
): number {
  const valor = detalhes[campo] ?? limites.padrao;
  garantir(
    typeof valor === 'number' &&
      Number.isInteger(valor) &&
      valor >= limites.minimo &&
      valor <= limites.maximo,
    `${rotulo} deve ser um inteiro entre ${limites.minimo} e ${limites.maximo}.`,
  );
  return valor;
}

export function lerOpcao<T extends string>(
  detalhes: DetalhesProjeto,
  campo: string,
  rotulo: string,
  opcoes: readonly T[],
): T {
  const valor = detalhes[campo];
  garantir(
    typeof valor === 'string' && (opcoes as readonly string[]).includes(valor),
    `${rotulo} deve ser um de: ${opcoes.join(', ')}.`,
  );
  return valor as T;
}

export function opcoesUnicas<T extends string>(
  valores: readonly string[],
  rotulo: string,
  opcoes: readonly T[],
): T[] {
  garantir(
    valores.every((valor) => (opcoes as readonly string[]).includes(valor)),
    `${rotulo} deve conter apenas: ${opcoes.join(', ')}.`,
  );
  garantir(new Set(valores).size === valores.length, `${rotulo} não pode ter itens repetidos.`);
  return valores as T[];
}
