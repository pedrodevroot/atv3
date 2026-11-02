import type { Equipe } from '../../domain/entidades/equipe.js';
import type { MembroEquipe } from '../../domain/entidades/membro-equipe.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import { StatusMembro } from '../../domain/enums/status.js';
import type { VisitanteProjeto } from '../../domain/visitante/visitante-projeto.js';
import { arredondar, mediaPonderada, normalizarNota } from '../strategies/pontuacao.js';
import { equipesRelevantes } from './navegacao.js';

export interface PesosCompatibilidade {
  readonly score: number;
  readonly reputacao: number;
}

export const PESOS_COMPATIBILIDADE_PADRAO: PesosCompatibilidade = Object.freeze({
  score: 0.7,
  reputacao: 0.3,
});

const REPUTACAO_NEUTRA = 0.5;

export class CalculadorCompatibilidade implements VisitanteProjeto<number> {
  constructor(
    private readonly projeto: Projeto,
    private readonly pesos: PesosCompatibilidade = PESOS_COMPATIBILIDADE_PADRAO,
  ) {}

  visitarProjeto(projeto: Projeto): number {
    const equipes = equipesRelevantes(projeto);
    return equipes.length === 0 ? 0 : Math.max(...equipes.map((equipe) => equipe.aceitar(this)));
  }

  visitarEquipe(equipe: Equipe): number {
    const total = this.projeto.requisitos.reduce(
      (soma, requisito) =>
        soma +
        this.projeto.pesoNormalizado(requisito.papel) *
          (equipe.membro(requisito.papel)?.aceitar(this) ?? 0),
      0,
    );
    return arredondar(total);
  }

  visitarMembro(membro: MembroEquipe): number {
    if (
      membro.status === StatusMembro.RECUSADO ||
      !membro.profissional.disponivelEm(this.projeto.periodo)
    ) {
      return 0;
    }
    return arredondar(
      mediaPonderada([
        [membro.score, this.pesos.score],
        [membro.profissional.aceitar(this), this.pesos.reputacao],
      ]),
    );
  }

  visitarProfissional(profissional: Profissional): number {
    return profissional.totalAvaliacoes === 0
      ? REPUTACAO_NEUTRA
      : arredondar(normalizarNota(profissional.notaMedia));
  }
}

export function calcularCompatibilidade(projeto: Projeto): number {
  return projeto.aceitar(new CalculadorCompatibilidade(projeto));
}
