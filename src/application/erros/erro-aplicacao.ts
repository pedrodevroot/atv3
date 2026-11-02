import { ErroDominio } from '../../domain/comum/erro-dominio.js';

export type CodigoErroAplicacao =
  | 'ESTRATEGIA_DESCONHECIDA'
  | 'TIPO_PROJETO_DESCONHECIDO'
  | 'PARAMETROS_INVALIDOS'
  | 'RESTRICAO_VIOLADA'
  | 'FLUXO_INVARIAVEL'
  | 'NAO_ENCONTRADO'
  | 'CONFLITO_CONCORRENCIA';

export class ErroAplicacao extends Error {
  constructor(
    readonly codigo: CodigoErroAplicacao,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
  }
}

export function naoEncontrado(recurso: string, id: string): ErroAplicacao {
  return new ErroAplicacao('NAO_ENCONTRADO', `${recurso} ${id} não encontrado.`);
}

export function conflitoConcorrencia(recurso: string, id: string): ErroAplicacao {
  return new ErroAplicacao(
    'CONFLITO_CONCORRENCIA',
    `${recurso} ${id} foi alterado por outra operação; recarregue e tente novamente.`,
  );
}

export function ehConflitoConcorrencia(erro: unknown): boolean {
  return erro instanceof ErroAplicacao && erro.codigo === 'CONFLITO_CONCORRENCIA';
}

export function ehErroDeNegocio(erro: unknown): erro is ErroAplicacao | ErroDominio {
  return (
    erro instanceof ErroDominio || (erro instanceof ErroAplicacao && !ehConflitoConcorrencia(erro))
  );
}

const ESPERA_BASE_MS = 15;

export async function comNovasTentativas<T>(
  acao: () => Promise<T>,
  tentativas = 6,
  sortear: () => number = Math.random,
): Promise<T> {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      return await acao();
    } catch (erro) {
      if (!ehConflitoConcorrencia(erro) || tentativa >= tentativas) {
        throw erro;
      }
      const espera = ESPERA_BASE_MS * tentativa * (0.5 + sortear());
      await new Promise((resolver) => setTimeout(resolver, espera));
    }
  }
}
