import { garantir, garantirData, garantirTexto } from '../comum/erro-dominio.js';
import { gerarId } from '../comum/identificador.js';
import type { Papel } from '../enums/papel.js';

export interface DadosRecomendacao {
  id?: string;
  projetoId: string;
  equipeId?: string;
  papel: Papel;
  profissionalId: string;
  score: number;
  posicao: number;
  estrategia: string;
  rodada: number;
  justificativa?: string;
  criadaEm?: Date;
}

export class Recomendacao {
  private constructor(
    readonly id: string,
    readonly projetoId: string,
    readonly equipeId: string | undefined,
    readonly papel: Papel,
    readonly profissionalId: string,
    readonly score: number,
    readonly posicao: number,
    readonly estrategia: string,
    readonly rodada: number,
    readonly justificativa: string,
    readonly criadaEm: Date,
  ) {}

  static criar(dados: DadosRecomendacao): Recomendacao {
    garantir(
      Number.isFinite(dados.score) && dados.score >= 0 && dados.score <= 1,
      'Score da recomendação deve estar entre 0 e 1.',
    );
    garantir(
      Number.isInteger(dados.posicao) && dados.posicao >= 1,
      'Posição deve ser inteira e >= 1.',
    );
    garantir(
      Number.isInteger(dados.rodada) && dados.rodada >= 1,
      'Rodada deve ser inteira e >= 1.',
    );
    return new Recomendacao(
      dados.id ?? gerarId(),
      garantirTexto(dados.projetoId, 'Projeto da recomendação'),
      dados.equipeId,
      dados.papel,
      garantirTexto(dados.profissionalId, 'Profissional recomendado'),
      dados.score,
      dados.posicao,
      garantirTexto(dados.estrategia, 'Estratégia da recomendação'),
      dados.rodada,
      dados.justificativa?.trim() ?? '',
      garantirData(dados.criadaEm ?? new Date(), 'Data da recomendação'),
    );
  }
}
