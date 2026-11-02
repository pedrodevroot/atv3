import { describe, expect, it } from 'vitest';
import type { Equipe } from '../../../src/domain/entidades/equipe.js';
import type { MembroEquipe } from '../../../src/domain/entidades/membro-equipe.js';
import type { Profissional } from '../../../src/domain/entidades/profissional.js';
import type { Projeto } from '../../../src/domain/entidades/projeto.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import {
  criarEvento,
  ehEventoDoTipo,
  TIPOS_EVENTO,
  type EventoRecomendacao,
} from '../../../src/domain/eventos/evento-recomendacao.js';
import type { VisitanteProjeto } from '../../../src/domain/visitante/visitante-projeto.js';
import { criarEquipe, criarProjeto } from '../../fixtures/dominio.js';

describe('Eventos de domínio', () => {
  it('cria evento tipado com id, data ISO, origem e correlação', () => {
    const evento = criarEvento(
      'CONVITE_ACEITO',
      {
        conviteId: 'c-1',
        projetoId: 'p-1',
        produtorId: 'prod-1',
        equipeId: 'e-1',
        papel: Papel.EDITOR,
        profissionalId: 'prof-1',
      },
      { origem: 'teste', correlacaoId: 'req-1', ocorridoEm: new Date('2026-09-27T12:00:00.000Z') },
    );

    expect(evento).toMatchObject({
      tipo: 'CONVITE_ACEITO',
      origem: 'teste',
      correlacaoId: 'req-1',
      ocorridoEm: '2026-09-27T12:00:00.000Z',
    });
    expect(evento.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('omite correlação ausente e discrimina a união pelo tipo', () => {
    const evento: EventoRecomendacao = criarEvento(
      'REAVALIACAO_SOLICITADA',
      {
        projetoId: 'p-1',
        produtorId: 'prod-1',
        significativa: true,
        variacaoOrcamento: -0.2,
        variacaoPrazoDias: 0,
      },
      { origem: 'teste' },
    );

    expect(evento).not.toHaveProperty('correlacaoId');
    expect(ehEventoDoTipo(evento, 'EQUIPE_FORMADA')).toBe(false);
    if (ehEventoDoTipo(evento, 'REAVALIACAO_SOLICITADA')) {
      expect(evento.dados.significativa).toBe(true);
    }
  });

  it('lista todos os tipos de evento suportados', () => {
    expect(TIPOS_EVENTO).toContain('RECOMENDACAO_GERADA');
    expect(TIPOS_EVENTO).toContain('EQUIPE_FORMADA');
    expect(new Set(TIPOS_EVENTO).size).toBe(TIPOS_EVENTO.length);
  });
});

describe('Visitavel (double dispatch)', () => {
  class Rastreador implements VisitanteProjeto<string[]> {
    visitarProjeto(projeto: Projeto): string[] {
      return [
        `projeto:${projeto.titulo}`,
        ...projeto.equipes.flatMap((equipe) => equipe.aceitar(this)),
      ];
    }

    visitarEquipe(equipe: Equipe): string[] {
      return [
        `equipe:${equipe.status}`,
        ...equipe.membros.flatMap((membro) => membro.aceitar(this)),
      ];
    }

    visitarMembro(membro: MembroEquipe): string[] {
      return [`membro:${membro.papel}`, ...membro.profissional.aceitar(this)];
    }

    visitarProfissional(profissional: Profissional): string[] {
      return [`profissional:${profissional.nome}`];
    }
  }

  it('cada elemento chama o método de visita do seu próprio tipo', () => {
    const projeto = criarProjeto();
    projeto.registrarSugestoes([criarEquipe(projeto)]);

    expect(projeto.aceitar(new Rastreador())).toEqual([
      'projeto:Vozes do Sertão',
      'equipe:SUGERIDA',
      'membro:DIRETOR',
      'profissional:Ana Souza',
      'membro:EDITOR',
      'profissional:Ana Souza',
    ]);
  });
});
