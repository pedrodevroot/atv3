import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agendarVarredura } from '../../../src/infrastructure/agendamento/varredura-periodica.js';

describe('agendarVarredura', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executa a cada intervalo, sem sobrepor execuções, e para quando pedido', async () => {
    let chamadas = 0;
    let concluir: () => void = () => undefined;
    const varredura = agendarVarredura(
      () => {
        chamadas += 1;
        return new Promise<void>((resolver) => {
          concluir = resolver;
        });
      },
      1_000,
      () => undefined,
    );

    await vi.advanceTimersByTimeAsync(3_500);
    expect(chamadas).toBe(1);

    concluir();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(chamadas).toBe(2);

    concluir();
    varredura.parar();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(chamadas).toBe(2);
  });

  it('entrega a falha ao tratador e continua agendada', async () => {
    const falhas: unknown[] = [];
    let chamadas = 0;
    const varredura = agendarVarredura(
      () => {
        chamadas += 1;
        return Promise.reject(new Error('banco fora do ar'));
      },
      1_000,
      (erro) => falhas.push(erro),
    );

    await vi.advanceTimersByTimeAsync(2_000);
    varredura.parar();

    expect(chamadas).toBe(2);
    expect(falhas).toHaveLength(2);
  });
});
