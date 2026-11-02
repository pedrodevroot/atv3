import { ErroDominio, garantir, garantirData, garantirTexto } from '../comum/erro-dominio.js';
import { gerarId } from '../comum/identificador.js';
import type { Papel } from '../enums/papel.js';
import { StatusEquipe, StatusMembro } from '../enums/status.js';
import type { VisitanteProjeto, Visitavel } from '../visitante/visitante-projeto.js';
import type { MembroEquipe } from './membro-equipe.js';

export interface DadosEquipe {
  id?: string;
  projetoId: string;
  estrategia: string;
  membros: readonly MembroEquipe[];
  status?: StatusEquipe;
  rodada?: number;
  criadaEm?: Date;
  descartados?: readonly string[];
}

export class Equipe implements Visitavel {
  private readonly _membros: Map<Papel, MembroEquipe>;
  private readonly _descartados: Set<string>;

  private constructor(
    readonly id: string,
    readonly projetoId: string,
    readonly estrategia: string,
    membros: readonly MembroEquipe[],
    private _status: StatusEquipe,
    private _rodada: number,
    readonly criadaEm: Date,
    descartados: readonly string[],
  ) {
    this._membros = new Map(membros.map((membro) => [membro.papel, membro]));
    this._descartados = new Set(descartados);
  }

  static criar(dados: DadosEquipe): Equipe {
    const papeis = dados.membros.map((membro) => membro.papel);
    garantir(new Set(papeis).size === papeis.length, 'Uma equipe não pode repetir papéis.');
    const rodada = dados.rodada ?? 1;
    garantir(Number.isInteger(rodada) && rodada >= 1, 'Rodada deve ser inteira e >= 1.');
    return new Equipe(
      dados.id ?? gerarId(),
      garantirTexto(dados.projetoId, 'Projeto da equipe'),
      garantirTexto(dados.estrategia, 'Estratégia da equipe'),
      dados.membros,
      dados.status ?? StatusEquipe.SUGERIDA,
      rodada,
      garantirData(dados.criadaEm ?? new Date(), 'Data de criação da equipe'),
      dados.descartados ?? [],
    );
  }

  get status(): StatusEquipe {
    return this._status;
  }

  get profissionaisDescartados(): readonly string[] {
    return [...this._descartados];
  }

  get rodada(): number {
    return this._rodada;
  }

  get membros(): readonly MembroEquipe[] {
    return [...this._membros.values()];
  }

  get custoTotal(): number {
    return this.membros.reduce((soma, membro) => soma + membro.custo, 0);
  }

  get ativa(): boolean {
    return this._status === StatusEquipe.SUGERIDA || this._status === StatusEquipe.EM_FORMACAO;
  }

  membro(papel: Papel): MembroEquipe | undefined {
    return this._membros.get(papel);
  }

  papeisVagos(requisitos: readonly Papel[]): Papel[] {
    return requisitos.filter((papel) => !this._membros.has(papel));
  }

  membrosFixos(excetoPapel?: Papel): MembroEquipe[] {
    return this.membros.filter((membro) => membro.papel !== excetoPapel);
  }

  convidarMembro(papel: Papel): MembroEquipe {
    this.garantirModificavel();
    const membro = this.obterMembro(papel);
    membro.convidar();
    this._status = StatusEquipe.EM_FORMACAO;
    return membro;
  }

  rejeitarMembro(papel: Papel): MembroEquipe {
    this.garantirModificavel();
    const membro = this.obterMembro(papel);
    this.garantirNaoConfirmado(membro);
    this._membros.delete(papel);
    this._descartados.add(membro.profissional.id);
    this._status = StatusEquipe.EM_FORMACAO;
    return membro;
  }

  substituirMembro(novo: MembroEquipe): MembroEquipe | undefined {
    this.garantirModificavel();
    const anterior = this._membros.get(novo.papel);
    if (anterior) {
      this.garantirNaoConfirmado(anterior);
    }
    garantir(
      novo.status === StatusMembro.SUGERIDO,
      'O substituto deve entrar como sugestão.',
      'REGRA_VIOLADA',
    );
    garantir(
      !this._descartados.has(novo.profissional.id),
      `${novo.profissional.nome} já foi descartado nesta equipe.`,
      'REGRA_VIOLADA',
    );
    if (anterior) {
      this._descartados.add(anterior.profissional.id);
    }
    this._membros.set(novo.papel, novo);
    this._rodada += 1;
    this._status = StatusEquipe.EM_FORMACAO;
    return anterior;
  }

  registrarRespostaConvite(papel: Papel, aceito: boolean): MembroEquipe {
    this.garantirModificavel();
    const membro = this.obterMembro(papel);
    if (aceito) {
      membro.confirmar();
    } else {
      membro.recusar();
    }
    return membro;
  }

  estaCompleta(requisitos: readonly Papel[]): boolean {
    return requisitos.every((papel) => this._membros.get(papel)?.confirmado === true);
  }

  finalizar(requisitos: readonly Papel[]): void {
    this.garantirModificavel();
    const pendentes = requisitos.filter((papel) => this._membros.get(papel)?.confirmado !== true);
    garantir(
      pendentes.length === 0,
      `Equipe só pode ser formada com todos os papéis confirmados. Pendentes: ${pendentes.join(', ')}.`,
      'REGRA_VIOLADA',
    );
    this._status = StatusEquipe.FORMADA;
  }

  descartar(): void {
    garantir(
      this._status !== StatusEquipe.FORMADA,
      'Equipe formada não pode ser descartada.',
      'TRANSICAO_INVALIDA',
    );
    this._status = StatusEquipe.DESCARTADA;
  }

  aceitar<R>(visitante: VisitanteProjeto<R>): R {
    return visitante.visitarEquipe(this);
  }

  private obterMembro(papel: Papel): MembroEquipe {
    const membro = this._membros.get(papel);
    if (!membro) {
      throw new ErroDominio('NAO_ENCONTRADO', `Equipe não possui membro para ${papel}.`);
    }
    return membro;
  }

  private garantirModificavel(): void {
    garantir(this.ativa, `Equipe ${this._status} não pode ser alterada.`, 'TRANSICAO_INVALIDA');
  }

  private garantirNaoConfirmado(membro: MembroEquipe): void {
    garantir(
      !membro.confirmado,
      `Membro confirmado em ${membro.papel} não pode ser removido.`,
      'REGRA_VIOLADA',
    );
  }
}
