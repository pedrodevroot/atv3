import { pino, type Logger, type LoggerOptions } from 'pino';
import type { Config } from '../../config/config.js';

export function criarOpcoesLogger(config: Config): LoggerOptions {
  const base: LoggerOptions = {
    level: config.ambiente === 'test' ? 'silent' : config.log.nivel,
    base: { servico: 'cinebridge-recomendacao' },
    redact: ['req.headers.authorization'],
  };
  if (config.ambiente === 'development') {
    return {
      ...base,
      transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss.l' } },
    };
  }
  return base;
}

export function criarLogger(config: Config): Logger {
  return pino(criarOpcoesLogger(config));
}
