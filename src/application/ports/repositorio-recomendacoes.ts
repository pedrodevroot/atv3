import type { Recomendacao } from '../../domain/entidades/recomendacao.js';

export interface RepositorioRecomendacoes {
  salvarTodas(recomendacoes: readonly Recomendacao[]): Promise<void>;
  listarPorProjeto(projetoId: string): Promise<Recomendacao[]>;
}
