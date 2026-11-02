import { RequisitoPapel } from '../requisito-papel.js';
import type { Papel } from '../../enums/papel.js';
import { ServicoAtomico } from './servico-atomico.js';
import type {
  DadosPacoteServico,
  DadosServico,
  RequisitoServico,
  ServicoProjeto,
} from './servico-projeto.js';

export const NOME_PACOTE_DO_PROJETO = 'Pacote do projeto';

export class PacoteServico implements ServicoProjeto {
  private readonly subservicos: readonly ServicoProjeto[];

  private constructor(
    readonly nome: string,
    subservicos: readonly ServicoProjeto[],
  ) {
    this.subservicos = [...subservicos];
  }

  static criar(nome: string, subservicos: readonly ServicoProjeto[]): PacoteServico {
    return new PacoteServico(nome, subservicos);
  }

  calcularCusto(): number {
    const total = this.subservicos.reduce((soma, servico) => soma + servico.calcularCusto(), 0);
    return Math.round(total * 100) / 100;
  }

  listarSubservicos(): readonly ServicoProjeto[] {
    return [...this.subservicos];
  }

  obterPrazo(): number {
    return this.subservicos.reduce((soma, servico) => soma + servico.obterPrazo(), 0);
  }

  validar(): readonly string[] {
    const problemas: string[] = [];
    if (this.nome.trim().length === 0) {
      problemas.push('Pacote sem nome.');
    }
    if (this.subservicos.length === 0) {
      problemas.push(`Pacote "${this.nome}" não contém serviços.`);
    }
    return [...problemas, ...this.subservicos.flatMap((servico) => servico.validar())];
  }

  listarRequisitos(): readonly RequisitoServico[] {
    return this.subservicos.flatMap((servico) => servico.listarRequisitos());
  }

  clonar(): PacoteServico {
    return new PacoteServico(
      this.nome,
      this.subservicos.map((servico) => servico.clonar()),
    );
  }

  exportar(): DadosPacoteServico {
    return {
      nome: this.nome,
      subservicos: this.subservicos.map((servico) => servico.exportar()),
    };
  }
}

export function servicoDeDados(dados: DadosServico): ServicoProjeto {
  return 'subservicos' in dados
    ? PacoteServico.criar(dados.nome, dados.subservicos.map(servicoDeDados))
    : ServicoAtomico.criar(dados);
}

export function pacoteDeRequisitos(requisitos: readonly RequisitoPapel[]): PacoteServico {
  return PacoteServico.criar(
    NOME_PACOTE_DO_PROJETO,
    requisitos.map((requisito) =>
      ServicoAtomico.criar({
        nome: `Serviço de ${requisito.papel}`,
        papel: requisito.papel,
        custo: 0,
        prazoDias: 0,
        peso: requisito.peso,
      }),
    ),
  );
}

export function requisitosDoServico(servico: ServicoProjeto): RequisitoPapel[] {
  const pesos = new Map<Papel, number>();
  for (const { papel, peso } of servico.listarRequisitos()) {
    pesos.set(papel, Math.max(pesos.get(papel) ?? 0, peso));
  }
  return [...pesos].map(([papel, peso]) => RequisitoPapel.criar(papel, peso));
}
