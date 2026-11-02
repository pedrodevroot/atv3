import type { Relogio } from '../../src/application/ports/relogio.js';
import { resolverParametros } from '../../src/application/strategies/parametros-recomendacao.js';
import { Competencia } from '../../src/domain/entidades/competencia.js';
import type { Profissional } from '../../src/domain/entidades/profissional.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { FaixaPreco } from '../../src/domain/value-objects/faixa-preco.js';
import { criarRegistroEstrategias } from '../../src/container.js';
import { RepositorioProfissionaisMemoria } from '../../src/infrastructure/repositories/repositorio-profissionais-memoria.js';
import { criarCadastroDemonstracao } from './cadastro-demonstracao.js';
import { SAO_PAULO, criarProfissional } from './dominio.js';
import { fabricaFiccao, fabricasTeste } from './fabricas.js';

export { fabricaFiccao };

export const AGORA = new Date('2026-09-27T12:00:00.000Z');
export const relogioFixo: Relogio = () => new Date(AGORA.getTime());

export const ID_EDITOR_ECONOMICO = 'editor-economico';

export function criarEditorEconomico(): Profissional {
  return criarProfissional({
    id: ID_EDITOR_ECONOMICO,
    nome: 'Duda Corte',
    especialidades: [Papel.EDITOR],
    competencias: [Competencia.criar('Montagem', 3), Competencia.criar('Ritmo narrativo', 3)],
    faixaPreco: FaixaPreco.criar(5_000, 8_000),
    localizacao: SAO_PAULO,
  });
}

export function criarAmbienteOrquestracao(cadastroExtra: readonly Profissional[] = []) {
  const repositorio = new RepositorioProfissionaisMemoria([
    ...criarCadastroDemonstracao(),
    criarEditorEconomico(),
    ...cadastroExtra,
  ]);
  const registro = criarRegistroEstrategias();
  return {
    repositorio,
    registro,
    fabricas: fabricasTeste,
    fabrica: fabricaFiccao,
    parametros: resolverParametros(),
    cosseno: registro.obter('similaridade-cosseno'),
  };
}
