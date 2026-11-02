import type { Avaliacao } from '../../domain/entidades/avaliacao.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { CriteriosBusca } from './repositorio-profissionais.js';

export type CriteriosProfissional = Partial<CriteriosBusca>;

export interface AdaptadorProfissional {
  readonly provedor: string;
  readonly externo: boolean;
  listarProfissionais(criterios?: CriteriosProfissional): Promise<Profissional[]>;
  detalharProfissional(id: string): Promise<Profissional>;
  registrarAvaliacao(id: string, avaliacao: Avaliacao): Promise<void>;
}

export interface CadastroInterno {
  listarAtivos(): Promise<Profissional[]>;
  obterPorIds(ids: readonly string[]): Promise<Map<string, Profissional>>;
  salvarTodos(profissionais: readonly Profissional[]): Promise<void> | void;
}
