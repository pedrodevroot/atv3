import type { DataSource } from 'typeorm';
import { RepositorioProfissionaisTypeorm } from '../../repositories/repositorio-profissionais-typeorm.js';
import { emLotes } from '../escrita.js';
import { gerarCadastroProfissionais } from './gerador-cadastro.js';

export interface Semeador {
  readonly nome: string;
  executar(dataSource: DataSource): Promise<number>;
}

export interface OpcoesSemeadura {
  readonly totalProfissionais: number;
  readonly semente: number;
}

export class SemeadorProfissionais implements Semeador {
  readonly nome = 'profissionais';

  constructor(private readonly opcoes: OpcoesSemeadura) {}

  async executar(dataSource: DataSource): Promise<number> {
    const profissionais = gerarCadastroProfissionais(
      this.opcoes.totalProfissionais,
      this.opcoes.semente,
    );
    const repositorio = new RepositorioProfissionaisTypeorm(dataSource);
    await dataSource.query('TRUNCATE profissional RESTART IDENTITY CASCADE');
    for (const lote of emLotes(profissionais, 2_000)) {
      await repositorio.salvarTodos(lote);
    }
    return profissionais.length;
  }
}

export function criarSemeadores(opcoes: OpcoesSemeadura): Semeador[] {
  return [new SemeadorProfissionais(opcoes)];
}
