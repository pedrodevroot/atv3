import type { Logger as Pino } from 'pino';
import type { DataSource } from 'typeorm';
import { FabricaAnimacao } from './application/familias/animacao/fabrica-animacao.js';
import { FabricaDocumentario } from './application/familias/documentario/fabrica-documentario.js';
import type { DependenciasFabrica } from './application/familias/fabrica-projeto.js';
import { FabricaFiccao } from './application/familias/ficcao/fabrica-ficcao.js';
import { FabricaPublicitario } from './application/familias/publicitario/fabrica-publicitario.js';
import { RegistroFabricas } from './application/familias/registro-fabricas.js';
import { AtualizadorComposicao } from './application/observers/atualizador-composicao.js';
import { AuditoriaRecomendacao } from './application/observers/auditoria-recomendacao.js';
import { NotificadorEmail } from './application/observers/notificador-email.js';
import { NotificadorInterno } from './application/observers/notificador-interno.js';
import { PublicadorIntegracao } from './application/observers/publicador-integracao.js';
import type {
  CaixaMensagens,
  PublicadorExterno,
  RegistroAuditoria,
  ServicoEmail,
} from './application/ports/canais-saida.js';
import type { Logger } from './application/ports/logger.js';
import type { Observador, Sujeito } from './application/ports/observador.js';
import { CatalogoModelos } from './application/prototipos/catalogo-modelos.js';
import { criarModelosPadrao } from './application/prototipos/modelos-padrao.js';
import { SistemaRecomendacao } from './application/sistema-recomendacao.js';
import { CacheRecomendacoes } from './application/strategies/decoradores/cache-decorator.js';
import { MontadorDecoradores } from './application/strategies/decoradores/montador-decoradores.js';
import { FiltragemColaborativa } from './application/strategies/filtragem-colaborativa.js';
import {
  resolverParametros,
  type ParametrosRecomendacao,
} from './application/strategies/parametros-recomendacao.js';
import { RegistroEstrategias } from './application/strategies/registro-estrategias.js';
import { RegrasOrcamento } from './application/strategies/regras-orcamento.js';
import { SimilaridadeCosseno } from './application/strategies/similaridade-cosseno.js';
import { relogioDoSistema, type Relogio } from './application/ports/relogio.js';
import { ORIGEM_EXPIRACAO } from './application/use-cases/casos-equipe.js';
import { criarCasosDeUso } from './application/use-cases/casos-de-uso.js';
import { ConsultarSaude } from './application/use-cases/consultar-saude.js';
import type { DependenciasApi } from './app.js';
import type { Config } from './config/config.js';
import {
  criarAdaptadorArmazenamento,
  criarAdaptadorPagamento,
  criarAdaptadorProfissional,
} from './infrastructure/adaptadores/criar-adaptadores.js';
import { FonteCadastroAdaptada } from './infrastructure/adaptadores/profissional/fonte-cadastro-adaptada.js';
import { ConexaoBanco } from './infrastructure/database/conexao-banco.js';
import { criarDataSource } from './infrastructure/database/data-source.js';
import { VerificadorBanco } from './infrastructure/database/verificador-banco.js';
import { criarLogger } from './infrastructure/logging/opcoes-logger.js';
import { BarramentoEventosEmMemoria } from './infrastructure/messaging/barramento-eventos-memoria.js';
import {
  CaixaMensagensMemoria,
  PublicadorExternoMemoria,
  RegistroAuditoriaLog,
  ServicoEmailSimulado,
} from './infrastructure/notifications/canais-simulados.js';
import {
  DepositoObjetosTypeorm,
  LivroTransacoesTypeorm,
  RepositorioPagamentosTypeorm,
} from './infrastructure/repositories/repositorios-integracoes.js';
import { RepositorioProfissionaisResiliente } from './infrastructure/repositories/repositorio-profissionais-resiliente.js';
import { RepositorioProfissionaisTypeorm } from './infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { DisjuntorCircuito } from './infrastructure/resiliencia/disjuntor.js';
import { RepositorioProjetosTypeorm } from './infrastructure/repositories/repositorio-projetos-typeorm.js';
import {
  CaixaMensagensTypeorm,
  RegistroAuditoriaTypeorm,
  RepositorioConvitesTypeorm,
  RepositorioRecomendacoesTypeorm,
} from './infrastructure/repositories/repositorios-typeorm.js';

export interface CanaisSaida {
  readonly email: ServicoEmail;
  readonly caixa: CaixaMensagens;
  readonly auditoria: RegistroAuditoria;
  readonly publicador: PublicadorExterno;
}

