import { describe, expect, it, vi } from 'vitest';
import { OrquestradorPadrao } from '../../../src/application/orchestration/orquestrador-padrao.js';
import type { FonteCadastroProfissionais } from '../../../src/application/ports/repositorio-profissionais.js';
import type { Profissional } from '../../../src/domain/entidades/profissional.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import { RepositorioProfissionaisResiliente } from '../../../src/infrastructure/repositories/repositorio-profissionais-resiliente.js';
import {
  DisjuntorCircuito,
  ErroCircuitoAberto,
  ErroTempoEsgotado,
  comTempoLimite,
} from '../../../src/infrastructure/resiliencia/disjuntor.js';
import {
  criarCadastroDemonstracao,
  criarProjetoDemonstracao,
} from '../../fixtures/cadastro-demonstracao.js';
import { criarProfissional, criarProjeto } from '../../fixtures/dominio.js';
import {
  criarAmbienteOrquestracao,
  fabricaFiccao,
  relogioFixo,
} from '../../fixtures/orquestracao.js';

function relogioControlado(inicio = 0) {
  let agora = inicio;
  return {
    relogio: () => new Date(agora),
    avancar: (ms: number) => {
      agora += ms;
    },
  };
}

function fonteControlada(profissionais: Profissional[] = criarCadastroDemonstracao()) {
  let falhar = false;
  const fonte: FonteCadastroProfissionais & { chamadas: number } = {
    chamadas: 0,
    listarAtivos() {
      this.chamadas += 1;
      return falhar ? Promise.reject(new Error('ECONNREFUSED')) : Promise.resolve(profissionais);
    },
  };
  return {
    fonte,
    derrubar: () => {
      falhar = true;
    },
    restaurar: () => {
      falhar = false;
    },
  };
}

function criarResiliente(fonte: FonteCadastroProfissionais, relogio: () => Date, ttlMs = 1_000) {
  const disjuntor = new DisjuntorCircuito(
    { nome: 'cadastro', limiteFalhas: 2, esperaMs: 5_000 },
    relogio,
  );
  const repositorio = new RepositorioProfissionaisResiliente(
    fonte,
    disjuntor,
    { ttlMs, timeoutMs: 1_000, variacaoTtl: 0 },
    relogio,
  );
  return { repositorio, disjuntor };
}

const criterios = () => ({
  papeis: [Papel.DIRETOR],
  periodo: criarProjeto().periodo,
  precoMinimoAte: 1_000_000,
});

describe('comTempoLimite', () => {
  it('resolve dentro do prazo e rejeita quando o prazo estoura', async () => {
    await expect(comTempoLimite(Promise.resolve(1), 50, 'rápida')).resolves.toBe(1);
    await expect(
      comTempoLimite(new Promise((resolver) => setTimeout(resolver, 200)), 10, 'lenta'),
    ).rejects.toThrow(ErroTempoEsgotado);
  });
});

describe('DisjuntorCircuito', () => {
  it('abre após falhas seguidas, bloqueia, vai a meio-aberto e fecha no sucesso', async () => {
    const { relogio, avancar } = relogioControlado();
    const disjuntor = new DisjuntorCircuito(
      { nome: 'teste', limiteFalhas: 2, esperaMs: 1_000 },
      relogio,
    );
    const falha = () => Promise.reject(new Error('fora do ar'));

    await expect(disjuntor.executar(falha)).rejects.toThrow('fora do ar');
    expect(disjuntor.estado).toBe('FECHADO');
    await expect(disjuntor.executar(falha)).rejects.toThrow('fora do ar');
    expect(disjuntor.estado).toBe('ABERTO');

    const acao = vi.fn(() => Promise.resolve('ok'));
    await expect(disjuntor.executar(acao)).rejects.toThrow(ErroCircuitoAberto);
    expect(acao).not.toHaveBeenCalled();

    avancar(1_000);
    expect(disjuntor.estado).toBe('MEIO_ABERTO');
    await expect(disjuntor.executar(acao)).resolves.toBe('ok');
    expect(disjuntor.estado).toBe('FECHADO');
  });

  it('uma falha no meio-aberto reabre o circuito imediatamente', async () => {
    const { relogio, avancar } = relogioControlado();
    const disjuntor = new DisjuntorCircuito(
      { nome: 'teste', limiteFalhas: 1, esperaMs: 100 },
      relogio,
    );
    await expect(disjuntor.executar(() => Promise.reject(new Error('x')))).rejects.toThrow();
    avancar(100);

    await expect(disjuntor.executar(() => Promise.reject(new Error('y')))).rejects.toThrow('y');

    expect(disjuntor.estado).toBe('ABERTO');
  });
});

