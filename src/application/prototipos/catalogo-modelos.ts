import type { AjustesProjeto, Projeto } from '../../domain/entidades/projeto.js';
import { ErroAplicacao, naoEncontrado } from '../erros/erro-aplicacao.js';

export interface ModeloProjeto {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string;
  readonly prototipo: Projeto;
}

export class CatalogoModelos {
  private readonly modelos = new Map<string, ModeloProjeto>();

  constructor(modelos: readonly ModeloProjeto[] = []) {
    for (const modelo of modelos) {
      this.registrar(modelo);
    }
  }

  get ids(): string[] {
    return [...this.modelos.keys()];
  }

  registrar(modelo: ModeloProjeto): void {
    if (this.modelos.has(modelo.id)) {
      throw new ErroAplicacao(
        'PARAMETROS_INVALIDOS',
        `Modelo de projeto "${modelo.id}" registrado mais de uma vez.`,
      );
    }
    this.modelos.set(modelo.id, { ...modelo, prototipo: modelo.prototipo.clonar() });
  }

  listar(): ModeloProjeto[] {
    return [...this.modelos.values()].map((modelo) => ({
      ...modelo,
      prototipo: modelo.prototipo.clonar({ id: modelo.prototipo.id }),
    }));
  }

  clonar(modeloId: string, ajustes: AjustesProjeto = {}): Projeto {
    const modelo = this.modelos.get(modeloId);
    if (!modelo) {
      throw naoEncontrado('Modelo de projeto', modeloId);
    }
    return modelo.prototipo.clonar(ajustes);
  }
}
