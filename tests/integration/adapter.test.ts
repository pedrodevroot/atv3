import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';
import { PAPEIS } from '../../src/domain/enums/papel.js';
import {
  criarAdaptadorArmazenamento,
  criarAdaptadorPagamento,
  criarAdaptadorProfissional,
} from '../../src/infrastructure/adaptadores/criar-adaptadores.js';
import { criarLogger } from '../../src/infrastructure/logging/opcoes-logger.js';
import { RepositorioProfissionaisTypeorm } from '../../src/infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { cadastroDaApi, corpoProjetoDemonstracao } from '../fixtures/api.js';
import { relogioFixo } from '../fixtures/orquestracao.js';
import { limparTabelas, prepararBanco } from './banco.js';

interface Rodada {
  projeto: {
    id: string;
    equipes: {
      id: string;
      membros: { papel: string; custo: number; profissional: { id: string } }[];
    }[];
  };
}

const PROVEDORES_ARQUIVO = ['s3', 'google-cloud', 'local'] as const;
const PROVEDORES_PAGAMENTO = ['stripe', 'pagseguro', 'paypal'] as const;
const PROVEDORES_EXTERNOS = ['linkedin', 'indeed'] as const;
const REQUISITOS_TODOS = PAPEIS.map((papel) => ({ papel, peso: 1 }));

