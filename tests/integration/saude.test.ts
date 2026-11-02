import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';

describe('GET /health com PostgreSQL real', () => {
  let container: Container;
  let app: App;

  beforeAll(async () => {
    container = criarContainer(carregarConfig());
    app = await construirApp(container);
    app.addHook('onClose', () => container.encerrar());
  });

  afterAll(async () => {
    await app.close();
  });

  it('fica degradado até o cache do cadastro carregar e ok depois disso', async () => {
    const antes = await app.inject({ method: 'GET', url: '/health' });
    if (!container.dataSource.isInitialized) {
      await container.dataSource.initialize();
    }
    await container.cadastroProfissionais.aquecer();
    const depois = await app.inject({ method: 'GET', url: '/health' });

    expect(antes.json()).toMatchObject({
      status: 'degradado',
      dependencias: { postgres: 'disponivel', 'cadastro-profissionais': 'indisponivel' },
    });
    expect(depois.statusCode).toBe(200);
    expect(depois.json()).toMatchObject({
      status: 'ok',
      dependencias: { postgres: 'disponivel', 'cadastro-profissionais': 'disponivel' },
    });
  });

  it('conecta no PostgreSQL 18 ou superior', async () => {
    const [linha] = await container.dataSource.query<{ versao: string }[]>(
      "SELECT current_setting('server_version') AS versao",
    );

    expect(container.dataSource.isInitialized).toBe(true);
    expect(Number.parseInt(linha?.versao ?? '0', 10)).toBeGreaterThanOrEqual(18);
  });
});
