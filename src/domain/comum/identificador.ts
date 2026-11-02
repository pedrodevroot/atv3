import { randomUUID } from 'node:crypto';

export function gerarId(): string {
  return randomUUID();
}
