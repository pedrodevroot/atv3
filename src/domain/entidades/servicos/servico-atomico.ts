import { PAPEIS, type Papel } from '../../enums/papel.js';
import { PESO_MAXIMO } from '../requisito-papel.js';
import type { DadosServicoAtomico, RequisitoServico, ServicoProjeto } from './servico-projeto.js';

export const PESO_PADRAO_SERVICO = 1;

export class ServicoAtomico implements ServicoProjeto {
  readonly nome: string;
  readonly papel: Papel;
  readonly custo: number;
  readonly prazoDias: number;
  readonly peso: number;

  private constructor(dados: DadosServicoAtomico) {
    this.nome = dados.nome;
    this.papel = dados.papel;
    this.custo = dados.custo;
    this.prazoDias = dados.prazoDias;
    this.peso = dados.peso ?? PESO_PADRAO_SERVICO;
  }

  static criar(dados: DadosServicoAtomico): ServicoAtomico {
    return new ServicoAtomico(dados);
  }

  calcularCusto(): number {
    return this.custo;
  }

  listarSubservicos(): readonly ServicoProjeto[] {
    return [];
  }

  obterPrazo(): number {
    return this.prazoDias;
  }

  validar(): readonly string[] {
    const identificacao = `Serviço "${this.nome}"`;
    const problemas: string[] = [];
    if (this.nome.trim().length === 0) {
      problemas.push('Serviço sem nome.');
    }
    if (!PAPEIS.includes(this.papel)) {
      problemas.push(`${identificacao}: papel ${this.papel} não existe.`);
    }
    if (!Number.isFinite(this.custo) || this.custo < 0) {
      problemas.push(`${identificacao}: custo não pode ser negativo.`);
    }
    if (!Number.isInteger(this.prazoDias) || this.prazoDias < 0) {
      problemas.push(`${identificacao}: prazo deve ser um número inteiro de dias.`);
    }
    if (!Number.isFinite(this.peso) || this.peso <= 0 || this.peso > PESO_MAXIMO) {
      problemas.push(`${identificacao}: peso deve ser maior que 0 e no máximo ${PESO_MAXIMO}.`);
    }
    return problemas;
  }

  listarRequisitos(): readonly RequisitoServico[] {
    return [{ papel: this.papel, peso: this.peso }];
  }

  clonar(): ServicoAtomico {
    return new ServicoAtomico(this.exportar());
  }

  exportar(): DadosServicoAtomico {
    return {
      nome: this.nome,
      papel: this.papel,
      custo: this.custo,
      prazoDias: this.prazoDias,
      peso: this.peso,
    };
  }
}
