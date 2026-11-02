import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Recomendacao } from '../../domain/entidades/recomendacao.js';
import {
  criarEvento,
  type EventoDoTipo,
  type EventoRecomendacao,
  type TipoEvento,
} from '../../domain/eventos/evento-recomendacao.js';
import { comNovasTentativas, ehErroDeNegocio } from '../erros/erro-aplicacao.js';
import { eventoRecomendacaoGerada } from '../eventos/fabrica-eventos.js';
import type { Observador } from '../ports/observador.js';
import type { RepositorioProjetos } from '../ports/repositorio-projetos.js';
import type { RepositorioRecomendacoes } from '../ports/repositorio-recomendacoes.js';
import type { SistemaRecomendacao } from '../sistema-recomendacao.js';

export const ORIGEM_ATUALIZADOR = 'atualizador-composicao';

export interface DependenciasAtualizador {
  readonly projetos: RepositorioProjetos;
  readonly recomendacoes?: RepositorioRecomendacoes;
  readonly sistema: SistemaRecomendacao;
}

type RespostaConvite =
  | EventoDoTipo<'CONVITE_ACEITO'>
  | EventoDoTipo<'CONVITE_RECUSADO'>
  | EventoDoTipo<'CONVITE_EXPIRADO'>;

export class AtualizadorComposicao implements Observador {
  readonly nome = ORIGEM_ATUALIZADOR;
  readonly interesses: readonly TipoEvento[] = [
    'CONVITE_ACEITO',
    'CONVITE_RECUSADO',
    'CONVITE_EXPIRADO',
  ];

  constructor(private readonly dependencias: DependenciasAtualizador) {}

  async atualizar(evento: EventoRecomendacao): Promise<void> {
    if (
      evento.tipo !== 'CONVITE_ACEITO' &&
      evento.tipo !== 'CONVITE_RECUSADO' &&
      evento.tipo !== 'CONVITE_EXPIRADO'
    ) {
      return;
    }
    await comNovasTentativas(() => this.aplicarResposta(evento), 8);
  }

  private async aplicarResposta(evento: RespostaConvite): Promise<void> {
    const { projetos, sistema } = this.dependencias;
    const { projetoId, equipeId, papel } = evento.dados;
    const projeto = await projetos.obter(projetoId);
    if (!projeto) {
      throw new Error(`Projeto ${projetoId} não encontrado para atualizar a composição.`);
    }
    if (!projeto.equipe(equipeId).ativa) {
      return;
    }

    const aceito = evento.tipo === 'CONVITE_ACEITO';
    projeto.registrarRespostaConvite(equipeId, papel, aceito);
    const rodada = aceito
      ? { eventos: [], recomendacoes: [] }
      : await this.iniciarNovaRodada(projeto, evento);

    await projetos.salvar(projeto);
    await this.dependencias.recomendacoes?.salvarTodas(rodada.recomendacoes);
    for (const seguinte of rodada.eventos) {
      sistema.notificarObservadores(seguinte, projeto);
    }
  }

  private async iniciarNovaRodada(
    projeto: Projeto,
    evento: RespostaConvite,
  ): Promise<{ eventos: EventoRecomendacao[]; recomendacoes: readonly Recomendacao[] }> {
    const { projetoId, produtorId, equipeId, papel, profissionalId } = evento.dados;
    const opcoes = { origem: ORIGEM_ATUALIZADOR, correlacaoId: evento.correlacaoId ?? evento.id };
    let resultado;
    try {
      resultado = await this.dependencias.sistema.substituir(projeto, { equipeId, papel });
    } catch (erro) {
      if (!ehErroDeNegocio(erro)) {
        throw erro;
      }
      return {
        eventos: [
          criarEvento(
            'SUBSTITUICAO_INDISPONIVEL',
            { projetoId, produtorId, equipeId, papel, motivo: erro.message },
            opcoes,
          ),
        ],
        recomendacoes: [],
      };
    }
    const novoMembro = projeto.equipe(equipeId).membro(papel);
    const eventos: EventoRecomendacao[] = [
      criarEvento(
        'SUBSTITUICAO_SOLICITADA',
        { projetoId, produtorId, equipeId, papel, profissionalAnteriorId: profissionalId },
        opcoes,
      ),
    ];
    if (novoMembro && novoMembro.profissional.id !== profissionalId) {
      eventos.push(
        eventoRecomendacaoGerada(
          {
            projeto,
            equipes: resultado.equipes,
            membros: [novoMembro],
            estrategia: resultado.estrategia,
            rodada: resultado.rodada,
            parcial: resultado.parcial,
          },
          opcoes,
        ),
      );
    }
    return { eventos, recomendacoes: resultado.recomendacoes };
  }
}
