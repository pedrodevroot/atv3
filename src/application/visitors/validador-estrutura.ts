import type { Projeto } from '../../domain/entidades/projeto.js';
import type { VisitanteProjeto } from '../../domain/visitante/visitante-projeto.js';
import { formatarMoeda } from './navegacao.js';
import { resultadoDe, type Problema, type ResultadoValidacao } from './validador-consistencia.js';

function problemaDeEstrutura(mensagem: string): Problema {
  return { codigo: 'ESTRUTURA_SERVICOS', severidade: 'ERRO', mensagem };
}

export class ValidadorEstrutura implements VisitanteProjeto<ResultadoValidacao> {
  visitarProjeto(projeto: Projeto): ResultadoValidacao {
    const problemas = projeto.servicoPrincipal.validar().map(problemaDeEstrutura);
    const custo = projeto.calcularCustoTotal();
    if (custo > projeto.orcamento) {
      problemas.push(
        problemaDeEstrutura(
          `Custo dos serviços (${formatarMoeda(custo)}) excede o orçamento (${formatarMoeda(projeto.orcamento)}).`,
        ),
      );
    }
    const prazo = projeto.obterPrazoTotal();
    if (prazo > projeto.periodo.duracaoDias) {
      problemas.push(
        problemaDeEstrutura(
          `Prazo dos serviços (${prazo} dias) excede o período do projeto (${projeto.periodo.duracaoDias} dias).`,
        ),
      );
    }
    return resultadoDe(problemas);
  }

  visitarEquipe(): ResultadoValidacao {
    return resultadoDe([]);
  }

  visitarMembro(): ResultadoValidacao {
    return resultadoDe([]);
  }

  visitarProfissional(): ResultadoValidacao {
    return resultadoDe([]);
  }
}
