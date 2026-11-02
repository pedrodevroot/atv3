import type { CriteriosBusca } from '../../application/ports/repositorio-profissionais.js';
import type { Profissional } from '../../domain/entidades/profissional.js';

export function atendeCriterios(profissional: Profissional, criterios: CriteriosBusca): boolean {
  return (
    profissional.ativo &&
    profissional.faixaPreco.cabeNoOrcamento(criterios.precoMinimoAte) &&
    profissional.disponivelEm(criterios.periodo)
  );
}

export function filtrarCandidatos(
  profissionais: Iterable<Profissional>,
  criterios: CriteriosBusca,
): Profissional[] {
  const excluidos = new Set(criterios.excluirIds ?? []);
  const selecionados: Profissional[] = [];
  for (const profissional of profissionais) {
    if (
      !excluidos.has(profissional.id) &&
      criterios.papeis.some((papel) => profissional.atuaComo(papel)) &&
      atendeCriterios(profissional, criterios)
    ) {
      selecionados.push(profissional);
    }
  }
  return selecionados;
}
