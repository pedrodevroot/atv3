import type {
  AjustesProjeto,
  DetalhesProjeto,
  Projeto,
  ResultadoReavaliacao,
} from '../../domain/entidades/projeto.js';
import { RequisitoPapel } from '../../domain/entidades/requisito-papel.js';
import type { Papel } from '../../domain/enums/papel.js';
import { criarEvento } from '../../domain/eventos/evento-recomendacao.js';
import { Localizacao, type DadosLocalizacao } from '../../domain/value-objects/localizacao.js';
import {
  ORIGEM_SERVICO,
  eventoRecomendacaoGerada,
  membrosSugeridos,
} from '../eventos/fabrica-eventos.js';
import { comNovasTentativas } from '../erros/erro-aplicacao.js';
import type { ResultadoOrquestracao } from '../orchestration/orquestrador-equipe.js';
import {
  resolverParametros,
  type ParametrosRecomendacaoParciais,
} from '../strategies/parametros-recomendacao.js';
import {
  obterProjeto,
  type ContextoRequisicao,
  type DependenciasCasosDeUso,
} from './dependencias.js';

export interface OpcoesRodada {
  readonly estrategia?: string;
  readonly parametros?: ParametrosRecomendacaoParciais;
}

export interface ResultadoRodada {
  readonly projeto: Projeto;
  readonly resultado: ResultadoOrquestracao;
}

export class GerarRodadaRecomendacao {
  constructor(private readonly deps: DependenciasCasosDeUso) {}

  async executar(
    projeto: Projeto,
    opcoes: OpcoesRodada,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoRodada> {
    const { sistema, projetos, recomendacoes, convites } = this.deps;
    const parametros = opcoes.parametros
      ? resolverParametros(opcoes.parametros)
      : this.deps.parametros;

    const resultado = await sistema.recomendar(projeto, {
      ...(opcoes.estrategia ? { estrategia: opcoes.estrategia } : {}),
      parametros,
    });
    projeto.definirEstrategia(resultado.estrategia);
    const descartadas =
      resultado.equipes.length > 0 ? projeto.equipesAtivas.map((equipe) => equipe.id) : [];
    if (resultado.equipes.length > 0) {
      projeto.registrarSugestoes(resultado.equipes);
    }
    await projetos.salvar(projeto);
    await convites.cancelarPendentesDasEquipes(descartadas);
    await recomendacoes.salvarTodas(resultado.recomendacoes);

    sistema.notificarObservadores(
      eventoRecomendacaoGerada(
        {
          projeto,
          equipes: resultado.equipes,
          membros: membrosSugeridos(resultado.equipes),
          estrategia: resultado.estrategia,
          rodada: resultado.rodada,
          parcial: resultado.parcial,
        },
        contexto,
      ),
      projeto,
    );
    return { projeto, resultado };
  }
}

export interface DadosNovoProjeto {
  readonly titulo: string;
  readonly produtorId: string;
  readonly genero: string;
  readonly tipoCaptacao: string;
  readonly duracaoMinutos: number;
  readonly orcamento: number;
  readonly dataInicio: Date;
  readonly dataEntrega: Date;
  readonly localizacao: DadosLocalizacao;
  readonly requisitos: readonly { papel: Papel; peso: number }[];
  readonly detalhes?: DetalhesProjeto;
  readonly estrategia?: string;
  readonly parametros?: ParametrosRecomendacaoParciais;
}

export class CriarProjetoERecomendar {
  constructor(
    private readonly deps: DependenciasCasosDeUso,
    private readonly gerarRodada: GerarRodadaRecomendacao,
  ) {}

  async executar(dados: DadosNovoProjeto, contexto: ContextoRequisicao): Promise<ResultadoRodada> {
    const { fabricas, sistema, relogio } = this.deps;
    const fabrica = fabricas.para(dados.tipoCaptacao);
    const projeto = fabrica.criarProjeto({
      titulo: dados.titulo,
      produtorId: dados.produtorId,
      genero: dados.genero,
      duracaoMinutos: dados.duracaoMinutos,
      orcamento: dados.orcamento,
      dataInicio: dados.dataInicio,
      dataEntrega: dados.dataEntrega,
      localizacao: Localizacao.criar(dados.localizacao),
      requisitos: dados.requisitos.map((requisito) =>
        RequisitoPapel.criar(requisito.papel, requisito.peso),
      ),
      detalhes: dados.detalhes ?? {},
      estrategia:
        dados.estrategia ?? sistema.estrategiaSugerida(dados.tipoCaptacao, dados.orcamento),
      criadoEm: relogio(),
    });
    return this.gerarRodada.executar(
      projeto,
      dados.parametros ? { parametros: dados.parametros } : {},
      contexto,
    );
  }
}

export interface DadosProjetoDeModelo {
  readonly modeloId: string;
  readonly titulo: string;
  readonly produtorId: string;
  readonly dataInicio: Date;
  readonly dataEntrega: Date;
  readonly genero?: string;
  readonly duracaoMinutos?: number;
  readonly orcamento?: number;
  readonly localizacao?: DadosLocalizacao;
  readonly requisitos?: readonly { papel: Papel; peso: number }[];
  readonly detalhes?: DetalhesProjeto;
  readonly estrategia?: string;
  readonly parametros?: ParametrosRecomendacaoParciais;
}

export class CriarProjetoDeModelo {
  constructor(
    private readonly deps: DependenciasCasosDeUso,
    private readonly gerarRodada: GerarRodadaRecomendacao,
  ) {}

