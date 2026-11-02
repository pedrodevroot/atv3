import type { MembroEquipe } from '../../../domain/entidades/membro-equipe.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import { ProjetoPublicitario } from '../../../domain/entidades/projetos/projeto-publicitario.js';
import { Papel } from '../../../domain/enums/papel.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import type { Problema } from '../../visitors/validador-consistencia.js';
import { ValidadorTipoProjeto } from '../validador-tipo-projeto.js';

export const PRAZO_MAXIMO_PUBLICITARIO_DIAS = 90;

export class ValidadorPublicitario extends ValidadorTipoProjeto<ProjetoPublicitario> {
  readonly tipo = TipoCaptacao.PUBLICITARIO;

  protected atende(projeto: Projeto): projeto is ProjetoPublicitario {
    return projeto instanceof ProjetoPublicitario;
  }

  protected regrasDoProjeto(projeto: ProjetoPublicitario): Problema[] {
    const problemas: Problema[] = [];
    if (projeto.veiculacao.length === 0) {
      problemas.push({
        codigo: 'DETALHE_DO_TIPO',
        severidade: 'ERRO',
        mensagem: 'Peça publicitária precisa de ao menos um meio de veiculação.',
      });
    }
    if (projeto.periodo.duracaoDias > PRAZO_MAXIMO_PUBLICITARIO_DIAS) {
      problemas.push({
        codigo: 'PRAZO_DO_TIPO',
        severidade: 'ALERTA',
        mensagem: `Campanhas costumam ser entregues em até ${PRAZO_MAXIMO_PUBLICITARIO_DIAS} dias; o prazo atual é de ${projeto.periodo.duracaoDias} dias.`,
      });
    }
    return problemas;
  }

  protected regrasDoMembro(membro: MembroEquipe): Problema[] {
    return this.exigirCompetencias(
      membro,
      Papel.EDITOR,
      ['ritmo-narrativo'],
      'peças curtas dependem de ritmo de edição.',
    );
  }
}
