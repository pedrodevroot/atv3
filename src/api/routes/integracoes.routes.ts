import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { CasosDeUso } from '../../application/use-cases/casos-de-uso.js';
import { apresentarPagamento } from '../apresentacao.js';
import { RespostaErro } from '../schemas/comum.schema.js';
import {
  ArquivoResposta,
  ArquivosResposta,
  ConteudoArquivoResposta,
  CorpoArquivo,
  PagamentoResposta,
  ParamsMembro,
  ParamsPagamento,
  ParamsProjeto,
  QueryArquivo,
  TAMANHO_MAXIMO_ARQUIVO_BASE64,
} from '../schemas/recomendacao.schema.js';
import { contextoDe } from './projetos.routes.js';

const erros = { 400: RespostaErro, 404: RespostaErro, 409: RespostaErro, 422: RespostaErro };
const LIMITE_CORPO_ARQUIVO = TAMANHO_MAXIMO_ARQUIVO_BASE64 + 4_096;

export function rotasIntegracoes(casos: CasosDeUso): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.post(
      '/projetos/:projetoId/arquivos',
      {
        bodyLimit: LIMITE_CORPO_ARQUIVO,
        schema: {
          tags: ['integracoes'],
          summary: 'Anexa um arquivo ao projeto no provedor configurado (Adapter)',
          params: ParamsProjeto,
          body: CorpoArquivo,
          response: { 201: ArquivoResposta, ...erros },
        },
      },
      async (requisicao, resposta) => {
        const { nome, tipoConteudo, conteudoBase64 } = requisicao.body;
        const id = await casos.arquivos.anexar(
          {
            projetoId: requisicao.params.projetoId,
            nome,
            tipoConteudo,
            conteudo: Buffer.from(conteudoBase64, 'base64'),
          },
          contextoDe(requisicao),
        );
        return resposta.status(201).send({ id, provedor: casos.arquivos.provedor });
      },
    );

    app.get(
      '/projetos/:projetoId/arquivos',
      {
        schema: {
          tags: ['integracoes'],
          summary: 'Lista os arquivos do projeto no provedor configurado',
          params: ParamsProjeto,
          response: { 200: ArquivosResposta, ...erros },
        },
      },
      async (requisicao) => ({
        arquivos: await casos.arquivos.listar(requisicao.params.projetoId),
      }),
    );

    app.get(
      '/projetos/:projetoId/arquivos/conteudo',
      {
        schema: {
          tags: ['integracoes'],
          summary: 'Recupera o conteúdo de um arquivo do projeto, em base64',
          params: ParamsProjeto,
          querystring: QueryArquivo,
          response: { 200: ConteudoArquivoResposta, ...erros },
        },
      },
      async (requisicao) => {
        const { id } = requisicao.query;
        const conteudo = await casos.arquivos.recuperar(requisicao.params.projetoId, id);
        return { id, conteudoBase64: conteudo.toString('base64') };
      },
    );

    app.post(
      '/projetos/:projetoId/equipes/:equipeId/membros/:papel/pagamento',
      {
        schema: {
          tags: ['integracoes'],
          summary: 'Paga o membro de uma equipe formada no provedor configurado (Adapter)',
          params: ParamsMembro,
          response: { 201: PagamentoResposta, ...erros },
        },
      },
      async (requisicao, resposta) => {
        const pagamento = await casos.pagamentos.efetuar(
          { ...requisicao.params, papel: requisicao.params.papel },
          contextoDe(requisicao),
        );
        return resposta.status(201).send(apresentarPagamento(pagamento));
      },
    );

    app.get(
      '/projetos/:projetoId/pagamentos/:pagamentoId',
      {
        schema: {
          tags: ['integracoes'],
          summary: 'Consulta o status de um pagamento no provedor',
          params: ParamsPagamento,
          response: { 200: PagamentoResposta, ...erros },
        },
      },
      async (requisicao) =>
        apresentarPagamento(
          await casos.pagamentos.consultar(
            requisicao.params.projetoId,
            requisicao.params.pagamentoId,
          ),
        ),
    );

    app.delete(
      '/projetos/:projetoId/pagamentos/:pagamentoId',
      {
        schema: {
          tags: ['integracoes'],
          summary: 'Cancela um pagamento no provedor',
          params: ParamsPagamento,
          response: { 200: PagamentoResposta, ...erros },
        },
      },
      async (requisicao) =>
        apresentarPagamento(
          await casos.pagamentos.cancelar(
            requisicao.params.projetoId,
            requisicao.params.pagamentoId,
            contextoDe(requisicao),
          ),
        ),
    );
  };
}
