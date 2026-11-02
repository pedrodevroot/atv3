import type { MembroEquipe } from '../../../domain/entidades/membro-equipe.js';
import type { Projeto } from '../../../domain/entidades/projeto.js';
import { ProjetoAnimacao } from '../../../domain/entidades/projetos/projeto-animacao.js';
import { Papel } from '../../../domain/enums/papel.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import type { Problema } from '../../visitors/validador-consistencia.js';
import { ValidadorTipoProjeto } from '../validador-tipo-projeto.js';

export class ValidadorAnimacao extends ValidadorTipoProjeto<ProjetoAnimacao> {
  readonly tipo = TipoCaptacao.ANIMACAO;

  protected atende(projeto: Projeto): projeto is ProjetoAnimacao {
    return projeto instanceof ProjetoAnimacao;
  }

  protected regrasDoProjeto(projeto: ProjetoAnimacao): Problema[] {
    const problemas: Problema[] = [];
    if (!projeto.papeisObrigatorios.includes(Papel.EFEITOS_VISUAIS)) {
      problemas.push({
        codigo: 'REQUISITO_DO_TIPO',
        severidade: 'ERRO',
        mensagem: 'Animação exige o papel EFEITOS_VISUAIS.',
      });
    }
    if (projeto.softwares.length === 0) {
      problemas.push({
        codigo: 'DETALHE_DO_TIPO',
        severidade: 'ALERTA',
        mensagem: 'Informe os softwares do pipeline de animação para orientar a equipe.',
      });
    }
    return problemas;
  }

  protected regrasDoMembro(membro: MembroEquipe): Problema[] {
    return this.exigirCompetencias(
      membro,
      Papel.EFEITOS_VISUAIS,
      ['modelagem-3d', 'animacao'],
      'o pipeline de animação depende de modelagem e animação.',
    );
  }
}
