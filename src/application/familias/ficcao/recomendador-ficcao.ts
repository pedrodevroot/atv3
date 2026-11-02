import { Papel } from '../../../domain/enums/papel.js';
import type { AjustesPerfil } from '../../strategies/catalogo-perfis.js';
import { RecomendadorPorPerfil } from '../recomendador-por-perfil.js';

export const AJUSTES_PERFIL_FICCAO: AjustesPerfil = {
  [Papel.DIRETOR]: { 'direcao-de-atores': 0.2 },
  [Papel.ROTEIRISTA]: { dramaturgia: 0.1 },
};

export class RecomendadorFiccao extends RecomendadorPorPerfil {
  constructor() {
    super(
      'recomendador-ficcao',
      'Cosseno com o perfil de ficção: direção de atores e dramaturgia em destaque.',
      AJUSTES_PERFIL_FICCAO,
    );
  }
}
