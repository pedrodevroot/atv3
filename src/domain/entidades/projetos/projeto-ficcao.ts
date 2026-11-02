import { TipoCaptacao } from '../../enums/tipo-captacao.js';
import {
  Projeto,
  type AjustesProjeto,
  type DadosProjeto,
  type DetalhesProjeto,
} from '../projeto.js';
import { garantirCamposConhecidos } from './leitura-detalhes.js';

export class ProjetoFiccao extends Projeto {
  readonly tipoCaptacao = TipoCaptacao.FICCAO;

  private constructor(dados: DadosProjeto) {
    super(dados);
  }

  static criar(dados: DadosProjeto): ProjetoFiccao {
    return new ProjetoFiccao(dados);
  }

  static detalhesDe(valores: DetalhesProjeto): DetalhesProjeto {
    garantirCamposConhecidos(valores, [], TipoCaptacao.FICCAO);
    return {};
  }

  get detalhes(): DetalhesProjeto {
    return {};
  }

  clonar(ajustes: AjustesProjeto = {}): ProjetoFiccao {
    ProjetoFiccao.detalhesDe(this.detalhesDoClone(ajustes));
    return new ProjetoFiccao(this.dadosDoClone(ajustes));
  }

  protected aplicarDetalhes(detalhes: DetalhesProjeto): void {
    ProjetoFiccao.detalhesDe(detalhes);
  }
}
