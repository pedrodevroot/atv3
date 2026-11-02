export const Papel = {
  DIRETOR: 'DIRETOR',
  DIRETOR_FOTOGRAFIA: 'DIRETOR_FOTOGRAFIA',
  SONOPLASTA: 'SONOPLASTA',
  EDITOR: 'EDITOR',
  ROTEIRISTA: 'ROTEIRISTA',
  EFEITOS_VISUAIS: 'EFEITOS_VISUAIS',
} as const;

export type Papel = (typeof Papel)[keyof typeof Papel];

export const PAPEIS: readonly Papel[] = Object.values(Papel);

export function ehPapel(valor: string): valor is Papel {
  return (PAPEIS as readonly string[]).includes(valor);
}
