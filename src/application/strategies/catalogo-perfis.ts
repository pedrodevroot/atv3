import { Papel } from '../../domain/enums/papel.js';
import { VetorCompetencia } from '../../domain/value-objects/vetor-competencia.js';

export type PesosCompetencia = Readonly<Record<string, number>>;

export type PerfisPorPapel = Readonly<Record<Papel, PesosCompetencia>>;

export type AjustesPerfil = Readonly<Partial<Record<Papel, PesosCompetencia>>>;

export const PERFIS_BASE: PerfisPorPapel = {
  [Papel.DIRETOR]: { 'direcao-de-atores': 1, decupagem: 0.8, lideranca: 0.9, roteiro: 0.4 },
  [Papel.DIRETOR_FOTOGRAFIA]: {
    fotografia: 1,
    iluminacao: 0.9,
    'operacao-de-camera': 0.8,
    'color-grading': 0.5,
  },
  [Papel.SONOPLASTA]: {
    'captacao-de-som': 1,
    mixagem: 0.9,
    'desenho-de-som': 0.8,
    'trilha-sonora': 0.4,
  },
  [Papel.EDITOR]: {
    montagem: 1,
    'edicao-nao-linear': 0.9,
    'ritmo-narrativo': 0.7,
    'color-grading': 0.5,
  },
  [Papel.ROTEIRISTA]: { roteiro: 1, dramaturgia: 0.9, dialogos: 0.8, pesquisa: 0.5 },
  [Papel.EFEITOS_VISUAIS]: {
    'composicao-digital': 1,
    rastreamento: 0.7,
    'modelagem-3d': 0.8,
    animacao: 0.5,
  },
};

export class CatalogoPerfis {
  private readonly cache = new Map<Papel, VetorCompetencia>();

  constructor(
    private readonly ajustes: AjustesPerfil = {},
    private readonly base: PerfisPorPapel = PERFIS_BASE,
  ) {}

  perfilPara(papel: Papel): VetorCompetencia {
    const existente = this.cache.get(papel);
    if (existente) {
      return existente;
    }
    const pesos: Record<string, number> = { ...this.base[papel] };
    for (const [competencia, ajuste] of Object.entries(this.ajustes[papel] ?? {})) {
      pesos[competencia] = Math.max(0, (pesos[competencia] ?? 0) + ajuste);
    }
    const perfil = VetorCompetencia.de(pesos);
    this.cache.set(papel, perfil);
    return perfil;
  }
}
