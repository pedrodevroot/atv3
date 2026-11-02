import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import type {
  AdaptadorArmazenamento,
  MetadadosArquivo,
} from '../../../application/ports/adaptador-armazenamento.js';
import { chaveDoArquivo, chaveDoId } from './chave-arquivo.js';

const URI_BASE = 'local://';

export class AdaptadorLocal implements AdaptadorArmazenamento {
  readonly provedor = 'local';
  private readonly raiz: string;

  constructor(diretorio: string) {
    this.raiz = resolve(diretorio);
  }

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    const chave = chaveDoArquivo(metadados);
    const caminho = this.caminhoDe(chave);
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, conteudo);
    return `${URI_BASE}${chave}`;
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    return readFile(this.caminhoDe(chaveDoId(id, URI_BASE, this.provedor)));
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    await mkdir(this.raiz, { recursive: true });
    const entradas = await readdir(this.raiz, { recursive: true, withFileTypes: true });
    return entradas
      .filter((entrada) => entrada.isFile())
      .map((entrada) =>
        relative(this.raiz, resolve(entrada.parentPath, entrada.name)).split(sep).join('/'),
      )
      .filter((chave) => chave.startsWith(prefixo))
      .sort()
      .map((chave) => `${URI_BASE}${chave}`);
  }

  private caminhoDe(chave: string): string {
    const caminho = resolve(this.raiz, chave);
    if (!caminho.startsWith(`${this.raiz}${sep}`)) {
      throw new Error(`Caminho fora do diretório de arquivos: ${chave}.`);
    }
    return caminho;
  }
}
