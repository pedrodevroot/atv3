import { garantir, garantirTexto } from '../comum/erro-dominio.js';
import type { Papel } from '../enums/papel.js';
import type { TipoCaptacao } from '../enums/tipo-captacao.js';

export interface DadosParticipacaoProjeto {
  projetoId: string;
  titulo: string;
  papel: Papel;
  genero: string;
  tipoCaptacao: TipoCaptacao;
  ano: number;
}

export class ParticipacaoProjeto {
  private constructor(
    readonly projetoId: string,
    readonly titulo: string,
    readonly papel: Papel,
    readonly genero: string,
    readonly tipoCaptacao: TipoCaptacao,
    readonly ano: number,
  ) {}

  static criar(dados: DadosParticipacaoProjeto): ParticipacaoProjeto {
    garantir(
      Number.isInteger(dados.ano) && dados.ano >= 1890 && dados.ano <= 2100,
      'Ano da participação inválido.',
    );
    return new ParticipacaoProjeto(
      garantirTexto(dados.projetoId, 'Projeto da participação'),
      garantirTexto(dados.titulo, 'Título da participação'),
      dados.papel,
      garantirTexto(dados.genero, 'Gênero da participação'),
      dados.tipoCaptacao,
      dados.ano,
    );
  }
}
