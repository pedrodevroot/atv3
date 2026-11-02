import type { DadosCriacaoProjeto } from '../../../domain/entidades/projeto.js';
import { ProjetoPublicitario } from '../../../domain/entidades/projetos/projeto-publicitario.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import { FabricaProjeto, type DependenciasFabrica } from '../fabrica-projeto.js';
import { NotificadorPublicitario } from './notificador-publicitario.js';
import { RecomendadorPublicitario } from './recomendador-publicitario.js';
import { ValidadorPublicitario } from './validador-publicitario.js';

export class FabricaPublicitario extends FabricaProjeto {
  readonly tipo = TipoCaptacao.PUBLICITARIO;
  readonly descricao =
    'Publicidade: exige meio de veiculação, prioriza color grading, ritmo e trilha e alerta prazos longos.';

  constructor(private readonly dependencias: DependenciasFabrica) {
    super();
  }

  criarProjeto(dados: DadosCriacaoProjeto): ProjetoPublicitario {
    return ProjetoPublicitario.criar({
      ...dados,
      ...ProjetoPublicitario.detalhesDe(dados.detalhes ?? {}),
    });
  }

  criarValidador(): ValidadorPublicitario {
    return new ValidadorPublicitario();
  }

  criarRecomendador(): RecomendadorPublicitario {
    return new RecomendadorPublicitario();
  }

  criarNotificador(): NotificadorPublicitario {
    return new NotificadorPublicitario(this.dependencias.caixa);
  }
}
