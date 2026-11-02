import { describe, expect, it } from 'vitest';
import { SistemaRecomendacao } from '../../../../src/application/sistema-recomendacao.js';
import { resolverParametros } from '../../../../src/application/strategies/parametros-recomendacao.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { criarRegistroEstrategias } from '../../../../src/container.js';
import { BarramentoEventosEmMemoria } from '../../../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import {
  IDS_DEMONSTRACAO,
  criarCadastroDemonstracao,
  criarProjetoDemonstracao,
} from '../../../fixtures/cadastro-demonstracao.js';
import { fabricasTeste } from '../../../fixtures/fabricas.js';
import { criarAmbienteOrquestracao, relogioFixo } from '../../../fixtures/orquestracao.js';

const parametros = resolverParametros();
const registro = criarRegistroEstrategias();

function rankingDeDiretores(nomeEstrategia: string): string[] {
  const projeto = criarProjetoDemonstracao();
  const estrategia = registro.obter(nomeEstrategia);
  const ranking = estrategia.recomendar(projeto, criarCadastroDemonstracao(), parametros);
  return (ranking.get(Papel.DIRETOR) ?? []).map((candidato) => candidato.profissional.id);
}

describe('Demonstração do Strategy: mesmo projeto e mesmo cadastro, rankings diferentes', () => {
  it('similaridade de cosseno escolhe quem tem as competências do perfil ideal', () => {
    expect(rankingDeDiretores('similaridade-cosseno')).toEqual([
      IDS_DEMONSTRACAO.DIRETORA_TECNICA,
      IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
    ]);
  });

  it('filtragem colaborativa escolhe quem é melhor avaliado em projetos parecidos', () => {
    expect(rankingDeDiretores('filtragem-colaborativa')).toEqual([
      IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
      IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      IDS_DEMONSTRACAO.DIRETORA_TECNICA,
    ]);
  });

  it('regras de orçamento escolhem o melhor custo-benefício local', () => {
    expect(rankingDeDiretores('regras-orcamento')).toEqual([
      IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
      IDS_DEMONSTRACAO.DIRETORA_TECNICA,
    ]);
  });

  it('cada estratégia coloca um profissional diferente em primeiro lugar', () => {
    const primeiros = registro.nomes.map((nome) => rankingDeDiretores(nome)[0]);

    expect(new Set(primeiros).size).toBe(3);
  });

  it('a estratégia definida na criação do projeto é usada quando o produtor não escolhe outra', async () => {
    const sistema = new SistemaRecomendacao({
      repositorio: criarAmbienteOrquestracao().repositorio,
      fabricas: fabricasTeste,
      estrategias: registro,
      sujeito: new BarramentoEventosEmMemoria(),
      parametros,
      relogio: relogioFixo,
    });
    const projeto = criarProjetoDemonstracao('filtragem-colaborativa');

    expect((await sistema.recomendar(projeto)).estrategia).toBe('filtragem-colaborativa');
    expect((await sistema.recomendar(projeto, { estrategia: 'regras-orcamento' })).estrategia).toBe(
      'regras-orcamento',
    );
  });
});
