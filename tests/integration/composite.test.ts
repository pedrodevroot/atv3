import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';
import type { DadosServico } from '../../src/domain/entidades/servicos/servico-projeto.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { criarLogger } from '../../src/infrastructure/logging/opcoes-logger.js';
import { RepositorioProfissionaisTypeorm } from '../../src/infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { cadastroDaApi, corpoProjetoDemonstracao } from '../fixtures/api.js';
import { relogioFixo } from '../fixtures/orquestracao.js';
import {
  SERVICO_DOIS_NIVEIS,
  SERVICO_QUATRO_NIVEIS,
  SERVICO_RASO,
  TOTAIS_QUATRO_NIVEIS,
  semRequisitos,
} from '../fixtures/servicos.js';
import { limparTabelas, prepararBanco } from './banco.js';

interface ProjetoJson {
  id: string;
  requisitos: { papel: string; peso: number }[];
  servicoPrincipal: DadosServico;
  custoTotalServicos: number;
  prazoTotalDias: number;
}

function corpoComServico(servicoPrincipal: unknown, sobrescritas: Record<string, unknown> = {}) {
  return semRequisitos(corpoProjetoDemonstracao({ servicoPrincipal, ...sobrescritas }));
}

describe('Composite: hierarquia de serviços com PostgreSQL real', () => {
  let banco: DataSource;
  let container: Container;
  let app: App;

  beforeAll(async () => {
    banco = await prepararBanco();
    await limparTabelas(banco);
    await new RepositorioProfissionaisTypeorm(banco).salvarTodos(cadastroDaApi());
    const config = carregarConfig();
    container = criarContainer(config, criarLogger(config), { relogio: relogioFixo });
    await container.dataSource.initialize();
    app = await construirApp(container);
  });

  afterAll(async () => {
    await app.close();
    await container.encerrar();
    await banco.destroy();
  });

  it.each([
    ['um serviço atômico', SERVICO_RASO, 8_000, 10],
    ['dois níveis', SERVICO_DOIS_NIVEIS, 11_000.5, 15],
    [
      'quatro níveis',
      SERVICO_QUATRO_NIVEIS,
      TOTAIS_QUATRO_NIVEIS.custo,
      TOTAIS_QUATRO_NIVEIS.prazo,
    ],
  ])(
    'calcula custo e prazo e relê do banco a árvore com %s',
    async (_nome, servico, custo, prazo) => {
      const criado = await app.inject({
        method: 'POST',
        url: '/projetos',
        payload: corpoComServico(servico),
      });
      const { projeto } = criado.json<{ projeto: ProjetoJson }>();
      const lido = await app.inject({ method: 'GET', url: `/projetos/${projeto.id}` });
      const relido = lido.json<ProjetoJson>();

      expect(criado.statusCode, criado.body).toBe(201);
      expect(projeto.custoTotalServicos).toBe(custo);
      expect(projeto.prazoTotalDias).toBe(prazo);
      expect(relido.custoTotalServicos).toBe(custo);
      expect(relido.prazoTotalDias).toBe(prazo);
      expect(relido.servicoPrincipal).toEqual(projeto.servicoPrincipal);
      expect(relido.requisitos).toEqual(projeto.requisitos);
    },
  );

  it('recomenda para os papéis de toda a árvore, sem repetir papel', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoComServico(SERVICO_DOIS_NIVEIS, { orcamento: 150_000 }),
    });
    const { projeto, ranking } = criado.json<{
      projeto: ProjetoJson;
      ranking: Record<string, unknown[]>;
    }>();

    expect(projeto.requisitos).toEqual([
      { papel: Papel.EDITOR, peso: 4 },
      { papel: Papel.SONOPLASTA, peso: 2 },
    ]);
    expect(Object.keys(ranking)).toEqual([Papel.EDITOR, Papel.SONOPLASTA]);
  });

  it('grava em requisito_papel os papéis derivados da árvore', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoComServico(SERVICO_QUATRO_NIVEIS, { orcamento: 200_000 }),
    });
    const { projeto } = criado.json<{ projeto: ProjetoJson }>();

    const linhas = await banco.query<{ papel: string; peso: string }[]>(
      'SELECT papel, peso FROM requisito_papel WHERE projeto_id = $1 ORDER BY ordem',
      [projeto.id],
    );

    expect(linhas.map(({ papel, peso }) => [papel, Number(peso)])).toEqual([
      [Papel.DIRETOR, 5],
      [Papel.EDITOR, 4],
      [Papel.EFEITOS_VISUAIS, 1],
      [Papel.SONOPLASTA, 3],
    ]);
  });

  it('aceita requisitos como antes, convertidos em pacote simples', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao(),
    });
    const { projeto } = criado.json<{ projeto: ProjetoJson }>();

    expect(criado.statusCode).toBe(201);
    expect(projeto.custoTotalServicos).toBe(0);
    expect(
      'subservicos' in projeto.servicoPrincipal && projeto.servicoPrincipal.subservicos,
    ).toHaveLength(2);
  });

  it.each([
    ['custo acima do orçamento', { orcamento: 41_999 }, 'excede o orçamento'],
    [
      'prazo acima do período',
      { dataEntrega: '2026-10-20T00:00:00.000Z' },
      'excede o período do projeto',
    ],
  ])('recusa árvore com %s', async (_nome, sobrescritas, mensagem) => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoComServico(SERVICO_QUATRO_NIVEIS, sobrescritas),
    });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ codigo: string; mensagem: string }>()).toMatchObject({
      codigo: 'RESTRICAO_VIOLADA',
      mensagem: expect.stringContaining(mensagem) as string,
    });
  });

  it('a reavaliação que corta o orçamento abaixo do custo dos serviços é recusada', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoComServico(SERVICO_QUATRO_NIVEIS, { orcamento: 100_000 }),
    });
    const { projeto } = criado.json<{ projeto: ProjetoJson }>();

    const resposta = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/reavaliacao`,
      payload: { orcamento: 30_000 },
    });
    const relido = await container.repositorioProjetos.obter(projeto.id);

    expect(resposta.statusCode).toBe(422);
    expect(relido?.orcamento).toBe(100_000);
  });

  it('o relatório aponta a árvore que deixou de caber no orçamento', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoComServico(SERVICO_QUATRO_NIVEIS, { orcamento: 100_000 }),
    });
    const { projeto } = criado.json<{ projeto: ProjetoJson }>();
    await banco.query('UPDATE projeto SET orcamento = 1000 WHERE id = $1', [projeto.id]);

    const relatorio = await app.inject({ method: 'GET', url: `/projetos/${projeto.id}/relatorio` });

    expect(
      relatorio
        .json<{ validacao: { problemas: { codigo: string }[] } }>()
        .validacao.problemas.map((problema) => problema.codigo),
    ).toContain('ESTRUTURA_SERVICOS');
  });

  it.each([
    ['papel inexistente', { nome: 'x', papel: 'ATOR', custo: 1, prazoDias: 1 }],
    ['custo negativo', { nome: 'x', papel: Papel.EDITOR, custo: -1, prazoDias: 1 }],
    ['prazo fracionado', { nome: 'x', papel: Papel.EDITOR, custo: 1, prazoDias: 1.5 }],
    ['pacote vazio', { nome: 'x', subservicos: [] }],
    ['campo desconhecido', { nome: 'x', papel: Papel.EDITOR, custo: 1, prazoDias: 1, cor: 'azul' }],
  ])('a API recusa %s com 400', async (_nome, servico) => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoComServico(servico),
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('recusa árvore mais profunda que o limite, sem estourar a pilha', async () => {
    const niveis = 5_000;
    const atomico = JSON.stringify({ nome: 'x', papel: Papel.EDITOR, custo: 1, prazoDias: 1 });
    const fundo = `${'{"nome":"p","subservicos":['.repeat(niveis)}${atomico}${']}'.repeat(niveis)}`;

    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(corpoComServico('__ARVORE__')).replace('"__ARVORE__"', fundo),
    });

    expect(resposta.statusCode, resposta.body).toBe(400);
  });

  it('recusa requisitos e serviço principal juntos, e a ausência dos dois', async () => {
    const juntos = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao({ servicoPrincipal: SERVICO_RASO }),
    });
    const semNenhum = semRequisitos(corpoProjetoDemonstracao());
    const nenhum = await app.inject({ method: 'POST', url: '/projetos', payload: semNenhum });

    expect(juntos.statusCode).toBe(422);
    expect(nenhum.statusCode).toBe(422);
  });

  it('os modelos prontos trazem árvores que o clone preserva e os ajustes substituem', async () => {
    const modelos = await app.inject({ method: 'GET', url: '/modelos-projeto' });
    const ficcao = modelos
      .json<(ProjetoJson & { id: string })[]>()
      .find((modelo) => modelo.id === 'ficcao-longa');
    const comum = {
      titulo: 'Clone',
      produtorId: 'produtor-2',
      dataInicio: '2026-10-01T00:00:00.000Z',
      dataEntrega: '2027-01-30T00:00:00.000Z',
    };

    const clone = await app.inject({
      method: 'POST',
      url: '/modelos-projeto/ficcao-longa/projetos',
      payload: comum,
    });
    const ajustado = await app.inject({
      method: 'POST',
      url: '/modelos-projeto/ficcao-longa/projetos',
      payload: { ...comum, servicoPrincipal: SERVICO_DOIS_NIVEIS },
    });

    expect(ficcao?.custoTotalServicos).toBe(75_000);
    expect(ficcao?.prazoTotalDias).toBe(55);
    expect(clone.statusCode, clone.body).toBe(201);
    expect(clone.json<{ projeto: ProjetoJson }>().projeto.servicoPrincipal).toEqual(
      ficcao?.servicoPrincipal,
    );
    expect(ajustado.json<{ projeto: ProjetoJson }>().projeto.custoTotalServicos).toBe(11_000.5);
  });

  it('a migração converte projetos antigos em pacote simples e pode ser desfeita', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao(),
    });
    const { projeto } = criado.json<{ projeto: ProjetoJson }>();

    await banco.undoLastMigration({ transaction: 'each' });
    const colunas = await banco.query<unknown[]>(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'projeto' AND column_name = 'servico_principal'`,
    );
    await banco.runMigrations({ transaction: 'each' });
    const relido = await container.repositorioProjetos.obter(projeto.id);

    expect(colunas).toEqual([]);
    expect(relido?.requisitos.map(({ papel, peso }) => [papel, peso])).toEqual(
      projeto.requisitos.map(({ papel, peso }) => [papel, peso]),
    );
    expect(relido?.servicoPrincipal.listarSubservicos()).toHaveLength(projeto.requisitos.length);
    expect(relido?.calcularCustoTotal()).toBe(0);
  });
});
