import { ErroSistemaExterno } from './erro-sistema-externo.js';

export interface PerfilExterno {
  readonly id: string;
  readonly notas: readonly number[];
}

export interface FiltrosExternos {
  readonly termos?: readonly string[];
}

export class ApiProfissionalExterna<TPerfil extends PerfilExterno> {
  private readonly perfis: Map<string, TPerfil>;

  constructor(
    readonly sistema: string,
    perfis: readonly TPerfil[],
    private readonly termosDe: (perfil: TPerfil) => readonly string[],
  ) {
    this.perfis = new Map(perfis.map((perfil) => [perfil.id, perfil]));
  }

  buscarProfissionais(filtros: FiltrosExternos = {}): Promise<TPerfil[]> {
    const { termos } = filtros;
    const encontrados = [...this.perfis.values()].filter(
      (perfil) => !termos || this.termosDe(perfil).some((termo) => termos.includes(termo)),
    );
    return Promise.resolve(encontrados);
  }

  obterPerfil(id: string): Promise<TPerfil> {
    return Promise.resolve(this.exigir(id));
  }

  avaliarProfissional(id: string, nota: number): Promise<void> {
    const perfil = this.exigir(id);
    this.perfis.set(id, { ...perfil, notas: [...perfil.notas, nota] });
    return Promise.resolve();
  }

  private exigir(id: string): TPerfil {
    const perfil = this.perfis.get(id);
    if (!perfil) {
      throw new ErroSistemaExterno(this.sistema, `perfil ${id} não existe.`);
    }
    return perfil;
  }
}
