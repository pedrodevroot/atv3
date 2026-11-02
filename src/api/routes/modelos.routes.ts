import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { CasosDeUso } from '../../application/use-cases/casos-de-uso.js';
import { apresentarModelo, apresentarRodada, apresentarTipoProjeto } from '../apresentacao.js';
import { RespostaErro } from '../schemas/comum.schema.js';
import {
  CorpoProjetoDeModelo,
  ModelosResposta,
  ParamsModelo,
  RodadaResposta,
  TiposProjetoResposta,
} from '../schemas/recomendacao.schema.js';
import { contextoDe } from './projetos.routes.js';

const erros = { 400: RespostaErro, 404: RespostaErro, 409: RespostaErro, 422: RespostaErro };

export function rotasTiposEModelos(casos: CasosDeUso): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get(
      '/tipos-projeto',
      {
        schema: {
          tags: ['tipos-e-modelos'],
          summary: 'Tipos de projeto com fábrica registrada (Abstract Factory)',
          response: { 200: TiposProjetoResposta },
        },
      },
      async () => casos.consultas.listarTiposProjeto().map(apresentarTipoProjeto),
    );

    app.get(
      '/modelos-projeto',
      {
        schema: {
          tags: ['tipos-e-modelos'],
          summary: 'Modelos pré-configurados que servem de protótipo (Prototype)',
          response: { 200: ModelosResposta },
        },
      },
      async () => casos.consultas.listarModelos().map(apresentarModelo),
    );

    app.post(
      '/modelos-projeto/:modeloId/projetos',
      {
        schema: {
          tags: ['tipos-e-modelos'],
          summary: 'Clona o modelo com os ajustes informados e já retorna as equipes recomendadas',
          params: ParamsModelo,
          body: CorpoProjetoDeModelo,
          response: { 201: RodadaResposta, ...erros },
        },
      },
      async (requisicao, resposta) => {
        const { dataInicio, dataEntrega, ...corpo } = requisicao.body;
        const rodada = await casos.criarProjetoDeModelo.executar(
          {
            ...corpo,
            modeloId: requisicao.params.modeloId,
            dataInicio: new Date(dataInicio),
            dataEntrega: new Date(dataEntrega),
          },
          contextoDe(requisicao),
        );
        return resposta.status(201).send(apresentarRodada(rodada));
      },
    );
  };
}
