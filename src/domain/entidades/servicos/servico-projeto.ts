import type { Papel } from '../../enums/papel.js';

export interface DadosServicoAtomico {
  readonly nome: string;
  readonly papel: Papel;
  readonly custo: number;
  readonly prazoDias: number;
  readonly peso?: number;
}

export interface DadosPacoteServico {
  readonly nome: string;
  readonly subservicos: readonly DadosServico[];
}

export type DadosServico = DadosServicoAtomico | DadosPacoteServico;

export interface RequisitoServico {
  readonly papel: Papel;
  readonly peso: number;
}

export interface ServicoProjeto {
  readonly nome: string;
  calcularCusto(): number;
  listarSubservicos(): readonly ServicoProjeto[];
  obterPrazo(): number;
  validar(): readonly string[];
  listarRequisitos(): readonly RequisitoServico[];
  clonar(): ServicoProjeto;
  exportar(): DadosServico;
}
