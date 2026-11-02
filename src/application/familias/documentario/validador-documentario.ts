import type { MembroEquipe } from '../../../domain/entidades/membro-equipe.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import { ProjetoDocumentario } from '../../../domain/entidades/projetos/projeto-documentario.js';
import { Papel } from '../../../domain/enums/papel.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import type { Problema } from '../../visitors/validador-consistencia.js';
import { ValidadorTipoProjeto } from '../validador-tipo-projeto.js';

export class ValidadorDocumentario extends ValidadorTipoProjeto<ProjetoDocumentario> {
  readonly tipo = TipoCaptacao.DOCUMENTARIO;

  protected atende(projeto: Projeto): projeto is ProjetoDocumentario {
    return projeto instanceof ProjetoDocumentario;
  }

  protected regrasDoProjeto(projeto: ProjetoDocumentario): Problema[] {
    const problemas: Problema[] = [];
    if (projeto.entrevistados.length === 0) {
      problemas.push({
        codigo: 'DETALHE_DO_TIPO',
        severidade: 'ERRO',
        mensagem: 'Documentário precisa de ao menos um entrevistado.',
      });
    }
    if (!projeto.papeisObrigatorios.includes(Papel.SONOPLASTA)) {
      problemas.push({
        codigo: 'REQUISITO_DO_TIPO',
        severidade: 'ALERTA',
        mensagem:
          'Documentário sem SONOPLASTA: ninguém responde pela captação de som das entrevistas.',
      });
    }
    return problemas;
  }

  protected regrasDoMembro(membro: MembroEquipe): Problema[] {
    return this.exigirCompetencias(
      membro,
      Papel.DIRETOR,
      ['entrevista', 'pesquisa'],
      'a direção de documentário conduz as entrevistas.',
    );
  }
}
