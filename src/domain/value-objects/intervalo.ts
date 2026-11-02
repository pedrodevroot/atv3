import { garantir, garantirData } from '../comum/erro-dominio.js';

const MILISSEGUNDOS_POR_DIA = 86_400_000;

export class Intervalo {
  private constructor(
    readonly inicio: Date,
    readonly fim: Date,
  ) {}

  static criar(inicio: Date, fim: Date): Intervalo {
    const inicioValido = garantirData(inicio, 'Início do intervalo');
    const fimValido = garantirData(fim, 'Fim do intervalo');
    garantir(
      inicioValido.getTime() <= fimValido.getTime(),
      'O início do intervalo deve ser anterior ou igual ao fim.',
    );
    return new Intervalo(inicioValido, fimValido);
  }

  get duracaoDias(): number {
    return Math.ceil((this.fim.getTime() - this.inicio.getTime()) / MILISSEGUNDOS_POR_DIA);
  }

  sobrepoe(outro: Intervalo): boolean {
    return (
      this.inicio.getTime() <= outro.fim.getTime() && outro.inicio.getTime() <= this.fim.getTime()
    );
  }

  contem(outro: Intervalo): boolean {
    return (
      this.inicio.getTime() <= outro.inicio.getTime() && outro.fim.getTime() <= this.fim.getTime()
    );
  }

  equivale(outro: Intervalo): boolean {
    return (
      this.inicio.getTime() === outro.inicio.getTime() && this.fim.getTime() === outro.fim.getTime()
    );
  }
}
