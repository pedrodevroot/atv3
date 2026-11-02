import type { DadosCriacaoProjeto } from '../../../domain/entidades/projeto.js';
import { ProjetoDocumentario } from '../../../domain/entidades/projetos/projeto-documentario.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import { FabricaProjeto, type DependenciasFabrica } from '../fabrica-projeto.js';
import { NotificadorDocumentario } from './notificador-documentario.js';
import { RecomendadorDocumentario } from './recomendador-documentario.js';
import { ValidadorDocumentario } from './validador-documentario.js';

export class FabricaDocumentario extends FabricaProjeto {
  readonly tipo = TipoCaptacao.DOCUMENTARIO;
  readonly descricao =
    'Documentários: exige entrevistados, prioriza entrevista e pesquisa e reforça o som direto.';

  constructor(private readonly dependencias: DependenciasFabrica) {
    super();
  }

  criarProjeto(dados: DadosCriacaoProjeto): ProjetoDocumentario {
    return ProjetoDocumentario.criar({
      ...dados,
      ...ProjetoDocumentario.detalhesDe(dados.detalhes ?? {}),
    });
  }

  criarValidador(): ValidadorDocumentario {
    return new ValidadorDocumentario();
  }

  criarRecomendador(): RecomendadorDocumentario {
    return new RecomendadorDocumentario();
  }

  criarNotificador(): NotificadorDocumentario {
    return new NotificadorDocumentario(this.dependencias.caixa);
  }
}
