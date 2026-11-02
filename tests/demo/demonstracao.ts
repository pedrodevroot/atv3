import {
  eventoRecomendacaoGerada,
  membrosSugeridos,
} from '../../src/application/eventos/fabrica-eventos.js';
import { OrquestradorPadrao } from '../../src/application/orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from '../../src/application/orchestration/orquestrador-substituicao.js';
import { AuditoriaRecomendacao } from '../../src/application/observers/auditoria-recomendacao.js';
import { NotificadorEmail } from '../../src/application/observers/notificador-email.js';
import { NotificadorInterno } from '../../src/application/observers/notificador-interno.js';
import { PublicadorIntegracao } from '../../src/application/observers/publicador-integracao.js';
import type { Observador } from '../../src/application/ports/observador.js';
import type { RepositorioProfissionais } from '../../src/application/ports/repositorio-profissionais.js';
import { CatalogoModelos } from '../../src/application/prototipos/catalogo-modelos.js';
import { criarModelosPadrao } from '../../src/application/prototipos/modelos-padrao.js';
import { SistemaRecomendacao } from '../../src/application/sistema-recomendacao.js';
import { resolverParametros } from '../../src/application/strategies/parametros-recomendacao.js';
import { CalculadorCompatibilidade } from '../../src/application/visitors/calculador-compatibilidade.js';
import { GeradorRelatorio } from '../../src/application/visitors/gerador-relatorio.js';
import { ValidadorConsistencia } from '../../src/application/visitors/validador-consistencia.js';
import { criarCanaisSaida, criarRegistroEstrategias } from '../../src/container.js';
import { RequisitoPapel } from '../../src/domain/entidades/requisito-papel.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { TIPOS_CAPTACAO, TipoCaptacao } from '../../src/domain/enums/tipo-captacao.js';
import { criarEvento } from '../../src/domain/eventos/evento-recomendacao.js';
import { BarramentoEventosEmMemoria } from '../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import { CaixaMensagensMemoria } from '../../src/infrastructure/notifications/canais-simulados.js';
import { RepositorioProfissionaisMemoria } from '../../src/infrastructure/repositories/repositorio-profissionais-memoria.js';
import { criarArvoreProjeto, fotografar } from '../fixtures/arvore-projeto.js';
import {
  criarCadastroDemonstracao,
  criarProjetoDemonstracao,
} from '../fixtures/cadastro-demonstracao.js';
import { DETALHES_MULTITIPO, criarCadastroMultitipo } from '../fixtures/cadastro-multitipo.js';
import { criarProjeto, dadosProjetoBase } from '../fixtures/dominio.js';
import {
  FabricaRealidadeVirtual,
  TIPO_REALIDADE_VIRTUAL,
} from '../fixtures/fabrica-realidade-virtual.js';
import { DETALHES_PADRAO, criarFabricas, fabricasTeste } from '../fixtures/fabricas.js';
import { criarAmbienteOrquestracao, fabricaFiccao, relogioFixo } from '../fixtures/orquestracao.js';

const titulo = (texto: string) => {
  console.info(`\n${'='.repeat(78)}\n${texto}\n${'='.repeat(78)}`);
};
const passo = (texto: string) => {
  console.info(`\n> ${texto}`);
};

async function demonstrarStrategy() {
  titulo('1. STRATEGY: mesmo projeto e mesmo cadastro, estratégias diferentes');
  const { registro, parametros } = criarAmbienteOrquestracao();
  const cadastro = criarCadastroDemonstracao();
  for (const estrategia of registro.listar()) {
    passo(`${estrategia.nome}: ${estrategia.descricao}`);
    const ranking = estrategia.recomendar(criarProjetoDemonstracao(), cadastro, parametros);
    console.table(
      (ranking.get(Papel.DIRETOR) ?? []).map((candidato, indice) => ({
        posicao: indice + 1,
        diretor: candidato.profissional.nome,
        score: candidato.score,
        custo: candidato.custoEstimado,
        justificativa: candidato.justificativa,
      })),
    );
  }
  console.info(
    'Cada estratégia coloca um diretor diferente em 1º lugar; a troca é feita em tempo de execução.',
  );
  await Promise.resolve();
}

