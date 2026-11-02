import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { ConsultarSaude } from '../../application/use-cases/consultar-saude.js';
import { RespostaSaude } from '../schemas/saude.schema.js';

export function rotasSaude(consultarSaude: ConsultarSaude): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.get(
      '/health',
      {
        schema: {
          tags: ['saude'],
          summary: 'Verifica o estado do serviço e das dependências',
          response: { 200: RespostaSaude },
        },
      },
      async () => consultarSaude.executar(),
    );
  };
}
