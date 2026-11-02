import { ErroDominio, garantir, garantirData, garantirTexto } from '../comum/erro-dominio.js';
import { gerarId } from '../comum/identificador.js';
import type { Papel } from '../enums/papel.js';
import { StatusEquipe } from '../enums/status.js';
import { Intervalo } from '../value-objects/intervalo.js';
import { Localizacao } from '../value-objects/localizacao.js';
import type { VisitanteProjeto, Visitavel } from '../visitante/visitante-projeto.js';
import type { Equipe } from './equipe.js';
import type { MembroEquipe } from './membro-equipe.js';
import { RequisitoPapel } from './requisito-papel.js';

export const LIMIAR_REAVALIACAO_PADRAO = 0.15;
export const ORCAMENTO_MAXIMO = 999_999_999_999;
export const DURACAO_MAXIMA_MINUTOS = 100_000;

export type DetalhesProjeto = Readonly<Record<string, unknown>>;

export interface DadosProjeto {
  id?: string;
  titulo: string;
  produtorId: string;
  genero: string;
  duracaoMinutos: number;
  orcamento: number;
  dataInicio: Date;
  dataEntrega: Date;
  localizacao: Localizacao;
  requisitos: readonly RequisitoPapel[];
  estrategia: string;
  equipes?: readonly Equipe[];
  criadoEm?: Date;
}

export interface DadosCriacaoProjeto extends DadosProjeto {
  detalhes?: DetalhesProjeto;
}

export interface AjustesProjeto {
  id?: string;
  titulo?: string;
  produtorId?: string;
  genero?: string;
  duracaoMinutos?: number;
  orcamento?: number;
  dataInicio?: Date;
  dataEntrega?: Date;
  localizacao?: Localizacao;
  requisitos?: readonly RequisitoPapel[];
  estrategia?: string;
  criadoEm?: Date;
  detalhes?: DetalhesProjeto;
}

export interface AlteracaoProjeto {
  orcamento?: number;
  dataEntrega?: Date;
}

export interface ResultadoReavaliacao {
  significativa: boolean;
  variacaoOrcamento: number;
  variacaoPrazoDias: number;
}

export abstract class Projeto implements Visitavel {
  abstract readonly tipoCaptacao: string;
  readonly id: string;
  readonly titulo: string;
  readonly produtorId: string;
  readonly genero: string;
  readonly duracaoMinutos: number;
  readonly localizacao: Localizacao;
  readonly requisitos: readonly RequisitoPapel[];
  readonly criadoEm: Date;
  private _orcamento: number;
  private _periodo: Intervalo;
  private _estrategia: string;
  private readonly _equipes: Equipe[];

  protected constructor(dados: DadosProjeto) {
    garantir(
      Number.isInteger(dados.duracaoMinutos) && dados.duracaoMinutos > 0,
      'Duração deve ser um número inteiro de minutos maior que zero.',
    );
    garantir(
      dados.duracaoMinutos <= DURACAO_MAXIMA_MINUTOS,
      `Duração deve ser de no máximo ${DURACAO_MAXIMA_MINUTOS} minutos.`,
    );
    Projeto.validarOrcamento(dados.orcamento);
    garantir(dados.requisitos.length > 0, 'Projeto precisa de ao menos um papel obrigatório.');
    const papeis = dados.requisitos.map((requisito) => requisito.papel);
    garantir(new Set(papeis).size === papeis.length, 'Papéis obrigatórios não podem se repetir.');
    const periodo = Intervalo.criar(dados.dataInicio, dados.dataEntrega);
    garantir(periodo.duracaoDias > 0, 'Data de entrega deve ser posterior à data de início.');
    const id = dados.id ?? gerarId();
    const equipes = dados.equipes ?? [];
    garantir(
      equipes.every((equipe) => equipe.projetoId === id),
      'Equipes devem pertencer ao projeto.',
      'REGRA_VIOLADA',
    );

    this.id = id;
    this.titulo = garantirTexto(dados.titulo, 'Título do projeto');
    this.produtorId = garantirTexto(dados.produtorId, 'Produtor do projeto');
    this.genero = garantirTexto(dados.genero, 'Gênero do projeto');
    this.duracaoMinutos = dados.duracaoMinutos;
    this._orcamento = dados.orcamento;
    this._periodo = periodo;
    this.localizacao = dados.localizacao;
    this.requisitos = [...dados.requisitos];
    this._estrategia = garantirTexto(dados.estrategia, 'Estratégia do projeto');
    this._equipes = [...equipes];
    this.criadoEm = garantirData(dados.criadoEm ?? new Date(), 'Data de criação do projeto');
  }

  abstract get detalhes(): DetalhesProjeto;

  abstract clonar(ajustes?: AjustesProjeto): Projeto;

  ajustarDetalhes(novos: DetalhesProjeto): void {
    this.garantirSemEquipeFormada();
    this.aplicarDetalhes({ ...this.detalhes, ...novos });
  }

  protected abstract aplicarDetalhes(detalhes: DetalhesProjeto): void;

  protected dadosDoClone(ajustes: AjustesProjeto): DadosProjeto {
    return {
      id: ajustes.id ?? gerarId(),
      titulo: ajustes.titulo ?? this.titulo,
      produtorId: ajustes.produtorId ?? this.produtorId,
      genero: ajustes.genero ?? this.genero,
      duracaoMinutos: ajustes.duracaoMinutos ?? this.duracaoMinutos,
      orcamento: ajustes.orcamento ?? this._orcamento,
      dataInicio: new Date((ajustes.dataInicio ?? this._periodo.inicio).getTime()),
      dataEntrega: new Date((ajustes.dataEntrega ?? this._periodo.fim).getTime()),
      localizacao: Localizacao.criar(ajustes.localizacao ?? this.localizacao),
      requisitos: (ajustes.requisitos ?? this.requisitos).map((requisito) =>
        RequisitoPapel.criar(requisito.papel, requisito.peso),
      ),
      estrategia: ajustes.estrategia ?? this._estrategia,
      criadoEm: ajustes.criadoEm ?? new Date(),
    };
  }