export interface CanaisSaidaMemoria extends CanaisSaida {
  readonly email: ServicoEmailSimulado;
  readonly caixa: CaixaMensagensMemoria;
  readonly auditoria: RegistroAuditoriaLog;
  readonly publicador: PublicadorExternoMemoria;
}

export interface CanaisSaidaContainer extends CanaisSaida {
  readonly email: ServicoEmailSimulado;
  readonly caixa: CaixaMensagensTypeorm;
  readonly auditoria: RegistroAuditoriaTypeorm;
  readonly publicador: PublicadorExternoMemoria;
}

export interface Container extends DependenciasApi {
  readonly config: Config;
  readonly logger: Pino;
  readonly dataSource: DataSource;
  readonly conexao: ConexaoBanco;
  readonly parametros: ParametrosRecomendacao;
  readonly registroEstrategias: RegistroEstrategias;
  readonly registroFabricas: RegistroFabricas;
  readonly modelos: CatalogoModelos;
  readonly sistema: SistemaRecomendacao;
  readonly repositorioProfissionais: RepositorioProfissionaisTypeorm;
  readonly cadastroProfissionais: RepositorioProfissionaisResiliente;
  readonly repositorioProjetos: RepositorioProjetosTypeorm;
  readonly repositorioConvites: RepositorioConvitesTypeorm;
  readonly repositorioRecomendacoes: RepositorioRecomendacoesTypeorm;
  readonly repositorioPagamentos: RepositorioPagamentosTypeorm;
  readonly depositoObjetos: DepositoObjetosTypeorm;
  readonly livroTransacoes: LivroTransacoesTypeorm;
  readonly cacheRecomendacoes: CacheRecomendacoes;
  readonly decoradores: MontadorDecoradores;
  readonly barramento: BarramentoEventosEmMemoria;
  readonly canais: CanaisSaidaContainer;
  encerrar(): Promise<void>;
}

export function criarRegistroEstrategias(): RegistroEstrategias {
  return new RegistroEstrategias([
    new SimilaridadeCosseno(),
    new FiltragemColaborativa(),
    new RegrasOrcamento(),
  ]);
}

export function criarRegistroFabricas(dependencias: DependenciasFabrica): RegistroFabricas {
  return new RegistroFabricas([
    new FabricaDocumentario(dependencias),
    new FabricaAnimacao(dependencias),
    new FabricaPublicitario(dependencias),
    new FabricaFiccao(dependencias),
  ]);
}

export function criarCanaisSaida(logger?: Logger): CanaisSaidaMemoria {
  return {
    email: new ServicoEmailSimulado(logger),
    caixa: new CaixaMensagensMemoria(),
    auditoria: new RegistroAuditoriaLog(logger),
    publicador: new PublicadorExternoMemoria(logger),
  };
}

export interface DependenciasObservadores {
  readonly canais: CanaisSaida;
  readonly atualizador: AtualizadorComposicao;
}

export function criarObservadores({ canais, atualizador }: DependenciasObservadores): Observador[] {
  return [
    new NotificadorEmail(canais.email),
    new NotificadorInterno(canais.caixa),
    new AuditoriaRecomendacao(canais.auditoria, new Set([atualizador.nome, ORIGEM_EXPIRACAO])),
    atualizador,
    new PublicadorIntegracao(canais.publicador),
  ];
}

export function registrarObservadores(sujeito: Sujeito, observadores: readonly Observador[]): void {
  for (const observador of observadores) {
    sujeito.adicionarObservador(observador);
  }
}

export interface OpcoesContainer {
  readonly relogio?: Relogio;
}

