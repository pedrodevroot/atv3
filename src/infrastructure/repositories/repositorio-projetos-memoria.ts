import type { RegistroFabricas } from '../../application/familias/registro-fabricas.js';
import type { RepositorioProjetos } from '../../application/ports/repositorio-projetos.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import { deProjeto, paraProjeto, type LinhasProjeto } from '../database/mapeadores.js';

export class RepositorioProjetosMemoria implements RepositorioProjetos {
  private readonly linhas = new Map<string, LinhasProjeto>();
  private readonly profissionais = new Map<string, Profissional>();

  constructor(private readonly fabricas: RegistroFabricas) {}

  obter(id: string): Promise<Projeto | undefined> {
    const linhas = this.linhas.get(id);
    return Promise.resolve(
      linhas ? paraProjeto(linhas, this.profissionais, this.fabricas) : undefined,
    );
  }

  salvar(projeto: Projeto): Promise<void> {
    for (const membro of projeto.equipes.flatMap((equipe) => equipe.membros)) {
      this.profissionais.set(membro.profissional.id, membro.profissional);
    }
    this.linhas.set(projeto.id, deProjeto(projeto));
    return Promise.resolve();
  }
}
