import { describe, expect, it, vi } from 'vitest';
import { GeradorRelatorioAnimacao } from '../../../../src/application/familias/animacao/gerador-relatorio-animacao.js';
import { RecomendadorAnimacao } from '../../../../src/application/familias/animacao/recomendador-animacao.js';
import { ValidadorAnimacao } from '../../../../src/application/familias/animacao/validador-animacao.js';
import { RegistroFabricas } from '../../../../src/application/familias/registro-fabricas.js';
import { OrquestradorPadrao } from '../../../../src/application/orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from '../../../../src/application/orchestration/orquestrador-substituicao.js';
import { GeradorRelatorio } from '../../../../src/application/visitors/gerador-relatorio.js';
import { SistemaRecomendacao } from '../../../../src/application/sistema-recomendacao.js';
import { resolverParametros } from '../../../../src/application/strategies/parametros-recomendacao.js';
import { criarRegistroEstrategias } from '../../../../src/container.js';
import { Competencia } from '../../../../src/domain/entidades/competencia.js';
import type { Projeto } from '../../../../src/domain/entidades/projeto.js';
import { RequisitoPapel } from '../../../../src/domain/entidades/requisito-papel.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { TIPOS_CAPTACAO, TipoCaptacao } from '../../../../src/domain/enums/tipo-captacao.js';
import { BarramentoEventosEmMemoria } from '../../../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import { CaixaMensagensMemoria } from '../../../../src/infrastructure/notifications/canais-simulados.js';
import { RepositorioProfissionaisMemoria } from '../../../../src/infrastructure/repositories/repositorio-profissionais-memoria.js';
import {
  DETALHES_MULTITIPO,
  IDS_MULTITIPO,
  criarCadastroMultitipo,
} from '../../../fixtures/cadastro-multitipo.js';
import {
  criarEquipe,
  criarProfissional,
  criarProjeto,
  dadosProjetoBase,
} from '../../../fixtures/dominio.js';
import {
  eventoEquipeFormada,
  eventoRecomendacao,
  eventoRespostaConvite,
} from '../../../fixtures/eventos.js';
import {
  FabricaRealidadeVirtual,
  TIPO_REALIDADE_VIRTUAL,
} from '../../../fixtures/fabrica-realidade-virtual.js';
import { DETALHES_PADRAO, criarFabricas } from '../../../fixtures/fabricas.js';
import { relogioFixo } from '../../../fixtures/orquestracao.js';

const parametros = resolverParametros();

const REQUISITOS_MULTITIPO = [
  RequisitoPapel.criar(Papel.DIRETOR, 5),
  RequisitoPapel.criar(Papel.EFEITOS_VISUAIS, 3),
  RequisitoPapel.criar(Papel.SONOPLASTA, 3),
  RequisitoPapel.criar(Papel.EDITOR, 3),
];

function projetoMultitipo(tipoCaptacao: TipoCaptacao, orcamento = 200_000): Projeto {
  return criarProjeto({
    tipoCaptacao,
    orcamento,
    detalhes: DETALHES_MULTITIPO[tipoCaptacao],
    requisitos: REQUISITOS_MULTITIPO,
  });
}

function codigos(projeto: Projeto, fabricas = criarFabricas()) {
  return projeto
    .aceitar(fabricas.para(projeto.tipoCaptacao).criarValidador())
    .problemas.map((problema) => `${problema.severidade}:${problema.codigo}`);
}

