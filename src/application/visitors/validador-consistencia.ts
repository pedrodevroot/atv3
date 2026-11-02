import type { Equipe } from '../../domain/entidades/equipe.js';
import type { MembroEquipe } from '../../domain/entidades/membro-equipe.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Papel } from '../../domain/enums/papel.js';
import { StatusMembro } from '../../domain/enums/status.js';
import type { VisitanteProjeto } from '../../domain/visitante/visitante-projeto.js';
import { equipesRelevantes, formatarMoeda } from './navegacao.js';

export type Severidade = 'ERRO' | 'ALERTA';

export type CodigoProblema =
  | 'SEM_EQUIPE'
  | 'PAPEL_VAGO'
  | 'MEMBRO_RECUSADO'
  | 'ORCAMENTO_INSUFICIENTE'
  | 'PROFISSIONAL_DUPLICADO'
  | 'CUSTO_FORA_DA_FAIXA'
  | 'AGENDA_CONFLITANTE'
  | 'PROFISSIONAL_INATIVO'
  | 'TIPO_INCOMPATIVEL'
  | 'REQUISITO_DO_TIPO'
  | 'DETALHE_DO_TIPO'
  | 'PRAZO_DO_TIPO'
  | 'COMPETENCIA_DO_TIPO';

export interface Problema {
  readonly codigo: CodigoProblema;
  readonly severidade: Severidade;
  readonly mensagem: string;
  readonly equipeId?: string;
  readonly papel?: Papel;
  readonly profissionalId?: string;
}

export interface ResultadoValidacao {
  readonly valido: boolean;
  readonly problemas: readonly Problema[];
}

export function resultadoDe(problemas: readonly Problema[]): ResultadoValidacao {
  return { valido: problemas.every((problema) => problema.severidade !== 'ERRO'), problemas };
}

export function combinarValidacoes(resultados: readonly ResultadoValidacao[]): ResultadoValidacao {
  return resultadoDe(resultados.flatMap((resultado) => resultado.problemas));
}

export class ValidadorConsistencia implements VisitanteProjeto<ResultadoValidacao> {
  constructor(private readonly projeto: Projeto) {}

  visitarProjeto(projeto: Projeto): ResultadoValidacao {
    const equipes = equipesRelevantes(projeto);
    if (equipes.length === 0) {
      return this.resultado([
        {
          codigo: 'SEM_EQUIPE',
          severidade: 'ERRO',
          mensagem: 'O projeto ainda não tem equipe sugerida ou formada.',
        },
      ]);
    }
    return combinarValidacoes(equipes.map((equipe) => equipe.aceitar(this)));
  }

  visitarEquipe(equipe: Equipe): ResultadoValidacao {
    const problemas: Problema[] = [];
    for (const papel of equipe.papeisVagos(this.projeto.papeisObrigatorios)) {
      problemas.push({
        codigo: 'PAPEL_VAGO',
        severidade: 'ERRO',
        mensagem: `O papel obrigatório ${papel} não está preenchido.`,
        equipeId: equipe.id,
        papel,
      });
    }
    if (equipe.custoTotal > this.projeto.orcamento) {
      problemas.push({
        codigo: 'ORCAMENTO_INSUFICIENTE',
        severidade: 'ERRO',
        mensagem: `Custo da equipe (${formatarMoeda(equipe.custoTotal)}) excede o orçamento (${formatarMoeda(this.projeto.orcamento)}).`,
        equipeId: equipe.id,
      });
    }
    const vistos = new Set<string>();
    for (const membro of equipe.membros) {
      if (vistos.has(membro.profissional.id)) {
        problemas.push({
          codigo: 'PROFISSIONAL_DUPLICADO',
          severidade: 'ERRO',
          mensagem: `${membro.profissional.nome} ocupa mais de um papel na mesma equipe.`,
          equipeId: equipe.id,
          papel: membro.papel,
          profissionalId: membro.profissional.id,
        });
      }
      vistos.add(membro.profissional.id);
    }
    const daEquipe = (resultado: ResultadoValidacao) =>
      this.resultado(resultado.problemas.map((problema) => ({ ...problema, equipeId: equipe.id })));
    return combinarValidacoes([
      this.resultado(problemas),
      ...equipe.membros.map((membro) => daEquipe(membro.aceitar(this))),
    ]);
  }

  visitarMembro(membro: MembroEquipe): ResultadoValidacao {
    const problemas: Problema[] = [];
    const identificacao = { papel: membro.papel, profissionalId: membro.profissional.id };
    if (membro.status === StatusMembro.RECUSADO) {
      problemas.push({
        codigo: 'MEMBRO_RECUSADO',
        severidade: 'ERRO',
        mensagem: `${membro.profissional.nome} recusou o convite para ${membro.papel}.`,
        ...identificacao,
      });
    }
    if (!membro.profissional.faixaPreco.contem(membro.custo)) {
      problemas.push({
        codigo: 'CUSTO_FORA_DA_FAIXA',
        severidade: 'ALERTA',
        mensagem: `Custo de ${formatarMoeda(membro.custo)} está fora da faixa de ${membro.profissional.nome}.`,
        ...identificacao,
      });
    }
    const doMembro = membro.profissional
      .aceitar(this)
      .problemas.map((problema) => ({ ...problema, papel: membro.papel }));
    return combinarValidacoes([this.resultado(problemas), this.resultado(doMembro)]);
  }

  visitarProfissional(profissional: Profissional): ResultadoValidacao {
    const problemas: Problema[] = [];
    if (!profissional.ativo) {
      problemas.push({
        codigo: 'PROFISSIONAL_INATIVO',
        severidade: 'ERRO',
        mensagem: `${profissional.nome} está inativo no cadastro.`,
        profissionalId: profissional.id,
      });
    }
    if (!profissional.disponivelEm(this.projeto.periodo)) {
      problemas.push({
        codigo: 'AGENDA_CONFLITANTE',
        severidade: 'ERRO',
        mensagem: `${profissional.nome} não está disponível durante todo o período do projeto.`,
        profissionalId: profissional.id,
      });
    }
    return this.resultado(problemas);
  }

  private resultado(problemas: readonly Problema[]): ResultadoValidacao {
    return resultadoDe(problemas);
  }
}

export function validarProjeto(projeto: Projeto): ResultadoValidacao {
  return projeto.aceitar(new ValidadorConsistencia(projeto));
}
