import type {
  CriteriosBusca,
  RepositorioProfissionais,
  ResultadoBusca,
} from '../../application/ports/repositorio-profissionais.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import { filtrarCandidatos } from './filtro-candidatos.js';

export class RepositorioProfissionaisMemoria implements RepositorioProfissionais {
  private readonly profissionais = new Map<string, Profissional>();

  constructor(iniciais: readonly Profissional[] = []) {
    this.salvarTodos(iniciais);
  }

  salvarTodos(profissionais: readonly Profissional[]): void {
    for (const profissional of profissionais) {
      this.profissionais.set(profissional.id, profissional);
    }
  }

  get total(): number {
    return this.profissionais.size;
  }

  listarAtivos(): Promise<Profissional[]> {
    return Promise.resolve(
      [...this.profissionais.values()].filter((profissional) => profissional.ativo),
    );
  }

  buscarCandidatos(criterios: CriteriosBusca): Promise<ResultadoBusca> {
    return Promise.resolve({
      profissionais: filtrarCandidatos(this.profissionais.values(), criterios),
      parcial: false,
      avisos: [],
    });
  }
}
