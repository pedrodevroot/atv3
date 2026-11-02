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
  lerTexto,
  opcoesUnicas,
  textoLimitado,
} from './leitura-detalhes.js';

export const MeioVeiculacao = {
  TV: 'TV',
  DIGITAL: 'DIGITAL',
  CINEMA: 'CINEMA',
} as const;

export type MeioVeiculacao = (typeof MeioVeiculacao)[keyof typeof MeioVeiculacao];

export const MEIOS_VEICULACAO: readonly MeioVeiculacao[] = Object.values(MeioVeiculacao);

export const PECAS_PUBLICITARIAS = { minimo: 1, maximo: 50, padrao: 1 } as const;

export interface DetalhesPublicitario {
  marca: string;
  veiculacao: readonly MeioVeiculacao[];
  pecas: number;
}

export interface DadosProjetoPublicitario extends DadosProjeto, DetalhesPublicitario {}

const CAMPOS_PUBLICITARIO = ['marca', 'veiculacao', 'pecas'];

export class ProjetoPublicitario extends Projeto {
  readonly tipoCaptacao = TipoCaptacao.PUBLICITARIO;
  private _marca: string;
  private _pecas: number;
  private _veiculacao: readonly MeioVeiculacao[];

  private constructor(dados: DadosProjetoPublicitario) {
    super(dados);
    const validos = ProjetoPublicitario.validar(dados);
    this._marca = validos.marca;
    this._pecas = validos.pecas;
    this._veiculacao = validos.veiculacao;
  }

  static criar(dados: DadosProjetoPublicitario): ProjetoPublicitario {
    return new ProjetoPublicitario(dados);
  }

  static detalhesDe(valores: DetalhesProjeto): DetalhesPublicitario {
    garantirCamposConhecidos(valores, CAMPOS_PUBLICITARIO, TipoCaptacao.PUBLICITARIO);
    return {
      marca: lerTexto(valores, 'marca', 'Marca anunciante'),
      veiculacao: opcoesUnicas(
        lerListaDeTextos(valores, 'veiculacao', 'Veiculação'),
        'Veiculação',
        MEIOS_VEICULACAO,
      ),
      pecas: lerInteiro(valores, 'pecas', 'Quantidade de peças', PECAS_PUBLICITARIAS),
    };
  }

  private static validar(detalhes: DetalhesPublicitario): DetalhesPublicitario {
    garantir(
      Number.isInteger(detalhes.pecas) &&
        detalhes.pecas >= PECAS_PUBLICITARIAS.minimo &&
        detalhes.pecas <= PECAS_PUBLICITARIAS.maximo,
      `Quantidade de peças deve estar entre ${PECAS_PUBLICITARIAS.minimo} e ${PECAS_PUBLICITARIAS.maximo}.`,
    );
    return {
      marca: textoLimitado(detalhes.marca, 'Marca anunciante'),
      pecas: detalhes.pecas,
      veiculacao: opcoesUnicas(detalhes.veiculacao, 'Veiculação', MEIOS_VEICULACAO),
    };
  }

  get marca(): string {
    return this._marca;
  }

  get pecas(): number {
    return this._pecas;
  }

  get veiculacao(): MeioVeiculacao[] {
    return [...this._veiculacao];
  }

  get detalhes(): DetalhesProjeto {
    return { marca: this.marca, veiculacao: this.veiculacao, pecas: this.pecas };
  }

  clonar(ajustes: AjustesProjeto = {}): ProjetoPublicitario {
    return new ProjetoPublicitario({
      ...this.dadosDoClone(ajustes),
      ...ProjetoPublicitario.detalhesDe(this.detalhesDoClone(ajustes)),
    });
  }

  protected aplicarDetalhes(detalhes: DetalhesProjeto): void {
    const validos = ProjetoPublicitario.validar(ProjetoPublicitario.detalhesDe(detalhes));
    this._marca = validos.marca;
    this._pecas = validos.pecas;
    this._veiculacao = validos.veiculacao;
  }
}