  async executar(
    dados: DadosProjetoDeModelo,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoRodada> {
    const { modelos, sistema, relogio } = this.deps;
    const ajustes: AjustesProjeto = {
      titulo: dados.titulo,
      produtorId: dados.produtorId,
      dataInicio: dados.dataInicio,
      dataEntrega: dados.dataEntrega,
      criadoEm: relogio(),
      ...(dados.genero === undefined ? {} : { genero: dados.genero }),
      ...(dados.duracaoMinutos === undefined ? {} : { duracaoMinutos: dados.duracaoMinutos }),
      ...(dados.orcamento === undefined ? {} : { orcamento: dados.orcamento }),
      ...(dados.localizacao === undefined
        ? {}
        : { localizacao: Localizacao.criar(dados.localizacao) }),
      ...(dados.requisitos === undefined
        ? {}
        : {
            requisitos: dados.requisitos.map((requisito) =>
              RequisitoPapel.criar(requisito.papel, requisito.peso),
            ),
          }),
      ...(dados.detalhes === undefined ? {} : { detalhes: dados.detalhes }),
    };
    const projeto = modelos.clonar(dados.modeloId, ajustes);
    return this.gerarRodada.executar(
      projeto,
      {
        estrategia:
          dados.estrategia ?? sistema.estrategiaSugerida(projeto.tipoCaptacao, projeto.orcamento),
        ...(dados.parametros ? { parametros: dados.parametros } : {}),
      },
      contexto,
    );
  }
}

export class RecomendarNovamente {
  constructor(
    private readonly deps: DependenciasCasosDeUso,
    private readonly gerarRodada: GerarRodadaRecomendacao,
  ) {}

  executar(
    projetoId: string,
    opcoes: OpcoesRodada,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoRodada> {
    return comNovasTentativas(async () => {
      const projeto = await obterProjeto(this.deps.projetos, projetoId);
      return this.gerarRodada.executar(projeto, opcoes, contexto);
    });
  }
}

export class AjustarDetalhesProjeto {
  constructor(private readonly deps: DependenciasCasosDeUso) {}

  executar(
    projetoId: string,
    detalhes: DetalhesProjeto,
    contexto: ContextoRequisicao,
  ): Promise<Projeto> {
    return comNovasTentativas(async () => {
      const projeto = await obterProjeto(this.deps.projetos, projetoId);
      projeto.ajustarDetalhes(detalhes);
      await this.deps.projetos.salvar(projeto);
      this.deps.sistema.notificarObservadores(
        criarEvento(
          'DETALHES_ATUALIZADOS',
          {
            projetoId: projeto.id,
            produtorId: projeto.produtorId,
            detalhes: { ...projeto.detalhes },
          },
          { origem: ORIGEM_SERVICO, ...contexto },
        ),
        projeto,
      );
      return projeto;
    });
  }
}

export interface DadosReavaliacao {
  readonly orcamento?: number;
  readonly dataEntrega?: Date;
  readonly limiar?: number;
}

export interface ResultadoReavaliacaoProjeto {
  readonly projeto: Projeto;
  readonly reavaliacao: ResultadoReavaliacao;
  readonly rodada?: ResultadoRodada;
}

export class ReavaliarProjeto {
  constructor(
    private readonly deps: DependenciasCasosDeUso,
    private readonly gerarRodada: GerarRodadaRecomendacao,
  ) {}

  executar(
    projetoId: string,
    dados: DadosReavaliacao,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoReavaliacaoProjeto> {
    return comNovasTentativas(() => this.tentar(projetoId, dados, contexto));
  }

  private async tentar(
    projetoId: string,
    dados: DadosReavaliacao,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoReavaliacaoProjeto> {
    const projeto = await obterProjeto(this.deps.projetos, projetoId);
    const reavaliacao = projeto.solicitarReavaliacao(
      {
        ...(dados.orcamento === undefined ? {} : { orcamento: dados.orcamento }),
        ...(dados.dataEntrega === undefined ? {} : { dataEntrega: dados.dataEntrega }),
      },
      dados.limiar,
    );
    const rodada = reavaliacao.significativa
      ? await this.gerarRodada.executar(projeto, {}, contexto)
      : undefined;
    if (!rodada) {
      await this.deps.projetos.salvar(projeto);
    }
    this.deps.sistema.notificarObservadores(
      criarEvento(
        'REAVALIACAO_SOLICITADA',
        { projetoId: projeto.id, produtorId: projeto.produtorId, ...reavaliacao },
        { origem: ORIGEM_SERVICO, ...contexto },
      ),
      projeto,
    );
    return rodada ? { projeto, reavaliacao, rodada } : { projeto, reavaliacao };
  }
}
