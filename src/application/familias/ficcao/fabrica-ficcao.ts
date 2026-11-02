import type { DadosCriacaoProjeto } from '../../../domain/entidades/projeto.js';
import { ProjetoFiccao } from '../../../domain/entidades/projetos/projeto-ficcao.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import { FabricaProjeto, type DependenciasFabrica } from '../fabrica-projeto.js';
import { NotificadorFiccao } from './notificador-ficcao.js';
import { RecomendadorFiccao } from './recomendador-ficcao.js';
import { ValidadorFiccao } from './validador-ficcao.js';

export class FabricaFiccao extends FabricaProjeto {
  readonly tipo = TipoCaptacao.FICCAO;
  readonly descricao =
    'Ficção: o tipo da ATV1, com direção de atores e dramaturgia em destaque e sem detalhes extras.';

  constructor(private readonly dependencias: DependenciasFabrica) {
    super();
  }

  criarProjeto(dados: DadosCriacaoProjeto): ProjetoFiccao {
    ProjetoFiccao.detalhesDe(dados.detalhes ?? {});
    return ProjetoFiccao.criar(dados);
  }

  criarValidador(): ValidadorFiccao {
    return new ValidadorFiccao();
  }

  criarRecomendador(): RecomendadorFiccao {
    return new RecomendadorFiccao();
  }

  criarNotificador(): NotificadorFiccao {
    return new NotificadorFiccao(this.dependencias.caixa);
  }
}
