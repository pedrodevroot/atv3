import { describe, expect, it, vi } from 'vitest';
import {
  ORDEM_ETAPAS,
  type EntradaOrquestracao,
  type ResultadoOrquestracao,
} from '../../../../src/application/orchestration/orquestrador-equipe.js';
import { OrquestradorPadrao } from '../../../../src/application/orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from '../../../../src/application/orchestration/orquestrador-substituicao.js';
import type { RankingPorPapel } from '../../../../src/application/strategies/estrategia-recomendacao.js';
import type { Profissional } from '../../../../src/domain/entidades/profissional.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { criarProjetoDemonstracao } from '../../../fixtures/cadastro-demonstracao.js';
import { criarProjeto } from '../../../fixtures/dominio.js';
import {
  criarAmbienteOrquestracao,
  fabricaFiccao,
  relogioFixo,
} from '../../../fixtures/orquestracao.js';

class OrquestradorEspiao extends OrquestradorPadrao {
  readonly chamadas: string[] = [];

  protected override validarRestricoes(entrada: EntradaOrquestracao): void {
    this.chamadas.push('validarRestricoes');
    super.validarRestricoes(entrada);
  }

  protected override normalizarDados(
    entrada: EntradaOrquestracao,
    profissionais: readonly Profissional[],
  ): Profissional[] {
    this.chamadas.push('normalizarDados');
    return super.normalizarDados(entrada, profissionais);
  }

  protected override posProcessar(
    entrada: EntradaOrquestracao,
    ranking: RankingPorPapel,
  ): RankingPorPapel {
    this.chamadas.push('posProcessar');
    return super.posProcessar(entrada, ranking);
  }
}

describe('Demonstração do Template Method: o fluxo principal é invariável', () => {
  it('OrquestradorPadrao e OrquestradorSubstituicao executam exatamente a mesma sequência de etapas', async () => {
    const { repositorio, parametros, cosseno } = criarAmbienteOrquestracao();
    const projeto = criarProjetoDemonstracao();
    const padrao = new OrquestradorPadrao(repositorio, fabricaFiccao, relogioFixo);
    const substituicao = new OrquestradorSubstituicao(repositorio, fabricaFiccao, relogioFixo);

    const resultadoPadrao = await padrao.orquestrar({ projeto, estrategia: cosseno, parametros });
    const [equipe] = resultadoPadrao.equipes;
    if (!equipe) {
      throw new Error('Nenhuma equipe sugerida');
    }
    projeto.registrarSugestoes(resultadoPadrao.equipes);
    const resultadoSubstituicao = await substituicao.orquestrar({
      projeto,
      estrategia: cosseno,
      parametros,
      equipeId: equipe.id,
      papel: Papel.EDITOR,
    });

    expect(resultadoPadrao.etapas).toEqual(ORDEM_ETAPAS);
    expect(resultadoSubstituicao.etapas).toEqual(ORDEM_ETAPAS);
    expect(ORDEM_ETAPAS).toEqual([
      'validarRestricoes',
      'buscarCandidatos',
      'normalizarDados',
      'ranquear',
      'posProcessar',
      'montarEquipes',
      'registrarRecomendacoes',
    ]);
  });

  it('as subclasses só preenchem os passos; quem chama cada passo, e em que ordem, é o método-template', async () => {
    const { repositorio, parametros, cosseno } = criarAmbienteOrquestracao();
    const espiao = new OrquestradorEspiao(repositorio, fabricaFiccao, relogioFixo);
    const buscar = vi.spyOn(repositorio, 'buscarCandidatos');
    const recomendar = vi.spyOn(cosseno, 'recomendar');

    await espiao.orquestrar({
      projeto: criarProjetoDemonstracao(),
      estrategia: cosseno,
      parametros,
    });

    expect(espiao.chamadas).toEqual(['validarRestricoes', 'normalizarDados', 'posProcessar']);
    expect(buscar).toHaveBeenCalledOnce();
    expect(recomendar).toHaveBeenCalledOnce();
    expect(buscar.mock.invocationCallOrder[0]).toBeLessThan(
      recomendar.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('uma falha em validarRestricoes interrompe o fluxo antes de buscar e ranquear', async () => {
    const { repositorio, parametros, cosseno } = criarAmbienteOrquestracao();
    const espiao = new OrquestradorEspiao(repositorio, fabricaFiccao, relogioFixo);
    const buscar = vi.spyOn(repositorio, 'buscarCandidatos');
    const recomendar = vi.spyOn(cosseno, 'recomendar');
    const projetoSemOrcamento = criarProjeto({ orcamento: 1_500 });

    await expect(
      espiao.orquestrar({ projeto: projetoSemOrcamento, estrategia: cosseno, parametros }),
    ).rejects.toMatchObject({ codigo: 'RESTRICAO_VIOLADA' });

    expect(espiao.chamadas).toEqual(['validarRestricoes']);
    expect(buscar).not.toHaveBeenCalled();
    expect(recomendar).not.toHaveBeenCalled();
  });

  it('uma subclasse não consegue sobrescrever orquestrar()', () => {
    const { repositorio } = criarAmbienteOrquestracao();

    class Atalho extends OrquestradorPadrao {
      override orquestrar(): Promise<ResultadoOrquestracao> {
        return Promise.reject(new Error('pulou etapas'));
      }
    }

    expect(() => new Atalho(repositorio, fabricaFiccao)).toThrow(
      expect.objectContaining({
        codigo: 'FLUXO_INVARIAVEL',
        message: 'Atalho não pode sobrescrever orquestrar(): o fluxo principal é invariável.',
      }) as Error,
    );
  });

  it('trocar a estratégia muda a equipe, mas não o fluxo', async () => {
    const { repositorio, parametros, registro } = criarAmbienteOrquestracao();
    const orquestrador = new OrquestradorPadrao(repositorio, fabricaFiccao, relogioFixo);
    const diretorDa = async (nome: string) => {
      const resultado = await orquestrador.orquestrar({
        projeto: criarProjetoDemonstracao(),
        estrategia: registro.obter(nome),
        parametros,
      });
      return {
        diretor: resultado.equipes[0]?.membro(Papel.DIRETOR)?.profissional.nome,
        etapas: resultado.etapas,
      };
    };

    const cosseno = await diretorDa('similaridade-cosseno');
    const orcamento = await diretorDa('regras-orcamento');

    expect(cosseno.diretor).toBe('Helena Técnica');
    expect(orcamento.diretor).toBe('Caio Local');
    expect(cosseno.etapas).toEqual(orcamento.etapas);
  });
});
