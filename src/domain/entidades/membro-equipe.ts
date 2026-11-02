import { garantir } from '../comum/erro-dominio.js';
import type { Papel } from '../enums/papel.js';
import { StatusMembro } from '../enums/status.js';
import type { VisitanteProjeto, Visitavel } from '../visitante/visitante-projeto.js';
import type { Profissional } from './profissional.js';

export interface DadosMembroEquipe {
  papel: Papel;
  profissional: Profissional;
  custo: number;
  score: number;
  status?: StatusMembro;
}

export class MembroEquipe implements Visitavel {
  private constructor(
    readonly papel: Papel,
    readonly profissional: Profissional,
    readonly custo: number,
    readonly score: number,
    private _status: StatusMembro,
  ) {}

  static criar(dados: DadosMembroEquipe): MembroEquipe {
    garantir(
      dados.profissional.atuaComo(dados.papel),
      `${dados.profissional.nome} não atua como ${dados.papel}.`,
      'REGRA_VIOLADA',
    );
    garantir(Number.isFinite(dados.custo) && dados.custo >= 0, 'Custo do membro deve ser >= 0.');
    garantir(
      Number.isFinite(dados.score) && dados.score >= 0 && dados.score <= 1,
      'Score do membro deve estar entre 0 e 1.',
    );
    return new MembroEquipe(
      dados.papel,
      dados.profissional,
      dados.custo,
      dados.score,
      dados.status ?? StatusMembro.SUGERIDO,
    );
  }

  get status(): StatusMembro {
    return this._status;
  }

  get confirmado(): boolean {
    return this._status === StatusMembro.CONFIRMADO;
  }

  convidar(): void {
    this.transicionar(StatusMembro.SUGERIDO, StatusMembro.CONVIDADO);
  }

  confirmar(): void {
    this.transicionar(StatusMembro.CONVIDADO, StatusMembro.CONFIRMADO);
  }

  recusar(): void {
    this.transicionar(StatusMembro.CONVIDADO, StatusMembro.RECUSADO);
  }

  aceitar<R>(visitante: VisitanteProjeto<R>): R {
    return visitante.visitarMembro(this);
  }

  private transicionar(esperado: StatusMembro, proximo: StatusMembro): void {
    garantir(
      this._status === esperado,
      `Membro ${this.papel} está ${this._status}; esperado ${esperado} para ir a ${proximo}.`,
      'TRANSICAO_INVALIDA',
    );
    this._status = proximo;
  }
}
