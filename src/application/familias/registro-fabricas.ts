import { ErroAplicacao } from '../erros/erro-aplicacao.js';
import type { FabricaProjeto } from './fabrica-projeto.js';

export class RegistroFabricas {
  private readonly fabricas = new Map<string, FabricaProjeto>();

  constructor(fabricas: readonly FabricaProjeto[]) {
    for (const fabrica of fabricas) {
      this.registrar(fabrica);
    }
  }

  get tipos(): string[] {
    return [...this.fabricas.keys()];
  }

  registrar(fabrica: FabricaProjeto): void {
    if (this.fabricas.has(fabrica.tipo)) {
      throw new ErroAplicacao(
        'PARAMETROS_INVALIDOS',
        `Fábrica do tipo "${fabrica.tipo}" registrada mais de uma vez.`,
      );
    }
    this.fabricas.set(fabrica.tipo, fabrica);
  }

  listar(): FabricaProjeto[] {
    return [...this.fabricas.values()];
  }

  existe(tipo: string): boolean {
    return this.fabricas.has(tipo);
  }

  para(tipo: string): FabricaProjeto {
    const fabrica = this.fabricas.get(tipo);
    if (!fabrica) {
      throw new ErroAplicacao(
        'TIPO_PROJETO_DESCONHECIDO',
        `Tipo de projeto "${tipo}" não tem fábrica registrada. Disponíveis: ${this.tipos.join(', ')}.`,
      );
    }
    return fabrica;
  }
}
