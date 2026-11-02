import type { Projeto } from '../../domain/entidades/projeto.js';
import { naoEncontrado } from '../erros/erro-aplicacao.js';
import type { RegistroFabricas } from '../familias/registro-fabricas.js';
import type { Relogio } from '../ports/relogio.js';
import type { RepositorioConvites } from '../ports/repositorio-convites.js';
import type { RepositorioPagamentos } from '../ports/repositorio-pagamentos.js';
import type { RepositorioProjetos } from '../ports/repositorio-projetos.js';
import type { RepositorioRecomendacoes } from '../ports/repositorio-recomendacoes.js';
import type { CatalogoModelos } from '../prototipos/catalogo-modelos.js';
import type { SistemaRecomendacao } from '../sistema-recomendacao.js';
import type { MontadorDecoradores } from '../strategies/decoradores/montador-decoradores.js';
import type { ParametrosRecomendacao } from '../strategies/parametros-recomendacao.js';
import type { RegistroEstrategias } from '../strategies/registro-estrategias.js';

export interface DependenciasCasosDeUso {
  readonly projetos: RepositorioProjetos;
  readonly convites: RepositorioConvites;
  readonly recomendacoes: RepositorioRecomendacoes;
  readonly pagamentos: RepositorioPagamentos;
  readonly decoradores: MontadorDecoradores;
  readonly estrategias: RegistroEstrategias;
  readonly fabricas: RegistroFabricas;
  readonly modelos: CatalogoModelos;
  readonly sistema: SistemaRecomendacao;
  readonly parametros: ParametrosRecomendacao;
  readonly relogio: Relogio;
}

export interface ContextoRequisicao {
  readonly correlacaoId?: string;
}

export async function obterProjeto(
  projetos: RepositorioProjetos,
  projetoId: string,
): Promise<Projeto> {
  const projeto = await projetos.obter(projetoId);
  if (!projeto) {
    throw naoEncontrado('Projeto', projetoId);
  }
  return projeto;
}
