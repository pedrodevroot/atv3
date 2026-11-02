import { describe, expect, it } from 'vitest';
import { Convite } from '../../../src/domain/entidades/convite.js';
import { Recomendacao } from '../../../src/domain/entidades/recomendacao.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import { StatusConvite } from '../../../src/domain/enums/status.js';

const CRIADO_EM = new Date('2026-09-27T12:00:00.000Z');
const horasDepois = (horas: number) => new Date(CRIADO_EM.getTime() + horas * 3_600_000);

function novoConvite(validadeHoras?: number) {
  return Convite.criar({
    projetoId: 'projeto-1',
    equipeId: 'equipe-1',
    papel: Papel.EDITOR,
    profissionalId: 'prof-1',
    produtorId: 'produtor-1',
    criadoEm: CRIADO_EM,
    ...(validadeHoras === undefined ? {} : { validadeHoras }),
  });
}

describe('Convite', () => {
  it('nasce pendente com validade padrão de 72h', () => {
    const convite = novoConvite();

    expect(convite.status).toBe(StatusConvite.PENDENTE);
    expect(convite.pendente).toBe(true);
    expect(convite.expiraEm).toEqual(horasDepois(72));
    expect(convite.respondidoEm).toBeUndefined();
  });

  it('PENDENTE → ACEITO registra a data da resposta', () => {
    const convite = novoConvite();
    convite.aceitar(horasDepois(1));

    expect(convite.status).toBe(StatusConvite.ACEITO);
    expect(convite.respondidoEm).toEqual(horasDepois(1));
  });

  it('PENDENTE → RECUSADO', () => {
    const convite = novoConvite();
    convite.recusar(horasDepois(2));

    expect(convite.status).toBe(StatusConvite.RECUSADO);
  });

  it('PENDENTE → EXPIRADO somente após o vencimento', () => {
    const convite = novoConvite(24);

    expect(convite.expirar(horasDepois(23))).toBe(false);
    expect(convite.venceuEm(horasDepois(24))).toBe(true);
    expect(convite.expirar(horasDepois(24))).toBe(true);
    expect(convite.status).toBe(StatusConvite.EXPIRADO);
    expect(convite.expirar(horasDepois(48))).toBe(false);
  });

  it('resposta após o vencimento expira o convite e é rejeitada', () => {
    const convite = novoConvite(1);

    expect(() => {
      convite.aceitar(horasDepois(2));
    }).toThrow('Convite expirado não pode ser respondido.');
    expect(convite.status).toBe(StatusConvite.EXPIRADO);
  });

  it('PENDENTE → CANCELADO e estados finais não mudam mais', () => {
    const convite = novoConvite();
    convite.cancelar();

    expect(convite.status).toBe(StatusConvite.CANCELADO);
    expect(() => {
      convite.aceitar(horasDepois(1));
    }).toThrow('CANCELADO não pode mais ser alterado');
    expect(() => {
      convite.cancelar();
    }).toThrow(expect.objectContaining({ codigo: 'TRANSICAO_INVALIDA' }) as Error);
  });

  it('usa datas padrão e valida validade', () => {
    const convite = Convite.criar({
      projetoId: 'p',
      equipeId: 'e',
      papel: Papel.DIRETOR,
      profissionalId: 'prof',
      produtorId: 'prod',
    });
    convite.recusar();

    expect(convite.respondidoEm).toBeInstanceOf(Date);
    expect(() => novoConvite(0)).toThrow('Validade do convite deve ser maior que zero.');
  });

  it('restaura um convite persistido mantendo o estado', () => {
    const restaurado = Convite.restaurar({
      id: 'c-1',
      projetoId: 'p',
      equipeId: 'e',
      papel: Papel.DIRETOR,
      profissionalId: 'prof',
      produtorId: 'prod',
      criadoEm: CRIADO_EM,
      expiraEm: horasDepois(72),
      status: StatusConvite.ACEITO,
      respondidoEm: horasDepois(3),
    });

    expect(restaurado.id).toBe('c-1');
    expect(restaurado.pendente).toBe(false);
    expect(restaurado.respondidoEm).toEqual(horasDepois(3));
  });
});

describe('Recomendacao', () => {
  const base = {
    projetoId: 'projeto-1',
    papel: Papel.DIRETOR,
    profissionalId: 'prof-1',
    score: 0.92,
    posicao: 1,
    estrategia: 'similaridade-cosseno',
    rodada: 1,
  };

  it('registra score, posição, estratégia e rodada', () => {
    const recomendacao = Recomendacao.criar({ ...base, justificativa: ' cosseno 0.92 ' });

    expect(recomendacao.justificativa).toBe('cosseno 0.92');
    expect(recomendacao.equipeId).toBeUndefined();
    expect(recomendacao.criadaEm).toBeInstanceOf(Date);
    expect(Recomendacao.criar(base).justificativa).toBe('');
  });

  it.each([
    [{ score: 1.5 }, 'Score da recomendação'],
    [{ posicao: 0 }, 'Posição deve ser inteira'],
    [{ rodada: 1.5 }, 'Rodada deve ser inteira'],
    [{ profissionalId: '' }, 'Profissional recomendado é obrigatório.'],
  ])('valida invariantes %#', (dados, mensagem) => {
    expect(() => Recomendacao.criar({ ...base, ...dados })).toThrow(mensagem);
  });
});
