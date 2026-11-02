import type { DataSource } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConexaoBanco } from '../../../src/infrastructure/database/conexao-banco.js';

function dataSourceFalso(falhasAntesDeConectar: number) {
  let falhas = falhasAntesDeConectar;
  const falso = {
    isInitialized: false,
    initialize: vi.fn(async () => {
      await Promise.resolve();
      if (falhas > 0) {
        falhas -= 1;
        throw Object.assign(new Error('getaddrinfo ENOTFOUND postgres'), { code: 'ENOTFOUND' });
      }
      falso.isInitialized = true;
      return falso;
    }),
  };
  return falso;
}

const criar = (falhas: number) => {
  const dataSource = dataSourceFalso(falhas);
  return { dataSource, conexao: new ConexaoBanco(dataSource as unknown as DataSource) };
};

describe('ConexaoBanco', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('chamadas simultâneas compartilham uma única tentativa de conexão', async () => {
    const { dataSource, conexao } = criar(0);

    await Promise.all([conexao.garantir(), conexao.garantir(), conexao.garantir()]);
    await conexao.garantir();

    expect(dataSource.initialize).toHaveBeenCalledOnce();
    expect(conexao.conectada).toBe(true);
  });

  it('depois de uma falha permite tentar de novo', async () => {
    const { dataSource, conexao } = criar(1);

    await expect(conexao.garantir()).rejects.toThrow('ENOTFOUND');
    await expect(conexao.garantir()).resolves.toBeUndefined();

    expect(dataSource.initialize).toHaveBeenCalledTimes(2);
  });

  it('reconecta em segundo plano quando o banco volta e só então aquece o cadastro', async () => {
    vi.useFakeTimers();
    const { dataSource, conexao } = criar(2);
    const aoConectar = vi.fn(() => Promise.resolve(true));
    const aoFalhar = vi.fn();

    conexao.reconectarEmSegundoPlano({ intervaloMs: 100, aoConectar, aoFalhar });
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    expect(aoConectar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(dataSource.initialize).toHaveBeenCalledTimes(3);
    expect(aoFalhar).toHaveBeenCalledTimes(2);
    expect(aoConectar).toHaveBeenCalledOnce();
    expect(conexao.conectada).toBe(true);
  });

  it('continua tentando enquanto o aquecimento não der certo', async () => {
    vi.useFakeTimers();
    const { conexao } = criar(0);
    const aoConectar = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    conexao.reconectarEmSegundoPlano({ intervaloMs: 50, aoConectar });
    await vi.advanceTimersByTimeAsync(500);

    expect(aoConectar).toHaveBeenCalledTimes(2);
  });

  it('parar interrompe as tentativas pendentes', async () => {
    vi.useFakeTimers();
    const { dataSource, conexao } = criar(10);

    conexao.reconectarEmSegundoPlano({ intervaloMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    conexao.parar();
    await vi.advanceTimersByTimeAsync(1_000);
    conexao.reconectarEmSegundoPlano({ intervaloMs: 50 });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(dataSource.initialize).toHaveBeenCalledOnce();
  });
});
