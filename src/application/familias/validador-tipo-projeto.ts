import type { Equipe } from '../../domain/entidades/equipe.js';
import type { MembroEquipe } from '../../domain/entidades/membro-equipe.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { VisitanteProjeto } from '../../domain/visitante/visitante-projeto.js';
import { equipesRelevantes } from '../visitors/navegacao.js';
import {
  combinarValidacoes,
  resultadoDe,
  type Problema,
  type ResultadoValidacao,
} from '../visitors/validador-consistencia.js';

export abstract class ValidadorTipoProjeto<
  P extends Projeto,
> implements VisitanteProjeto<ResultadoValidacao> {
  abstract readonly tipo: string;

  visitarProjeto(projeto: Projeto): ResultadoValidacao {
    if (!this.atende(projeto)) {
      return resultadoDe([
        {
          codigo: 'TIPO_INCOMPATIVEL',
          severidade: 'ERRO',
          mensagem: `O validador de ${this.tipo} não valida projetos do tipo ${projeto.tipoCaptacao}.`,
        },
      ]);
    }
    return combinarValidacoes([
      resultadoDe(this.regrasDoProjeto(projeto)),
      ...equipesRelevantes(projeto).map((equipe) => equipe.aceitar(this)),
    ]);
  }

  visitarEquipe(equipe: Equipe): ResultadoValidacao {
    return combinarValidacoes(
      equipe.membros.map((membro) =>
        resultadoDe(
          membro.aceitar(this).problemas.map((problema) => ({ ...problema, equipeId: equipe.id })),
        ),
      ),
    );
  }

  visitarMembro(membro: MembroEquipe): ResultadoValidacao {
    return resultadoDe(this.regrasDoMembro(membro));
  }

  visitarProfissional(): ResultadoValidacao {
    return resultadoDe([]);
  }

  protected abstract atende(projeto: Projeto): projeto is P;

  protected abstract regrasDoProjeto(projeto: P): Problema[];

  protected abstract regrasDoMembro(membro: MembroEquipe): Problema[];

  protected exigirCompetencias(
    membro: MembroEquipe,
    papel: Papel,
    competencias: readonly string[],
    motivo: string,
  ): Problema[] {
    const possui = competencias.some(
      (competencia) => membro.profissional.vetorCompetencias.valor(competencia) > 0,
    );
    if (membro.papel !== papel || possui) {
      return [];
    }
    return [
      {
        codigo: 'COMPETENCIA_DO_TIPO',
        severidade: 'ALERTA',
        mensagem: `${membro.profissional.nome} não registra ${competencias.join(' nem ')}; ${motivo}`,
        papel: membro.papel,
        profissionalId: membro.profissional.id,
      },
    ];
  }
}
