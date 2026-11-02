import type { Projeto } from '../domain/entidades/projeto.js';
import type { Papel } from '../domain/enums/papel.js';
import type { EventoRecomendacao } from '../domain/eventos/evento-recomendacao.js';
import type { VisitanteProjeto } from '../domain/visitante/visitante-projeto.js';
import { eventoRecomendacaoGerada, membrosSugeridos } from './eventos/fabrica-eventos.js';
import type { FabricaProjeto } from './familias/fabrica-projeto.js';
import type { RegistroFabricas } from './familias/registro-fabricas.js';
import type { ResultadoOrquestracao } from './orchestration/orquestrador-equipe.js';
import { OrquestradorPadrao } from './orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from './orchestration/orquestrador-substituicao.js';
import type { Observador, Sujeito } from './ports/observador.js';
import { relogioDoSistema, type Relogio } from './ports/relogio.js';
import type { RepositorioProfissionais } from './ports/repositorio-profissionais.js';
import type { EstrategiaRecomendacao } from './strategies/estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from './strategies/parametros-recomendacao.js';
import type { RegistroEstrategias } from './strategies/registro-estrategias.js';
import type { ResultadoValidacao } from './visitors/validador-consistencia.js';

export type RecomendacaoStrategy = EstrategiaRecomendacao;

export interface DependenciasSistemaRecomendacao {
  readonly repositorio: RepositorioProfissionais;
  readonly fabricas: RegistroFabricas;
  readonly estrategias: RegistroEstrategias;
  readonly sujeito: Sujeito;
  readonly parametros: ParametrosRecomendacao;
  readonly relogio?: Relogio;
}

export interface EcossistemaProjeto {
  readonly fabrica: FabricaProjeto;
  readonly orquestrador: OrquestradorPadrao;
  readonly substituicao: OrquestradorSubstituicao;
  readonly validador: VisitanteProjeto<ResultadoValidacao>;
  readonly recomendador: RecomendacaoStrategy;
  readonly notificador: Observador;
}

export interface OpcoesExecucao {
  readonly estrategia?: RecomendacaoStrategy | string;
  readonly parametros?: ParametrosRecomendacao;
}

export interface AlvoSubstituicao {
  readonly equipeId: string;
  readonly papel: Papel;
}

export class SistemaRecomendacao {
  private estrategiaAtual: RecomendacaoStrategy | undefined;

  constructor(
    private readonly dependencias: DependenciasSistemaRecomendacao,
    estrategiaInicial?: RecomendacaoStrategy | string,
  ) {
    if (estrategiaInicial !== undefined) {
      this.definirEstrategia(estrategiaInicial);
    }
  }

  get estrategia(): RecomendacaoStrategy | undefined {
    return this.estrategiaAtual;
  }

  definirEstrategia(estrategia: RecomendacaoStrategy | string): void {
    this.estrategiaAtual =
      typeof estrategia === 'string' ? this.dependencias.estrategias.obter(estrategia) : estrategia;
  }

  usarEstrategiaDoTipo(): void {
    this.estrategiaAtual = undefined;
  }

  fabricaPara(projeto: Projeto): FabricaProjeto {
    return this.dependencias.fabricas.para(projeto.tipoCaptacao);
  }

  criarEcossistema(projeto: Projeto): EcossistemaProjeto {
    const fabrica = this.fabricaPara(projeto);
    const { repositorio } = this.dependencias;
    const relogio = this.dependencias.relogio ?? relogioDoSistema;
    return {
      fabrica,
      orquestrador: new OrquestradorPadrao(repositorio, fabrica, relogio),
      substituicao: new OrquestradorSubstituicao(repositorio, fabrica, relogio),
      validador: fabrica.criarValidador(),
      recomendador: fabrica.criarRecomendador(),
      notificador: fabrica.criarNotificador(),
    };
  }

  async recomendar(projeto: Projeto, opcoes: OpcoesExecucao = {}): Promise<ResultadoOrquestracao> {
    return this.recomendarCom(this.criarEcossistema(projeto), projeto, opcoes);
  }

  async substituir(
    projeto: Projeto,
    alvo: AlvoSubstituicao,
    opcoes: OpcoesExecucao = {},
  ): Promise<ResultadoOrquestracao> {
    const ecossistema = this.criarEcossistema(projeto);
    return ecossistema.substituicao.orquestrar({
      projeto,
      estrategia: this.resolverEstrategia(ecossistema, projeto, opcoes.estrategia),
      parametros: opcoes.parametros ?? this.dependencias.parametros,
      equipeId: alvo.equipeId,
      papel: alvo.papel,
    });
  }

  async executarRecomendacao(
    projeto: Projeto,
    opcoes: OpcoesExecucao = {},
  ): Promise<ResultadoOrquestracao> {
    const ecossistema = this.criarEcossistema(projeto);
    const resultado = await this.recomendarCom(ecossistema, projeto, opcoes);
    this.publicar(
      eventoRecomendacaoGerada({
        projeto,
        equipes: resultado.equipes,
        membros: membrosSugeridos(resultado.equipes),
        estrategia: resultado.estrategia,
        rodada: resultado.rodada,
        parcial: resultado.parcial,
      }),
      ecossistema.notificador,
    );
    return resultado;
  }

  validar(projeto: Projeto): ResultadoValidacao {
    return projeto.aceitar(this.fabricaPara(projeto).criarValidador());
  }

  estrategiaSugerida(tipoCaptacao: string, orcamento: number): string {
    const { estrategias, fabricas, parametros } = this.dependencias;
    return estrategias.sugerirPara(
      orcamento,
      parametros,
      fabricas.para(tipoCaptacao).criarRecomendador().nome,
    );
  }

  adicionarObservador(observador: Observador): void {
    this.dependencias.sujeito.adicionarObservador(observador);
  }

  removerObservador(observador: Observador): void {
    this.dependencias.sujeito.removerObservador(observador);
  }

  notificarObservadores(evento: EventoRecomendacao, projeto?: Projeto): void {
    this.publicar(evento, projeto ? this.fabricaPara(projeto).criarNotificador() : undefined);
  }

  private publicar(evento: EventoRecomendacao, notificadorDoTipo?: Observador): void {
    const { sujeito } = this.dependencias;
    sujeito.notificarObservadores(evento);
    if (notificadorDoTipo) {
      sujeito.notificarObservador(notificadorDoTipo, evento);
    }
  }

  private recomendarCom(
    ecossistema: EcossistemaProjeto,
    projeto: Projeto,
    opcoes: OpcoesExecucao,
  ): Promise<ResultadoOrquestracao> {
    return ecossistema.orquestrador.orquestrar({
      projeto,
      estrategia: this.resolverEstrategia(ecossistema, projeto, opcoes.estrategia),
      parametros: opcoes.parametros ?? this.dependencias.parametros,
    });
  }

  private resolverEstrategia(
    ecossistema: EcossistemaProjeto,
    projeto: Projeto,
    solicitada?: RecomendacaoStrategy | string,
  ): RecomendacaoStrategy {
    const escolhida = solicitada ?? this.estrategiaAtual ?? projeto.estrategia;
    if (typeof escolhida !== 'string') {
      return escolhida;
    }
    return escolhida === ecossistema.recomendador.nome
      ? ecossistema.recomendador
      : this.dependencias.estrategias.obter(escolhida);
  }
}
