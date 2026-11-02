import { describe, expect, it } from 'vitest';
import type { EstrategiaRecomendacao } from '../../../../src/application/strategies/estrategia-recomendacao.js';
import { FiltragemColaborativa } from '../../../../src/application/strategies/filtragem-colaborativa.js';
import { resolverParametros } from '../../../../src/application/strategies/parametros-recomendacao.js';
import { RegrasOrcamento } from '../../../../src/application/strategies/regras-orcamento.js';
import { SimilaridadeCosseno } from '../../../../src/application/strategies/similaridade-cosseno.js';
import { RequisitoPapel } from '../../../../src/domain/entidades/requisito-papel.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { FaixaPreco } from '../../../../src/domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../../../src/domain/value-objects/intervalo.js';
import { criarCadastroDemonstracao } from '../../../fixtures/cadastro-demonstracao.js';
import { criarProfissional, criarProjeto } from '../../../fixtures/dominio.js';

const estrategias: EstrategiaRecomendacao[] = [
  new SimilaridadeCosseno(),
  new FiltragemColaborativa(),
  new RegrasOrcamento(),
];

const inelegiveis = [
  criarProfissional({ id: 'inativo', ativo: false }),
  criarProfissional({ id: 'caro-demais', faixaPreco: FaixaPreco.criar(900_000, 1_000_000) }),
  criarProfissional({
    id: 'indisponivel',
    disponibilidades: [Intervalo.criar(new Date('2025-01-01'), new Date('2025-02-01'))],
  }),
  criarProfissional({ id: 'outro-papel', especialidades: [Papel.SONOPLASTA] }),
];

describe.each(estrategias)('Contrato de EstrategiaRecomendacao: $nome', (estrategia) => {
  const projeto = criarProjeto();
  const cadastro = [...criarCadastroDemonstracao(), ...inelegiveis];
  const parametros = resolverParametros();

  it('tem nome e descrição para seleção dinâmica', () => {
    expect(estrategia.nome).toMatch(/^[a-z-]+$/);
    expect(estrategia.descricao.length).toBeGreaterThan(20);
  });

  it('retorna uma lista para cada papel obrigatório do projeto', () => {
    const ranking = estrategia.recomendar(projeto, cadastro, parametros);

    expect([...ranking.keys()]).toEqual(projeto.papeisObrigatorios);
  });

  it('só recomenda profissionais ativos, do papel, disponíveis e dentro do teto', () => {
    const ranking = estrategia.recomendar(projeto, cadastro, parametros);
    const ids = [...ranking.values()].flat().map((candidato) => candidato.profissional.id);

    expect(ids).not.toContain('inativo');
    expect(ids).not.toContain('caro-demais');
    expect(ids).not.toContain('indisponivel');
    expect(ids).not.toContain('outro-papel');
    for (const [papel, candidatos] of ranking) {
      for (const candidato of candidatos) {
        expect(candidato.papel).toBe(papel);
        expect(candidato.profissional.atuaComo(papel)).toBe(true);
      }
    }
  });

  it('ordena por score decrescente com scores entre 0 e 1 e justificativa', () => {
    const candidatos =
      estrategia.recomendar(projeto, cadastro, parametros).get(Papel.DIRETOR) ?? [];
    const scores = candidatos.map((candidato) => candidato.score);

    expect(candidatos.length).toBeGreaterThan(1);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const candidato of candidatos) {
      expect(candidato.score).toBeGreaterThanOrEqual(0);
      expect(candidato.score).toBeLessThanOrEqual(1);
      expect(candidato.custoEstimado).toBeGreaterThan(0);
      expect(candidato.justificativa).not.toBe('');
    }
  });

  it('respeita o topN parametrizado', () => {
    const ranking = estrategia.recomendar(projeto, cadastro, resolverParametros({ topN: 1 }));

    expect(ranking.get(Papel.DIRETOR)).toHaveLength(1);
  });

  it('é determinística e não altera o cadastro recebido', () => {
    const copia = [...cadastro];
    const primeira = estrategia.recomendar(projeto, cadastro, parametros);
    const segunda = estrategia.recomendar(projeto, cadastro, parametros);

    expect(cadastro).toEqual(copia);
    expect(segunda).toEqual(primeira);
  });

  it('devolve lista vazia para papel sem candidatos, sem lançar erro', () => {
    const projetoComSonoplasta = criarProjeto({
      requisitos: [
        RequisitoPapel.criar(Papel.DIRETOR, 5),
        RequisitoPapel.criar(Papel.SONOPLASTA, 1),
      ],
    });
    const semSonoplastaElegivel = cadastro.filter(
      (profissional) => profissional.id !== 'outro-papel',
    );

    const ranking = estrategia.recomendar(projetoComSonoplasta, semSonoplastaElegivel, parametros);

    expect(ranking.get(Papel.SONOPLASTA)).toEqual([]);
  });
});
