import {
  AceitarMembro,
  ExpirarConvites,
  FinalizarEquipe,
  RejeitarMembro,
  ResponderConvite,
  SubstituirMembro,
} from './casos-equipe.js';
import {
  ConsultasRecomendacao,
  type LeitorAuditoria,
  type LeitorMensagens,
} from './casos-consulta.js';
import {
  AjustarDetalhesProjeto,
  CriarProjetoDeModelo,
  CriarProjetoERecomendar,
  GerarRodadaRecomendacao,
  ReavaliarProjeto,
  RecomendarNovamente,
} from './casos-projeto.js';
import type { DependenciasCasosDeUso } from './dependencias.js';

export interface CasosDeUso {
  readonly criarProjeto: CriarProjetoERecomendar;
  readonly criarProjetoDeModelo: CriarProjetoDeModelo;
  readonly recomendarNovamente: RecomendarNovamente;
  readonly reavaliarProjeto: ReavaliarProjeto;
  readonly ajustarDetalhes: AjustarDetalhesProjeto;
  readonly aceitarMembro: AceitarMembro;
  readonly rejeitarMembro: RejeitarMembro;
  readonly substituirMembro: SubstituirMembro;
  readonly responderConvite: ResponderConvite;
  readonly expirarConvites: ExpirarConvites;
  readonly finalizarEquipe: FinalizarEquipe;
  readonly consultas: ConsultasRecomendacao;
}

export function criarCasosDeUso(
  deps: DependenciasCasosDeUso,
  leitores: { auditoria: LeitorAuditoria; mensagens: LeitorMensagens },
): CasosDeUso {
  const gerarRodada = new GerarRodadaRecomendacao(deps);
  const expirarConvites = new ExpirarConvites(deps);
  return {
    criarProjeto: new CriarProjetoERecomendar(deps, gerarRodada),
    criarProjetoDeModelo: new CriarProjetoDeModelo(deps, gerarRodada),
    recomendarNovamente: new RecomendarNovamente(deps, gerarRodada),
    reavaliarProjeto: new ReavaliarProjeto(deps, gerarRodada),
    ajustarDetalhes: new AjustarDetalhesProjeto(deps),
    aceitarMembro: new AceitarMembro(deps),
    rejeitarMembro: new RejeitarMembro(deps),
    substituirMembro: new SubstituirMembro(deps),
    responderConvite: new ResponderConvite(deps, expirarConvites),
    expirarConvites,
    finalizarEquipe: new FinalizarEquipe(deps),
    consultas: new ConsultasRecomendacao(deps, leitores.auditoria, leitores.mensagens),
  };
}
