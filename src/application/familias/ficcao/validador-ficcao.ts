import type { MembroEquipe } from '../../../domain/entidades/membro-equipe.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import { ProjetoFiccao } from '../../../domain/entidades/projetos/projeto-ficcao.js';
import { Papel } from '../../../domain/enums/papel.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import type { Problema } from '../../visitors/validador-consistencia.js';
import { ValidadorTipoProjeto } from '../validador-tipo-projeto.js';

export class ValidadorFiccao extends ValidadorTipoProjeto<ProjetoFiccao> {
  readonly tipo = TipoCaptacao.FICCAO;

  protected atende(projeto: Projeto): projeto is ProjetoFiccao {
    return projeto instanceof ProjetoFiccao;
  }

  protected regrasDoProjeto(): Problema[] {
    return [];
  }

  protected regrasDoMembro(membro: MembroEquipe): Problema[] {
    return this.exigirCompetencias(
      membro,
      Papel.DIRETOR,
      ['direcao-de-atores'],
      'a ficção depende da direção do elenco.',
    );
  }
}
