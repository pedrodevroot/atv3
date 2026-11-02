import { gerarId } from '../comum/identificador.js';
import type { Papel } from '../enums/papel.js';

export interface DadosPorTipoEvento {
  RECOMENDACAO_GERADA: {
    projetoId: string;
    produtorId: string;
    estrategia: string;
    rodada: number;
    parcial: boolean;
    equipes: { equipeId: string; custoTotal: number }[];
    profissionais: { profissionalId: string; papel: Papel; score: number }[];
  };
  SUBSTITUICAO_SOLICITADA: {
    projetoId: string;
    produtorId: string;
    equipeId: string;
    papel: Papel;
    profissionalAnteriorId?: string;
  };
  SUBSTITUICAO_INDISPONIVEL: {
    projetoId: string;
    produtorId: string;
    equipeId: string;
    papel: Papel;
    motivo: string;
  };
  MEMBRO_REJEITADO: {
    projetoId: string;
    produtorId: string;
    equipeId: string;
    papel: Papel;
    profissionalId: string;
  };
  CONVITE_ENVIADO: {
    conviteId: string;
    projetoId: string;
    produtorId: string;
    equipeId: string;
    papel: Papel;
    profissionalId: string;
    expiraEm: string;
  };
  CONVITE_ACEITO: {
    conviteId: string;
    projetoId: string;
    produtorId: string;
    equipeId: string;
    papel: Papel;
    profissionalId: string;
  };
  CONVITE_RECUSADO: {
    conviteId: string;
    projetoId: string;
    produtorId: string;
    equipeId: string;
    papel: Papel;
    profissionalId: string;
  };
  CONVITE_EXPIRADO: {
    conviteId: string;
    projetoId: string;
    produtorId: string;
    equipeId: string;
    papel: Papel;
    profissionalId: string;
  };
  REAVALIACAO_SOLICITADA: {
    projetoId: string;
    produtorId: string;
    significativa: boolean;
    variacaoOrcamento: number;
    variacaoPrazoDias: number;
  };
  DETALHES_ATUALIZADOS: {
    projetoId: string;
    produtorId: string;
    detalhes: Record<string, unknown>;
  };
  EQUIPE_FORMADA: {
    projetoId: string;
    produtorId: string;
    equipeId: string;
    custoTotal: number;
    membros: { papel: Papel; profissionalId: string; custo: number }[];
  };
}

export type TipoEvento = keyof DadosPorTipoEvento;

export const TIPOS_EVENTO = [
  'RECOMENDACAO_GERADA',
  'SUBSTITUICAO_SOLICITADA',
  'SUBSTITUICAO_INDISPONIVEL',
  'MEMBRO_REJEITADO',
  'CONVITE_ENVIADO',
  'CONVITE_ACEITO',
  'CONVITE_RECUSADO',
  'CONVITE_EXPIRADO',
  'REAVALIACAO_SOLICITADA',
  'DETALHES_ATUALIZADOS',
  'EQUIPE_FORMADA',
] as const satisfies readonly TipoEvento[];

export type EventoDoTipo<T extends TipoEvento> = {
  readonly id: string;
  readonly tipo: T;
  readonly ocorridoEm: string;
  readonly origem: string;
  readonly correlacaoId?: string;
  readonly dados: DadosPorTipoEvento[T];
};

export type EventoRecomendacao = { [T in TipoEvento]: EventoDoTipo<T> }[TipoEvento];

export interface OpcoesEvento {
  origem: string;
  correlacaoId?: string;
  ocorridoEm?: Date;
}

export function criarEvento<T extends TipoEvento>(
  tipo: T,
  dados: DadosPorTipoEvento[T],
  opcoes: OpcoesEvento,
): EventoDoTipo<T> {
  return {
    id: gerarId(),
    tipo,
    ocorridoEm: (opcoes.ocorridoEm ?? new Date()).toISOString(),
    origem: opcoes.origem,
    ...(opcoes.correlacaoId === undefined ? {} : { correlacaoId: opcoes.correlacaoId }),
    dados,
  };
}

export function ehEventoDoTipo<T extends TipoEvento>(
  evento: EventoRecomendacao,
  tipo: T,
): evento is EventoDoTipo<T> & EventoRecomendacao {
  return evento.tipo === tipo;
}
