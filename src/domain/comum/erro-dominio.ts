export type CodigoErroDominio =
  'VALOR_INVALIDO' | 'REGRA_VIOLADA' | 'TRANSICAO_INVALIDA' | 'NAO_ENCONTRADO';

export class ErroDominio extends Error {
  constructor(
    readonly codigo: CodigoErroDominio,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDominio';
  }
}

export function garantir(
  condicao: boolean,
  mensagem: string,
  codigo: CodigoErroDominio = 'VALOR_INVALIDO',
): asserts condicao {
  if (!condicao) {
    throw new ErroDominio(codigo, mensagem);
  }
}

export function garantirTexto(valor: string, campo: string): string {
  const texto = valor.trim();
  garantir(texto.length > 0, `${campo} é obrigatório.`);
  return texto;
}

export function garantirData(valor: Date, campo: string): Date {
  garantir(!Number.isNaN(valor.getTime()), `${campo} deve ser uma data válida.`);
  return new Date(valor.getTime());
}