describe('RepositorioProfissionaisResiliente', () => {
  it('carrega o cadastro uma vez e atende as buscas em memória', async () => {
    const { relogio } = relogioControlado();
    const { fonte } = fonteControlada();
    const { repositorio } = criarResiliente(fonte, relogio);

    expect(await repositorio.aquecer()).toBe(true);
    const primeira = await repositorio.buscarCandidatos(criterios());
    await repositorio.buscarCandidatos({ ...criterios(), excluirIds: ['diretora-tecnica'] });

    expect(fonte.chamadas).toBe(1);
    expect(primeira).toMatchObject({ parcial: false, avisos: [] });
    expect(primeira.profissionais).toHaveLength(3);
    expect(repositorio.estado).toMatchObject({
      circuito: 'FECHADO',
      profissionaisEmCache: 4,
      degradado: false,
    });
    expect(await repositorio.verificar()).toBe(true);
  });

  it('com TTL vencido responde na hora com o snapshot e recarrega em segundo plano uma única vez', async () => {
    const { relogio, avancar } = relogioControlado();
    const { fonte } = fonteControlada();
    const { repositorio } = criarResiliente(fonte, relogio);
    await repositorio.aquecer();
    avancar(1_000);

    await Promise.all([
      repositorio.buscarCandidatos(criterios()),
      repositorio.buscarCandidatos(criterios()),
    ]);
    await vi.waitFor(() => {
      expect(fonte.chamadas).toBe(2);
    });
  });

  it('RNF05: com a fonte fora do ar usa o último snapshot e sinaliza resultado parcial', async () => {
    const { relogio, avancar } = relogioControlado();
    const { fonte, derrubar, restaurar } = fonteControlada();
    const { repositorio } = criarResiliente(fonte, relogio);
    await repositorio.aquecer();
    derrubar();
    avancar(1_000);
    await repositorio.buscarCandidatos(criterios());
    await vi.waitFor(() => {
      expect(repositorio.estado.degradado).toBe(true);
    });

    const degradada = await repositorio.buscarCandidatos(criterios());

    expect(degradada.parcial).toBe(true);
    expect(degradada.profissionais).toHaveLength(3);
    expect(degradada.avisos[0]).toContain('usando cadastro em cache');

    await vi.waitFor(() => {
      expect(repositorio.estado.circuito).toBe('ABERTO');
    });
    restaurar();
    avancar(5_000);
    await vi.waitFor(async () => {
      await repositorio.buscarCandidatos(criterios());
      expect(repositorio.estado.degradado).toBe(false);
    });
  });

  it('sem snapshot e com a fonte fora do ar devolve lista vazia parcial em vez de erro', async () => {
    const { relogio } = relogioControlado();
    const { fonte, derrubar } = fonteControlada();
    derrubar();
    const { repositorio } = criarResiliente(fonte, relogio);

    expect(await repositorio.aquecer()).toBe(false);
    const resultado = await repositorio.buscarCandidatos(criterios());

    expect(resultado).toMatchObject({ profissionais: [], parcial: true });
    expect(resultado.avisos[0]).toContain('Cadastro de profissionais indisponível');
    expect(await repositorio.verificar()).toBe(false);
  });

  it('a verificação de saúde recarrega o cache sozinha quando a fonte volta', async () => {
    const { relogio } = relogioControlado();
    const { fonte, derrubar, restaurar } = fonteControlada();
    derrubar();
    const { repositorio } = criarResiliente(fonte, relogio);
    await repositorio.aquecer();
    restaurar();

    expect(await repositorio.verificar()).toBe(false);
    await vi.waitFor(async () => {
      expect(await repositorio.verificar()).toBe(true);
    });
    expect(repositorio.estado.profissionaisEmCache).toBe(4);
  });

  it('o disjuntor aberto impede novas tentativas contra a fonte', async () => {
    const { relogio } = relogioControlado();
    const { fonte, derrubar } = fonteControlada();
    derrubar();
    const { repositorio, disjuntor } = criarResiliente(fonte, relogio);

    await repositorio.buscarCandidatos(criterios());
    await repositorio.buscarCandidatos(criterios());
    const bloqueada = await repositorio.buscarCandidatos(criterios());

    expect(disjuntor.estado).toBe('ABERTO');
    expect(fonte.chamadas).toBe(2);
    expect(bloqueada.avisos[0]).toContain('Circuito "cadastro" aberto');
    expect(repositorio.estado.idadeCacheMs).toBeNull();
  });

  it('invalidar força nova carga e o TTL recebe variação para evitar recargas simultâneas', async () => {
    const { relogio, avancar } = relogioControlado();
    const { fonte } = fonteControlada([criarProfissional({ id: 'unico' })]);
    const repositorio = new RepositorioProfissionaisResiliente(
      fonte,
      new DisjuntorCircuito({ nome: 'c', limiteFalhas: 3, esperaMs: 1_000 }, relogio),
      { ttlMs: 1_000, timeoutMs: 1_000, aleatorio: () => 1 },
      relogio,
    );
    await repositorio.aquecer();
    avancar(1_100);
    await repositorio.buscarCandidatos(criterios());
    expect(fonte.chamadas).toBe(1);

    repositorio.invalidar();
    await repositorio.buscarCandidatos(criterios());
    expect(fonte.chamadas).toBe(2);
  });

  it('RNF05 de ponta a ponta: a orquestração devolve resultado parcial com avisos, sem erro', async () => {
    const { relogio } = relogioControlado();
    const { fonte, derrubar } = fonteControlada();
    derrubar();
    const { repositorio } = criarResiliente(fonte, relogio);
    const { parametros, cosseno } = criarAmbienteOrquestracao();

    const resultado = await new OrquestradorPadrao(
      repositorio,
      fabricaFiccao,
      relogioFixo,
    ).orquestrar({
      projeto: criarProjetoDemonstracao(),
      estrategia: cosseno,
      parametros,
    });

    expect(resultado.parcial).toBe(true);
    expect(resultado.equipes).toEqual([]);
    expect(resultado.papeisSemCandidatos).toEqual([Papel.DIRETOR, Papel.EDITOR]);
    expect(resultado.avisos[0]).toContain('Cadastro de profissionais indisponível');
  });
});