describe('Adapter: trocar o provedor não altera a lógica de negócio', () => {
  const diretorio = mkdtempSync(join(tmpdir(), 'cinebridge-integracao-'));
  let banco: DataSource;
  let container: Container;
  let outroProcesso: Container;
  let app: App;

  function configurar(
    armazenamento: (typeof PROVEDORES_ARQUIVO)[number] = 's3',
    pagamento: (typeof PROVEDORES_PAGAMENTO)[number] = 'stripe',
    profissional: 'interno' | (typeof PROVEDORES_EXTERNOS)[number] = 'interno',
  ) {
    container.sistema.configurarAdaptadores(
      criarAdaptadorArmazenamento(armazenamento, container.depositoObjetos, diretorio),
      criarAdaptadorPagamento(pagamento, container.livroTransacoes),
      criarAdaptadorProfissional(profissional, container.repositorioProfissionais),
    );
  }

  async function criarProjeto(sobrescritas: Record<string, unknown> = {}): Promise<Rodada> {
    const resposta = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao(sobrescritas),
    });
    expect(resposta.statusCode, resposta.body).toBe(201);
    return resposta.json<Rodada>();
  }

  async function formarEquipe(rodada: Rodada): Promise<string> {
    const { id: projetoId, equipes } = rodada.projeto;
    const equipe = equipes[0];
    if (!equipe) {
      throw new Error('Projeto sem equipe sugerida.');
    }
    for (const { papel } of equipe.membros) {
      const aceite = await app.inject({
        method: 'POST',
        url: `/projetos/${projetoId}/equipes/${equipe.id}/membros/${papel}/aceite`,
      });
      const conviteId = aceite.json<{ convite: { id: string } }>().convite.id;
      await app.inject({
        method: 'POST',
        url: `/convites/${conviteId}/resposta`,
        payload: { aceito: true },
      });
      await container.barramento.aguardarEntregas();
    }
    const finalizacao = await app.inject({
      method: 'POST',
      url: `/projetos/${projetoId}/equipes/${equipe.id}/finalizacao`,
    });
    expect(finalizacao.statusCode, finalizacao.body).toBe(200);
    return equipe.id;
  }

  beforeAll(async () => {
    banco = await prepararBanco();
    await limparTabelas(banco);
    await new RepositorioProfissionaisTypeorm(banco).salvarTodos(cadastroDaApi());
    const config = carregarConfig();
    container = criarContainer(config, criarLogger(config), { relogio: relogioFixo });
    outroProcesso = criarContainer(config, criarLogger(config), { relogio: relogioFixo });
    await container.dataSource.initialize();
    await outroProcesso.dataSource.initialize();
    app = await construirApp(container);
  });

  beforeEach(() => {
    configurar();
  });

  afterAll(async () => {
    await app.close();
    await container.encerrar();
    await outroProcesso.encerrar();
    await banco.destroy();
    rmSync(diretorio, { recursive: true, force: true });
  });

  it.each(PROVEDORES_ARQUIVO)(
    'anexa, lista e recupera arquivos com o provedor %s pelas mesmas rotas',
    async (provedor) => {
      configurar(provedor);
      const { projeto } = await criarProjeto();
      const conteudo = Buffer.from(`roteiro em ${provedor}`);

      const anexo = await app.inject({
        method: 'POST',
        url: `/projetos/${projeto.id}/arquivos`,
        payload: {
          nome: 'roteiro.txt',
          tipoConteudo: 'text/plain',
          conteudoBase64: conteudo.toString('base64'),
        },
      });
      const { id, provedor: usado } = anexo.json<{ id: string; provedor: string }>();
      const lista = await app.inject({ method: 'GET', url: `/projetos/${projeto.id}/arquivos` });
      const baixado = await app.inject({
        method: 'GET',
        url: `/projetos/${projeto.id}/arquivos/conteudo`,
        query: { id },
      });

      expect(anexo.statusCode, anexo.body).toBe(201);
      expect(usado).toBe(provedor);
      expect(lista.json<{ arquivos: string[] }>().arquivos).toEqual([id]);
      expect(baixado.json<{ conteudoBase64: string }>().conteudoBase64).toBe(
        conteudo.toString('base64'),
      );
    },
  );

  it('um provedor não enxerga os arquivos do outro', async () => {
    const { projeto } = await criarProjeto();
    await container.casos.arquivos.anexar(
      {
        projetoId: projeto.id,
        nome: 'a.txt',
        tipoConteudo: 'text/plain',
        conteudo: Buffer.from('a'),
      },
      {},
    );

    configurar('google-cloud');

    expect(await container.casos.arquivos.listar(projeto.id)).toEqual([]);
  });

  it('o arquivo gravado por um processo é lido por outro, como no cluster', async () => {
    const { projeto } = await criarProjeto();
    const id = await container.casos.arquivos.anexar(
      {
        projetoId: projeto.id,
        nome: 'b.txt',
        tipoConteudo: 'text/plain',
        conteudo: Buffer.from('compartilhado'),
      },
      {},
    );

    const lido = await outroProcesso.casos.arquivos.recuperar(projeto.id, id);

    expect(lido.toString()).toBe('compartilhado');
  });

  it('não entrega arquivo de outro projeto, mesmo com o id correto', async () => {
    const dono = await criarProjeto();
    const outro = await criarProjeto();
    const id = await container.casos.arquivos.anexar(
      {
        projetoId: dono.projeto.id,
        nome: 'c.txt',
        tipoConteudo: 'text/plain',
        conteudo: Buffer.from('privado'),
      },
      {},
    );

    const resposta = await app.inject({
      method: 'GET',
      url: `/projetos/${outro.projeto.id}/arquivos/conteudo`,
      query: { id },
    });

    expect(resposta.statusCode).toBe(404);
  });

  it('registra o anexo na auditoria', async () => {
    const { projeto } = await criarProjeto();
    await container.casos.arquivos.anexar(
      {
        projetoId: projeto.id,
        nome: 'd.txt',
        tipoConteudo: 'text/plain',
        conteudo: Buffer.from('d'),
      },
      { correlacaoId: 'anexo-1' },
    );
    await container.barramento.aguardarEntregas();

    const auditoria = await container.casos.consultas.listarAuditoria(projeto.id);

    expect(auditoria.find((entrada) => entrada.tipo === 'ARQUIVO_ANEXADO')).toMatchObject({
      correlacaoId: 'anexo-1',
      dados: { provedor: 's3', tamanhoBytes: 1 },
    });
  });

  it.each(PROVEDORES_PAGAMENTO)(
    'paga, consulta e cancela com o provedor %s pelas mesmas rotas',
    async (provedor) => {
      configurar('s3', provedor);
      const rodada = await criarProjeto();
      const equipeId = await formarEquipe(rodada);
      const { id: projetoId } = rodada.projeto;
      const membro = rodada.projeto.equipes[0]?.membros[0];
      const rota = `/projetos/${projetoId}/equipes/${equipeId}/membros/${membro?.papel ?? ''}/pagamento`;

      const pago = await app.inject({ method: 'POST', url: rota });
      const pagamento = pago.json<{
        id: string;
        valor: number;
        status: string;
        provedor: string;
      }>();
      const consulta = await app.inject({
        method: 'GET',
        url: `/projetos/${projetoId}/pagamentos/${pagamento.id}`,
      });
      const cancelado = await app.inject({
        method: 'DELETE',
        url: `/projetos/${projetoId}/pagamentos/${pagamento.id}`,
      });
      const novoPagamento = await app.inject({ method: 'POST', url: rota });

      expect(pago.statusCode, pago.body).toBe(201);
      expect(pagamento).toMatchObject({ provedor, status: 'APROVADO', valor: membro?.custo });
      expect(consulta.json<{ status: string }>().status).toBe('APROVADO');
      expect(cancelado.json<{ status: string }>().status).toBe('CANCELADO');
      expect(novoPagamento.statusCode).toBe(201);
    },
  );

  it('não paga duas vezes o mesmo papel, nem em chamadas simultâneas', async () => {
    const rodada = await criarProjeto();
    const equipeId = await formarEquipe(rodada);
    const papel = rodada.projeto.equipes[0]?.membros[0]?.papel ?? '';
    const rota = `/projetos/${rodada.projeto.id}/equipes/${equipeId}/membros/${papel}/pagamento`;
    const contarAprovadas = async () => {
      const [linha] = await banco.query<{ aprovadas: string }[]>(
        `SELECT count(*) AS aprovadas FROM transacao_externa
         WHERE status = 'succeeded' AND dados->>'recebedor' = $1`,
        [rodada.projeto.equipes[0]?.membros[0]?.profissional.id],
      );
      return Number(linha?.aprovadas);
    };
    const aprovadasAntes = await contarAprovadas();

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () => app.inject({ method: 'POST', url: rota })),
    );
    const repetida = await app.inject({ method: 'POST', url: rota });

    expect(respostas.filter((resposta) => resposta.statusCode === 201)).toHaveLength(1);
    expect(respostas.filter((resposta) => resposta.statusCode === 409)).toHaveLength(4);
    expect(repetida.statusCode).toBe(409);
    expect((await contarAprovadas()) - aprovadasAntes).toBe(1);
    const [ativos] = await banco.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM pagamento_membro WHERE equipe_id = $1 AND NOT cancelado',
      [equipeId],
    );
    expect(Number(ativos?.total)).toBe(1);
  });

  it('só paga equipe formada', async () => {
    const { projeto } = await criarProjeto();
    const equipe = projeto.equipes[0];

    const resposta = await app.inject({
      method: 'POST',
      url: `/projetos/${projeto.id}/equipes/${equipe?.id ?? ''}/membros/${equipe?.membros[0]?.papel ?? ''}/pagamento`,
    });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json<{ codigo: string }>().codigo).toBe('TRANSICAO_INVALIDA');
  });

  it('avisa quando o pagamento foi feito em outro provedor', async () => {
    const rodada = await criarProjeto();
    const equipeId = await formarEquipe(rodada);
    const papel = rodada.projeto.equipes[0]?.membros[0]?.papel ?? '';
    const pago = await app.inject({
      method: 'POST',
      url: `/projetos/${rodada.projeto.id}/equipes/${equipeId}/membros/${papel}/pagamento`,
    });

    configurar('s3', 'paypal');
    const consulta = await app.inject({
      method: 'GET',
      url: `/projetos/${rodada.projeto.id}/pagamentos/${pago.json<{ id: string }>().id}`,
    });

    expect(consulta.statusCode).toBe(422);
    expect(consulta.json<{ mensagem: string }>().mensagem).toContain('stripe');
  });

  it('não expõe pagamento de outro projeto', async () => {
    const rodada = await criarProjeto();
    const outro = await criarProjeto();
    const equipeId = await formarEquipe(rodada);
    const papel = rodada.projeto.equipes[0]?.membros[0]?.papel ?? '';
    const pago = await app.inject({
      method: 'POST',
      url: `/projetos/${rodada.projeto.id}/equipes/${equipeId}/membros/${papel}/pagamento`,
    });

    const consulta = await app.inject({
      method: 'GET',
      url: `/projetos/${outro.projeto.id}/pagamentos/${pago.json<{ id: string }>().id}`,
    });

    expect(consulta.statusCode).toBe(404);
  });

  it.each(PROVEDORES_EXTERNOS)(
    'recomenda, salva e relê uma equipe vinda do cadastro %s',
    async (provedor) => {
      configurar('s3', 'stripe', provedor);

      const { projeto } = await criarProjeto({
        orcamento: 300_000,
        requisitos: REQUISITOS_TODOS,
      });
      const relido = await container.repositorioProjetos.obter(projeto.id);
      const membros = relido?.equipes[0]?.membros ?? [];

      expect(membros).toHaveLength(PAPEIS.length);
      expect(membros.every(({ profissional }) => profissional.id.startsWith(`${provedor}:`))).toBe(
        true,
      );
    },
  );

  it('volta para o cadastro interno sem reaproveitar o cache do provedor anterior', async () => {
    configurar('s3', 'stripe', 'linkedin');
    await criarProjeto({ orcamento: 300_000, requisitos: REQUISITOS_TODOS });

    configurar('s3', 'stripe', 'interno');
    const { projeto } = await criarProjeto();

    expect(
      projeto.equipes[0]?.membros.every(
        ({ profissional }) => !profissional.id.startsWith('linkedin:'),
      ),
    ).toBe(true);
  });

  it('a lógica de negócio não cita nenhum provedor concreto', () => {
    const arquivos = [
      'src/application/sistema-recomendacao.ts',
      'src/application/use-cases/casos-integracoes.ts',
      'src/application/orchestration/orquestrador-padrao.ts',
    ];
    for (const arquivo of arquivos) {
      expect(readFileSync(arquivo, 'utf8')).not.toMatch(
        /AdaptadorS3|AdaptadorGoogleCloud|AdaptadorLocal|AdaptadorStripe|AdaptadorPagSeguro|AdaptadorPayPal|AdaptadorLinkedIn|AdaptadorIndeed|AdaptadorInterno/,
      );
    }
  });
});
