import type { AdaptadorProfissional } from './ports/adaptador-profissional.js';
import type {
  CriteriosBusca,
  RepositorioProfissionais,
  ResultadoBusca,
} from './ports/repositorio-profissionais.js';

export class CadastroViaAdaptador implements RepositorioProfissionais {
  constructor(private readonly adaptador: AdaptadorProfissional) {}

  async buscarCandidatos(criterios: CriteriosBusca): Promise<ResultadoBusca> {
    return {
      profissionais: await this.adaptador.listarProfissionais(criterios),
      parcial: false,
      avisos: [],
    };
  }
}
