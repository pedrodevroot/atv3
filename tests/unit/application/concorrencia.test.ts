import { describe, expect, it } from 'vitest';
import {
  ErroAplicacao,
  comNovasTentativas,
  conflitoConcorrencia,
  ehConflitoConcorrencia,
} from '../../../src/application/erros/erro-aplicacao.js';

describe('comNovasTentativas', () => {
  it('repete a operação enquanto houver conflito de concorrência', async () => {
    let tentativas = 0;

    const resultado = await comNovasTentativas(() => {
      tentativas += 1;
      return tentativas < 3
        ? Promise.reject(conflitoConcorrencia('Projeto', 'p-1'))
        : Promise.resolve('salvo');
    });

    expect(resultado).toBe('salvo');
    expect(tentativas).toBe(3);
  });

  it('desiste após o limite e não repete outros erros', async () => {
    let tentativas = 0;
    const conflito = () => {
      tentativas += 1;
      return Promise.reject(conflitoConcorrencia('Projeto', 'p-1'));
    };

    await expect(comNovasTentativas(conflito, 2)).rejects.toMatchObject({
      codigo: 'CONFLITO_CONCORRENCIA',
    });
    expect(tentativas).toBe(2);
    await expect(
      comNovasTentativas(() => Promise.reject(new ErroAplicacao('NAO_ENCONTRADO', 'x'))),
    ).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(ehConflitoConcorrencia(new Error('x'))).toBe(false);
  });
});
