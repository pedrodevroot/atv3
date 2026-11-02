import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';
import type { DetalhesProjeto } from '../../src/domain/entidades/projeto.js';
import { ProjetoAnimacao } from '../../src/domain/entidades/projetos/projeto-animacao.js';
import { ProjetoDocumentario } from '../../src/domain/entidades/projetos/projeto-documentario.js';
import { ProjetoFiccao } from '../../src/domain/entidades/projetos/projeto-ficcao.js';
import { ProjetoPublicitario } from '../../src/domain/entidades/projetos/projeto-publicitario.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { TipoCaptacao } from '../../src/domain/enums/tipo-captacao.js';
import { criarLogger } from '../../src/infrastructure/logging/opcoes-logger.js';
import { RepositorioProfissionaisTypeorm } from '../../src/infrastructure/repositories/repositorio-profissionais-typeorm.js';
import {
  DETALHES_MULTITIPO,
  IDS_MULTITIPO,
  criarCadastroMultitipo,
} from '../fixtures/cadastro-multitipo.js';
import {
  FabricaRealidadeVirtual,
  ProjetoRealidadeVirtual,
  TIPO_REALIDADE_VIRTUAL,
} from '../fixtures/fabrica-realidade-virtual.js';
import { relogioFixo } from '../fixtures/orquestracao.js';
import { limparTabelas, prepararBanco } from './banco.js';

interface Membro {
  papel: string;
  profissional: { id: string };
}

interface Rodada {
  projeto: {
    id: string;
    tipoCaptacao: string;
    estrategia: string;
    detalhes: Record<string, unknown>;
    equipes: { id: string; membros: Membro[] }[];
  };
}

const REQUISITOS = [
  { papel: 'DIRETOR', peso: 5 },
  { papel: 'EFEITOS_VISUAIS', peso: 3 },
  { papel: 'SONOPLASTA', peso: 3 },
  { papel: 'EDITOR', peso: 3 },
];

function corpo(tipoCaptacao: string, detalhes: DetalhesProjeto, sobrescritas: object = {}) {
  return {
    titulo: `Projeto ${tipoCaptacao}`,
    produtorId: `produtor-${tipoCaptacao.toLowerCase()}`,
    genero: 'drama',
    tipoCaptacao,
    duracaoMinutos: 30,
    orcamento: 200_000,
    dataInicio: '2026-10-01T00:00:00.000Z',
    dataEntrega: '2026-12-30T00:00:00.000Z',
    localizacao: { cidade: 'São Paulo', uf: 'SP', latitude: -23.5505, longitude: -46.6333 },
    requisitos: REQUISITOS,
    detalhes,
    ...sobrescritas,
  };
}

function membro(rodada: Rodada, papel: string): string | undefined {
  return rodada.projeto.equipes[0]?.membros.find((item) => item.papel === papel)?.profissional.id;
}

const CASOS = [
  {
    tipo: TipoCaptacao.DOCUMENTARIO,
    classe: ProjetoDocumentario,
    recomendador: 'recomendador-documentario',
    diretor: IDS_MULTITIPO.DIRETOR_ENTREVISTADOR,
    efeitos: IDS_MULTITIPO.VFX_COMPOSITOR,
    sonoplasta: IDS_MULTITIPO.SOM_DIRETO,
    assunto: 'Documentário: equipe sugerida para as entrevistas',
    detalheNoRelatorio: 'tema: Rios do cerrado; entrevistados: Seu Tião, Dona Lia',
  },
  {
    tipo: TipoCaptacao.ANIMACAO,
    classe: ProjetoAnimacao,
    recomendador: 'recomendador-animacao',
    diretor: IDS_MULTITIPO.DIRETOR_ANIMADOR,
    efeitos: IDS_MULTITIPO.VFX_ANIMADOR,
    sonoplasta: IDS_MULTITIPO.DESENHISTA_DE_SOM,
    assunto: 'Animação: equipe sugerida para o pipeline',
    detalheNoRelatorio: 'tecnica: 3D; softwares: Blender; quadrosPorSegundo: 24',
  },
  {
    tipo: TipoCaptacao.PUBLICITARIO,
    classe: ProjetoPublicitario,
    recomendador: 'recomendador-publicitario',
    diretor: IDS_MULTITIPO.DIRETOR_DE_ELENCO,
    efeitos: IDS_MULTITIPO.VFX_COMPOSITOR,
    sonoplasta: IDS_MULTITIPO.DESENHISTA_DE_SOM,
    assunto: 'Publicitário: equipe sugerida para a campanha',
    detalheNoRelatorio: 'marca: Café Serrano; veiculacao: TV, DIGITAL; pecas: 3',
  },
  {
    tipo: TipoCaptacao.FICCAO,
    classe: ProjetoFiccao,
    recomendador: 'recomendador-ficcao',
    diretor: IDS_MULTITIPO.DIRETOR_DE_ELENCO,
    efeitos: IDS_MULTITIPO.VFX_COMPOSITOR,
    sonoplasta: IDS_MULTITIPO.SOM_DIRETO,
    assunto: 'Ficção: equipe técnica sugerida',
    detalheNoRelatorio: undefined,
  },
] as const;

