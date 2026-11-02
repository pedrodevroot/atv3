import type { Equipe } from '../../domain/entidades/equipe.js';
import { MembroEquipe } from '../../domain/entidades/membro-equipe.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import { Recomendacao } from '../../domain/entidades/recomendacao.js';
import type { Papel } from '../../domain/enums/papel.js';
import { ErroAplicacao } from '../erros/erro-aplicacao.js';
import type { FabricaProjeto } from '../familias/fabrica-projeto.js';
import { relogioDoSistema, type Relogio } from '../ports/relogio.js';
import type {
  CriteriosBusca,
  RepositorioProfissionais,
  ResultadoBusca,
} from '../ports/repositorio-profissionais.js';
import type {
  CandidatoRanqueado,
  EstrategiaRecomendacao,
  RankingPorPapel,
} from '../strategies/estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from '../strategies/parametros-recomendacao.js';

export const EtapaOrquestracao = {
  VALIDAR: 'validarRestricoes',
  BUSCAR: 'buscarCandidatos',
  NORMALIZAR: 'normalizarDados',
  RANQUEAR: 'ranquear',
  POS_PROCESSAR: 'posProcessar',
  MONTAR: 'montarEquipes',
  REGISTRAR: 'registrarRecomendacoes',
} as const;

export type EtapaOrquestracao = (typeof EtapaOrquestracao)[keyof typeof EtapaOrquestracao];

export const ORDEM_ETAPAS: readonly EtapaOrquestracao[] = Object.values(EtapaOrquestracao);

export interface EntradaOrquestracao {
  readonly projeto: Projeto;
  readonly estrategia?: EstrategiaRecomendacao;
  readonly parametros: ParametrosRecomendacao;
}

export type EntradaResolvida<TEntrada extends EntradaOrquestracao> = TEntrada & {
  readonly estrategia: EstrategiaRecomendacao;
};

export interface ResultadoMontagem {
  readonly equipes: readonly Equipe[];
  readonly avisos: readonly string[];
}

export interface ResultadoOrquestracao {
  readonly estrategia: string;
  readonly equipes: readonly Equipe[];
  readonly ranking: RankingPorPapel;
  readonly recomendacoes: readonly Recomendacao[];
  readonly rodada: number;
  readonly parcial: boolean;
  readonly papeisSemCandidatos: readonly Papel[];
  readonly avisos: readonly string[];
  readonly etapas: readonly EtapaOrquestracao[];
}

export abstract class OrquestradorEquipe<
  TEntrada extends EntradaOrquestracao = EntradaOrquestracao,
