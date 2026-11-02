import { garantir } from '../../comum/erro-dominio.js';
import { TipoCaptacao } from '../../enums/tipo-captacao.js';
import {
  Projeto,
  type AjustesProjeto,
  type DadosProjeto,
  type DetalhesProjeto,
} from '../projeto.js';
import {
  garantirCamposConhecidos,
  lerInteiro,
  lerListaDeTextos,
  lerOpcao,
  textosUnicos,
} from './leitura-detalhes.js';

export const TecnicaAnimacao = {
  ANIMACAO_2D: '2D',
  ANIMACAO_3D: '3D',
  STOP_MOTION: 'STOP_MOTION',
} as const;

export type TecnicaAnimacao = (typeof TecnicaAnimacao)[keyof typeof TecnicaAnimacao];

export const TECNICAS_ANIMACAO: readonly TecnicaAnimacao[] = Object.values(TecnicaAnimacao);

export const QUADROS_POR_SEGUNDO = { minimo: 1, maximo: 120, padrao: 24 } as const;

export interface DetalhesAnimacao {
  tecnica: TecnicaAnimacao;
  softwares: readonly string[];
  quadrosPorSegundo: number;
}

export interface DadosProjetoAnimacao extends DadosProjeto, DetalhesAnimacao {}

const CAMPOS_ANIMACAO = ['tecnica', 'softwares', 'quadrosPorSegundo'];

export class ProjetoAnimacao extends Projeto {
  readonly tipoCaptacao = TipoCaptacao.ANIMACAO;
  private _tecnica: TecnicaAnimacao;
  private _quadrosPorSegundo: number;
  private _softwares: readonly string[];

  private constructor(dados: DadosProjetoAnimacao) {
    super(dados);
    const validos = ProjetoAnimacao.validar(dados);
    this._tecnica = validos.tecnica;
    this._quadrosPorSegundo = validos.quadrosPorSegundo;
    this._softwares = validos.softwares;
  }

  static criar(dados: DadosProjetoAnimacao): ProjetoAnimacao {
    return new ProjetoAnimacao(dados);
  }

  static detalhesDe(valores: DetalhesProjeto): DetalhesAnimacao {
    garantirCamposConhecidos(valores, CAMPOS_ANIMACAO, TipoCaptacao.ANIMACAO);
    return {
      tecnica: lerOpcao(valores, 'tecnica', 'Técnica de animação', TECNICAS_ANIMACAO),
      softwares: lerListaDeTextos(valores, 'softwares', 'Softwares'),
      quadrosPorSegundo: lerInteiro(
        valores,
        'quadrosPorSegundo',
        'Quadros por segundo',
        QUADROS_POR_SEGUNDO,
      ),
    };
  }

  private static validar(detalhes: DetalhesAnimacao): DetalhesAnimacao {
    garantir(TECNICAS_ANIMACAO.includes(detalhes.tecnica), 'Técnica de animação inválida.');
    garantir(
      Number.isInteger(detalhes.quadrosPorSegundo) &&
        detalhes.quadrosPorSegundo >= QUADROS_POR_SEGUNDO.minimo &&
        detalhes.quadrosPorSegundo <= QUADROS_POR_SEGUNDO.maximo,
      `Quadros por segundo devem estar entre ${QUADROS_POR_SEGUNDO.minimo} e ${QUADROS_POR_SEGUNDO.maximo}.`,
    );
    return {
      tecnica: detalhes.tecnica,
      quadrosPorSegundo: detalhes.quadrosPorSegundo,
      softwares: textosUnicos(detalhes.softwares, 'Softwares'),
    };
  }

  get tecnica(): TecnicaAnimacao {
    return this._tecnica;
  }

  get quadrosPorSegundo(): number {
    return this._quadrosPorSegundo;
  }

  get softwares(): string[] {
    return [...this._softwares];
  }

  get detalhes(): DetalhesProjeto {
    return {
      tecnica: this.tecnica,
      softwares: this.softwares,
      quadrosPorSegundo: this.quadrosPorSegundo,
    };
  }

  clonar(ajustes: AjustesProjeto = {}): ProjetoAnimacao {
    return new ProjetoAnimacao({
      ...this.dadosDoClone(ajustes),
      ...ProjetoAnimacao.detalhesDe(this.detalhesDoClone(ajustes)),
    });
  }

  protected aplicarDetalhes(detalhes: DetalhesProjeto): void {
    const validos = ProjetoAnimacao.validar(ProjetoAnimacao.detalhesDe(detalhes));
    this._tecnica = validos.tecnica;
    this._quadrosPorSegundo = validos.quadrosPorSegundo;
    this._softwares = validos.softwares;
  }
}
