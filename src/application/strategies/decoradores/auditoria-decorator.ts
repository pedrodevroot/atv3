import { gerarId } from '../../../domain/comum/identificador.js';
import type { Profissional } from '../../../domain/entidades/profissional.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import type { RegistroAuditoria } from '../../ports/canais-saida.js';
import type { Logger } from '../../ports/logger.js';
import { relogioDoSistema, type Relogio } from '../../ports/relogio.js';
import type { RankingPorPapel, RecomendacaoStrategy } from '../estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from '../parametros-recomendacao.js';
import { DecoradorRecomendacao } from './decorador-recomendacao.js';

export const TIPO_AUDITORIA_RECOMENDADOR = 'RECOMENDADOR_EXECUTADO';
export const ORIGEM_AUDITORIA_RECOMENDADOR = 'auditoria-decorator';

export class AuditoriaDecorator extends DecoradorRecomendacao {
  constructor(
    interno: RecomendacaoStrategy,
    private readonly registro: RegistroAuditoria,
    private readonly relogio: Relogio = relogioDoSistema,
    private readonly logger?: Logger,
  ) {
    super(interno);
  }

  recomendar(
    projeto: Projeto,
    profissionais: readonly Profissional[],
    parametros: ParametrosRecomendacao,
  ): RankingPorPapel {
    const inicio = performance.now();
    try {
      const ranking = this.interno.recomendar(projeto, profissionais, parametros);
      this.registrar(projeto, profissionais.length, inicio, {
        sucesso: true,
        recomendados: [...ranking.values()].reduce((soma, lista) => soma + lista.length, 0),
      });
      return ranking;
    } catch (erro) {
      this.registrar(projeto, profissionais.length, inicio, {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
      throw erro;
    }
  }

  private registrar(
    projeto: Projeto,
    candidatos: number,
    inicio: number,
    resultado: Readonly<Record<string, unknown>>,
  ): void {
    this.registro
      .registrar({
        eventoId: gerarId(),
        tipo: TIPO_AUDITORIA_RECOMENDADOR,
        ocorridoEm: this.relogio().toISOString(),
        origem: ORIGEM_AUDITORIA_RECOMENDADOR,
        projetoId: projeto.id,
        atorId: ORIGEM_AUDITORIA_RECOMENDADOR,
        tipoAtor: 'SISTEMA',
        dados: {
          estrategia: this.nome,
          candidatos,
          duracaoMs: Math.round((performance.now() - inicio) * 100) / 100,
          ...resultado,
        },
      })
      .catch((erro: unknown) => {
        this.logger?.warn({ err: erro }, 'Falha ao registrar a auditoria do recomendador');
      });
  }
}
