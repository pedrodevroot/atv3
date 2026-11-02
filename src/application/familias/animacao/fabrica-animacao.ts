import type { DadosCriacaoProjeto, Projeto } from '../../../domain/entidades/projeto.js';
import type { VisitanteProjeto } from '../../../domain/visitante/visitante-projeto.js';
import { ProjetoAnimacao } from '../../../domain/entidades/projetos/projeto-animacao.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import { FabricaProjeto, type DependenciasFabrica } from '../fabrica-projeto.js';
import { GeradorRelatorioAnimacao } from './gerador-relatorio-animacao.js';
import { NotificadorAnimacao } from './notificador-animacao.js';
import { RecomendadorAnimacao } from './recomendador-animacao.js';
import { ValidadorAnimacao } from './validador-animacao.js';

export class FabricaAnimacao extends FabricaProjeto {
  readonly tipo = TipoCaptacao.ANIMACAO;
  readonly descricao =
    'Animações: exige efeitos visuais, prioriza animação e modelagem 3D e acompanha o pipeline de renderização.';

  constructor(private readonly dependencias: DependenciasFabrica) {
    super();
  }

  criarProjeto(dados: DadosCriacaoProjeto): ProjetoAnimacao {
    return ProjetoAnimacao.criar({ ...dados, ...ProjetoAnimacao.detalhesDe(dados.detalhes ?? {}) });
  }

  criarValidador(): ValidadorAnimacao {
    return new ValidadorAnimacao();
  }

  criarRecomendador(): RecomendadorAnimacao {
    return new RecomendadorAnimacao();
  }

  criarNotificador(): NotificadorAnimacao {
    return new NotificadorAnimacao(this.dependencias.caixa);
  }

  override criarGeradorRelatorio(projeto: Projeto, geradoEm: Date): VisitanteProjeto<string> {
    return projeto instanceof ProjetoAnimacao
      ? new GeradorRelatorioAnimacao(projeto, geradoEm)
      : super.criarGeradorRelatorio(projeto, geradoEm);
  }
}