  protected detalhesDoClone(ajustes: AjustesProjeto): DetalhesProjeto {
    return { ...this.detalhes, ...ajustes.detalhes };
  }

  get orcamento(): number {
    return this._orcamento;
  }

  get periodo(): Intervalo {
    return this._periodo;
  }

  get dataEntrega(): Date {
    return this._periodo.fim;
  }

  get estrategia(): string {
    return this._estrategia;
  }

  get papeisObrigatorios(): Papel[] {
    return this.requisitos.map((requisito) => requisito.papel);
  }

  get equipes(): readonly Equipe[] {
    return [...this._equipes];
  }

  get equipesAtivas(): Equipe[] {
    return this._equipes.filter((equipe) => equipe.ativa);
  }

  get equipeFormada(): Equipe | undefined {
    return this._equipes.find((equipe) => equipe.status === StatusEquipe.FORMADA);
  }

  pesoDe(papel: Papel): number {
    return this.requisitos.find((requisito) => requisito.papel === papel)?.peso ?? 0;
  }

  pesoNormalizado(papel: Papel): number {
    const total = this.requisitos.reduce((soma, requisito) => soma + requisito.peso, 0);
    return this.pesoDe(papel) / total;
  }

  definirEstrategia(estrategia: string): void {
    this._estrategia = garantirTexto(estrategia, 'Estratégia do projeto');
  }

  equipe(equipeId: string): Equipe {
    const equipe = this._equipes.find((candidata) => candidata.id === equipeId);
    if (!equipe) {
      throw new ErroDominio('NAO_ENCONTRADO', `Equipe ${equipeId} não pertence ao projeto.`);
    }
    return equipe;
  }

  registrarSugestoes(equipes: readonly Equipe[]): void {
    this.garantirSemEquipeFormada();
    garantir(equipes.length > 0, 'Informe ao menos uma sugestão de equipe.');
    garantir(
      equipes.every((equipe) => equipe.projetoId === this.id),
      'Equipes devem pertencer ao projeto.',
      'REGRA_VIOLADA',
    );
    for (const equipe of this.equipesAtivas) {
      equipe.descartar();
    }
    this._equipes.push(...equipes);
  }

  aceitarRecomendacao(equipeId: string, papel: Papel): MembroEquipe {
    return this.equipe(equipeId).convidarMembro(papel);
  }

  rejeitarRecomendacao(equipeId: string, papel: Papel): MembroEquipe {
    return this.equipe(equipeId).rejeitarMembro(papel);
  }

  substituirMembro(equipeId: string, novo: MembroEquipe): MembroEquipe | undefined {
    garantir(
      this.papeisObrigatorios.includes(novo.papel),
      `${novo.papel} não é um papel obrigatório do projeto.`,
      'REGRA_VIOLADA',
    );
    return this.equipe(equipeId).substituirMembro(novo);
  }

  registrarRespostaConvite(equipeId: string, papel: Papel, aceito: boolean): MembroEquipe {
    return this.equipe(equipeId).registrarRespostaConvite(papel, aceito);
  }

  solicitarReavaliacao(
    alteracao: AlteracaoProjeto,
    limiar = LIMIAR_REAVALIACAO_PADRAO,
  ): ResultadoReavaliacao {
    this.garantirSemEquipeFormada();
    const novoOrcamento = alteracao.orcamento ?? this._orcamento;
    Projeto.validarOrcamento(novoOrcamento);
    const novoPeriodo = Intervalo.criar(
      this._periodo.inicio,
      alteracao.dataEntrega ?? this._periodo.fim,
    );
    garantir(novoPeriodo.duracaoDias > 0, 'Data de entrega deve ser posterior à data de início.');

    const variacaoOrcamento = (novoOrcamento - this._orcamento) / this._orcamento;
    const variacaoPrazoDias = novoPeriodo.duracaoDias - this._periodo.duracaoDias;
    const significativa =
      Math.abs(variacaoOrcamento) >= limiar ||
      Math.abs(variacaoPrazoDias) / this._periodo.duracaoDias >= limiar;

    this._orcamento = novoOrcamento;
    this._periodo = novoPeriodo;
    return { significativa, variacaoOrcamento, variacaoPrazoDias };
  }

  finalizarEquipe(equipeId: string): Equipe {
    this.garantirSemEquipeFormada();
    const equipe = this.equipe(equipeId);
    equipe.finalizar(this.papeisObrigatorios);
    for (const outra of this.equipesAtivas) {
      outra.descartar();
    }
    return equipe;
  }

  aceitar<R>(visitante: VisitanteProjeto<R>): R {
    return visitante.visitarProjeto(this);
  }

  private garantirSemEquipeFormada(): void {
    garantir(
      this.equipeFormada === undefined,
      'Projeto já possui equipe formada.',
      'TRANSICAO_INVALIDA',
    );
  }

  private static validarOrcamento(orcamento: number): void {
    garantir(Number.isFinite(orcamento) && orcamento > 0, 'Orçamento deve ser maior que zero.');
    garantir(orcamento <= ORCAMENTO_MAXIMO, `Orçamento deve ser de no máximo ${ORCAMENTO_MAXIMO}.`);
  }
}
