import type { FabricaProjeto } from '../application/familias/fabrica-projeto.js';
import type { ResultadoOrquestracao } from '../application/orchestration/orquestrador-equipe.js';
import type { ModeloProjeto } from '../application/prototipos/catalogo-modelos.js';
import type { EntradaAuditoria } from '../application/ports/canais-saida.js';
import type { AnaliseComposicao } from '../application/use-cases/casos-consulta.js';
import type { RankingPorPapel } from '../application/strategies/estrategia-recomendacao.js';
import type { Convite } from '../domain/entidades/convite.js';
import type { Equipe } from '../domain/entidades/equipe.js';
import type { MembroEquipe } from '../domain/entidades/membro-equipe.js';
import type { Projeto } from '../domain/entidades/projeto.js';
import type { Recomendacao } from '../domain/entidades/recomendacao.js';

export function apresentarMembro(membro: MembroEquipe) {
  const { profissional } = membro;
  return {
    papel: membro.papel,
    status: membro.status,
    custo: membro.custo,
    score: membro.score,
    profissional: {
      id: profissional.id,
      nome: profissional.nome,
      cidade: profissional.localizacao.cidade,
      uf: profissional.localizacao.uf,
      notaMedia: Math.round(profissional.notaMedia * 100) / 100,
      totalAvaliacoes: profissional.totalAvaliacoes,
    },
  };
}

export function apresentarEquipe(equipe: Equipe) {
  return {
    id: equipe.id,
    status: equipe.status,
    rodada: equipe.rodada,
    estrategia: equipe.estrategia,
    custoTotal: equipe.custoTotal,
    membros: equipe.membros.map(apresentarMembro),
  };
}

export function apresentarProjeto(projeto: Projeto) {
  const formada = projeto.equipeFormada;
  return {
    id: projeto.id,
    titulo: projeto.titulo,
    produtorId: projeto.produtorId,
    genero: projeto.genero,
    tipoCaptacao: projeto.tipoCaptacao,
    duracaoMinutos: projeto.duracaoMinutos,
    orcamento: projeto.orcamento,
    dataInicio: projeto.periodo.inicio.toISOString(),
    dataEntrega: projeto.dataEntrega.toISOString(),
    localizacao: { cidade: projeto.localizacao.cidade, uf: projeto.localizacao.uf },
    estrategia: projeto.estrategia,
    requisitos: projeto.requisitos.map((requisito) => ({
      papel: requisito.papel,
      peso: requisito.peso,
    })),
    detalhes: { ...projeto.detalhes },
    equipes: projeto.equipes
      .filter((equipe) => equipe.ativa || equipe === formada)
      .map(apresentarEquipe),
    ...(formada ? { equipeFormadaId: formada.id } : {}),
  };
}

export function apresentarModelo(modelo: ModeloProjeto) {
  const { prototipo } = modelo;
  return {
    id: modelo.id,
    nome: modelo.nome,
    descricao: modelo.descricao,
    tipoCaptacao: prototipo.tipoCaptacao,
    genero: prototipo.genero,
    duracaoMinutos: prototipo.duracaoMinutos,
    orcamento: prototipo.orcamento,
    duracaoDias: prototipo.periodo.duracaoDias,
    estrategia: prototipo.estrategia,
    requisitos: prototipo.requisitos.map((requisito) => ({
      papel: requisito.papel,
      peso: requisito.peso,
    })),
    detalhes: { ...prototipo.detalhes },
  };
}

export function apresentarTipoProjeto(fabrica: FabricaProjeto) {
  const recomendador = fabrica.criarRecomendador();
  return {
    tipo: fabrica.tipo,
    descricao: fabrica.descricao,
    recomendador: { nome: recomendador.nome, descricao: recomendador.descricao },
  };
}

export function apresentarRanking(ranking: RankingPorPapel) {
  return Object.fromEntries(
    [...ranking].map(([papel, candidatos]) => [
      papel,
      candidatos.map((candidato) => ({
        profissionalId: candidato.profissional.id,
        nome: candidato.profissional.nome,
        score: candidato.score,
        custoEstimado: candidato.custoEstimado,
        justificativa: candidato.justificativa,
      })),
    ]),
  );
}

export function apresentarInformacoesRodada(resultado: ResultadoOrquestracao, estrategia: string) {
  return {
    rodada: resultado.rodada,
    estrategia,
    parcial: resultado.parcial,
    avisos: [...resultado.avisos],
    papeisSemCandidatos: [...resultado.papeisSemCandidatos],
    ranking: apresentarRanking(resultado.ranking),
  };
}

export function apresentarRodada(rodada: { projeto: Projeto; resultado: ResultadoOrquestracao }) {
  return {
    projeto: apresentarProjeto(rodada.projeto),
    ...apresentarInformacoesRodada(rodada.resultado, rodada.projeto.estrategia),
  };
}

export function apresentarConvite(convite: Convite) {
  return {
    id: convite.id,
    projetoId: convite.projetoId,
    equipeId: convite.equipeId,
    papel: convite.papel,
    profissionalId: convite.profissionalId,
    status: convite.status,
    criadoEm: convite.criadoEm.toISOString(),
    expiraEm: convite.expiraEm.toISOString(),
    ...(convite.respondidoEm ? { respondidoEm: convite.respondidoEm.toISOString() } : {}),
  };
}

export function apresentarAnalise(analise: AnaliseComposicao) {
  return {
    validacao: {
      valido: analise.validacao.valido,
      problemas: analise.validacao.problemas.map((problema) => ({ ...problema })),
    },
    compatibilidade: analise.compatibilidade,
    relatorio: analise.relatorio,
  };
}

export function apresentarAuditoria(entrada: EntradaAuditoria) {
  return { ...entrada, dados: { ...entrada.dados } as Record<string, unknown> };
}

export function apresentarRecomendacao(recomendacao: Recomendacao) {
  return {
    id: recomendacao.id,
    papel: recomendacao.papel,
    profissionalId: recomendacao.profissionalId,
    score: recomendacao.score,
    posicao: recomendacao.posicao,
    estrategia: recomendacao.estrategia,
    rodada: recomendacao.rodada,
    justificativa: recomendacao.justificativa,
    criadaEm: recomendacao.criadaEm.toISOString(),
  };
}
