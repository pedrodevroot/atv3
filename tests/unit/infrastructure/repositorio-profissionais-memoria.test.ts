import { describe, expect, it } from 'vitest';
import { Papel } from '../../../src/domain/enums/papel.js';
import { FaixaPreco } from '../../../src/domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../../src/domain/value-objects/intervalo.js';
import { RepositorioProfissionaisMemoria } from '../../../src/infrastructure/repositories/repositorio-profissionais-memoria.js';
import { criarProfissional, criarProjeto } from '../../fixtures/dominio.js';

describe('RepositorioProfissionaisMemoria', () => {
  const periodo = criarProjeto().periodo;
  const repositorio = new RepositorioProfissionaisMemoria([
    criarProfissional({ id: 'diretor' }),
    criarProfissional({ id: 'editor', especialidades: [Papel.EDITOR] }),
    criarProfissional({ id: 'inativo', ativo: false }),
    criarProfissional({ id: 'caro', faixaPreco: FaixaPreco.criar(90_000, 99_000) }),
    criarProfissional({
      id: 'ocupado',
      disponibilidades: [Intervalo.criar(new Date('2025-01-01'), new Date('2025-02-01'))],
    }),
  ]);

  it('filtra por papel, preço, disponibilidade, status e exclusões', async () => {
    const resultado = await repositorio.buscarCandidatos({
      papeis: [Papel.DIRETOR],
      periodo,
      precoMinimoAte: 50_000,
    });
    const comExclusao = await repositorio.buscarCandidatos({
      papeis: [Papel.DIRETOR, Papel.EDITOR],
      periodo,
      precoMinimoAte: 50_000,
      excluirIds: ['diretor'],
    });

    expect(resultado.profissionais.map((profissional) => profissional.id)).toEqual(['diretor']);
    expect(resultado.parcial).toBe(false);
    expect(comExclusao.profissionais.map((profissional) => profissional.id)).toEqual(['editor']);
  });

  it('salva e sobrescreve por id', () => {
    const local = new RepositorioProfissionaisMemoria();
    local.salvarTodos([criarProfissional({ id: 'x' }), criarProfissional({ id: 'x' })]);

    expect(local.total).toBe(1);
    expect(repositorio.total).toBe(5);
  });
});
