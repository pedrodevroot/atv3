import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';

export interface ContextoPapel {
  readonly projeto: Projeto;
  readonly papel: Papel;
  readonly teto: number;
  readonly parametros: ParametrosRecomendacao;
}

export interface FiltroCandidato {
  readonly nome: string;
  aceita(profissional: Profissional, contexto: ContextoPapel): boolean;
}

export class FiltroAtivo implements FiltroCandidato {
  readonly nome = 'ativo';

  aceita(profissional: Profissional): boolean {
    return profissional.ativo;
  }
}

export class FiltroEspecialidade implements FiltroCandidato {
  readonly nome = 'especialidade';

  aceita(profissional: Profissional, contexto: ContextoPapel): boolean {
    return profissional.atuaComo(contexto.papel);
  }
}

export class FiltroPreco implements FiltroCandidato {
  readonly nome = 'preco';

  aceita(profissional: Profissional, contexto: ContextoPapel): boolean {
    return profissional.faixaPreco.cabeNoOrcamento(contexto.teto);
  }
}

export class FiltroDisponibilidade implements FiltroCandidato {
  readonly nome = 'disponibilidade';

  aceita(profissional: Profissional, contexto: ContextoPapel): boolean {
    return profissional.disponivelEm(contexto.projeto.periodo);
  }
}

export const FILTROS_PADRAO: readonly FiltroCandidato[] = Object.freeze([
  new FiltroAtivo(),
  new FiltroEspecialidade(),
  new FiltroPreco(),
  new FiltroDisponibilidade(),
]);
