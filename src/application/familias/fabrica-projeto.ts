import type { DadosCriacaoProjeto, Projeto } from '../../domain/entidades/projeto.js';
import type { VisitanteProjeto } from '../../domain/visitante/visitante-projeto.js';
import type { CaixaMensagens } from '../ports/canais-saida.js';
import type { Observador } from '../ports/observador.js';
import type { EstrategiaRecomendacao } from '../strategies/estrategia-recomendacao.js';
import { GeradorRelatorio } from '../visitors/gerador-relatorio.js';
import type { ResultadoValidacao } from '../visitors/validador-consistencia.js';

export interface DependenciasFabrica {
  readonly caixa: CaixaMensagens;
}

export abstract class FabricaProjeto {
  abstract readonly tipo: string;
  abstract readonly descricao: string;

  abstract criarProjeto(dados: DadosCriacaoProjeto): Projeto;

  abstract criarValidador(): VisitanteProjeto<ResultadoValidacao>;

  abstract criarRecomendador(): EstrategiaRecomendacao;

  abstract criarNotificador(): Observador;

  criarGeradorRelatorio(projeto: Projeto, geradoEm: Date): VisitanteProjeto<string> {
    return new GeradorRelatorio(projeto, geradoEm);
  }
}