> {
  constructor(
    protected readonly repositorio: RepositorioProfissionais,
    protected readonly fabrica: FabricaProjeto,
    protected readonly relogio: Relogio = relogioDoSistema,
  ) {
    if (this.orquestrar !== OrquestradorEquipe.prototype.orquestrar) {
      throw new ErroAplicacao(
        'FLUXO_INVARIAVEL',
        `${new.target.name} não pode sobrescrever orquestrar(): o fluxo principal é invariável.`,
      );
    }
  }

  async orquestrar(pedido: TEntrada): Promise<ResultadoOrquestracao> {
    const entrada: EntradaResolvida<TEntrada> = {
      ...pedido,
      estrategia: pedido.estrategia ?? this.fabrica.criarRecomendador(),
    };
    const etapas: EtapaOrquestracao[] = [];
    const executar = <T>(etapa: EtapaOrquestracao, acao: () => T): T => {
      etapas.push(etapa);
      return acao();
    };

    executar(EtapaOrquestracao.VALIDAR, () => {
      this.validarRegrasDoTipo(entrada);
      this.validarRestricoes(entrada);
    });
    const busca = await executar(EtapaOrquestracao.BUSCAR, () => this.buscarCandidatos(entrada));
    const candidatos = executar(EtapaOrquestracao.NORMALIZAR, () =>
      this.normalizarDados(entrada, busca.profissionais),
    );
    const ranking = executar(EtapaOrquestracao.RANQUEAR, () => this.ranquear(entrada, candidatos));
    const refinado = executar(EtapaOrquestracao.POS_PROCESSAR, () =>
      this.posProcessar(entrada, ranking),
    );
    const rodada = this.rodadaDe(entrada);
    const montagem = executar(EtapaOrquestracao.MONTAR, () =>
      this.montarEquipes(entrada, refinado, rodada),
    );
    const recomendacoes = executar(EtapaOrquestracao.REGISTRAR, () =>
      this.registrarRecomendacoes(entrada, refinado, rodada),
    );

    const papeisSemCandidatos = [...refinado]
      .filter(([, lista]) => lista.length === 0)
      .map(([papel]) => papel);

    return {
      estrategia: entrada.estrategia.nome,
      equipes: montagem.equipes,
      ranking: refinado,
      recomendacoes,
      rodada,
      parcial: busca.parcial || papeisSemCandidatos.length > 0,
      papeisSemCandidatos,
      avisos: [
        ...busca.avisos,
        ...papeisSemCandidatos.map((papel) => `Nenhum candidato elegível para ${papel}.`),
        ...montagem.avisos,
      ],
      etapas,
    };
  }

  protected abstract validarRestricoes(entrada: EntradaResolvida<TEntrada>): void;

  protected abstract criteriosDeBusca(entrada: EntradaResolvida<TEntrada>): CriteriosBusca;

  protected abstract normalizarDados(
    entrada: EntradaResolvida<TEntrada>,
    profissionais: readonly Profissional[],
  ): Profissional[];

  protected abstract posProcessar(
    entrada: EntradaResolvida<TEntrada>,
    ranking: RankingPorPapel,
  ): RankingPorPapel;

  protected abstract montarEquipes(
    entrada: EntradaResolvida<TEntrada>,
    ranking: RankingPorPapel,
    rodada: number,
  ): ResultadoMontagem;

  protected buscarCandidatos(entrada: EntradaResolvida<TEntrada>): Promise<ResultadoBusca> {
    return this.repositorio.buscarCandidatos(this.criteriosDeBusca(entrada));
  }

  protected exigeRegrasDoTipo(): boolean {
    return true;
  }

  protected rodadaDe(entrada: EntradaResolvida<TEntrada>): number {
    return 1 + Math.max(0, ...entrada.projeto.equipes.map((equipe) => equipe.rodada));
  }

  protected normalizarCadastro(profissionais: readonly Profissional[]): Profissional[] {
    const unicos = new Map<string, Profissional>();
    for (const profissional of profissionais) {
      if (profissional.ativo) {
        unicos.set(profissional.id, profissional);
      }
    }
    return [...unicos.values()];
  }

  protected filtrarRanking(
    ranking: RankingPorPapel,
    manter: (candidato: CandidatoRanqueado, papel: Papel) => boolean,
  ): RankingPorPapel {
    return new Map(
      [...ranking].map(([papel, lista]) => [
        papel,
        lista.filter((candidato) => manter(candidato, papel)),
      ]),
    );
  }

  protected membroDe(candidato: CandidatoRanqueado): MembroEquipe {
    return MembroEquipe.criar({
      papel: candidato.papel,
      profissional: candidato.profissional,
      custo: candidato.custoEstimado,
      score: candidato.score,
    });
  }

  protected violacao(mensagem: string): never {
    throw new ErroAplicacao('RESTRICAO_VIOLADA', mensagem);
  }

  private validarRegrasDoTipo(entrada: EntradaResolvida<TEntrada>): void {
    if (!this.exigeRegrasDoTipo()) {
      return;
    }
    const erros = entrada.projeto
      .aceitar(this.fabrica.criarValidador())
      .problemas.filter((problema) => problema.severidade === 'ERRO');
    if (erros.length > 0) {
      this.violacao(erros.map((problema) => problema.mensagem).join(' '));
    }
  }

  private ranquear(
    entrada: EntradaResolvida<TEntrada>,
    candidatos: readonly Profissional[],
  ): RankingPorPapel {
    return entrada.estrategia.recomendar(entrada.projeto, candidatos, entrada.parametros);
  }

  private registrarRecomendacoes(
    entrada: EntradaResolvida<TEntrada>,
    ranking: RankingPorPapel,
    rodada: number,
  ): Recomendacao[] {
    const criadaEm = this.relogio();
    return [...ranking.values()].flatMap((lista) =>
      lista.map((candidato, indice) =>
        Recomendacao.criar({
          projetoId: entrada.projeto.id,
          papel: candidato.papel,
          profissionalId: candidato.profissional.id,
          score: candidato.score,
          posicao: indice + 1,
          estrategia: entrada.estrategia.nome,
          rodada,
          justificativa: candidato.justificativa,
          criadaEm,
        }),
      ),
    );
  }
}
