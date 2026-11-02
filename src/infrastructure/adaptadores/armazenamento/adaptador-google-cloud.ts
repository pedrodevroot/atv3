import { File } from 'node:buffer';
import type {
  AdaptadorArmazenamento,
  MetadadosArquivo,
} from '../../../application/ports/adaptador-armazenamento.js';
import type { ArmazenamentoExterno } from '../../externos/armazenamento-externo.js';
import { chaveDoArquivo, chaveDoId } from './chave-arquivo.js';

const URI_BASE = 'gs://cinebridge-midia/';

export class AdaptadorGoogleCloud implements AdaptadorArmazenamento {
  readonly provedor = 'google-cloud';

  constructor(private readonly externo: ArmazenamentoExterno) {}

  async salvarArquivo(conteudo: Buffer, metadados: MetadadosArquivo): Promise<string> {
    const arquivo = new File([conteudo], chaveDoArquivo(metadados), {
      type: metadados.tipoConteudo,
    });
    return `${URI_BASE}${await this.externo.upload(arquivo)}`;
  }

  async recuperarArquivo(id: string): Promise<Buffer> {
    const arquivo = await this.externo.download(chaveDoId(id, URI_BASE, this.provedor));
    return Buffer.from(await arquivo.arrayBuffer());
  }

  async listarArquivos(prefixo: string): Promise<string[]> {
    const chaves = await this.externo.listar(prefixo);
    return chaves.map((chave) => `${URI_BASE}${chave}`);
  }
}
