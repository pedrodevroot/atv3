import { TipoCaptacao } from '../../enums/tipo-captacao.js';
import {
  Projeto,
  type AjustesProjeto,
  type DadosProjeto,
  type DetalhesProjeto,
} from '../projeto.js';
import {
  garantirCamposConhecidos,
  lerListaDeTextos,
  lerTexto,
  textoLimitado,
  textosUnicos,
} from './leitura-detalhes.js';

export interface DetalhesDocumentario {
  tema: string;
  entrevistados: readonly string[];
}

export interface DadosProjetoDocumentario extends DadosProjeto, DetalhesDocumentario {}

const CAMPOS_DOCUMENTARIO = ['tema', 'entrevistados'];

export class ProjetoDocumentario extends Projeto {
  readonly tipoCaptacao = TipoCaptacao.DOCUMENTARIO;
  private _tema: string;
  private _entrevistados: readonly string[];

  private constructor(dados: DadosProjetoDocumentario) {
    super(dados);
    const validos = ProjetoDocumentario.validar(dados);
    this._tema = validos.tema;
    this._entrevistados = validos.entrevistados;
  }

  static criar(dados: DadosProjetoDocumentario): ProjetoDocumentario {
    return new ProjetoDocumentario(dados);
  }

  static detalhesDe(valores: DetalhesProjeto): DetalhesDocumentario {
    garantirCamposConhecidos(valores, CAMPOS_DOCUMENTARIO, TipoCaptacao.DOCUMENTARIO);
    return {
      tema: lerTexto(valores, 'tema', 'Tema do documentário'),
      entrevistados: lerListaDeTextos(valores, 'entrevistados', 'Entrevistados'),
    };
  }

  private static validar(detalhes: DetalhesDocumentario): DetalhesDocumentario {
    return {
      tema: textoLimitado(detalhes.tema, 'Tema do documentário'),
      entrevistados: textosUnicos(detalhes.entrevistados, 'Entrevistados'),
    };
  }

  get tema(): string {
    return this._tema;
  }

  get entrevistados(): string[] {
    return [...this._entrevistados];
  }

  get detalhes(): DetalhesProjeto {
    return { tema: this.tema, entrevistados: this.entrevistados };
  }

  clonar(ajustes: AjustesProjeto = {}): ProjetoDocumentario {
    return new ProjetoDocumentario({
      ...this.dadosDoClone(ajustes),
      ...ProjetoDocumentario.detalhesDe(this.detalhesDoClone(ajustes)),
    });
  }

  protected aplicarDetalhes(detalhes: DetalhesProjeto): void {
    const validos = ProjetoDocumentario.validar(ProjetoDocumentario.detalhesDe(detalhes));
    this._tema = validos.tema;
    this._entrevistados = validos.entrevistados;
  }
}
