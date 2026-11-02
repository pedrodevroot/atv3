import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { Intervalo } from '../../domain/value-objects/intervalo.js';

export interface CriteriosBusca {
  readonly papeis: readonly Papel[];
  readonly periodo: Intervalo;
  readonly precoMinimoAte: number;
  readonly excluirIds?: readonly string[];
}

export interface ResultadoBusca {
  readonly profissionais: readonly Profissional[];
  readonly parcial: boolean;
  readonly avisos: readonly string[];
}

export interface RepositorioProfissionais {
  buscarCandidatos(criterios: CriteriosBusca): Promise<ResultadoBusca>;
}

export interface FonteCadastroProfissionais {
  listarAtivos(): Promise<Profissional[]>;
}
