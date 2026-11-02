import { ErroDominio, garantir, garantirData, garantirTexto } from '../comum/erro-dominio.js';
import { gerarId } from '../comum/identificador.js';
import type { Papel } from '../enums/papel.js';
import { StatusConvite } from '../enums/status.js';

export const VALIDADE_CONVITE_HORAS_PADRAO = 72;
const MILISSEGUNDOS_POR_HORA = 3_600_000;

export interface DadosConvite {
  id?: string;
  projetoId: string;
  equipeId: string;
  papel: Papel;
  profissionalId: string;
  produtorId: string;
  criadoEm?: Date;
  validadeHoras?: number;
}

export interface DadosConviteExistente extends Omit<DadosConvite, 'validadeHoras'> {
  id: string;
  criadoEm: Date;
  expiraEm: Date;
  status: StatusConvite;
  respondidoEm?: Date;
}

export class Convite {
  private constructor(
    readonly id: string,
    readonly projetoId: string,
    readonly equipeId: string,
    readonly papel: Papel,
    readonly profissionalId: string,
    readonly produtorId: string,
    readonly criadoEm: Date,
    readonly expiraEm: Date,
    private _status: StatusConvite,
    private _respondidoEm: Date | undefined,
  ) {}

  static criar(dados: DadosConvite): Convite {
    const validadeHoras = dados.validadeHoras ?? VALIDADE_CONVITE_HORAS_PADRAO;
    garantir(
      Number.isFinite(validadeHoras) && validadeHoras > 0,
      'Validade do convite deve ser maior que zero.',
    );
    const criadoEm = garantirData(dados.criadoEm ?? new Date(), 'Data do convite');
    return new Convite(
      dados.id ?? gerarId(),
      garantirTexto(dados.projetoId, 'Projeto do convite'),
      garantirTexto(dados.equipeId, 'Equipe do convite'),
      dados.papel,
      garantirTexto(dados.profissionalId, 'Profissional convidado'),
      garantirTexto(dados.produtorId, 'Produtor do convite'),
      criadoEm,
      new Date(criadoEm.getTime() + validadeHoras * MILISSEGUNDOS_POR_HORA),
      StatusConvite.PENDENTE,
      undefined,
    );
  }

  static restaurar(dados: DadosConviteExistente): Convite {
    return new Convite(
      dados.id,
      dados.projetoId,
      dados.equipeId,
      dados.papel,
      dados.profissionalId,
      dados.produtorId,
      dados.criadoEm,
      dados.expiraEm,
      dados.status,
      dados.respondidoEm,
    );
  }

  get status(): StatusConvite {
    return this._status;
  }

  get respondidoEm(): Date | undefined {
    return this._respondidoEm;
  }

  get pendente(): boolean {
    return this._status === StatusConvite.PENDENTE;
  }

  venceuEm(agora: Date): boolean {
    return agora.getTime() >= this.expiraEm.getTime();
  }

  aceitar(agora = new Date()): void {
    this.responder(StatusConvite.ACEITO, agora);
  }

  recusar(agora = new Date()): void {
    this.responder(StatusConvite.RECUSADO, agora);
  }

  expirar(agora = new Date()): boolean {
    if (!this.pendente || !this.venceuEm(agora)) {
      return false;
    }
    this._status = StatusConvite.EXPIRADO;
    return true;
  }

  cancelar(): void {
    this.garantirPendente();
    this._status = StatusConvite.CANCELADO;
  }

  private responder(resposta: StatusConvite, agora: Date): void {
    this.garantirPendente();
    if (this.expirar(agora)) {
      throw new ErroDominio('TRANSICAO_INVALIDA', 'Convite expirado não pode ser respondido.');
    }
    this._status = resposta;
    this._respondidoEm = new Date(agora.getTime());
  }

  private garantirPendente(): void {
    garantir(
      this.pendente,
      `Convite ${this._status} não pode mais ser alterado.`,
      'TRANSICAO_INVALIDA',
    );
  }
}
