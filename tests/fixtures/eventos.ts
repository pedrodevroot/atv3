import { Papel } from '../../src/domain/enums/papel.js';
import { criarEvento, type EventoDoTipo } from '../../src/domain/eventos/evento-recomendacao.js';

const opcoes = { origem: 'teste', correlacaoId: 'req-1' };

export function eventoRecomendacao(): EventoDoTipo<'RECOMENDACAO_GERADA'> {
  return criarEvento(
    'RECOMENDACAO_GERADA',
    {
      projetoId: 'projeto-1',
      produtorId: 'produtor-1',
      estrategia: 'similaridade-cosseno',
      rodada: 1,
      parcial: false,
      equipes: [{ equipeId: 'equipe-1', custoTotal: 67_500 }],
      profissionais: [
        { profissionalId: 'diretora', papel: Papel.DIRETOR, score: 0.99 },
        { profissionalId: 'editora', papel: Papel.EDITOR, score: 0.9 },
      ],
    },
    opcoes,
  );
}

export function eventoEquipeFormada(): EventoDoTipo<'EQUIPE_FORMADA'> {
  return criarEvento(
    'EQUIPE_FORMADA',
    {
      projetoId: 'projeto-1',
      produtorId: 'produtor-1',
      equipeId: 'equipe-1',
      custoTotal: 67_500,
      membros: [
        { papel: Papel.DIRETOR, profissionalId: 'diretora', custo: 55_000 },
        { papel: Papel.EDITOR, profissionalId: 'editora', custo: 12_500 },
      ],
    },
    opcoes,
  );
}

export function eventoRespostaConvite<
  T extends 'CONVITE_ACEITO' | 'CONVITE_RECUSADO' | 'CONVITE_EXPIRADO',
>(
  tipo: T,
  dados: { projetoId: string; equipeId: string; papel: Papel; profissionalId: string },
): EventoDoTipo<T> {
  return criarEvento(tipo, { conviteId: 'convite-1', produtorId: 'produtor-1', ...dados }, opcoes);
}
