export const PREFIXO_LINKEDIN = 'linkedin:';
export const PREFIXO_INDEED = 'indeed:';

export function ehIdExterno(id: string): boolean {
  return id.startsWith(PREFIXO_LINKEDIN) || id.startsWith(PREFIXO_INDEED);
}
