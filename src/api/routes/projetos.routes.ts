import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyRequest } from 'fastify';
import type { ParametrosRecomendacaoParciais } from '../../application/strategies/parametros-recomendacao.js';
import type { CasosDeUso } from '../../application/use-cases/casos-de-uso.js';
import {
  apresentarAnalise,
  apresentarAuditoria,
  apresentarConvite,
  apresentarInformacoesRodada,
  apresentarProjeto,
  apresentarRecomendacao,
  apresentarRodada,
} from '../apresentacao.js';
import { RespostaErro } from '../schemas/comum.schema.js';
import {
  AceiteResposta,
  AnaliseResposta,
  AuditoriaResposta,
  CorpoCriarProjeto,
  CorpoDetalhes,
  CorpoReavaliacao,
  CorpoRodada,
  CorpoSubstituicao,
  ParamsEquipe,
  ParamsMembro,
  ParamsProjeto,
  ProjetoResposta,
  ReavaliacaoResposta,
  RecomendacoesResposta,
  RodadaResposta,
  type ParametrosEntrada,
} from '../schemas/recomendacao.schema.js';

const erros = { 400: RespostaErro, 404: RespostaErro, 409: RespostaErro, 422: RespostaErro };

export function contextoDe(requisicao: FastifyRequest) {
  return { correlacaoId: requisicao.id };
}

function parametrosDe(
  parametros: ParametrosEntrada | undefined,
): ParametrosRecomendacaoParciais | undefined {
  return parametros;
}

