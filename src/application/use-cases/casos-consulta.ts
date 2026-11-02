import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Recomendacao } from '../../domain/entidades/recomendacao.js';
import type { FabricaProjeto } from '../familias/fabrica-projeto.js';
import type { EntradaAuditoria, Notificacao } from '../ports/canais-saida.js';
import type { ModeloProjeto } from '../prototipos/catalogo-modelos.js';
import type { EstrategiaRecomendacao } from '../strategies/estrategia-recomendacao.js';
import { CalculadorCompatibilidade } from '../visitors/calculador-compatibilidade.js';
import {
  ValidadorConsistencia,
  combinarValidacoes,
  type ResultadoValidacao,
} from '../visitors/validador-consistencia.js';
import { obterProjeto, type DependenciasCasosDeUso } from './dependencias.js';

export interface LeitorAuditoria {
  listarPorProjeto(projetoId: string): Promise<EntradaAuditoria[]>;
}

export interface LeitorMensagens {
  mensagensDe(destinatarioId: string): Promise<Notificacao[]>;
}

export interface AnaliseComposicao {
  readonly projeto: Projeto;
  readonly validacao: ResultadoValidacao;
  readonly compatibilidade: number;
  readonly relatorio: string;
}

export class ConsultasRecomendacao {
  constructor(
    private readonly deps: DependenciasCasosDeUso,
    private readonly auditoria: LeitorAuditoria,
    private readonly mensagens: LeitorMensagens,
  ) {}

  obterProjeto(projetoId: string): Promise<Projeto> {
    return obterProjeto(this.deps.projetos, projetoId);
  }

  async analisar(projetoId: string, equipeId?: string): Promise<AnaliseComposicao> {
    const projeto = await this.obterProjeto(projetoId);
    const alvo = equipeId ? projeto.equipe(equipeId) : projeto;
    const fabrica = this.deps.sistema.fabricaPara(projeto);
    return {
      projeto,
      validacao: combinarValidacoes([
        alvo.aceitar(new ValidadorConsistencia(projeto)),
        alvo.aceitar(fabrica.criarValidador()),
      ]),
      compatibilidade: alvo.aceitar(new CalculadorCompatibilidade(projeto)),
      relatorio: alvo.aceitar(fabrica.criarGeradorRelatorio(projeto, this.deps.relogio())),
    };
  }

  listarEstrategias(): EstrategiaRecomendacao[] {
    return this.deps.estrategias.listar();
  }

  listarTiposProjeto(): FabricaProjeto[] {
    return this.deps.fabricas.listar();
  }

  listarModelos(): ModeloProjeto[] {
    return this.deps.modelos.listar();
  }

  async listarRecomendacoes(projetoId: string): Promise<Recomendacao[]> {
    await this.obterProjeto(projetoId);
    return this.deps.recomendacoes.listarPorProjeto(projetoId);
  }

  async listarAuditoria(projetoId: string): Promise<EntradaAuditoria[]> {
    await this.obterProjeto(projetoId);
    return this.auditoria.listarPorProjeto(projetoId);
  }

  listarMensagens(destinatarioId: string): Promise<Notificacao[]> {
    return this.mensagens.mensagensDe(destinatarioId);
  }
}
