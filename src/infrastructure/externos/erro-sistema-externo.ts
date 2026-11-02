export class ErroSistemaExterno extends Error {
  constructor(
    readonly sistema: string,
    mensagem: string,
  ) {
    super(`${sistema}: ${mensagem}`);
    this.name = 'ErroSistemaExterno';
  }
}