export function rotasProjetos(casos: CasosDeUso): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.post(
      '/projetos',
      {
        schema: {
          tags: ['projetos'],
          summary: 'Cria o projeto e já retorna as equipes recomendadas',
          body: CorpoCriarProjeto,
          response: { 201: RodadaResposta, ...erros },
        },
      },
      async (requisicao, resposta) => {
        const corpo = requisicao.body;
        const parametros = parametrosDe(corpo.parametros);
        const rodada = await casos.criarProjeto.executar(
          {
            ...corpo,
            dataInicio: new Date(corpo.dataInicio),
            dataEntrega: new Date(corpo.dataEntrega),
            requisitos: corpo.requisitos.map((requisito) => ({
              papel: requisito.papel,
              peso: requisito.peso,
            })),
            ...(parametros ? { parametros } : {}),
          },
          contextoDe(requisicao),
        );
        return resposta.status(201).send(apresentarRodada(rodada));
      },
    );

    app.get(
      '/projetos/:projetoId',
      {
        schema: {
          tags: ['projetos'],
          summary: 'Consulta o projeto com as equipes sugeridas ou formada',
          params: ParamsProjeto,
          response: { 200: ProjetoResposta, ...erros },
        },
      },
      async (requisicao) =>
        apresentarProjeto(await casos.consultas.obterProjeto(requisicao.params.projetoId)),
    );

    app.post(
      '/projetos/:projetoId/recomendacoes',
      {
        schema: {
          tags: ['projetos'],
          summary: 'Nova rodada de recomendações, opcionalmente com outra estratégia',
          params: ParamsProjeto,
          body: CorpoRodada,
          response: { 201: RodadaResposta, ...erros },
        },
      },
      async (requisicao, resposta) => {
        const parametros = parametrosDe(requisicao.body.parametros);
        const rodada = await casos.recomendarNovamente.executar(
          requisicao.params.projetoId,
          {
            ...(requisicao.body.estrategia ? { estrategia: requisicao.body.estrategia } : {}),
            ...(parametros ? { parametros } : {}),
          },
          contextoDe(requisicao),
        );
        return resposta.status(201).send(apresentarRodada(rodada));
      },
    );

    app.get(
      '/projetos/:projetoId/recomendacoes',
      {
        schema: {
          tags: ['projetos'],
          summary: 'Histórico de recomendações do projeto (todas as rodadas)',
          params: ParamsProjeto,
          response: { 200: RecomendacoesResposta, ...erros },
        },
      },
      async (requisicao) =>
        (await casos.consultas.listarRecomendacoes(requisicao.params.projetoId)).map(
          apresentarRecomendacao,
        ),
    );

    app.post(
      '/projetos/:projetoId/reavaliacao',
      {
        schema: {
          tags: ['projetos'],
          summary: 'Altera orçamento/prazo; se a mudança for significativa, refaz a equipe',
          params: ParamsProjeto,
          body: CorpoReavaliacao,
          response: { 200: ReavaliacaoResposta, ...erros },
        },
      },
      async (requisicao) => {
        const { orcamento, dataEntrega, limiar } = requisicao.body;
        const resultado = await casos.reavaliarProjeto.executar(
          requisicao.params.projetoId,
          {
            ...(orcamento === undefined ? {} : { orcamento }),
            ...(dataEntrega === undefined ? {} : { dataEntrega: new Date(dataEntrega) }),
            ...(limiar === undefined ? {} : { limiar }),
          },
          contextoDe(requisicao),
        );
        return {
          projeto: apresentarProjeto(resultado.projeto),
          reavaliacao: resultado.reavaliacao,
          ...(resultado.rodada
            ? {
                novaRodada: apresentarInformacoesRodada(
                  resultado.rodada.resultado,
                  resultado.projeto.estrategia,
                ),
              }
            : {}),
        };
      },
    );

    app.patch(
      '/projetos/:projetoId/detalhes',
      {
        schema: {
          tags: ['projetos'],
          summary: 'Completa ou corrige os detalhes específicos do tipo do projeto',
          params: ParamsProjeto,
          body: CorpoDetalhes,
          response: { 200: ProjetoResposta, ...erros },
        },
      },
      async (requisicao) =>
        apresentarProjeto(
          await casos.ajustarDetalhes.executar(
            requisicao.params.projetoId,
            requisicao.body.detalhes,
            contextoDe(requisicao),
          ),
        ),
    );

    app.post(
      '/projetos/:projetoId/equipes/:equipeId/membros/:papel/aceite',
      {
        schema: {
          tags: ['equipes'],
          summary: 'Produtor aceita a sugestão e o profissional recebe um convite',
          params: ParamsMembro,
          response: { 201: AceiteResposta, ...erros },
        },
      },
      async (requisicao, resposta) => {
        const { projeto, convite } = await casos.aceitarMembro.executar(
          { ...requisicao.params, papel: requisicao.params.papel },
          contextoDe(requisicao),
        );
        return resposta
          .status(201)
          .send({ projeto: apresentarProjeto(projeto), convite: apresentarConvite(convite) });
      },
    );

    app.delete(
      '/projetos/:projetoId/equipes/:equipeId/membros/:papel',
      {
        schema: {
          tags: ['equipes'],
          summary: 'Produtor rejeita o membro sugerido e o papel fica vago',
          params: ParamsMembro,
          response: { 200: ProjetoResposta, ...erros },
        },
      },
      async (requisicao) =>
        apresentarProjeto(
          await casos.rejeitarMembro.executar(
            { ...requisicao.params, papel: requisicao.params.papel },
            contextoDe(requisicao),
          ),
        ),
    );

    app.post(
      '/projetos/:projetoId/equipes/:equipeId/membros/:papel/substituicao',
      {
        schema: {
          tags: ['equipes'],
          summary: 'Nova rodada só para o papel, mantendo os demais membros fixos',
          params: ParamsMembro,
          body: CorpoSubstituicao,
          response: { 200: RodadaResposta, ...erros },
        },
      },
      async (requisicao) =>
        apresentarRodada(
          await casos.substituirMembro.executar(
            { ...requisicao.params, papel: requisicao.params.papel },
            requisicao.body.estrategia ? { estrategia: requisicao.body.estrategia } : {},
            contextoDe(requisicao),
          ),
        ),
    );

    app.post(
      '/projetos/:projetoId/equipes/:equipeId/finalizacao',
      {
        schema: {
          tags: ['equipes'],
          summary: 'Registra a composição final e avisa projetos e financeiro',
          params: ParamsEquipe,
          response: { 200: ProjetoResposta, ...erros },
        },
      },
      async (requisicao) => {
        const { projeto } = await casos.finalizarEquipe.executar(
          requisicao.params.projetoId,
          requisicao.params.equipeId,
          contextoDe(requisicao),
        );
        return apresentarProjeto(projeto);
      },
    );

    app.get(
      '/projetos/:projetoId/relatorio',
      {
        schema: {
          tags: ['relatorios'],
          summary: 'Validação, compatibilidade e relatório do projeto (Visitor)',
          params: ParamsProjeto,
          response: { 200: AnaliseResposta, ...erros },
        },
      },
      async (requisicao) =>
        apresentarAnalise(await casos.consultas.analisar(requisicao.params.projetoId)),
    );

    app.get(
      '/projetos/:projetoId/equipes/:equipeId/relatorio',
      {
        schema: {
          tags: ['relatorios'],
          summary: 'Validação, compatibilidade e relatório de uma equipe (Visitor)',
          params: ParamsEquipe,
          response: { 200: AnaliseResposta, ...erros },
        },
      },
      async (requisicao) =>
        apresentarAnalise(
          await casos.consultas.analisar(requisicao.params.projetoId, requisicao.params.equipeId),
        ),
    );

    app.get(
      '/projetos/:projetoId/auditoria',
      {
        schema: {
          tags: ['relatorios'],
          summary: 'Trilha de auditoria de todas as ações do projeto',
          params: ParamsProjeto,
          response: { 200: AuditoriaResposta, ...erros },
        },
      },
      async (requisicao) =>
        (await casos.consultas.listarAuditoria(requisicao.params.projetoId)).map(
          apresentarAuditoria,
        ),
    );
  };
}
