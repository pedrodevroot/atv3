import { describe, expect, it } from 'vitest';
import { avaliarPrecisao, precisaoEmK } from '../../../src/application/avaliacao/precisao.js';
import { resolverParametros } from '../../../src/application/strategies/parametros-recomendacao.js';
import { criarRegistroEstrategias } from '../../../src/container.js';
import { gerarCadastroComQualidade } from '../../../src/infrastructure/database/seeds/gerador-cadastro.js';
import { gerarProjetosSinteticos } from '../../fixtures/projetos-sinteticos.js';

describe('precisaoEmK', () => {
  it('conta a fração dos k primeiros que são relevantes', () => {
    const relevantes = new Set(['a', 'c']);

    expect(precisaoEmK(['a', 'b', 'c', 'd'], relevantes, 2)).toBe(0.5);
    expect(precisaoEmK(['a', 'c'], relevantes, 2)).toBe(1);
    expect(precisaoEmK(['a'], relevantes, 0)).toBe(0);
  });
});

describe('avaliarPrecisao (RNF03: precisão mensurável)', () => {
  it('mede cada configuração e a filtragem colaborativa supera o cosseno só por direção', () => {
    const registro = criarRegistroEstrategias();
    const resultados = avaliarPrecisao({
      cadastro: gerarCadastroComQualidade(1_200, 11),
      projetos: gerarProjetosSinteticos(4),
      k: 5,
      fracaoRelevantes: 0.1,
      configuracoes: [
        {
          rotulo: 'direcao',
          estrategia: registro.obter('similaridade-cosseno'),
          parametros: resolverParametros({
            cosseno: { pesoSimilaridade: 1, pesoAderencia: 0, pesoExperiencia: 0 },
          }),
        },
        {
          rotulo: 'colaborativa',
          estrategia: registro.obter('filtragem-colaborativa'),
          parametros: resolverParametros(),
        },
      ],
    });
    const [direcao, colaborativa] = resultados;

    expect(resultados.every((resultado) => resultado.amostras > 0)).toBe(true);
    expect(colaborativa?.precisao).toBeGreaterThan(direcao?.precisao ?? 1);
  });

  it('ignora papéis com menos elegíveis do que k', () => {
    const [resultado] = avaliarPrecisao({
      cadastro: gerarCadastroComQualidade(6, 3),
      projetos: gerarProjetosSinteticos(1),
      k: 5,
      fracaoRelevantes: 0.1,
      configuracoes: [
        {
          rotulo: 'x',
          estrategia: criarRegistroEstrategias().obter('regras-orcamento'),
          parametros: resolverParametros(),
        },
      ],
    });

    expect(resultado).toEqual({ rotulo: 'x', precisao: 0, amostras: 0 });
  });
});
