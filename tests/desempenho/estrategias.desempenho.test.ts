import { describe, expect, it } from 'vitest';
import { resolverParametros } from '../../src/application/strategies/parametros-recomendacao.js';
import { RequisitoPapel } from '../../src/domain/entidades/requisito-papel.js';
import { PAPEIS } from '../../src/domain/enums/papel.js';
import { criarRegistroEstrategias } from '../../src/container.js';
import { gerarCadastroSintetico, medirMelhorTempo } from '../fixtures/cadastro-sintetico.js';
import { criarProjeto } from '../fixtures/dominio.js';

const TOTAL_PROFISSIONAIS = 10_000;
const LIMITE_MS = 2_000;

describe('Desempenho das estratégias (RNF01: < 2 s com 10 mil profissionais)', () => {
  const cadastro = gerarCadastroSintetico(TOTAL_PROFISSIONAIS);
  const projeto = criarProjeto({
    orcamento: 400_000,
    requisitos: PAPEIS.map((papel, indice) => RequisitoPapel.criar(papel, indice + 1)),
  });
  const parametros = resolverParametros();

  it.each(criarRegistroEstrategias().listar())(
    '$nome ranqueia 6 papéis em menos de 2 s',
    (estrategia) => {
      const ranking = estrategia.recomendar(projeto, cadastro, parametros);
      const duracao = medirMelhorTempo(3, () => {
        estrategia.recomendar(projeto, cadastro, parametros);
      });

      expect(ranking.size).toBe(PAPEIS.length);
      expect(
        [...ranking.values()].every((candidatos) => candidatos.length === parametros.topN),
      ).toBe(true);
      expect(duracao).toBeLessThan(LIMITE_MS);
    },
  );
});