describe('Demonstração do Abstract Factory: cada fábrica entrega uma família coerente', () => {
  it.each(TIPOS_CAPTACAO)(
    '%s: projeto, validador, recomendador e notificador saem da mesma família',
    (tipo) => {
      const fabrica = criarFabricas().para(tipo);
      const projeto = fabrica.criarProjeto({
        ...dadosProjetoBase(),
        detalhes: DETALHES_PADRAO[tipo],
      });
      const sufixo = tipo.toLowerCase();

      expect(fabrica.tipo).toBe(tipo);
      expect(projeto.tipoCaptacao).toBe(tipo);
      expect(codigos(projeto)).not.toContain('ERRO:TIPO_INCOMPATIVEL');
      expect(fabrica.criarRecomendador().nome).toBe(`recomendador-${sufixo}`);
      expect(fabrica.criarNotificador().nome).toBe(`notificador-${sufixo}`);
    },
  );

  it('cada chamada de um método-fábrica devolve um objeto novo da classe certa (Factory Method)', () => {
    const fabrica = criarFabricas().para(TipoCaptacao.ANIMACAO);

    expect(fabrica.criarValidador()).not.toBe(fabrica.criarValidador());
    expect(fabrica.criarValidador()).toBeInstanceOf(ValidadorAnimacao);
    expect(fabrica.criarRecomendador()).not.toBe(fabrica.criarRecomendador());
  });

  it('misturar famílias é detectado: o validador de um tipo recusa projeto de outro', () => {
    const documentario = criarProjeto({ tipoCaptacao: TipoCaptacao.DOCUMENTARIO });

    expect(
      documentario.aceitar(criarFabricas().para(TipoCaptacao.ANIMACAO).criarValidador()),
    ).toEqual({
      valido: false,
      problemas: [
        {
          codigo: 'TIPO_INCOMPATIVEL',
          severidade: 'ERRO',
          mensagem: 'O validador de ANIMACAO não valida projetos do tipo DOCUMENTARIO.',
        },
      ],
    });
  });

  it('as regras de validação mudam com o tipo do projeto', () => {
    const soDiretor = [RequisitoPapel.criar(Papel.DIRETOR, 5)];
    const longo = new Date('2027-03-01T00:00:00.000Z');

    expect(
      codigos(
        criarProjeto({ tipoCaptacao: TipoCaptacao.DOCUMENTARIO, detalhes: { tema: 'Rios' } }),
      ),
    ).toEqual(['ERRO:DETALHE_DO_TIPO', 'ALERTA:REQUISITO_DO_TIPO']);
    expect(
      codigos(
        criarProjeto({
          tipoCaptacao: TipoCaptacao.ANIMACAO,
          detalhes: { tecnica: '2D' },
          requisitos: soDiretor,
        }),
      ),
    ).toEqual(['ERRO:REQUISITO_DO_TIPO', 'ALERTA:DETALHE_DO_TIPO']);
    expect(
      codigos(
        criarProjeto({
          tipoCaptacao: TipoCaptacao.PUBLICITARIO,
          detalhes: { marca: 'Café Serrano' },
          dataEntrega: longo,
        }),
      ),
    ).toEqual(['ERRO:DETALHE_DO_TIPO', 'ALERTA:PRAZO_DO_TIPO']);
    expect(
      codigos(criarProjeto({ tipoCaptacao: TipoCaptacao.FICCAO, requisitos: soDiretor })),
    ).toEqual([]);
  });

  it('os validadores também conferem as competências que o tipo exige dos membros', () => {
    const animacao = criarProjeto({
      tipoCaptacao: TipoCaptacao.ANIMACAO,
      requisitos: [
        RequisitoPapel.criar(Papel.DIRETOR, 5),
        RequisitoPapel.criar(Papel.EFEITOS_VISUAIS, 3),
      ],
    });
    const equipe = criarEquipe(animacao);
    animacao.registrarSugestoes([equipe]);
    const ficcao = criarProjeto();
    ficcao.registrarSugestoes([criarEquipe(ficcao)]);

    expect(
      animacao.aceitar(criarFabricas().para(TipoCaptacao.ANIMACAO).criarValidador()).problemas,
    ).toEqual([
      expect.objectContaining({
        codigo: 'COMPETENCIA_DO_TIPO',
        severidade: 'ALERTA',
        papel: Papel.EFEITOS_VISUAIS,
        equipeId: equipe.id,
      }),
    ]);
    expect(codigos(ficcao)).toEqual([]);
  });

  it('o recomendador de cada fábrica ranqueia o mesmo cadastro de acordo com o tipo', () => {
    const cadastro = criarCadastroMultitipo();
    const fabricas = criarFabricas();
    const melhor = (tipo: TipoCaptacao, papel: Papel) =>
      fabricas
        .para(tipo)
        .criarRecomendador()
        .recomendar(projetoMultitipo(tipo), cadastro, parametros)
        .get(papel)?.[0]?.profissional.id;

    expect(melhor(TipoCaptacao.DOCUMENTARIO, Papel.DIRETOR)).toBe(
      IDS_MULTITIPO.DIRETOR_ENTREVISTADOR,
    );
    expect(melhor(TipoCaptacao.ANIMACAO, Papel.DIRETOR)).toBe(IDS_MULTITIPO.DIRETOR_ANIMADOR);
    expect(melhor(TipoCaptacao.FICCAO, Papel.DIRETOR)).toBe(IDS_MULTITIPO.DIRETOR_DE_ELENCO);
    expect(melhor(TipoCaptacao.ANIMACAO, Papel.EFEITOS_VISUAIS)).toBe(IDS_MULTITIPO.VFX_ANIMADOR);
    expect(melhor(TipoCaptacao.FICCAO, Papel.EFEITOS_VISUAIS)).toBe(IDS_MULTITIPO.VFX_COMPOSITOR);
    expect(melhor(TipoCaptacao.PUBLICITARIO, Papel.SONOPLASTA)).toBe(
      IDS_MULTITIPO.DESENHISTA_DE_SOM,
    );
    expect(melhor(TipoCaptacao.DOCUMENTARIO, Papel.SONOPLASTA)).toBe(IDS_MULTITIPO.SOM_DIRETO);
  });

  it('o notificador de cada fábrica escreve ao produtor no formato do tipo', async () => {
    const caixa = new CaixaMensagensMemoria();
    const fabricas = criarFabricas(caixa);

    for (const tipo of TIPOS_CAPTACAO) {
      const notificador = fabricas.para(tipo).criarNotificador();
      await notificador.atualizar(eventoRecomendacao());
      await notificador.atualizar(eventoEquipeFormada());
      await notificador.atualizar(
        eventoRespostaConvite('CONVITE_ACEITO', {
          projetoId: 'projeto-1',
          equipeId: 'equipe-1',
          papel: Papel.DIRETOR,
          profissionalId: 'diretora',
        }),
      );
    }

    const mensagens = caixa.mensagensDe('produtor-1');
    expect(mensagens.map((mensagem) => mensagem.assunto)).toEqual([
      'Publicitário: equipe formada',
      'Publicitário: equipe sugerida para a campanha',
      'Animação: equipe formada',
      'Animação: equipe sugerida para o pipeline',
      'Ficção: equipe formada',
      'Ficção: equipe técnica sugerida',
      'Documentário: equipe formada',
      'Documentário: equipe sugerida para as entrevistas',
    ]);
    expect(mensagens.at(-1)?.corpo).toContain('2 profissional(is) sugerido(s)');
    expect(mensagens.every((mensagem) => mensagem.tipoDestinatario === 'PRODUTOR')).toBe(true);
  });
});

