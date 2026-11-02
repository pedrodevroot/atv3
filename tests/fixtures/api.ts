import { AtualizadorComposicao } from '../../src/application/observers/atualizador-composicao.js';
import type { Relogio } from '../../src/application/ports/relogio.js';
import { CatalogoModelos } from '../../src/application/prototipos/catalogo-modelos.js';
import { criarModelosPadrao } from '../../src/application/prototipos/modelos-padrao.js';
import { SistemaRecomendacao } from '../../src/application/sistema-recomendacao.js';
import { CacheRecomendacoes } from '../../src/application/strategies/decoradores/cache-decorator.js';
import {
  MontadorDecoradores,
  type NomeDecorador,
} from '../../src/application/strategies/decoradores/montador-decoradores.js';
import { resolverParametros } from '../../src/application/strategies/parametros-recomendacao.js';
import { criarCasosDeUso } from '../../src/application/use-cases/casos-de-uso.js';
import { ConsultarSaude } from '../../src/application/use-cases/consultar-saude.js';
import { construirApp } from '../../src/app.js';
import {
  criarCanaisSaida,
  criarObservadores,
  criarRegistroEstrategias,
  criarRegistroFabricas,
  registrarObservadores,
} from '../../src/container.js';
import type { Profissional } from '../../src/domain/entidades/profissional.js';
import {
  criarAdaptadorArmazenamento,
  criarAdaptadorPagamento,
  criarAdaptadorProfissional,
} from '../../src/infrastructure/adaptadores/criar-adaptadores.js';
import { DepositoObjetosMemoria } from '../../src/infrastructure/externos/armazenamento-externo.js';
import { LivroTransacoesMemoria } from '../../src/infrastructure/externos/gateway-pagamento.js';
import { BarramentoEventosEmMemoria } from '../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import { RepositorioPagamentosMemoria } from '../../src/infrastructure/repositories/repositorio-pagamentos-memoria.js';
import { RepositorioProfissionaisMemoria } from '../../src/infrastructure/repositories/repositorio-profissionais-memoria.js';
import { RepositorioProjetosMemoria } from '../../src/infrastructure/repositories/repositorio-projetos-memoria.js';
import {
  RepositorioConvitesMemoria,
  RepositorioRecomendacoesMemoria,
} from '../../src/infrastructure/repositories/repositorios-memoria.js';
import { criarCadastroDemonstracao } from './cadastro-demonstracao.js';
import { criarEditorEconomico, relogioFixo } from './orquestracao.js';

export function cadastroDaApi(): Profissional[] {
  return [...criarCadastroDemonstracao(), criarEditorEconomico()];
}

export async function criarAppMemoria(cadastro: readonly Profissional[] = cadastroDaApi()) {
  const ambiente = criarCasosMemoria(cadastro);
  const app = await construirApp({ consultarSaude: new ConsultarSaude([]), casos: ambiente.casos });
  return { app, ...ambiente };
}

export function criarCasosMemoria(
  cadastro: readonly Profissional[] = cadastroDaApi(),
  relogio: Relogio = relogioFixo,
  pilhaPadrao: readonly NomeDecorador[] = [],
) {
  const profissionais = new RepositorioProfissionaisMemoria(cadastro);
  const barramento = new BarramentoEventosEmMemoria();
  const canais = criarCanaisSaida();
  const estrategias = criarRegistroEstrategias();
  const fabricas = criarRegistroFabricas({ caixa: canais.caixa });
  const projetos = new RepositorioProjetosMemoria(fabricas);
  const parametros = resolverParametros();
  const recomendacoes = new RepositorioRecomendacoesMemoria();
  const pagamentos = new RepositorioPagamentosMemoria();
  const deposito = new DepositoObjetosMemoria();
  const livro = new LivroTransacoesMemoria();
  const cache = new CacheRecomendacoes({ ttlMs: 60_000, maximo: 100, relogio });
  const decoradores = new MontadorDecoradores(
    { cache, auditoria: canais.auditoria, fabricas, estrategias, relogio },
    pilhaPadrao,
  );
  const sistema = new SistemaRecomendacao({
    repositorio: profissionais,
    conectarCadastro: () => profissionais,
    fabricas,
    estrategias,
    sujeito: barramento,
    parametros,
    relogio,
  });
  sistema.configurarAdaptadores(
    criarAdaptadorArmazenamento('s3', deposito, ''),
    criarAdaptadorPagamento('stripe', livro),
    criarAdaptadorProfissional('interno', profissionais),
  );
  const atualizador = new AtualizadorComposicao({ projetos, recomendacoes, sistema, decoradores });
  registrarObservadores(barramento, criarObservadores({ canais, atualizador }));
  const casos = criarCasosDeUso(
    {
      projetos,
      convites: new RepositorioConvitesMemoria(),
      recomendacoes,
      pagamentos,
      decoradores,
      estrategias,
      fabricas,
      modelos: new CatalogoModelos(criarModelosPadrao(fabricas)),
      sistema,
      parametros,
      relogio,
    },
    {
      auditoria: {
        listarPorProjeto: (projetoId) =>
          Promise.resolve(
            canais.auditoria.entradas.todos.filter((entrada) => entrada.projetoId === projetoId),
          ),
      },
      mensagens: { mensagensDe: (id) => Promise.resolve([...canais.caixa.mensagensDe(id)]) },
    },
  );
  return {
    casos,
    barramento,
    canais,
    sistema,
    fabricas,
    projetos,
    cache,
    decoradores,
    deposito,
    livro,
    profissionais,
  };
}

export function corpoProjetoDemonstracao(sobrescritas: Record<string, unknown> = {}) {
  return {
    titulo: 'Vozes do Sertão',
    produtorId: 'produtor-1',
    genero: 'drama',
    tipoCaptacao: 'FICCAO',
    duracaoMinutos: 90,
    orcamento: 100_000,
    dataInicio: '2026-10-01T00:00:00.000Z',
    dataEntrega: '2026-12-30T00:00:00.000Z',
    localizacao: { cidade: 'São Paulo', uf: 'SP', latitude: -23.5505, longitude: -46.6333 },
    requisitos: [
      { papel: 'DIRETOR', peso: 5 },
      { papel: 'EDITOR', peso: 3 },
    ],
    estrategia: 'similaridade-cosseno',
    ...sobrescritas,
  };
}