async function demonstrarTemplateMethod() {
  titulo('2. TEMPLATE METHOD: o fluxo principal é invariável');
  const { repositorio, parametros, cosseno } = criarAmbienteOrquestracao();
  const projeto = criarProjetoDemonstracao();

  const padrao = await new OrquestradorPadrao(repositorio, fabricaFiccao, relogioFixo).orquestrar({
    projeto,
    estrategia: cosseno,
    parametros,
  });
  projeto.registrarSugestoes(padrao.equipes);
  const [equipe] = padrao.equipes;
  const substituicao = await new OrquestradorSubstituicao(
    repositorio,
    fabricaFiccao,
    relogioFixo,
  ).orquestrar({
    projeto,
    estrategia: cosseno,
    parametros,
    equipeId: equipe?.id ?? '',
    papel: Papel.EDITOR,
  });
  passo('Etapas executadas por cada subclasse:');
  console.table({
    OrquestradorPadrao: padrao.etapas.join(' > '),
    OrquestradorSubstituicao: substituicao.etapas.join(' > '),
  });
  console.info(
    `Padrão: ${padrao.equipes.length} sugestões. Substituição: novo editor = ${equipe?.membro(Papel.EDITOR)?.profissional.nome ?? '-'}.`,
  );

  passo('Uma validação que falha interrompe o fluxo antes de buscar e ranquear:');
  let buscas = 0;
  const repositorioContado: RepositorioProfissionais = {
    buscarCandidatos: (criterios) => {
      buscas += 1;
      return repositorio.buscarCandidatos(criterios);
    },
  };
  try {
    await new OrquestradorPadrao(repositorioContado, fabricaFiccao, relogioFixo).orquestrar({
      projeto: criarProjeto({ orcamento: 1_500 }),
      estrategia: cosseno,
      parametros,
    });
  } catch (erro) {
    console.info(`Erro: ${(erro as Error).message} | buscas no repositório: ${buscas}`);
  }

  passo('Uma subclasse que tenta sobrescrever orquestrar() é recusada:');
  class Atalho extends OrquestradorPadrao {
    override orquestrar(): never {
      throw new Error('pulou etapas');
    }
  }
  try {
    new Atalho(repositorio, fabricaFiccao);
  } catch (erro) {
    console.info(`Erro: ${(erro as Error).message}`);
  }
}

async function demonstrarObserver() {
  titulo('3. OBSERVER: observadores reagem de forma independente');
  const falhas: string[] = [];
  const barramento = new BarramentoEventosEmMemoria((falha) =>
    falhas.push(`${falha.observador}: ${(falha.erro as Error).message}`),
  );
  const canais = criarCanaisSaida();
  const quebrado: Observador = {
    nome: 'notificador-sms (fora do ar)',
    interesses: '*',
    atualizar: () => Promise.reject(new Error('gateway de SMS indisponível')),
  };
  for (const observador of [
    quebrado,
    new NotificadorEmail(canais.email),
    new NotificadorInterno(canais.caixa),
    new AuditoriaRecomendacao(canais.auditoria),
    new PublicadorIntegracao(canais.publicador),
  ]) {
    barramento.adicionarObservador(observador);
  }

  const { repositorio, parametros, cosseno } = criarAmbienteOrquestracao();
  const projeto = criarProjetoDemonstracao();
  const resultado = await new OrquestradorPadrao(
    repositorio,
    fabricaFiccao,
    relogioFixo,
  ).orquestrar({
    projeto,
    estrategia: cosseno,
    parametros,
  });
  const evento = eventoRecomendacaoGerada({
    projeto,
    equipes: resultado.equipes,
    membros: membrosSugeridos(resultado.equipes),
    estrategia: cosseno.nome,
    rodada: resultado.rodada,
    parcial: resultado.parcial,
  });

  passo('Publicando RECOMENDACAO_GERADA (entrega assíncrona):');
  barramento.notificarObservadores(evento);
  console.info(
    `Logo após publicar: ${canais.email.enviados.total} e-mails enviados, ${barramento.entregasPendentes} entregas pendentes.`,
  );
  await barramento.aguardarEntregas();
  console.table({
    'e-mails enviados': canais.email.enviados.total,
    'registros de auditoria': canais.auditoria.entradas.total,
    'publicações para outros serviços': canais.publicador.publicadas.total,
    'falhas isoladas': falhas.length,
  });
  console.info(`Falha registrada sem afetar os demais: ${falhas.join('; ')}`);

  passo('Publicando EQUIPE_FORMADA (só agora o publicador de integração reage):');
  barramento.notificarObservadores(
    criarEvento(
      'EQUIPE_FORMADA',
      {
        projetoId: projeto.id,
        produtorId: projeto.produtorId,
        equipeId: resultado.equipes[0]?.id ?? '',
        custoTotal: resultado.equipes[0]?.custoTotal ?? 0,
        membros: [],
      },
      { origem: 'demonstracao' },
    ),
  );
  await barramento.aguardarEntregas();
  console.info(
    `Tópicos publicados: ${canais.publicador.publicadas.todos.map((mensagem) => mensagem.topico).join(', ')}`,
  );
}