describe('RegistroFabricas', () => {
  it('resolve a fábrica pelo tipo e recusa tipos sem fábrica', () => {
    const fabricas = criarFabricas();

    expect(fabricas.tipos).toEqual(['DOCUMENTARIO', 'ANIMACAO', 'PUBLICITARIO', 'FICCAO']);
    expect(fabricas.listar()).toHaveLength(4);
    expect(() => fabricas.para('REALITY')).toThrow(
      expect.objectContaining({
        codigo: 'TIPO_PROJETO_DESCONHECIDO',
        message:
          'Tipo de projeto "REALITY" não tem fábrica registrada. Disponíveis: DOCUMENTARIO, ANIMACAO, PUBLICITARIO, FICCAO.',
      }) as Error,
    );
  });

  it('aceita uma fábrica nova e recusa registrar o mesmo tipo duas vezes', () => {
    const caixa = new CaixaMensagensMemoria();
    const fabricas = new RegistroFabricas([new FabricaRealidadeVirtual({ caixa })]);

    expect(fabricas.existe(TIPO_REALIDADE_VIRTUAL)).toBe(true);
    expect(() => {
      fabricas.registrar(new FabricaRealidadeVirtual({ caixa }));
    }).toThrow(expect.objectContaining({ codigo: 'PARAMETROS_INVALIDOS' }) as Error);
  });
});

