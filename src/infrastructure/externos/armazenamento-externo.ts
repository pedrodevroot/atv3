import { File } from 'node:buffer';
import { ErroSistemaExterno } from './erro-sistema-externo.js';

export interface ObjetoExterno {
  readonly chave: string;
  readonly tipoConteudo: string;
  readonly conteudo: Buffer;
}

export interface DepositoObjetos {
  gravar(sistema: string, objeto: ObjetoExterno): Promise<void>;
  ler(sistema: string, chave: string): Promise<ObjetoExterno | undefined>;
  listar(sistema: string, prefixo: string): Promise<string[]>;
}

export class DepositoObjetosMemoria implements DepositoObjetos {
  private readonly objetos = new Map<string, Map<string, ObjetoExterno>>();

  gravar(sistema: string, objeto: ObjetoExterno): Promise<void> {
    const doSistema = this.objetos.get(sistema) ?? new Map<string, ObjetoExterno>();
    doSistema.set(objeto.chave, objeto);
    this.objetos.set(sistema, doSistema);
    return Promise.resolve();
  }

  ler(sistema: string, chave: string): Promise<ObjetoExterno | undefined> {
    return Promise.resolve(this.objetos.get(sistema)?.get(chave));
  }

  listar(sistema: string, prefixo: string): Promise<string[]> {
    const chaves = [...(this.objetos.get(sistema)?.keys() ?? [])];
    return Promise.resolve(chaves.filter((chave) => chave.startsWith(prefixo)).sort());
  }
}

export class ArmazenamentoExterno {
  constructor(
    readonly sistema: string,
    private readonly deposito: DepositoObjetos,
  ) {}

  async upload(arquivo: File): Promise<string> {
    await this.deposito.gravar(this.sistema, {
      chave: arquivo.name,
      tipoConteudo: arquivo.type,
      conteudo: Buffer.from(await arquivo.arrayBuffer()),
    });
    return arquivo.name;
  }

  async download(id: string): Promise<File> {
    const objeto = await this.deposito.ler(this.sistema, id);
    if (!objeto) {
      throw new ErroSistemaExterno(this.sistema, `objeto ${id} não existe.`);
    }
    return new File([objeto.conteudo], objeto.chave, { type: objeto.tipoConteudo });
  }

  listar(pasta: string): Promise<string[]> {
    return this.deposito.listar(this.sistema, pasta);
  }
}