async function demonstrarVisitor() {
  titulo('4. VISITOR: operações distintas sobre a mesma árvore, sem alterar o domínio');
  const { projeto } = await criarArvoreProjeto();
  const antes = JSON.stringify(fotografar(projeto));

  const validacao = projeto.aceitar(new ValidadorConsistencia(projeto));
  const compatibilidade = projeto.aceitar(new CalculadorCompatibilidade(projeto));
  const relatorio = projeto.aceitar(new GeradorRelatorio(projeto, relogioFixo()));

  console.table({
    ValidadorConsistencia: `válido: ${validacao.valido}, problemas: ${validacao.problemas.length}`,
    CalculadorCompatibilidade: `compatibilidade da melhor equipe: ${compatibilidade.toFixed(2)}`,
    GeradorRelatorio: `${relatorio.split('\n').length} linhas de relatório`,
  });
  passo('Início do relatório gerado:');
  console.info(relatorio.split('\n').slice(0, 16).join('\n'));
  console.info(
    `\nÁrvore idêntica após as três visitas: ${JSON.stringify(fotografar(projeto)) === antes}`,
  );
}

async function demonstrarPrototype() {
  titulo('5. PROTOTYPE: projetos novos nascem da clonagem de modelos pré-configurados');
  const catalogo = new CatalogoModelos(criarModelosPadrao(fabricasTeste));
  passo('Modelos disponíveis no catálogo de protótipos:');
  console.table(
    catalogo.listar().map((modelo) => ({
      modelo: modelo.id,
      tipo: modelo.prototipo.tipoCaptacao,
      orcamento: modelo.prototipo.orcamento,
      detalhes: JSON.stringify(modelo.prototipo.detalhes),
    })),
  );

  passo('Clonando "documentario-entrevistas" com ajustes finos do produtor:');
  const clone = catalogo.clonar('documentario-entrevistas', {
    titulo: 'Rios do cerrado',
    produtorId: 'produtora-cerrado',
    detalhes: { tema: 'Rios do cerrado', entrevistados: ['Seu Tião', 'Dona Lia'] },
  });
  const outroClone = catalogo.clonar('documentario-entrevistas');
  console.table({
    'clone ajustado': { titulo: clone.titulo, detalhes: JSON.stringify(clone.detalhes) },
    'outro clone': { titulo: outroClone.titulo, detalhes: JSON.stringify(outroClone.detalhes) },
  });
  console.info(
    `Cópia profunda: compartilham requisitos? ${clone.requisitos === outroClone.requisitos}; compartilham local? ${clone.localizacao === outroClone.localizacao}`,
  );
  clone.solicitarReavaliacao({ orcamento: 90_000 });
  console.info(
    `Orçamento do clone após reavaliação: ${clone.orcamento}; o protótipo continua com ${catalogo.listar()[0]?.prototipo.orcamento ?? 0}.`,
  );
  await Promise.resolve();
}

