import { garantir, garantirData, garantirTexto } from '../comum/erro-dominio.js';
import { gerarId } from '../comum/identificador.js';
import type { Papel } from '../enums/papel.js';
import type { TipoCaptacao } from '../enums/tipo-captacao.js';

export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 5;

export interface DadosAvaliacao {
  id?: string;
  nota: number;
  comentario?: string;
  data: Date;
  produtorId: string;
  projetoId: string;
  papel: Papel;
  genero: string;
  tipoCaptacao: TipoCaptacao;
}

export class Avaliacao {
  private constructor(
    readonly id: string,
    readonly nota: number,
    readonly comentario: string,
    readonly data: Date,
    readonly produtorId: string,
    readonly projetoId: string,
    readonly papel: Papel,
    readonly genero: string,
    readonly tipoCaptacao: TipoCaptacao,
  ) {}

  static criar(dados: DadosAvaliacao): Avaliacao {
    garantir(
      Number.isFinite(dados.nota) && dados.nota >= NOTA_MINIMA && dados.nota <= NOTA_MAXIMA,
      `Nota deve estar entre ${NOTA_MINIMA} e ${NOTA_MAXIMA}.`,
    );
    return new Avaliacao(
      dados.id ?? gerarId(),
      dados.nota,
      dados.comentario?.trim() ?? '',
      garantirData(dados.data, 'Data da avaliação'),
      garantirTexto(dados.produtorId, 'Produtor da avaliação'),
      garantirTexto(dados.projetoId, 'Projeto da avaliação'),
      dados.papel,
      garantirTexto(dados.genero, 'Gênero do projeto avaliado'),
      dados.tipoCaptacao,
    );
  }

  get notaNormalizada(): number {
    return (this.nota - NOTA_MINIMA) / (NOTA_MAXIMA - NOTA_MINIMA);
  }
}
