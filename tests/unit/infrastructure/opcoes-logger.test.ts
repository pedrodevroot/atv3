import { describe, expect, it } from 'vitest';
import { carregarConfig, type Config } from '../../../src/config/config.js';
import {
  criarLogger,
  criarOpcoesLogger,
} from '../../../src/infrastructure/logging/opcoes-logger.js';

function config(ambiente: Config['ambiente']): Config {
  return carregarConfig({
    NODE_ENV: ambiente,
    LOG_LEVEL: 'debug',
    DB_USER: 'u',
    DB_PASSWORD: 's',
    DB_NAME: 'b',
  });
}

describe('criarOpcoesLogger', () => {
  it('silencia o logger em testes', () => {
    expect(criarOpcoesLogger(config('test')).level).toBe('silent');
    expect(criarLogger(config('test')).level).toBe('silent');
  });

  it('usa pino-pretty em desenvolvimento', () => {
    expect(criarOpcoesLogger(config('development'))).toMatchObject({
      level: 'debug',
      transport: { target: 'pino-pretty' },
    });
  });

  it('emite JSON estruturado em produção', () => {
    const opcoes = criarOpcoesLogger(config('production'));

    expect(opcoes).toMatchObject({ level: 'debug', base: { servico: 'cinebridge-recomendacao' } });
    expect(opcoes).not.toHaveProperty('transport');
  });
});
