import { describe, expect, it } from 'vitest';
import {
  membrosSugeridos,
  eventoRecomendacaoGerada,
} from '../../../../src/application/eventos/fabrica-eventos.js';
import { AuditoriaRecomendacao } from '../../../../src/application/observers/auditoria-recomendacao.js';
import { comporNotificacoes } from '../../../../src/application/observers/compositor-notificacoes.js';
import { PublicadorIntegracao } from '../../../../src/application/observers/publicador-integracao.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { criarEvento } from '../../../../src/domain/eventos/evento-recomendacao.js';
import { criarCanaisSaida } from '../../../../src/container.js';
import { HistoricoLimitado } from '../../../../src/infrastructure/comum/historico-limitado.js';
import { criarEquipe, criarMembro, criarProjeto } from '../../../fixtures/dominio.js';
import {
  eventoEquipeFormada,
  eventoRecomendacao,
  eventoRespostaConvite,
} from '../../../fixtures/eventos.js';

const resposta = {
  projetoId: 'projeto-1',
  equipeId: 'equipe-1',
  papel: Papel.EDITOR,
  profissionalId: 'editora',
};

describe('comporNotificacoes', () => {
  it('RF08: avisa cada profissional recomendado sobre o interesse do produtor', () => {
    const notificacoes = comporNotificacoes(eventoRecomendacao());

    expect(
      notificacoes.map((notificacao) => [notificacao.destinatarioId, notificacao.tipoDestinatario]),
    ).toEqual([
      ['diretora', 'PROFISSIONAL'],
      ['editora', 'PROFISSIONAL'],
    ]);
  });

  it('RF09: avisa o produtor quando o convite é aceito ou recusado', () => {
    const [aceito] = comporNotificacoes(eventoRespostaConvite('CONVITE_ACEITO', resposta));
    const [recusado] = comporNotificacoes(eventoRespostaConvite('CONVITE_RECUSADO', resposta));

    expect(aceito).toMatchObject({
      destinatarioId: 'produtor-1',
      assunto: 'Convite aceito para EDITOR',
    });
    expect(recusado?.corpo).toContain('O sistema vai buscar um substituto para EDITOR.');
  });

  it('avisa o convidado e todos os membros da equipe formada', () => {
    const convite = criarEvento(
      'CONVITE_ENVIADO',
      { conviteId: 'c', produtorId: 'p', expiraEm: '2026-09-30T12:00:00.000Z', ...resposta },
      { origem: 'teste' },
    );

    expect(comporNotificacoes(convite)[0]?.corpo).toContain('2026-09-30T12:00:00.000Z');
    expect(
      comporNotificacoes(eventoEquipeFormada()).map((notificacao) => notificacao.destinatarioId),
    ).toEqual(['produtor-1', 'diretora', 'editora']);
  });

  it('não gera notificação para eventos só de auditoria', () => {
    const rejeitado = criarEvento(
      'MEMBRO_REJEITADO',
      { produtorId: 'p', ...resposta },
      { origem: 'teste' },
    );

    expect(comporNotificacoes(rejeitado)).toEqual([]);
  });
});

describe('AuditoriaRecomendacao', () => {
  it('registra ator, correlação e dados de todos os eventos', async () => {
    const canais = criarCanaisSaida();
    const auditoria = new AuditoriaRecomendacao(
      canais.auditoria,
      new Set(['atualizador-composicao']),
    );
    const sistema = criarEvento(
      'SUBSTITUICAO_SOLICITADA',
      { produtorId: 'produtor-1', ...resposta },
      { origem: 'atualizador-composicao' },
    );

    await auditoria.atualizar(eventoRespostaConvite('CONVITE_RECUSADO', resposta));
    await auditoria.atualizar(sistema);

    expect(canais.auditoria.entradas.todos).toMatchObject([
      {
        tipo: 'CONVITE_RECUSADO',
        atorId: 'editora',
        tipoAtor: 'PROFISSIONAL',
        correlacaoId: 'req-1',
      },
      { tipo: 'SUBSTITUICAO_SOLICITADA', atorId: 'atualizador-composicao', tipoAtor: 'SISTEMA' },
    ]);
    expect(canais.auditoria.entradas.todos[1]).not.toHaveProperty('correlacaoId');
  });
});

describe('PublicadorIntegracao', () => {
  it('RF11: publica a equipe formada para os microsserviços de projetos e financeiro', async () => {
    const canais = criarCanaisSaida();
    const publicador = new PublicadorIntegracao(canais.publicador);

    await publicador.atualizar(eventoEquipeFormada());
    await publicador.atualizar(eventoRecomendacao());

    expect(canais.publicador.publicadas.todos).toMatchObject([
      {
        topico: 'gerenciamento-projetos.equipe-formada',
        chave: 'projeto-1',
        conteudo: { custoTotal: 67_500, correlacaoId: 'req-1' },
      },
      { topico: 'financeiro.equipe-formada', chave: 'projeto-1' },
    ]);
  });

  it('omite a correlação quando o evento não tem', async () => {
    const canais = criarCanaisSaida();
    const semCorrelacao = criarEvento('EQUIPE_FORMADA', eventoEquipeFormada().dados, {
      origem: 'x',
    });

    await new PublicadorIntegracao(canais.publicador, ['topico-unico']).atualizar(semCorrelacao);

    expect(canais.publicador.publicadas.todos[0]?.conteudo).not.toHaveProperty('correlacaoId');
  });
});

describe('fábrica de eventos', () => {
  it('RECOMENDACAO_GERADA lista cada profissional sugerido uma única vez', () => {
    const projeto = criarProjeto();
    const diretor = criarMembro(Papel.DIRETOR);
    const editor = criarMembro(Papel.EDITOR);
    const equipes = [
      criarEquipe(projeto, { membros: [diretor, editor] }),
      criarEquipe(projeto, { membros: [diretor] }),
    ];

    const evento = eventoRecomendacaoGerada({
      projeto,
      equipes,
      membros: membrosSugeridos(equipes),
      estrategia: 'regras-orcamento',
      rodada: 1,
      parcial: false,
    });

    expect(evento.origem).toBe('cinebridge-recomendacao');
    expect(evento.dados.profissionais).toHaveLength(2);
    expect(evento.dados.equipes).toHaveLength(2);
  });
});

describe('canais simulados', () => {
  it('guardam o histórico com capacidade limitada', () => {
    const historico = new HistoricoLimitado<number>(2);
    historico.adicionar(1);
    historico.adicionar(2);
    historico.adicionar(3);

    expect(historico.todos).toEqual([2, 3]);
    expect(historico.total).toBe(2);
    expect(criarCanaisSaida().caixa.mensagensDe('ninguem')).toEqual([]);
  });

  it('registram no logger estruturado quando informado', async () => {
    const registros: string[] = [];
    const logger = {
      info: (_dados: object, mensagem: string) => registros.push(mensagem),
      warn: () => undefined,
      error: () => undefined,
    };
    const canais = criarCanaisSaida(logger);
    const [notificacao] = comporNotificacoes(eventoRecomendacao());
    if (!notificacao) {
      throw new Error('sem notificação');
    }

    await canais.email.enviar(notificacao);
    await canais.publicador.publicar({ topico: 't', chave: 'k', conteudo: {} });
    await new AuditoriaRecomendacao(canais.auditoria).atualizar(eventoRecomendacao());

    expect(registros).toEqual([
      'E-mail enviado',
      'Evento publicado para outro microsserviço',
      'Auditoria: RECOMENDACAO_GERADA',
    ]);
  });
});
