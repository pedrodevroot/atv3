import { Papel } from '../../../domain/enums/papel.js';
import type { AjustesPerfil } from '../../strategies/catalogo-perfis.js';
import { RecomendadorPorPerfil } from '../recomendador-por-perfil.js';

export const AJUSTES_PERFIL_PUBLICITARIO: AjustesPerfil = {
  [Papel.DIRETOR]: { decupagem: 0.2, 'direcao-de-atores': -0.3 },
  [Papel.DIRETOR_FOTOGRAFIA]: { iluminacao: 0.1, 'color-grading': 0.4 },
  [Papel.EDITOR]: { 'ritmo-narrativo': 0.3, 'color-grading': 0.3 },
  [Papel.SONOPLASTA]: { 'trilha-sonora': 0.5, 'captacao-de-som': -0.3 },
  [Papel.ROTEIRISTA]: { dialogos: -0.3, dramaturgia: -0.4 },
};

export class RecomendadorPublicitario extends RecomendadorPorPerfil {
  constructor() {
    super(
      'recomendador-publicitario',
      'Cosseno com o perfil publicitário: decupagem, color grading, ritmo de edição e trilha sonora acima da dramaturgia.',
      AJUSTES_PERFIL_PUBLICITARIO,
    );
  }
}
