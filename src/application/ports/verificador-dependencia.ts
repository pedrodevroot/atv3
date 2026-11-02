export interface VerificadorDependencia {
  readonly nome: string;
  verificar(): Promise<boolean>;
}
