const LIMITE_MEMORIA = 10_000;
const normalizados = new Map<string, string>();

export function chaveTexto(texto: string): string {
  const existente = normalizados.get(texto);
  if (existente !== undefined) {
    return existente;
  }
  const chave = texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
  if (normalizados.size >= LIMITE_MEMORIA) {
    normalizados.clear();
  }
  normalizados.set(texto, chave);
  return chave;
}

export function mesmoTexto(a: string, b: string): boolean {
  return a === b || chaveTexto(a) === chaveTexto(b);
}