async function demonstrarFactoryMethod() {
  titulo('6. FACTORY METHOD: cada fábrica decide qual classe concreta instanciar');
  console.table(
    TIPOS_CAPTACAO.map((tipo) => {
      const fabrica = fabricasTeste.para(tipo);
      return {
        fabrica: fabrica.constructor.name,
        criarProjeto: fabrica.criarProjeto({
          ...dadosProjetoBase(),
          detalhes: DETALHES_PADRAO[tipo],
        }).constructor.name,
        criarValidador: fabrica.criarValidador().constructor.name,
        criarRecomendador: fabrica.criarRecomendador().constructor.name,
        criarNotificador: fabrica.criarNotificador().constructor.name,
      };
    }),
  );
  console.info(
    'Quem usa a fábrica só chama os métodos criarX(); a subclasse da fábrica escolhe a classe concreta.',
  );
  await Promise.resolve();
}

async function demonstrarAbstractFactory() {
  titulo('7. ABSTRACT FACTORY: trocar a fábrica troca o ecossistema inteiro');
  const caixa = new CaixaMensagensMemoria();
  const barramento = new BarramentoEventosEmMemoria();
  const fabricas = criarFabricas(caixa);
  const sistema = new SistemaRecomendacao({
    repositorio: new RepositorioProfissionaisMemoria(criarCadastroMultitipo()),
    fabricas,
    estrategias: criarRegistroEstrategias(),
    sujeito: barramento,
    parametros: resolverParametros(),
    relogio: relogioFixo,
  });
  const requisitos = [
    RequisitoPapel.criar(Papel.DIRETOR, 5),
    RequisitoPapel.criar(Papel.EFEITOS_VISUAIS, 3),
    RequisitoPapel.criar(Papel.SONOPLASTA, 3),
    RequisitoPapel.criar(Papel.EDITOR, 3),
  ];
  const linhas: Record<string, string | undefined>[] = [];

  passo('Mesmo cadastro, mesmos papéis e mesmo orçamento; só o tipo do projeto muda:');
  for (const tipo of TIPOS_CAPTACAO) {
    const projeto = criarProjeto({
      tipoCaptacao: tipo,
      produtorId: `produtor-${tipo.toLowerCase()}`,
      orcamento: 200_000,
      requisitos,
      detalhes: DETALHES_MULTITIPO[tipo],
      estrategia: sistema.estrategiaSugerida(tipo, 200_000),
    });
    const resultado = await sistema.executarRecomendacao(projeto);
    await barramento.aguardarEntregas();
    const equipe = resultado.equipes[0];
    linhas.push({
      tipo,
      recomendador: resultado.estrategia,
      diretor: equipe?.membro(Papel.DIRETOR)?.profissional.nome,
      efeitos: equipe?.membro(Papel.EFEITOS_VISUAIS)?.profissional.nome,
      som: equipe?.membro(Papel.SONOPLASTA)?.profissional.nome,
      notificacao: caixa.mensagensDe(projeto.produtorId)[0]?.assunto,
    });
  }
  console.table(linhas);

  passo('As regras do tipo barram a orquestração antes de buscar candidatos:');
  try {
    await sistema.executarRecomendacao(
      criarProjeto({ tipoCaptacao: TipoCaptacao.DOCUMENTARIO, detalhes: { tema: 'Rios' } }),
    );
  } catch (erro) {
    console.info(`Documentário sem entrevistados: ${(erro as Error).message}`);
  }

  passo('Tipo novo (realidade virtual) registrando só uma fábrica nova:');
  fabricas.registrar(new FabricaRealidadeVirtual({ caixa }));
  const imersivo = fabricas.para(TIPO_REALIDADE_VIRTUAL).criarProjeto({
    ...dadosProjetoBase({
      orcamento: 200_000,
      requisitos,
      estrategia: sistema.estrategiaSugerida(TIPO_REALIDADE_VIRTUAL, 200_000),
    }),
    detalhes: { plataformas: ['Meta Quest'] },
  });
  const resultado = await sistema.executarRecomendacao(imersivo);
  console.info(
    `${imersivo.constructor.name}: recomendador ${resultado.estrategia}, diretor ${resultado.equipes[0]?.membro(Papel.DIRETOR)?.profissional.nome ?? '-'}. Nenhuma linha do orquestrador mudou.`,
  );
}

await demonstrarStrategy();
await demonstrarTemplateMethod();
await demonstrarObserver();
await demonstrarVisitor();
await demonstrarPrototype();
await demonstrarFactoryMethod();
await demonstrarAbstractFactory();
console.info('\nDemonstração concluída.');
