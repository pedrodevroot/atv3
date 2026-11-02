import { Papel } from '../../../domain/enums/papel.js';
import type { AjustesPerfil } from '../../strategies/catalogo-perfis.js';
import { RecomendadorPorPerfil } from '../recomendador-por-perfil.js';

export const AJUSTES_PERFIL_DOCUMENTARIO: AjustesPerfil = {
  [Papel.DIRETOR]: { entrevista: 0.9, pesquisa: 0.7, 'direcao-de-atores': -0.6 },
  [Papel.ROTEIRISTA]: { pesquisa: 0.5, dialogos: -0.4 },
  [Papel.SONOPLASTA]: { 'captacao-de-som': 0.2 },
};

export class RecomendadorDocumentario extends RecomendadorPorPerfil {
  constructor() {
    super(
      'recomendador-documentario',
      'Cosseno com o perfil de documentário: direção e roteiro voltados a entrevista e pesquisa, som direto reforçado.',
      AJUSTES_PERFIL_DOCUMENTARIO,
    );
  }
}
