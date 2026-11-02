import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { CasosDeUso } from '../../application/use-cases/casos-de-uso.js';
import { apresentarConvite } from '../apresentacao.js';
import { RespostaErro } from '../schemas/comum.schema.js';
import {
  ConviteResposta,
  CorpoRespostaConvite,
  EstrategiasResposta,
  MensagensResposta,
  ParamsConvite,
  ParamsDestinatario,
} from '../schemas/recomendacao.schema.js';
import { contextoDe } from './projetos.routes.js';

export function rotasConvitesECatalogo(casos: CasosDeUso): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.post(
      '/convites/:conviteId/resposta',
      {
        schema: {
          tags: ['convites'],
          summary: 'Profissional aceita ou recusa o convite (recusa dispara nova rodada)',
          params: ParamsConvite,
          body: CorpoRespostaConvite,
          response: { 200: ConviteResposta, 404: RespostaErro, 409: RespostaErro },
        },
      },
      async (requisicao) =>
        apresentarConvite(
          await casos.responderConvite.executar(
            requisicao.params.conviteId,
            requisicao.body.aceito,
            contextoDe(requisicao),
          ),
        ),
    );

    app.get(
      '/estrategias',
      {
        schema: {
          tags: ['catalogo'],
          summary: 'Estratégias de recomendação disponíveis (Strategy)',
          response: { 200: EstrategiasResposta },
        },
      },
      async () =>
        casos.consultas
          .listarEstrategias()
          .map((estrategia) => ({ nome: estrategia.nome, descricao: estrategia.descricao })),
    );

    app.get(
      '/mensagens/:destinatarioId',
      {
        schema: {
          tags: ['catalogo'],
          summary: 'Caixa de mensagens internas de um produtor ou profissional',
          params: ParamsDestinatario,
          response: { 200: MensagensResposta },
        },
      },
      async (requisicao) => casos.consultas.listarMensagens(requisicao.params.destinatarioId),
    );
  };
}
