import type { Projeto } from '../../domain/entidades/projeto.js';

export interface RepositorioProjetos {
  obter(id: string): Promise<Projeto | undefined>;
  salvar(projeto: Projeto): Promise<void>;
}
