import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OrquestradorPadrao } from '../../src/application/orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from '../../src/application/orchestration/orquestrador-substituicao.js';
import { resolverParametros } from '../../src/application/strategies/parametros-recomendacao.js';
import { Convite } from '../../src/domain/entidades/convite.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { StatusConvite, StatusEquipe, StatusMembro } from '../../src/domain/enums/status.js';
import { criarRegistroEstrategias } from '../../src/container.js';
import { SemeadorProfissionais } from '../../src/infrastructure/database/seeds/index.js';
import { RepositorioProfissionaisTypeorm } from '../../src/infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { RepositorioProjetosTypeorm } from '../../src/infrastructure/repositories/repositorio-projetos-typeorm.js';
import {
  CaixaMensagensTypeorm,
  RegistroAuditoriaTypeorm,
  RepositorioConvitesTypeorm,
  RepositorioRecomendacoesTypeorm,
} from '../../src/infrastructure/repositories/repositorios-typeorm.js';
import { fotografar } from '../fixtures/arvore-projeto.js';
import {
  IDS_DEMONSTRACAO,
  criarCadastroDemonstracao,
  criarProjetoDemonstracao,
} from '../fixtures/cadastro-demonstracao.js';
import { migracoes } from '../../src/infrastructure/database/migrations/index.js';
import { criarEquipe, criarMembro, criarProfissional, criarProjeto } from '../fixtures/dominio.js';
import {
  criarEditorEconomico,
  fabricaFiccao,
  ID_EDITOR_ECONOMICO,
  relogioFixo,
} from '../fixtures/orquestracao.js';
import { fabricasTeste } from '../fixtures/fabricas.js';
import { limparTabelas, prepararBanco } from './banco.js';

