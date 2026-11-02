import type { EventoRecomendacao } from '../../domain/eventos/evento-recomendacao.js';
import type { EntradaAuditoria, RegistroAuditoria } from '../ports/canais-saida.js';
import { TODOS_OS_EVENTOS, type Observador } from '../ports/observador.js';

export class AuditoriaRecomendacao implements Observador {
  readonly nome = 'auditoria-recomendacao';
  readonly interesses = TODOS_OS_EVENTOS;

  constructor(
    private readonly registro: RegistroAuditoria,
    private readonly origensDeSistema: ReadonlySet<string> = new Set(),
  ) {}

  atualizar(evento: EventoRecomendacao): Promise<void> {
    return this.registro.registrar(this.paraEntrada(evento));
  }

  private paraEntrada(evento: EventoRecomendacao): EntradaAuditoria {
    return {
      eventoId: evento.id,
      tipo: evento.tipo,
      ocorridoEm: evento.ocorridoEm,
      origem: evento.origem,
      ...(evento.correlacaoId === undefined ? {} : { correlacaoId: evento.correlacaoId }),
      projetoId: evento.dados.projetoId,
      ...this.atorDe(evento),
      dados: evento.dados,
    };
  }

  private atorDe(evento: EventoRecomendacao): Pick<EntradaAuditoria, 'atorId' | 'tipoAtor'> {
    if (this.origensDeSistema.has(evento.origem)) {
      return { atorId: evento.origem, tipoAtor: 'SISTEMA' };
    }
    if (evento.tipo === 'CONVITE_ACEITO' || evento.tipo === 'CONVITE_RECUSADO') {
      return { atorId: evento.dados.profissionalId, tipoAtor: 'PROFISSIONAL' };
    }
    return { atorId: evento.dados.produtorId, tipoAtor: 'PRODUTOR' };
  }
}
