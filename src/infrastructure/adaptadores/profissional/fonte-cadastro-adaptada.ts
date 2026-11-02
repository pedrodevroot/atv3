import type {
  AdaptadorProfissional,
  CadastroInterno,
} from '../../../application/ports/adaptador-profissional.js';
import type { FonteCadastroProfissionais } from '../../../application/ports/repositorio-profissionais.js';
import type { Profissional } from '../../../domain/entidades/profissional.js';

export class FonteCadastroAdaptada implements FonteCadastroProfissionais {
  constructor(
    private adaptador: AdaptadorProfissional,
    private readonly espelho: CadastroInterno,
  ) {}

  usar(adaptador: AdaptadorProfissional): void {
    this.adaptador = adaptador;
  }

  async listarAtivos(): Promise<Profissional[]> {
    const profissionais = await this.adaptador.listarProfissionais();
    if (this.adaptador.externo) {
      await this.espelho.salvarTodos(profissionais);
    }
    return profissionais;
  }
}
