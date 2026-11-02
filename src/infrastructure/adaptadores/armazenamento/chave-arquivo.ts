import { randomUUID } from 'node:crypto';
import {
  prefixoArquivosDoProjeto,
  type MetadadosArquivo,
} from '../../../application/ports/adaptador-armazenamento.js';

const TAMANHO_MAXIMO_NOME = 120;

export function chaveDoArquivo({ projetoId, nome }: MetadadosArquivo): string {
  const nomeSeguro = nome.replace(/[^\w.-]/g, '_').slice(-TAMANHO_MAXIMO_NOME);
  return `${prefixoArquivosDoProjeto(projetoId)}${randomUUID()}-${nomeSeguro}`;
}

export function chaveDoId(id: string, uriBase: string, provedor: string): string {
  if (!id.startsWith(uriBase)) {
    throw new Error(`O arquivo ${id} não pertence ao provedor ${provedor}.`);
  }
  return id.slice(uriBase.length);
}
