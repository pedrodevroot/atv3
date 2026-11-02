import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import { tratarErro } from './api/erros/tratador-erros.js';
import { rotasConvitesECatalogo } from './api/routes/convites.routes.js';
import { rotasTiposEModelos } from './api/routes/modelos.routes.js';
import { rotasProjetos } from './api/routes/projetos.routes.js';
import { rotasSaude } from './api/routes/saude.routes.js';
import { RespostaErro } from './api/schemas/comum.schema.js';
import type { CasosDeUso } from './application/use-cases/casos-de-uso.js';
import type { ConsultarSaude } from './application/use-cases/consultar-saude.js';

export interface DependenciasApi {
  consultarSaude: ConsultarSaude;
  casos: CasosDeUso;
}

export interface OpcoesApp {
  logger?: FastifyBaseLogger;
}

export const ID_REQUISICAO_ACEITO = /^[A-Za-z0-9._:-]{1,64}$/;

export function idDaRequisicao(requisicao: IncomingMessage): string {
  const informado = requisicao.headers['x-request-id'];
  return typeof informado === 'string' && ID_REQUISICAO_ACEITO.test(informado)
    ? informado
    : randomUUID();
}

export async function construirApp(dependencias: DependenciasApi, opcoes: OpcoesApp = {}) {
  const app = Fastify({
    ...(opcoes.logger ? { loggerInstance: opcoes.logger } : { logger: false }),
    requestIdHeader: false,
    genReqId: idDaRequisicao,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.addHook('onSend', async (requisicao, resposta) => {
    void resposta.header('x-request-id', requisicao.id);
  });
  app.setErrorHandler(tratarErro);
  app.addSchema(RespostaErro);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CineBridge - Recomendação e Orquestração de Equipes',
        description:
          'Microsserviço que recomenda e orquestra equipes audiovisuais usando Strategy, Template Method, Observer, Visitor, Prototype, Factory Method e Abstract Factory.',
        version: '1.0.0',
      },
      tags: [
        { name: 'projetos', description: 'Criação, recomendação e reavaliação' },
        { name: 'equipes', description: 'Aceite, rejeição, substituição e finalização' },
        { name: 'convites', description: 'Resposta dos profissionais' },
        { name: 'relatorios', description: 'Visitors e auditoria' },
        { name: 'catalogo', description: 'Estratégias e mensagens internas' },
        {
          name: 'tipos-e-modelos',
          description: 'Fábricas por tipo de projeto e modelos clonáveis',
        },
        { name: 'saude', description: 'Estado do serviço' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(rotasSaude(dependencias.consultarSaude));
  await app.register(rotasProjetos(dependencias.casos));
  await app.register(rotasConvitesECatalogo(dependencias.casos));
  await app.register(rotasTiposEModelos(dependencias.casos));

  return app;
}

export type App = Awaited<ReturnType<typeof construirApp>>;