describe('Itens do texto da ATVII para animação', () => {
  const projetoAnimacao = (softwares: string[]) =>
    criarProjeto({
      tipoCaptacao: TipoCaptacao.ANIMACAO,
      detalhes: { tecnica: '3D', softwares },
      requisitos: [
        RequisitoPapel.criar(Papel.DIRETOR, 5),
        RequisitoPapel.criar(Papel.EFEITOS_VISUAIS, 3),
      ],
    });

  it('o recomendador de animação prioriza quem domina os softwares do projeto', () => {
    const especialista = (id: string, software: string) =>
      criarProfissional({
        id,
        especialidades: [Papel.EFEITOS_VISUAIS],
        competencias: [Competencia.criar(software, 5), Competencia.criar('Composição digital', 3)],
      });
    const cadastro = [especialista('vfx-blender', 'Blender'), especialista('vfx-maya', 'Maya')];
    const melhor = (softwares: string[]) =>
      new RecomendadorAnimacao()
        .recomendar(projetoAnimacao(softwares), cadastro, parametros)
        .get(Papel.EFEITOS_VISUAIS)?.[0]?.profissional.id;

    expect(melhor(['Maya'])).toBe('vfx-maya');
    expect(melhor(['Blender'])).toBe('vfx-blender');
  });

  it('a fábrica de animação cria o relatório com métricas de renderização', () => {
    const projeto = projetoAnimacao(['Blender']);
    const equipe = criarEquipe(projeto);
    projeto.registrarSugestoes([equipe]);
    const geradoEm = new Date('2026-09-27T12:00:00.000Z');

    const gerador = criarFabricas()
      .para(TipoCaptacao.ANIMACAO)
      .criarGeradorRelatorio(projeto, geradoEm);
    const relatorio = projeto.aceitar(gerador);

    expect(gerador).toBeInstanceOf(GeradorRelatorioAnimacao);
    expect(relatorio).toContain('## Métricas de renderização');
    expect(relatorio).toContain('- Técnica: 3D a 24 quadros/s; softwares: Blender');
    expect(relatorio).toContain('- Quadros a produzir: 129.600');
    expect(relatorio).toContain('- Ritmo necessário: 1.440 quadros/dia em 90 dias');
    expect(relatorio).toContain('- Render estimado: 32.400 h (0,25 h por quadro), 360 h por dia');
    expect(relatorio).toContain('Custo de efeitos visuais por quadro: R$ 0,12');
  });

  it('os outros tipos continuam com o relatório padrão', () => {
    const projeto = criarProjeto({ tipoCaptacao: TipoCaptacao.DOCUMENTARIO });
    const gerador = criarFabricas()
      .para(TipoCaptacao.DOCUMENTARIO)
      .criarGeradorRelatorio(projeto, new Date());

    expect(gerador).toBeInstanceOf(GeradorRelatorio);
    expect(gerador).not.toBeInstanceOf(GeradorRelatorioAnimacao);
    expect(projeto.aceitar(gerador)).not.toContain('Métricas de renderização');
  });
});

