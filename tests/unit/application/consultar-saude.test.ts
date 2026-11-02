import { describe, expect, it } from 'vitest';
import type { VerificadorDependencia } from '../../../src/application/ports/verificador-dependencia.js';
import { ConsultarSaude } from '../../../src/application/use-cases/consultar-saude.js';

const relogioFixo = () => new Date('2026-09-27T12:00:00.000Z');

function verificador(nome: string, verificar: () => Promise<boolean>): VerificadorDependencia {
  return { nome, verificar };
}

describe('ConsultarSaude', () => {
  it('retorna ok quando todas as dependências estão disponíveis', async () => {
    const consulta = new ConsultarSaude(
      [verificador('postgres', () => Promise.resolve(true))],
      relogioFixo,
    );

    await expect(consulta.executar()).resolves.toEqual({
      status: 'ok',
      timestamp: '2026-09-27T12:00:00.000Z',
      dependencias: { postgres: 'disponivel' },
    });
  });

  it('retorna degradado quando alguma dependência está indisponível', async () => {
    const consulta = new ConsultarSaude([
      verificador('postgres', () => Promise.resolve(true)),
      verificador('fila', () => Promise.resolve(false)),
    ]);

    const relatorio = await consulta.executar();

    expect(relatorio.status).toBe('degradado');
    expect(relatorio.dependencias).toEqual({ postgres: 'disponivel', fila: 'indisponivel' });
  });

  it('considera indisponível o verificador que lança erro', async () => {
    const consulta = new ConsultarSaude([
      verificador('postgres', () => Promise.reject(new Error('conexão recusada'))),
    ]);

    const relatorio = await consulta.executar();

    expect(relatorio).toMatchObject({
      status: 'degradado',
      dependencias: { postgres: 'indisponivel' },
    });
  });

  it('retorna ok sem dependências registradas', async () => {
    const relatorio = await new ConsultarSaude([]).executar();

    expect(relatorio.status).toBe('ok');
    expect(Date.parse(relatorio.timestamp)).not.toBeNaN();
  });
});
