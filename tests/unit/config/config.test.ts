import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  carregarArquivoEnv,
  carregarConfig,
  ErroConfiguracao,
} from '../../../src/config/config.js';

const obrigatorias = { DB_USER: 'usuario', DB_PASSWORD: 'senha', DB_NAME: 'banco' };

describe('carregarConfig', () => {
  it('aplica valores padrão quando só as variáveis obrigatórias existem', () => {
    const config = carregarConfig(obrigatorias);

    expect(config).toEqual({
      ambiente: 'development',
      servidor: { host: '0.0.0.0', porta: 3000 },
      log: { nivel: 'info' },
      banco: {
        host: 'localhost',
        porta: 5432,
        usuario: 'usuario',
        senha: 'senha',
        nome: 'banco',
        schema: 'public',
        poolMaximo: 30,
        timeoutMs: 5000,
      },
      resiliencia: {
        cacheTtlMs: 300_000,
        cadastroTimeoutMs: 10_000,
        circuitoLimiteFalhas: 3,
        circuitoEsperaMs: 10_000,
      },
      convites: { varreduraMs: 60_000 },
    });
  });

  it('converte texto das variáveis de ambiente em números', () => {
    const config = carregarConfig({ ...obrigatorias, PORT: '8080', DB_POOL_MAX: '50' });

    expect(config.servidor.porta).toBe(8080);
    expect(config.banco.poolMaximo).toBe(50);
  });

  it('trata variáveis vazias como ausentes', () => {
    const config = carregarConfig({ ...obrigatorias, HOST: '' });

    expect(config.servidor.host).toBe('0.0.0.0');
  });

  it('falha no boot listando todos os problemas encontrados', () => {
    const carregar = () => carregarConfig({ PORT: 'abc', LOG_LEVEL: 'barulhento' });

    expect(carregar).toThrow(ErroConfiguracao);
    try {
      carregar();
    } catch (erro) {
      const problemas = (erro as ErroConfiguracao).problemas;
      expect(problemas.some((problema) => problema.startsWith('PORT'))).toBe(true);
      expect(problemas.some((problema) => problema.startsWith('LOG_LEVEL'))).toBe(true);
      expect(problemas.some((problema) => problema.includes('DB_USER'))).toBe(true);
      expect(new Set(problemas).size).toBe(problemas.length);
    }
  });
});

describe('carregarArquivoEnv', () => {
  const diretorio = mkdtempSync(join(tmpdir(), 'cinebridge-env-'));
  const chave = 'CINEBRIDGE_TESTE_ENV';

  afterEach(() => {
    Reflect.deleteProperty(process.env, chave);
  });

  it('retorna falso quando o arquivo não existe', () => {
    expect(carregarArquivoEnv(join(diretorio, 'inexistente.env'))).toBe(false);
  });

  it('carrega as variáveis do arquivo informado', () => {
    const caminho = join(diretorio, '.env');
    writeFileSync(caminho, `${chave}=carregado\n`);

    expect(carregarArquivoEnv(caminho)).toBe(true);
    expect(process.env[chave]).toBe('carregado');

    rmSync(diretorio, { recursive: true, force: true });
  });
});
