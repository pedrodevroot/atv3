import type { Projeto } from '../../../domain/entidades/projeto.js';
import { ProjetoAnimacao } from '../../../domain/entidades/projetos/projeto-animacao.js';
import { Papel } from '../../../domain/enums/papel.js';
import type { AjustesPerfil, PesosCompetencia } from '../../strategies/catalogo-perfis.js';
import { RecomendadorPorPerfil } from '../recomendador-por-perfil.js';

export const AJUSTES_PERFIL_ANIMACAO: AjustesPerfil = {
  [Papel.DIRETOR]: { animacao: 0.9, 'direcao-de-atores': -0.6 },
  [Papel.EFEITOS_VISUAIS]: { animacao: 0.5, 'modelagem-3d': 0.2 },
  [Papel.SONOPLASTA]: { 'desenho-de-som': 0.2, 'captacao-de-som': -0.5 },
  [Papel.DIRETOR_FOTOGRAFIA]: { 'operacao-de-camera': -0.6, 'color-grading': 0.3 },
};

export const PESO_SOFTWARE_EFEITOS_VISUAIS = 0.8;
export const PESO_SOFTWARE_DIRECAO = 0.3;

function comSoftwares(
  pesos: PesosCompetencia | undefined,
  softwares: readonly string[],
  peso: number,
): PesosCompetencia {
  return { ...pesos, ...Object.fromEntries(softwares.map((software) => [software, peso])) };
}

export class RecomendadorAnimacao extends RecomendadorPorPerfil {
  constructor() {
    super(
      'recomendador-animacao',
      'Cosseno com o perfil de animação: prioriza animação, modelagem 3D e os softwares do projeto, desenho de som e color grading em vez de câmera.',
      AJUSTES_PERFIL_ANIMACAO,
    );
  }

  protected override ajustesPara(projeto: Projeto): AjustesPerfil {
    if (!(projeto instanceof ProjetoAnimacao) || projeto.softwares.length === 0) {
      return this.ajustes;
    }
    return {
      ...this.ajustes,
      [Papel.EFEITOS_VISUAIS]: comSoftwares(
        this.ajustes[Papel.EFEITOS_VISUAIS],
        projeto.softwares,
        PESO_SOFTWARE_EFEITOS_VISUAIS,
      ),
      [Papel.DIRETOR]: comSoftwares(
        this.ajustes[Papel.DIRETOR],
        projeto.softwares,
        PESO_SOFTWARE_DIRECAO,
      ),
    };
  }
}