describe('Repositórios TypeORM com PostgreSQL real', () => {
  let dataSource: DataSource;
  let profissionais: RepositorioProfissionaisTypeorm;
  let projetos: RepositorioProjetosTypeorm;
  const parametros = resolverParametros();
  const cosseno = criarRegistroEstrategias().obter('similaridade-cosseno');

  beforeAll(async () => {
    dataSource = await prepararBanco();
    profissionais = new RepositorioProfissionaisTypeorm(dataSource);
    projetos = new RepositorioProjetosTypeorm(dataSource, profissionais, fabricasTeste);
  });

  beforeEach(async () => {
    await limparTabelas(dataSource);
    await profissionais.salvarTodos([...criarCadastroDemonstracao(), criarEditorEconomico()]);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function projetoComSugestoes() {
    const projeto = criarProjetoDemonstracao();
    const resultado = await new OrquestradorPadrao(
      profissionais,
      fabricaFiccao,
      relogioFixo,
    ).orquestrar({
      projeto,
      estrategia: cosseno,
      parametros,
    });
    projeto.registrarSugestoes(resultado.equipes);
    return { projeto, resultado };
  }

  describe('RepositorioProfissionaisTypeorm', () => {
    it('reconstrói o profissional completo: competências, avaliações, histórico, agenda e local', async () => {
      const [original] = criarCadastroDemonstracao().filter(
        (profissional) => profissional.id === IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
      );
      const lido = (await profissionais.obterPorIds([IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA])).get(
        IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
      );

      expect(lido?.nome).toBe(original?.nome);
      expect(lido?.notaMedia).toBe(original?.notaMedia);
      expect(lido?.totalAvaliacoes).toBe(6);
      expect(lido?.faixaPreco).toEqual(original?.faixaPreco);
      expect(lido?.localizacao).toEqual(original?.localizacao);
      expect(lido?.vetorCompetencias.valor('roteiro')).toBe(0.6);
      expect(lido?.disponivelEm(criarProjeto().periodo)).toBe(true);
      expect([...(lido?.especialidades ?? [])]).toEqual([Papel.DIRETOR]);
    });

    it('busca candidatos filtrando papel, preço, agenda, ativos e exclusões no banco', async () => {
      await profissionais.salvarTodos([
        criarProfissional({ id: 'inativo', ativo: false }),
        criarProfissional({ id: 'sem-agenda', disponibilidades: [] }),
      ]);
      const periodo = criarProjeto().periodo;

      const diretores = await profissionais.buscarCandidatos({
        papeis: [Papel.DIRETOR],
        periodo,
        precoMinimoAte: 45_000,
        excluirIds: [IDS_DEMONSTRACAO.DIRETOR_LOCAL],
      });

      expect(diretores.profissionais.map((profissional) => profissional.id)).toEqual([
        IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
      ]);
      expect(await profissionais.contarAtivos()).toBe(6);
      expect(
        (await profissionais.listarAtivos()).map((profissional) => profissional.id),
      ).not.toContain('inativo');
    });

    it('salvar de novo atualiza o profissional e substitui os filhos sem duplicar', async () => {
      await profissionais.salvarTodos(criarCadastroDemonstracao());
      await profissionais.salvarTodos([
        criarProfissional({ id: IDS_DEMONSTRACAO.DIRETOR_LOCAL, nome: 'Caio Renomeado' }),
      ]);

      const lido = (await profissionais.obterPorIds([IDS_DEMONSTRACAO.DIRETOR_LOCAL])).get(
        IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      );
      const [contagem] = await dataSource.query<{ total: string }[]>(
        'SELECT count(*) AS total FROM avaliacao',
      );

      expect(lido?.nome).toBe('Caio Renomeado');
      expect(lido?.totalAvaliacoes).toBe(0);
      expect(Number(contagem?.total)).toBe(6);
      expect(await profissionais.obterPorIds([])).toEqual(new Map());
    });
  });

  describe('RepositorioProjetosTypeorm', () => {
    it('salva e reconstrói o agregado inteiro: requisitos, equipes, membros e status', async () => {
      const { projeto } = await projetoComSugestoes();
      const [principal] = projeto.equipes;
      if (!principal) {
        throw new Error('sem equipe');
      }
      projeto.aceitarRecomendacao(principal.id, Papel.DIRETOR);
      projeto.registrarRespostaConvite(principal.id, Papel.DIRETOR, true);
      projeto.solicitarReavaliacao({ orcamento: 95_000 });

      await projetos.salvar(projeto);
      const lido = await projetos.obter(projeto.id);

      expect(lido && fotografar(lido)).toEqual(fotografar(projeto));
      expect(lido?.papeisObrigatorios).toEqual(projeto.papeisObrigatorios);
      expect(lido?.equipe(principal.id).membro(Papel.DIRETOR)?.status).toBe(
        StatusMembro.CONFIRMADO,
      );
      expect(await projetos.obter('inexistente')).toBeUndefined();
    });

    it('persiste a substituição feita pelo orquestrador sobre um projeto lido do banco', async () => {
      const { projeto } = await projetoComSugestoes();
      await projetos.salvar(projeto);
      const lido = await projetos.obter(projeto.id);
      const [principal] = lido?.equipes ?? [];
      if (!lido || !principal) {
        throw new Error('projeto não reconstruído');
      }

      await new OrquestradorSubstituicao(profissionais, fabricaFiccao, relogioFixo).orquestrar({
        projeto: lido,
        estrategia: cosseno,
        parametros,
        equipeId: principal.id,
        papel: Papel.EDITOR,
      });
      await projetos.salvar(lido);
      const depois = await projetos.obter(projeto.id);

      expect(depois?.equipe(principal.id).membro(Papel.EDITOR)?.profissional.id).toBe(
        ID_EDITOR_ECONOMICO,
      );
      expect(depois?.equipe(principal.id).rodada).toBe(2);
    });

    it('persiste a finalização com as outras sugestões descartadas', async () => {
      const { projeto } = await projetoComSugestoes();
      const [principal] = projeto.equipes;
      if (!principal) {
        throw new Error('sem equipe');
      }
      for (const papel of projeto.papeisObrigatorios) {
        projeto.aceitarRecomendacao(principal.id, papel);
        projeto.registrarRespostaConvite(principal.id, papel, true);
      }
      projeto.finalizarEquipe(principal.id);

      await projetos.salvar(projeto);
      const lido = await projetos.obter(projeto.id);

      expect(lido?.equipeFormada?.id).toBe(principal.id);
      expect(
        lido?.equipes.filter((equipe) => equipe.status === StatusEquipe.DESCARTADA),
      ).toHaveLength(2);
    });

    it('controle otimista: quem salva por último sobre uma versão velha recebe conflito', async () => {
      const { projeto } = await projetoComSugestoes();
      await projetos.salvar(projeto);
      const primeiraLeitura = await projetos.obter(projeto.id);
      const segundaLeitura = await projetos.obter(projeto.id);
      if (!primeiraLeitura || !segundaLeitura) {
        throw new Error('projeto não reconstruído');
      }
      const equipeId = projeto.equipes[0]?.id ?? '';

      primeiraLeitura.aceitarRecomendacao(equipeId, Papel.DIRETOR);
      await projetos.salvar(primeiraLeitura);
      segundaLeitura.aceitarRecomendacao(equipeId, Papel.EDITOR);

      await expect(projetos.salvar(segundaLeitura)).rejects.toMatchObject({
        codigo: 'CONFLITO_CONCORRENCIA',
      });
      await expect(projetos.salvar(projeto)).rejects.toMatchObject({
        codigo: 'CONFLITO_CONCORRENCIA',
      });
      const final = await projetos.obter(projeto.id);
      expect(final?.equipe(equipeId).membro(Papel.DIRETOR)?.status).toBe(StatusMembro.CONVIDADO);
      expect(final?.equipe(equipeId).membro(Papel.EDITOR)?.status).toBe(StatusMembro.SUGERIDO);
    });

    it('preserva a ordem das sugestões mesmo com o mesmo instante de criação', async () => {
      const projeto = criarProjeto();
      const mesmoInstante = new Date('2026-09-27T12:00:00.000Z');
      const idsEmOrdemDeCriacao = ['z-primeira', 'm-segunda', 'a-terceira'];
      const diretor = (await profissionais.obterPorIds([IDS_DEMONSTRACAO.DIRETOR_LOCAL])).get(
        IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      );
      if (!diretor) {
        throw new Error('diretor não salvo');
      }
      projeto.registrarSugestoes(
        idsEmOrdemDeCriacao.map((id) =>
          criarEquipe(projeto, {
            id,
            criadaEm: mesmoInstante,
            membros: [criarMembro(Papel.DIRETOR, { profissional: diretor })],
          }),
        ),
      );

      await projetos.salvar(projeto);
      const lido = await projetos.obter(projeto.id);

      expect(lido?.equipes.map((equipe) => equipe.id)).toEqual(idsEmOrdemDeCriacao);
    });
  });

  describe('convites, recomendações, auditoria e mensagens internas', () => {
    it('salva convite, encontra o pendente do papel e atualiza a resposta', async () => {
      const { projeto } = await projetoComSugestoes();
      await projetos.salvar(projeto);
      const [principal] = projeto.equipes;
      if (!principal) {
        throw new Error('sem equipe');
      }
      const convites = new RepositorioConvitesTypeorm(dataSource);
      const convite = Convite.criar({
        projetoId: projeto.id,
        equipeId: principal.id,
        papel: Papel.EDITOR,
        profissionalId: IDS_DEMONSTRACAO.EDITOR,
        produtorId: projeto.produtorId,
        criadoEm: new Date(),
      });

      await convites.salvar(convite);
      expect((await convites.pendenteDoPapel(principal.id, Papel.EDITOR))?.id).toBe(convite.id);

      convite.aceitar();
      await convites.salvar(convite);
      const lido = await convites.obter(convite.id);

      expect(lido?.status).toBe(StatusConvite.ACEITO);
      expect(lido?.respondidoEm).toBeInstanceOf(Date);
      expect(await convites.pendenteDoPapel(principal.id, Papel.EDITOR)).toBeUndefined();
      expect(await convites.obter('inexistente')).toBeUndefined();
    });

    it('salva e lista recomendações da rodada em ordem de papel e posição', async () => {
      const { projeto, resultado } = await projetoComSugestoes();
      await projetos.salvar(projeto);
      const recomendacoes = new RepositorioRecomendacoesTypeorm(dataSource);

      await recomendacoes.salvarTodas(resultado.recomendacoes);
      const lidas = await recomendacoes.listarPorProjeto(projeto.id);

      expect(lidas).toHaveLength(resultado.recomendacoes.length);
      expect(
        lidas.filter((lida) => lida.papel === Papel.DIRETOR).map((lida) => lida.posicao),
      ).toEqual([1, 2, 3]);
      expect(lidas[0]?.criadaEm).toEqual(relogioFixo());
    });

    it('grava auditoria em jsonb e mensagens internas por destinatário', async () => {
      const auditoria = new RegistroAuditoriaTypeorm(dataSource);
      const caixa = new CaixaMensagensTypeorm(dataSource);

      await auditoria.registrar({
        eventoId: 'e-1',
        tipo: 'CONVITE_ACEITO',
        ocorridoEm: '2026-09-27T12:00:00.000Z',
        origem: 'teste',
        correlacaoId: 'req-1',
        projetoId: 'p-1',
        atorId: 'prof-1',
        tipoAtor: 'PROFISSIONAL',
        dados: { papel: 'EDITOR' },
      });
      await caixa.entregar([
        {
          destinatarioId: 'prof-1',
          tipoDestinatario: 'PROFISSIONAL',
          assunto: 'Convite',
          corpo: 'Você foi convidado.',
          eventoId: 'e-1',
        },
      ]);

      expect(await auditoria.listarPorProjeto('p-1')).toEqual([
        expect.objectContaining({
          tipo: 'CONVITE_ACEITO',
          correlacaoId: 'req-1',
          dados: { papel: 'EDITOR' },
        }),
      ]);
      expect(await caixa.mensagensDe('prof-1')).toEqual([
        expect.objectContaining({ assunto: 'Convite', tipoDestinatario: 'PROFISSIONAL' }),
      ]);
    });
  });

  describe('seed e migrations', () => {
    it('o semeador recria o cadastro de forma reprodutível', async () => {
      const semeador = new SemeadorProfissionais({ totalProfissionais: 120, semente: 7 });

      expect(await semeador.executar(dataSource)).toBe(120);
      const primeira = await profissionais.listarAtivos();
      await semeador.executar(dataSource);
      const segunda = await profissionais.listarAtivos();

      expect(segunda.map((profissional) => profissional.id)).toEqual(
        primeira.map((profissional) => profissional.id),
      );
      expect(primeira.length).toBeGreaterThan(100);
    });

    it('todas as migrations podem ser revertidas e reaplicadas', async () => {
      for (let indice = 0; indice < migracoes.length; indice += 1) {
        await dataSource.undoLastMigration({ transaction: 'each' });
      }
      const [depoisDoDown] = await dataSource.query<{ existe: string | null }[]>(
        "SELECT to_regclass('profissional') AS existe",
      );
      await dataSource.runMigrations({ transaction: 'each' });
      const [depoisDoUp] = await dataSource.query<{ existe: string | null }[]>(
        "SELECT to_regclass('profissional') AS existe",
      );

      expect(depoisDoDown?.existe).toBeNull();
      expect(depoisDoUp?.existe).toBe('profissional');
    });
  });
});
