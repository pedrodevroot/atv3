import {
  FabricaProjeto,
  type DependenciasFabrica,
} from '../../src/application/familias/fabrica-projeto.js';
import {
  NotificadorTipoProjeto,
  type MensagemDoTipo,
} from '../../src/application/familias/notificador-tipo-projeto.js';
import { RecomendadorPorPerfil } from '../../src/application/familias/recomendador-por-perfil.js';
import { ValidadorTipoProjeto } from '../../src/application/familias/validador-tipo-projeto.js';
import type { Problema } from '../../src/application/visitors/validador-consistencia.js';
import {
  Projeto,
  type AjustesProjeto,
  type DadosCriacaoProjeto,
  type DadosProjeto,
  type DetalhesProjeto,
} from '../../src/domain/entidades/projeto.js';
import { lerListaDeTextos } from '../../src/domain/entidades/projetos/leitura-detalhes.js';
import { Papel } from '../../src/domain/enums/papel.js';

export const TIPO_REALIDADE_VIRTUAL = 'REALIDADE_VIRTUAL';

function plataformasDe(detalhes: DetalhesProjeto): string[] {
  return lerListaDeTextos(detalhes, 'plataformas', 'Plataformas');
}

export class ProjetoRealidadeVirtual extends Projeto {
  readonly tipoCaptacao = TIPO_REALIDADE_VIRTUAL;
  private _plataformas: readonly string[];

  private constructor(dados: DadosProjeto, plataformas: readonly string[]) {
    super(dados);
    this._plataformas = [...plataformas];
  }

  static criar(dados: DadosCriacaoProjeto): ProjetoRealidadeVirtual {
    return new ProjetoRealidadeVirtual(dados, plataformasDe(dados.detalhes ?? {}));
  }

  get plataformas(): string[] {
    return [...this._plataformas];
  }

  get detalhes(): DetalhesProjeto {
    return { plataformas: this.plataformas };
  }

  clonar(ajustes: AjustesProjeto = {}): ProjetoRealidadeVirtual {
    return new ProjetoRealidadeVirtual(
      this.dadosDoClone(ajustes),
      plataformasDe(this.detalhesDoClone(ajustes)),
    );
  }

  protected aplicarDetalhes(detalhes: DetalhesProjeto): void {
    this._plataformas = plataformasDe(detalhes);
  }
}

class ValidadorRealidadeVirtual extends ValidadorTipoProjeto<ProjetoRealidadeVirtual> {
  readonly tipo = TIPO_REALIDADE_VIRTUAL;

  protected atende(projeto: Projeto): projeto is ProjetoRealidadeVirtual {
    return projeto instanceof ProjetoRealidadeVirtual;
  }

  protected regrasDoProjeto(projeto: ProjetoRealidadeVirtual): Problema[] {
    return projeto.plataformas.length > 0
      ? []
      : [
          {
            codigo: 'DETALHE_DO_TIPO',
            severidade: 'ERRO',
            mensagem: 'Experiência de realidade virtual precisa de ao menos uma plataforma.',
          },
        ];
  }

  protected regrasDoMembro(): Problema[] {
    return [];
  }
}

class NotificadorRealidadeVirtual extends NotificadorTipoProjeto {
  readonly nome = 'notificador-realidade-virtual';

  protected aoRecomendar(projetoId: string, sugeridos: number): MensagemDoTipo {
    return {
      assunto: 'Realidade virtual: equipe sugerida',
      corpo: `${sugeridos} profissional(is) sugerido(s) para a experiência ${projetoId}.`,
    };
  }

  protected aoFormarEquipe(projetoId: string): MensagemDoTipo {
    return {
      assunto: 'Realidade virtual: equipe formada',
      corpo: `A equipe da experiência ${projetoId} está completa.`,
    };
  }
}

export class FabricaRealidadeVirtual extends FabricaProjeto {
  readonly tipo = TIPO_REALIDADE_VIRTUAL;
  readonly descricao = 'Experiências imersivas: direção com animação e modelagem 3D.';

  constructor(private readonly dependencias: DependenciasFabrica) {
    super();
  }

  criarProjeto(dados: DadosCriacaoProjeto): ProjetoRealidadeVirtual {
    return ProjetoRealidadeVirtual.criar(dados);
  }

  criarValidador(): ValidadorRealidadeVirtual {
    return new ValidadorRealidadeVirtual();
  }

  criarRecomendador(): RecomendadorPorPerfil {
    return new RecomendadorPorPerfil(
      'recomendador-realidade-virtual',
      'Cosseno com direção voltada a animação e modelagem 3D.',
      { [Papel.DIRETOR]: { animacao: 1, 'modelagem-3d': 1, 'direcao-de-atores': -1 } },
    );
  }

  criarNotificador(): NotificadorRealidadeVirtual {
    return new NotificadorRealidadeVirtual(this.dependencias.caixa);
  }
}
