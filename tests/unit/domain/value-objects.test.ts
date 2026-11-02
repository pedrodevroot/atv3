import { describe, expect, it } from 'vitest';
import { ErroDominio } from '../../../src/domain/comum/erro-dominio.js';
import { FaixaPreco } from '../../../src/domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../../src/domain/value-objects/intervalo.js';
import { Localizacao } from '../../../src/domain/value-objects/localizacao.js';
import {
  normalizarNomeCompetencia,
  VetorCompetencia,
} from '../../../src/domain/value-objects/vetor-competencia.js';
import { RIO_DE_JANEIRO, SAO_PAULO } from '../../fixtures/dominio.js';

const data = (dia: string) => new Date(`2026-${dia}T00:00:00.000Z`);

describe('Intervalo', () => {
  const outubro = Intervalo.criar(data('10-01'), data('10-31'));

  it('calcula a duração em dias', () => {
    expect(outubro.duracaoDias).toBe(30);
    expect(Intervalo.criar(data('10-01'), data('10-01')).duracaoDias).toBe(0);
  });

  it('detecta sobreposição e contenção', () => {
    const meioDeOutubro = Intervalo.criar(data('10-10'), data('10-20'));
    const outubroANovembro = Intervalo.criar(data('10-25'), data('11-05'));
    const dezembro = Intervalo.criar(data('12-01'), data('12-31'));

    expect(outubro.contem(meioDeOutubro)).toBe(true);
    expect(outubro.contem(outubroANovembro)).toBe(false);
    expect(outubro.sobrepoe(outubroANovembro)).toBe(true);
    expect(outubro.sobrepoe(dezembro)).toBe(false);
  });

  it('compara intervalos por valor e não compartilha as datas recebidas', () => {
    const inicio = data('10-01');
    const intervalo = Intervalo.criar(inicio, data('10-31'));
    inicio.setUTCFullYear(2030);

    expect(intervalo.equivale(outubro)).toBe(true);
    expect(intervalo.equivale(Intervalo.criar(data('10-02'), data('10-31')))).toBe(false);
  });

  it('rejeita fim antes do início e datas inválidas', () => {
    expect(() => Intervalo.criar(data('10-31'), data('10-01'))).toThrow(ErroDominio);
    expect(() => Intervalo.criar(new Date('invalida'), data('10-01'))).toThrow(
      'Início do intervalo deve ser uma data válida.',
    );
  });
});

describe('Localizacao', () => {
  it('normaliza a UF e compara cidade sem diferenciar acentos e caixa', () => {
    const saoPaulo = Localizacao.criar({
      cidade: ' sao paulo ',
      uf: 'sp',
      latitude: -23.55,
      longitude: -46.63,
    });

    expect(saoPaulo.uf).toBe('SP');
    expect(saoPaulo.mesmaCidade(SAO_PAULO)).toBe(true);
    expect(saoPaulo.mesmaUf(RIO_DE_JANEIRO)).toBe(false);
    expect(saoPaulo.mesmaCidade(RIO_DE_JANEIRO)).toBe(false);
  });

  it('calcula a distância geodésica em km', () => {
    expect(SAO_PAULO.distanciaKm(RIO_DE_JANEIRO)).toBeCloseTo(361, -1);
    expect(SAO_PAULO.distanciaKm(SAO_PAULO)).toBe(0);
  });

  it.each([
    [{ cidade: '', uf: 'SP', latitude: 0, longitude: 0 }, 'Cidade é obrigatório.'],
    [{ cidade: 'X', uf: 'SPA', latitude: 0, longitude: 0 }, 'UF deve ter duas letras.'],
    [{ cidade: 'X', uf: 'SP', latitude: 91, longitude: 0 }, 'Latitude'],
    [{ cidade: 'X', uf: 'SP', latitude: 0, longitude: -181 }, 'Longitude'],
  ])('rejeita dados inválidos %#', (dados, mensagem) => {
    expect(() => Localizacao.criar(dados)).toThrow(mensagem);
  });
});

describe('FaixaPreco', () => {
  const faixa = FaixaPreco.criar(5_000, 15_000);

  it('expõe média, pertinência e compatibilidade com teto', () => {
    expect(faixa.media).toBe(10_000);
    expect(faixa.contem(5_000)).toBe(true);
    expect(faixa.contem(15_001)).toBe(false);
    expect(faixa.cabeNoOrcamento(5_000)).toBe(true);
    expect(faixa.cabeNoOrcamento(4_999)).toBe(false);
  });

  it('negocia o preço dentro do teto sem passar da média nem ficar abaixo do mínimo', () => {
    expect(faixa.precoNegociado(50_000)).toBe(10_000);
    expect(faixa.precoNegociado(7_000)).toBe(7_000);
    expect(faixa.precoNegociado(1_000)).toBe(5_000);
  });

  it('rejeita mínimo negativo e máximo menor que o mínimo', () => {
    expect(() => FaixaPreco.criar(-1, 10)).toThrow(ErroDominio);
    expect(() => FaixaPreco.criar(10, 5)).toThrow(
      'Preço máximo deve ser maior ou igual ao mínimo.',
    );
  });
});

describe('VetorCompetencia', () => {
  it('normaliza nomes removendo acentos, caixa e espaços', () => {
    expect(normalizarNomeCompetencia('  Direção de Fotografia ')).toBe('direcao-de-fotografia');
  });

  it('cria a partir de pares ou objeto e mantém o maior valor em nomes repetidos', () => {
    const porPares = VetorCompetencia.de([
      ['Edição', 0.4],
      ['edicao', 0.9],
    ]);
    const porObjeto = VetorCompetencia.de({ edição: 0.9 });

    expect(porPares.valor('EDIÇÃO')).toBe(0.9);
    expect(porPares.dimensoes).toEqual(['edicao']);
    expect(porObjeto.similaridadeCosseno(porPares)).toBeCloseTo(1);
  });

  it('calcula produto escalar, magnitude e similaridade de cosseno', () => {
    const a = VetorCompetencia.de({ x: 1, y: 0 });
    const b = VetorCompetencia.de({ x: 1, y: 1, z: 0 });
    const ortogonal = VetorCompetencia.de({ y: 1 });

    expect(a.produtoEscalar(b)).toBe(1);
    expect(b.produtoEscalar(a)).toBe(1);
    expect(b.magnitude).toBeCloseTo(Math.SQRT2);
    expect(a.similaridadeCosseno(b)).toBeCloseTo(Math.SQRT1_2);
    expect(a.similaridadeCosseno(ortogonal)).toBe(0);
    expect(a.valor('inexistente')).toBe(0);
  });

  it('retorna similaridade zero para vetor vazio', () => {
    const vazio = VetorCompetencia.de([]);

    expect(vazio.vazio).toBe(true);
    expect(vazio.similaridadeCosseno(VetorCompetencia.de({ x: 1 }))).toBe(0);
  });

  it('rejeita valores negativos e nomes vazios', () => {
    expect(() => VetorCompetencia.de({ x: -1 })).toThrow(ErroDominio);
    expect(() => VetorCompetencia.de({ '  ': 1 })).toThrow('Nome da competência é obrigatório.');
  });
});
