import {
  ehEventoDoTipo,
  type EventoRecomendacao,
  type TipoEvento,
} from '../../domain/eventos/evento-recomendacao.js';
import type { PublicadorExterno } from '../ports/canais-saida.js';
import type { Observador } from '../ports/observador.js';

export const TOPICOS_EQUIPE_FORMADA = [
  'gerenciamento-projetos.equipe-formada',
  'financeiro.equipe-formada',
] as const;

export class PublicadorIntegracao implements Observador {
  readonly nome = 'publicador-integracao';
  readonly interesses: readonly TipoEvento[] = ['EQUIPE_FORMADA'];

  constructor(
    private readonly publicador: PublicadorExterno,
    private readonly topicos: readonly string[] = TOPICOS_EQUIPE_FORMADA,
  ) {}

  async atualizar(evento: EventoRecomendacao): Promise<void> {
    if (!ehEventoDoTipo(evento, 'EQUIPE_FORMADA')) {
      return;
    }
    const conteudo = {
      eventoId: evento.id,
      ocorridoEm: evento.ocorridoEm,
      ...(evento.correlacaoId === undefined ? {} : { correlacaoId: evento.correlacaoId }),
      ...evento.dados,
    };
    await Promise.all(
      this.topicos.map((topico) =>
        this.publicador.publicar({ topico, chave: evento.dados.projetoId, conteudo }),
      ),
    );
  }
}
