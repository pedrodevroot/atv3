import { garantir, garantirTexto } from '../comum/erro-dominio.js';

export const NIVEL_COMPETENCIA_MINIMO = 1;
export const NIVEL_COMPETENCIA_MAXIMO = 5;

export class Competencia {
  private constructor(
    readonly nome: string,
    readonly nivel: number,
  ) {}

  static criar(nome: string, nivel: number): Competencia {
    garantir(
      Number.isInteger(nivel) &&
        nivel >= NIVEL_COMPETENCIA_MINIMO &&
        nivel <= NIVEL_COMPETENCIA_MAXIMO,
      `Nível da competência deve ser inteiro entre ${NIVEL_COMPETENCIA_MINIMO} e ${NIVEL_COMPETENCIA_MAXIMO}.`,
    );
    return new Competencia(garantirTexto(nome, 'Nome da competência'), nivel);
  }

  get nivelNormalizado(): number {
    return this.nivel / NIVEL_COMPETENCIA_MAXIMO;
  }
}