export function criarContainer(
  config: Config,
  logger: Pino = criarLogger(config),
  opcoes: OpcoesContainer = {},
): Container {
  const relogio = opcoes.relogio ?? relogioDoSistema;
  const dataSource = criarDataSource(config.banco);
  const conexao = new ConexaoBanco(dataSource);
  const parametros = resolverParametros();
  const registroEstrategias = criarRegistroEstrategias();
  const repositorioProfissionais = new RepositorioProfissionaisTypeorm(dataSource);
  const adaptadorProfissional = criarAdaptadorProfissional(
    config.integracoes.profissionais,
    repositorioProfissionais,
  );
  const fonteCadastro = new FonteCadastroAdaptada(adaptadorProfissional, repositorioProfissionais);
  const cadastroProfissionais = new RepositorioProfissionaisResiliente(
    fonteCadastro,
    new DisjuntorCircuito({
      nome: 'cadastro-profissionais',
      limiteFalhas: config.resiliencia.circuitoLimiteFalhas,
      esperaMs: config.resiliencia.circuitoEsperaMs,
    }),
    { ttlMs: config.resiliencia.cacheTtlMs, timeoutMs: config.resiliencia.cadastroTimeoutMs },
    relogioDoSistema,
    logger,
  );
  const consultarSaude = new ConsultarSaude([
    new VerificadorBanco(dataSource, undefined, conexao),
    cadastroProfissionais,
  ]);
  const canais: CanaisSaidaContainer = {
    email: new ServicoEmailSimulado(logger),
    caixa: new CaixaMensagensTypeorm(dataSource),
    auditoria: new RegistroAuditoriaTypeorm(dataSource, logger),
    publicador: new PublicadorExternoMemoria(logger),
  };
  const registroFabricas = criarRegistroFabricas({ caixa: canais.caixa });
  const modelos = new CatalogoModelos(criarModelosPadrao(registroFabricas));
  const repositorioProjetos = new RepositorioProjetosTypeorm(
    dataSource,
    repositorioProfissionais,
    registroFabricas,
  );
  const repositorioConvites = new RepositorioConvitesTypeorm(dataSource);
  const repositorioRecomendacoes = new RepositorioRecomendacoesTypeorm(dataSource);
  const repositorioPagamentos = new RepositorioPagamentosTypeorm(dataSource);
  const depositoObjetos = new DepositoObjetosTypeorm(dataSource);
  const livroTransacoes = new LivroTransacoesTypeorm(dataSource);
  const cacheRecomendacoes = new CacheRecomendacoes({
    ttlMs: config.recomendacao.cacheTtlMs,
    maximo: config.recomendacao.cacheMaximo,
    relogio,
  });
  const decoradores = new MontadorDecoradores(
    {
      cache: cacheRecomendacoes,
      auditoria: canais.auditoria,
      fabricas: registroFabricas,
      estrategias: registroEstrategias,
      relogio,
      logger,
    },
    config.recomendacao.decoradores,
  );
  const barramento = new BarramentoEventosEmMemoria((falha) => {
    logger.error(
      {
        observador: falha.observador,
        eventoId: falha.evento.id,
        tipo: falha.evento.tipo,
        err: falha.erro,
      },
      'Observador falhou ao processar evento',
    );
  });
  const sistema = new SistemaRecomendacao({
    repositorio: cadastroProfissionais,
    conectarCadastro: (adaptador) => {
      fonteCadastro.usar(adaptador);
      cadastroProfissionais.invalidar();
      return cadastroProfissionais;
    },
    fabricas: registroFabricas,
    estrategias: registroEstrategias,
    sujeito: barramento,
    parametros,
    relogio,
  });
  sistema.configurarAdaptadores(
    criarAdaptadorArmazenamento(
      config.integracoes.armazenamento,
      depositoObjetos,
      config.integracoes.diretorioLocal,
    ),
    criarAdaptadorPagamento(config.integracoes.pagamento, livroTransacoes),
    adaptadorProfissional,
  );
  const atualizador = new AtualizadorComposicao({
    projetos: repositorioProjetos,
    recomendacoes: repositorioRecomendacoes,
    sistema,
    decoradores,
  });
  registrarObservadores(barramento, criarObservadores({ canais, atualizador }));
  const casos = criarCasosDeUso(
    {
      projetos: repositorioProjetos,
      convites: repositorioConvites,
      recomendacoes: repositorioRecomendacoes,
      pagamentos: repositorioPagamentos,
      decoradores,
      estrategias: registroEstrategias,
      fabricas: registroFabricas,
      modelos,
      sistema,
      parametros,
      relogio,
    },
    { auditoria: canais.auditoria, mensagens: canais.caixa },
  );

  return {
    casos,
    config,
    logger,
    dataSource,
    conexao,
    consultarSaude,
    parametros,
    registroEstrategias,
    registroFabricas,
    modelos,
    sistema,
    repositorioProfissionais,
    cadastroProfissionais,
    repositorioProjetos,
    repositorioConvites,
    repositorioRecomendacoes,
    repositorioPagamentos,
    depositoObjetos,
    livroTransacoes,
    cacheRecomendacoes,
    decoradores,
    barramento,
    canais,
    async encerrar() {
      conexao.parar();
      await barramento.aguardarEntregas();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}
