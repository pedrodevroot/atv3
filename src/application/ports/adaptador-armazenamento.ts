export interface MetadadosArquivo {
  readonly projetoId: string;
  readonly nome: string;
  readonly tipoConteudo: string;
}

export interface AdaptadorArmazenamento {
  readonly provedor: string;
  salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string>;
  recuperarArquivo(id: string): Promise<Buffer>;
  listarArquivos(prefixo: string): Promise<string[]>;
}

export function prefixoArquivosDoProjeto(projetoId: string): string {
  return `projetos/${projetoId}/`;
}