describe('Abstract Factory com PostgreSQL real: trocar a fábrica troca o ecossistema inteiro', () => {
  let banco: DataSource;
  let container: Container;
  let app: App;

  beforeAll(async () => {
    banco = await prepararBanco();
    await limparTabelas(banco);
    await new RepositorioProfissionaisTypeorm(banco).salvarTodos(criarCadastroMultitipo());
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

  it.each(CASOS)(
    '$tipo: recomendação, validação e notificação vêm da fábrica do tipo',
    async (caso) => {
      const resposta = await app.inject({
        method: 'POST',
        url: '/projetos',
        payload: corpo(caso.tipo, DETALHES_MULTITIPO[caso.tipo]),
      });
      expect(resposta.statusCode).toBe(201);
      const rodada = resposta.json<Rodada>();

      expect(rodada.projeto.tipoCaptacao).toBe(caso.tipo);
      expect(rodada.projeto.estrategia).toBe(caso.recomendador);
      expect(rodada.projeto.detalhes).toEqual(DETALHES_MULTITIPO[caso.tipo]);
      expect(membro(rodada, Papel.DIRETOR)).toBe(caso.diretor);
      expect(membro(rodada, Papel.EFEITOS_VISUAIS)).toBe(caso.efeitos);
      expect(membro(rodada, Papel.SONOPLASTA)).toBe(caso.sonoplasta);

      await container.barramento.aguardarEntregas();
      const mensagens = await app.inject({
        method: 'GET',
        url: `/mensagens/produtor-${caso.tipo.toLowerCase()}`,
      });
      expect(mensagens.json<{ assunto: string }[]>().map((mensagem) => mensagem.assunto)).toEqual([
        caso.assunto,
      ]);

      const analise = await app.inject({
        method: 'GET',
        url: `/projetos/${rodada.projeto.id}/relatorio`,
      });
      const { relatorio } = analise.json<{ relatorio: string }>();
      if (caso.detalheNoRelatorio) {
        expect(relatorio).toContain(`- Detalhes do tipo: ${caso.detalheNoRelatorio}`);
      } else {
        expect(relatorio).not.toContain('Detalhes do tipo');
      }

      const relido = await container.repositorioProjetos.obter(rodada.projeto.id);
      expect(relido).toBeInstanceOf(caso.classe);
      expect(relido?.detalhes).toEqual(DETALHES_MULTITIPO[caso.tipo]);
    },
  );

  it('cada fábrica bloqueia a orquestração com as próprias regras', async () => {
    const criar = (payload: object) => app.inject({ method: 'POST', url: '/projetos', payload });

    const documentario = await criar(
      corpo(TipoCaptacao.DOCUMENTARIO, { tema: 'Rios', entrevistados: [] }),
    );
    const animacao = await criar(
      corpo(TipoCaptacao.ANIMACAO, DETALHES_MULTITIPO.ANIMACAO, {
        requisitos: [{ papel: 'DIRETOR', peso: 5 }],
      }),
    );
    const publicitario = await criar(
      corpo(TipoCaptacao.PUBLICITARIO, { marca: 'Café Serrano', veiculacao: [] }),
    );
    const ficcao = await criar(
      corpo(TipoCaptacao.FICCAO, {}, { requisitos: [{ papel: 'DIRETOR', peso: 5 }] }),
    );

    expect(documentario.json()).toMatchObject({
      codigo: 'RESTRICAO_VIOLADA',
      mensagem: 'Documentário precisa de ao menos um entrevistado.',
    });
    expect(animacao.json()).toMatchObject({
      codigo: 'RESTRICAO_VIOLADA',
      mensagem: 'Animação exige o papel EFEITOS_VISUAIS.',
    });
    expect(publicitario.json()).toMatchObject({
      codigo: 'RESTRICAO_VIOLADA',
      mensagem: 'Peça publicitária precisa de ao menos um meio de veiculação.',
    });
    expect(ficcao.statusCode).toBe(201);
  });

  it('um tipo novo entra registrando só uma fábrica nova, sem tocar no orquestrador', async () => {
    container.registroFabricas.registrar(
      new FabricaRealidadeVirtual({ caixa: container.canais.caixa }),
    );

    const { projeto, resultado } = await container.casos.criarProjeto.executar(
      {
        ...corpo(TIPO_REALIDADE_VIRTUAL, { plataformas: ['Meta Quest'] }),
        dataInicio: new Date('2026-10-01T00:00:00.000Z'),
        dataEntrega: new Date('2026-12-30T00:00:00.000Z'),
        requisitos: [
          { papel: Papel.DIRETOR, peso: 5 },
          { papel: Papel.EFEITOS_VISUAIS, peso: 3 },
        ],
      },
      {},
    );
    await container.barramento.aguardarEntregas();

    expect(resultado.estrategia).toBe('recomendador-realidade-virtual');
    expect(resultado.equipes[0]?.membro(Papel.DIRETOR)?.profissional.id).toBe(
      IDS_MULTITIPO.DIRETOR_ANIMADOR,
    );
    expect(await container.repositorioProjetos.obter(projeto.id)).toBeInstanceOf(
      ProjetoRealidadeVirtual,
    );
    expect(
      (await container.canais.caixa.mensagensDe('produtor-realidade_virtual')).map(
        (mensagem) => mensagem.assunto,
      ),
    ).toEqual(['Realidade virtual: equipe sugerida']);
  });

  it('o código do orquestrador e do sistema não cita nenhum tipo concreto de projeto', () => {
    const pasta = join(process.cwd(), 'src', 'application', 'orchestration');
    const arquivos = [
      ...readdirSync(pasta).map((arquivo) => join(pasta, arquivo)),
      join(process.cwd(), 'src', 'application', 'sistema-recomendacao.ts'),
    ];
    const tiposConcretos =
      /DOCUMENTARIO|ANIMACAO|PUBLICITARIO|FICCAO|Documentario|Animacao|Publicitario|Ficcao|tipoCaptacao\s*[!=]==|switch\s*\(/;

    for (const arquivo of arquivos) {
      expect(readFileSync(arquivo, 'utf-8'), arquivo).not.toMatch(tiposConcretos);
    }
  });
});
