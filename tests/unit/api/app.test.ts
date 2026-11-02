import Type from 'typebox';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../../src/app.js';
import { ConsultarSaude } from '../../../src/application/use-cases/consultar-saude.js';
import { criarCasosMemoria } from '../../fixtures/api.js';

describe('API HTTP', () => {
  let app: App;

  beforeEach(async () => {
    const consultarSaude = new ConsultarSaude([
      { nome: 'postgres', verificar: () => Promise.resolve(false) },
    ]);
    app = await construirApp({ consultarSaude, casos: criarCasosMemoria().casos });

    app.get('/teste/indisponivel', async () => {
      throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5434'), {
        code: 'ECONNREFUSED',
      });
    });
    app.get('/teste/host-inexistente', async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND postgres'), { code: 'ENOTFOUND' });
    });
    app.post(
      '/teste/validacao',
      { schema: { body: Type.Object({ nome: Type.String({ minLength: 3 }) }) } },
      async () => ({ ok: true }),
    );
    app.post(
      '/teste/estrito',
      {
        schema: {
          body: Type.Object({ valor: Type.Number() }, { additionalProperties: false }),
        },
      },
      async () => ({ ok: true }),
    );
    app.get('/teste/falha', async () => {
      throw new Error('segredo interno');
    });
    app.get('/teste/conflito', async () => {
      throw Object.assign(new Error('Recurso em conflito'), { statusCode: 409, code: 'CONFLITO' });
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health responde 200 com o estado degradado das dependências', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/health' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({
      status: 'degradado',
      dependencias: { postgres: 'indisponivel' },
    });
  });

  it('propaga o x-request-id recebido', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'req-123' },
    });

    expect(resposta.headers['x-request-id']).toBe('req-123');
  });

  it('gera um x-request-id quando o cliente não envia', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/health' });

    expect(resposta.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('troca por um id gerado o x-request-id longo demais ou com caracteres inválidos', async () => {
    const longo = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'r'.repeat(65) },
    });
    const invalido = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'id com espaço\n' },
    });
    const limite = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'r'.repeat(64) },
    });

    expect(longo.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(invalido.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(limite.headers['x-request-id']).toBe('r'.repeat(64));
  });

  it('publica a documentação OpenAPI com a rota de saúde', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/docs/json' });
    const documento = resposta.json<{ paths: Record<string, unknown> }>();

    expect(resposta.statusCode).toBe(200);
    expect(Object.keys(documento.paths)).toContain('/health');
  });

  it('padroniza erros de validação com status 400', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/teste/validacao',
      payload: { nome: 'ab' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toMatchObject({
      codigo: 'REQUISICAO_INVALIDA',
      detalhes: [expect.stringContaining('/nome')],
    });
  });

  it('recusa campos fora do contrato em vez de descartá-los em silêncio', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/teste/estrito',
      payload: { valor: 1, estrategiaa: 'cosseno' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toMatchObject({ codigo: 'REQUISICAO_INVALIDA' });
  });

  it('não converte texto em número no corpo', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/teste/estrito',
      payload: { valor: '280000' },
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('oculta detalhes de erros inesperados', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/teste/falha' });

    expect(resposta.statusCode).toBe(500);
    expect(resposta.json()).toEqual({
      codigo: 'ERRO_INTERNO',
      mensagem: 'Erro interno do servidor.',
    });
  });

  it('responde 503 com retry-after quando uma dependência está fora do ar', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/teste/indisponivel' });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.headers['retry-after']).toBe('5');
    expect(resposta.json()).toMatchObject({ codigo: 'SERVICO_INDISPONIVEL' });
  });

  it('responde 503 quando o host do banco não é encontrado (container parado)', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/teste/host-inexistente' });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toMatchObject({ codigo: 'SERVICO_INDISPONIVEL' });
  });

  it('preserva status e código de erros de cliente', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/teste/conflito' });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({ codigo: 'CONFLITO', mensagem: 'Recurso em conflito' });
  });
});
