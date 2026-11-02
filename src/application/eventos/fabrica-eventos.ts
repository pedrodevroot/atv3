import type { Equipe } from '../../domain/entidades/equipe.js';
import type { MembroEquipe } from '../../domain/entidades/membro-equipe.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import {
  criarEvento,
  type EventoDoTipo,
  type OpcoesEvento,
} from '../../domain/eventos/evento-recomendacao.js';

export const ORIGEM_SERVICO = 'cinebridge-recomendacao';

export interface DadosRecomendacaoGerada {
  readonly projeto: Projeto;
  readonly equipes: readonly Equipe[];
  readonly membros: readonly MembroEquipe[];
  readonly estrategia: string;
  readonly rodada: number;
  readonly parcial: boolean;
}

export function membrosSugeridos(equipes: readonly Equipe[]): MembroEquipe[] {
  const unicos = new Map<string, MembroEquipe>();
  for (const membro of equipes.flatMap((equipe) => equipe.membros)) {
    unicos.set(`${membro.papel}:${membro.profissional.id}`, membro);
  }
  return [...unicos.values()];
}

export function eventoRecomendacaoGerada(
  dados: DadosRecomendacaoGerada,
  opcoes: Partial<OpcoesEvento> = {},
): EventoDoTipo<'RECOMENDACAO_GERADA'> {
  return criarEvento(
    'RECOMENDACAO_GERADA',
    {
      projetoId: dados.projeto.id,
      produtorId: dados.projeto.produtorId,
      estrategia: dados.estrategia,
      rodada: dados.rodada,
      parcial: dados.parcial,
      equipes: dados.equipes.map((equipe) => ({
        equipeId: equipe.id,
        custoTotal: equipe.custoTotal,
      })),
      profissionais: dados.membros.map((membro) => ({
        profissionalId: membro.profissional.id,
        papel: membro.papel,
        score: membro.score,
      })),
    },
    { origem: ORIGEM_SERVICO, ...opcoes },
  );
}
