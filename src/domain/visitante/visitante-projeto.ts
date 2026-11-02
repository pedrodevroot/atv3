import type { Equipe } from '../entidades/equipe.js';
import type { MembroEquipe } from '../entidades/membro-equipe.js';
import type { Profissional } from '../entidades/profissional.js';
import type { Projeto } from '../entidades/projeto.js';

export interface VisitanteProjeto<R> {
  visitarProjeto(projeto: Projeto): R;
  visitarEquipe(equipe: Equipe): R;
  visitarMembro(membro: MembroEquipe): R;
  visitarProfissional(profissional: Profissional): R;
}

export interface Visitavel {
  aceitar<R>(visitante: VisitanteProjeto<R>): R;
}
