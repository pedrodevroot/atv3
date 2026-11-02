import { Equipe } from '../../domain/entidades/equipe.js';
import type { MembroEquipe } from '../../domain/entidades/membro-equipe.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { CriteriosBusca } from '../ports/repositorio-profissionais.js';
import type { CandidatoRanqueado, RankingPorPapel } from '../strategies/estrategia-recomendacao.js';
import {
  OrquestradorEquipe,
  type EntradaOrquestracao,
  type EntradaResolvida,
  type ResultadoMontagem,
} from './orquestrador-equipe.js';

export class OrquestradorPadrao extends OrquestradorEquipe {
  protected validarRestricoes({ projeto, parametros }: EntradaOrquestracao): void {
    if (projeto.equipeFormada) {
      this.violacao(
        'Projeto já possui equipe formada; solicite uma nova rodada apenas antes da formação.',
      );
    }
    if (projeto.dataEntrega.getTime() <= this.relogio().getTime()) {
      this.violacao('A data de entrega do projeto já passou.');
    }
    const minimoNecessario =
      projeto.papeisObrigatorios.length * parametros.orquestracao.custoMinimoPorPapel;
    if (projeto.orcamento < minimoNecessario) {
      this.violacao(
        `Orçamento de ${projeto.orcamento} é insuficiente para ${projeto.papeisObrigatorios.length} papéis (mínimo ${minimoNecessario}).`,
      );
    }
  }

  protected criteriosDeBusca({ projeto }: EntradaOrquestracao): CriteriosBusca {
    return {
      papeis: projeto.papeisObrigatorios,
      periodo: projeto.periodo,
      precoMinimoAte: projeto.orcamento,
    };
  }

  protected normalizarDados(
    _entrada: EntradaOrquestracao,
    profissionais: readonly Profissional[],
  ): Profissional[] {
    return this.normalizarCadastro(profissionais);
  }

  protected posProcessar(
    { parametros }: EntradaOrquestracao,
    ranking: RankingPorPapel,
  ): RankingPorPapel {
    return this.filtrarRanking(
      ranking,
      (candidato) => candidato.score >= parametros.orquestracao.scoreMinimo,
    );
  }

  protected montarEquipes(
    { projeto, estrategia, parametros }: EntradaResolvida<EntradaOrquestracao>,
    ranking: RankingPorPapel,
    rodada: number,
  ): ResultadoMontagem {
    const papeisPorPeso = [...projeto.requisitos]
      .sort((a, b) => b.peso - a.peso || a.papel.localeCompare(b.papel))
      .map((requisito) => requisito.papel);
    const custoMinimo = new Map<Papel, number>(
      papeisPorPeso.map((papel) => [papel, menorCusto(ranking.get(papel) ?? [])]),
    );
    const equipes: Equipe[] = [];
    const assinaturas = new Set<string>();

    for (let variacao = 0; variacao < parametros.orquestracao.numeroSugestoes; variacao += 1) {
      const membros = this.montarSugestao(
        papeisPorPeso,
        ranking,
        custoMinimo,
        projeto.orcamento,
        variacao,
      );
      const assinatura = membros
        .map((membro) => `${membro.papel}:${membro.profissional.id}`)
        .sort()
        .join('|');
      if (membros.length > 0 && !assinaturas.has(assinatura)) {
        assinaturas.add(assinatura);
        equipes.push(
          Equipe.criar({ projetoId: projeto.id, estrategia: estrategia.nome, membros, rodada }),
        );
      }
    }

    const avisos =
      equipes.length === 0
        ? ['Nenhuma equipe coube no orçamento com os candidatos disponíveis.']
        : [];
    return { equipes, avisos };
  }

  private montarSugestao(
    papeisPorPeso: readonly Papel[],
    ranking: RankingPorPapel,
    custoMinimo: ReadonlyMap<Papel, number>,
    orcamento: number,
    variacao: number,
  ): MembroEquipe[] {
    const usados = new Set<string>();
    const membros: MembroEquipe[] = [];
    let restante = orcamento;

    papeisPorPeso.forEach((papel, indice) => {
      const reserva = papeisPorPeso
        .slice(indice + 1)
        .reduce((soma, proximo) => soma + (custoMinimo.get(proximo) ?? 0), 0);
      const lista = ranking.get(papel) ?? [];
      const ordem = [...lista.slice(variacao), ...lista.slice(0, variacao)];
      const escolhido = ordem.find(
        (candidato) =>
          !usados.has(candidato.profissional.id) && candidato.custoEstimado <= restante - reserva,
      );
      if (escolhido) {
        usados.add(escolhido.profissional.id);
        restante -= escolhido.custoEstimado;
        membros.push(this.membroDe(escolhido));
      }
    });

    return membros;
  }
}

function menorCusto(candidatos: readonly CandidatoRanqueado[]): number {
  return candidatos.length === 0
    ? 0
    : Math.min(...candidatos.map((candidato) => candidato.custoEstimado));
}