describe('OrquestradorEquipe recebe a fábrica no construtor', () => {
  it('sem estratégia na entrada, ranqueia com o recomendador fabricado para o tipo', async () => {
    const repositorio = new RepositorioProfissionaisMemoria(criarCadastroMultitipo());
    const fabrica = criarFabricas().para(TipoCaptacao.ANIMACAO);

    const resultado = await new OrquestradorPadrao(repositorio, fabrica, relogioFixo).orquestrar({
      projeto: projetoMultitipo(TipoCaptacao.ANIMACAO),
      parametros,
    });

    expect(resultado.estrategia).toBe('recomendador-animacao');
    expect(resultado.equipes[0]?.membro(Papel.DIRETOR)?.profissional.id).toBe(
      IDS_MULTITIPO.DIRETOR_ANIMADOR,
    );
  });

  it('as regras do tipo interrompem a orquestração antes de buscar candidatos', async () => {
    const repositorio = new RepositorioProfissionaisMemoria(criarCadastroMultitipo());
    const buscar = vi.spyOn(repositorio, 'buscarCandidatos');
    const fabrica = criarFabricas().para(TipoCaptacao.DOCUMENTARIO);

    await expect(
      new OrquestradorPadrao(repositorio, fabrica, relogioFixo).orquestrar({
        projeto: criarProjeto({
          tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
          detalhes: { tema: 'Rios' },
        }),
        parametros,
      }),
    ).rejects.toMatchObject({
      codigo: 'RESTRICAO_VIOLADA',
      message: 'Documentário precisa de ao menos um entrevistado.',
    });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('a substituição de um papel não é barrada pelas regras do tipo do projeto', async () => {
    const repositorio = new RepositorioProfissionaisMemoria(criarCadastroMultitipo());
    const fabrica = criarFabricas().para(TipoCaptacao.DOCUMENTARIO);
    const projeto = projetoMultitipo(TipoCaptacao.DOCUMENTARIO);
    const rodada = await new OrquestradorPadrao(repositorio, fabrica, relogioFixo).orquestrar({
      projeto,
      parametros,
    });
    projeto.registrarSugestoes(rodada.equipes);
    projeto.ajustarDetalhes({ entrevistados: [] });
    const equipeId = rodada.equipes[0]?.id ?? '';

    const substituicao = await new OrquestradorSubstituicao(
      repositorio,
      fabrica,
      relogioFixo,
    ).orquestrar({ projeto, parametros, equipeId, papel: Papel.EDITOR });

    expect(substituicao.etapas).toHaveLength(7);
    await expect(
      new OrquestradorPadrao(repositorio, fabrica, relogioFixo).orquestrar({ projeto, parametros }),
    ).rejects.toMatchObject({ message: 'Documentário precisa de ao menos um entrevistado.' });
  });

  it('a mesma classe de orquestrador atende um tipo criado só no teste', async () => {
    const repositorio = new RepositorioProfissionaisMemoria(criarCadastroMultitipo());
    const fabrica = new FabricaRealidadeVirtual({ caixa: new CaixaMensagensMemoria() });
    const projeto = fabrica.criarProjeto({
      ...dadosProjetoBase({ orcamento: 200_000, requisitos: REQUISITOS_MULTITIPO }),
      detalhes: { plataformas: ['Meta Quest'] },
    });

    const resultado = await new OrquestradorPadrao(repositorio, fabrica, relogioFixo).orquestrar({
      projeto,
      parametros,
    });

    expect(resultado.estrategia).toBe('recomendador-realidade-virtual');
    expect(resultado.equipes[0]?.membro(Papel.DIRETOR)?.profissional.id).toBe(
      IDS_MULTITIPO.DIRETOR_ANIMADOR,
    );
  });
});

describe('SistemaRecomendacao identifica o tipo e usa a fábrica certa', () => {
  function criarSistema() {
    const caixa = new CaixaMensagensMemoria();
    const barramento = new BarramentoEventosEmMemoria();
    const sistema = new SistemaRecomendacao({
      repositorio: new RepositorioProfissionaisMemoria(criarCadastroMultitipo()),
      fabricas: criarFabricas(caixa),
      estrategias: criarRegistroEstrategias(),
      sujeito: barramento,
      parametros,
      relogio: relogioFixo,
    });
    return { sistema, caixa, barramento };
  }

  it('monta o ecossistema inteiro a partir da fábrica do tipo do projeto', () => {
    const { sistema } = criarSistema();

    const ecossistema = sistema.criarEcossistema(projetoMultitipo(TipoCaptacao.ANIMACAO));

    expect(ecossistema.fabrica.tipo).toBe(TipoCaptacao.ANIMACAO);
    expect(ecossistema.orquestrador).toBeInstanceOf(OrquestradorPadrao);
    expect(ecossistema.validador).toBeInstanceOf(ValidadorAnimacao);
    expect(ecossistema.recomendador.nome).toBe('recomendador-animacao');
    expect(ecossistema.notificador.nome).toBe('notificador-animacao');
  });

  it('entrega o evento ao notificador do tipo, além dos observadores inscritos', async () => {
    const { sistema, caixa, barramento } = criarSistema();
    const projeto = projetoMultitipo(TipoCaptacao.ANIMACAO);

    await sistema.executarRecomendacao(projeto, { estrategia: 'recomendador-animacao' });
    sistema.notificarObservadores(eventoEquipeFormada());
    await barramento.aguardarEntregas();

    expect(caixa.mensagensDe(projeto.produtorId).map((mensagem) => mensagem.assunto)).toEqual([
      'Animação: equipe sugerida para o pipeline',
    ]);
  });

  it('sugere a estratégia pelo orçamento e pela fábrica e valida com o validador do tipo', () => {
    const { sistema } = criarSistema();

    expect(sistema.estrategiaSugerida(TipoCaptacao.PUBLICITARIO, 200_000)).toBe(
      'recomendador-publicitario',
    );
    expect(sistema.estrategiaSugerida(TipoCaptacao.PUBLICITARIO, 30_000)).toBe('regras-orcamento');
    expect(
      sistema.validar(
        criarProjeto({ tipoCaptacao: TipoCaptacao.DOCUMENTARIO, detalhes: { tema: 'Rios' } }),
      ).valido,
    ).toBe(false);
  });
});

describe('BarramentoEventosEmMemoria.notificarObservador', () => {
  it('entrega só os eventos de interesse e isola a falha do observador', async () => {
    const falhas: string[] = [];
    const barramento = new BarramentoEventosEmMemoria((falha) => falhas.push(falha.observador));
    const recebidos: string[] = [];

    barramento.notificarObservador(
      {
        nome: 'so-equipe-formada',
        interesses: ['EQUIPE_FORMADA'],
        atualizar: (evento) => {
          recebidos.push(evento.tipo);
          return Promise.resolve();
        },
      },
      eventoRecomendacao(),
    );
    barramento.notificarObservador(
      { nome: 'quebrado', interesses: '*', atualizar: () => Promise.reject(new Error('fora')) },
      eventoEquipeFormada(),
    );
    await barramento.aguardarEntregas();

    expect(recebidos).toEqual([]);
    expect(falhas).toEqual(['quebrado']);
  });
});
