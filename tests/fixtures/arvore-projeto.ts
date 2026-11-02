import { OrquestradorPadrao } from '../../src/application/orchestration/orquestrador-padrao.js';
import type { Equipe } from '../../src/domain/entidades/equipe.js';
import type { Projeto } from '../../src/domain/entidades/projeto.js';
import { criarProjetoDemonstracao } from './cadastro-demonstracao.js';
import { criarAmbienteOrquestracao, fabricaFiccao, relogioFixo } from './orquestracao.js';

export interface ArvoreProjeto {
  readonly projeto: Projeto;
  readonly equipes: readonly Equipe[];
  readonly principal: Equipe;
}

export async function criarArvoreProjeto(): Promise<ArvoreProjeto> {
  const ambiente = criarAmbienteOrquestracao();
  const projeto = criarProjetoDemonstracao();
  const resultado = await new OrquestradorPadrao(
    ambiente.repositorio,
    fabricaFiccao,
    relogioFixo,
  ).orquestrar({
    projeto,
    estrategia: ambiente.cosseno,
    parametros: ambiente.parametros,
  });
  projeto.registrarSugestoes(resultado.equipes);
  const [principal] = resultado.equipes;
  if (!principal) {
    throw new Error('Nenhuma equipe sugerida');
  }
  return { projeto, equipes: resultado.equipes, principal };
}

export function confirmarTodos(projeto: Projeto, equipe: Equipe): void {
  for (const papel of projeto.papeisObrigatorios) {
    projeto.aceitarRecomendacao(equipe.id, papel);
    projeto.registrarRespostaConvite(equipe.id, papel, true);
  }
}

export function fotografar(projeto: Projeto): unknown {
  return {
    orcamento: projeto.orcamento,
    estrategia: projeto.estrategia,
    equipes: projeto.equipes.map((equipe) => ({
      id: equipe.id,
      status: equipe.status,
      rodada: equipe.rodada,
      custo: equipe.custoTotal,
      membros: equipe.membros.map((membro) => [
        membro.papel,
        membro.profissional.id,
        membro.status,
        membro.custo,
      ]),
    })),
  };
}
