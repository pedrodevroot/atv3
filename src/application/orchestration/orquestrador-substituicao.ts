import type { Equipe } from '../../domain/entidades/equipe.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { CriteriosBusca } from '../ports/repositorio-profissionais.js';
import type { RankingPorPapel } from '../strategies/estrategia-recomendacao.js';
import {
  OrquestradorEquipe,
  type EntradaOrquestracao,
  type ResultadoMontagem,
} from './orquestrador-equipe.js';

export interface EntradaSubstituicao extends EntradaOrquestracao {
  readonly equipeId: string;
  readonly papel: Papel;
}

export class OrquestradorSubstituicao extends OrquestradorEquipe<EntradaSubstituicao> {
  protected validarRestricoes(entrada: EntradaSubstituicao): void {
    const equipe = this.equipeDe(entrada);
    if (!equipe.ativa) {
      this.violacao(`Equipe ${equipe.status} não aceita substituições.`);
    }
    if (!entrada.projeto.papeisObrigatorios.includes(entrada.papel)) {
      this.violacao(`${entrada.papel} não é um papel obrigatório do projeto.`);
    }
    if (equipe.membro(entrada.papel)?.confirmado === true) {
      this.violacao(`O membro de ${entrada.papel} já confirmou e não pode ser substituído.`);
    }
    if (this.orcamentoRestante(entrada) <= 0) {
      this.violacao('Não há orçamento restante para substituir o papel.');
    }
  }

  protected criteriosDeBusca(entrada: EntradaSubstituicao): CriteriosBusca {
    return {
      papeis: [entrada.papel],
      periodo: entrada.projeto.periodo,
      precoMinimoAte: this.orcamentoRestante(entrada),
      excluirIds: [...this.idsExcluidos(entrada)],
    };
  }

  protected normalizarDados(
    entrada: EntradaSubstituicao,
    profissionais: readonly Profissional[],
  ): Profissional[] {
    const excluidos = this.idsExcluidos(entrada);
    return this.normalizarCadastro(profissionais).filter(
      (profissional) => !excluidos.has(profissional.id),
    );
  }

  protected posProcessar(entrada: EntradaSubstituicao, ranking: RankingPorPapel): RankingPorPapel {
    const restante = this.orcamentoRestante(entrada);
    const soPapelAfetado = new Map([[entrada.papel, ranking.get(entrada.papel) ?? []]]);
    return this.filtrarRanking(
      soPapelAfetado,
      (candidato) =>
        candidato.custoEstimado <= restante &&
        candidato.score >= entrada.parametros.orquestracao.scoreMinimo,
    );
  }

  protected montarEquipes(
    entrada: EntradaSubstituicao,
    ranking: RankingPorPapel,
  ): ResultadoMontagem {
    const equipe = this.equipeDe(entrada);
    const [melhor] = ranking.get(entrada.papel) ?? [];
    if (!melhor) {
      return {
        equipes: [equipe],
        avisos: [`Nenhum substituto para ${entrada.papel} cabe no orçamento restante.`],
      };
    }
    entrada.projeto.substituirMembro(equipe.id, this.membroDe(melhor));
    return { equipes: [equipe], avisos: [] };
  }

  protected override exigeRegrasDoTipo(): boolean {
    return false;
  }

  protected override rodadaDe(entrada: EntradaSubstituicao): number {
    return this.equipeDe(entrada).rodada + 1;
  }

  private equipeDe(entrada: EntradaSubstituicao): Equipe {
    return entrada.projeto.equipe(entrada.equipeId);
  }

  private orcamentoRestante(entrada: EntradaSubstituicao): number {
    const custoFixo = this.equipeDe(entrada)
      .membrosFixos(entrada.papel)
      .reduce((soma, membro) => soma + membro.custo, 0);
    return entrada.projeto.orcamento - custoFixo;
  }

  private idsExcluidos(entrada: EntradaSubstituicao): Set<string> {
    const equipe = this.equipeDe(entrada);
    return new Set([
      ...equipe.membros.map((membro) => membro.profissional.id),
      ...equipe.profissionaisDescartados,
    ]);
  }
}
