import { describe, expect, it } from 'vitest';
import { ErroDominio } from '../../../src/domain/comum/erro-dominio.js';
import { Avaliacao } from '../../../src/domain/entidades/avaliacao.js';
import { Competencia } from '../../../src/domain/entidades/competencia.js';
import { ParticipacaoProjeto } from '../../../src/domain/entidades/participacao-projeto.js';
import { ehPapel, Papel, PAPEIS } from '../../../src/domain/enums/papel.js';
import { TipoCaptacao, TIPOS_CAPTACAO } from '../../../src/domain/enums/tipo-captacao.js';
import { Intervalo } from '../../../src/domain/value-objects/intervalo.js';
import { criarAvaliacao, criarProfissional } from '../../fixtures/dominio.js';

describe('Enums de domínio', () => {
  it('lista os seis papéis técnicos do PDF e os quatro tipos de captação', () => {
    expect(PAPEIS).toHaveLength(6);
    expect(TIPOS_CAPTACAO).toEqual(['DOCUMENTARIO', 'FICCAO', 'ANIMACAO', 'PUBLICITARIO']);
    expect(ehPapel('EDITOR')).toBe(true);
    expect(ehPapel('PRODUTOR')).toBe(false);
  });
});

describe('Competencia', () => {
  it('normaliza o nível para o intervalo 0..1', () => {
    const competencia = Competencia.criar(' Color grading ', 4);

    expect(competencia.nome).toBe('Color grading');
    expect(competencia.nivelNormalizado).toBe(0.8);
  });

  it.each([0, 6, 2.5])('rejeita nível %s', (nivel) => {
    expect(() => Competencia.criar('edição', nivel)).toThrow(ErroDominio);
  });
});

describe('Avaliacao', () => {
  it('guarda contexto do projeto avaliado e normaliza a nota', () => {
    const avaliacao = criarAvaliacao({ nota: 4, comentario: '  ótima entrega ' });

    expect(avaliacao.id).toMatch(/[0-9a-f-]{36}/);
    expect(avaliacao.comentario).toBe('ótima entrega');
    expect(avaliacao.notaNormalizada).toBe(0.75);
    expect(avaliacao.tipoCaptacao).toBe(TipoCaptacao.FICCAO);
  });

  it('rejeita nota fora de 1..5 e produtor vazio', () => {
    expect(() => criarAvaliacao({ nota: 0 })).toThrow('Nota deve estar entre 1 e 5.');
    expect(() => criarAvaliacao({ produtorId: ' ' })).toThrow('Produtor da avaliação');
    expect(criarAvaliacao({ comentario: undefined }).comentario).toBe('');
  });

  it('aceita id informado', () => {
    expect(Avaliacao.criar({ ...dadosAvaliacaoMinimos(), id: 'av-1' }).id).toBe('av-1');
  });
});

describe('ParticipacaoProjeto', () => {
  it('registra o histórico e valida o ano', () => {
    const dados = {
      projetoId: 'p-1',
      titulo: 'Curta',
      papel: Papel.EDITOR,
      genero: 'drama',
      tipoCaptacao: TipoCaptacao.DOCUMENTARIO,
      ano: 2024,
    };
    const participacao = ParticipacaoProjeto.criar(dados);

    expect(participacao.papel).toBe(Papel.EDITOR);
    expect(() => ParticipacaoProjeto.criar({ ...dados, ano: 1500 })).toThrow(
      'Ano da participação inválido.',
    );
  });
});

describe('Profissional', () => {
  it('deriva vetor de competências e nota média das avaliações', () => {
    const profissional = criarProfissional({
      avaliacoes: [criarAvaliacao({ nota: 5 }), criarAvaliacao({ nota: 3 })],
    });

    expect(profissional.notaMedia).toBe(4);
    expect(profissional.totalAvaliacoes).toBe(2);
    expect(profissional.vetorCompetencias.valor('Direção de atores')).toBe(1);
    expect(profissional.vetorCompetencias.valor('roteiro')).toBe(0.6);
    expect(profissional.ativo).toBe(true);
  });

  it('tem nota média zero sem avaliações', () => {
    expect(criarProfissional().notaMedia).toBe(0);
  });

  it('informa papéis, disponibilidade e experiência', () => {
    const profissional = criarProfissional({
      especialidades: [Papel.DIRETOR, Papel.ROTEIRISTA],
      disponibilidades: [Intervalo.criar(new Date('2026-10-01'), new Date('2026-11-30'))],
      historico: [
        ParticipacaoProjeto.criar({
          projetoId: 'p-1',
          titulo: 'Longa',
          papel: Papel.DIRETOR,
          genero: 'drama',
          tipoCaptacao: TipoCaptacao.FICCAO,
          ano: 2023,
        }),
      ],
    });

    expect(profissional.atuaComo(Papel.ROTEIRISTA)).toBe(true);
    expect(profissional.atuaComo(Papel.EDITOR)).toBe(false);
    expect(
      profissional.disponivelEm(Intervalo.criar(new Date('2026-10-10'), new Date('2026-11-01'))),
    ).toBe(true);
    expect(
      profissional.disponivelEm(Intervalo.criar(new Date('2026-11-10'), new Date('2026-12-15'))),
    ).toBe(false);
    expect(profissional.experienciaComo(Papel.DIRETOR)).toBe(1);
    expect(profissional.experienciaComo(Papel.ROTEIRISTA)).toBe(0);
  });

  it('exige nome e ao menos uma especialidade', () => {
    expect(() => criarProfissional({ nome: '' })).toThrow('Nome do profissional é obrigatório.');
    expect(() => criarProfissional({ especialidades: [] })).toThrow(
      'Profissional precisa de ao menos uma especialidade.',
    );
  });

  it('respeita id e status ativo informados', () => {
    const profissional = criarProfissional({ id: 'prof-1', ativo: false });

    expect(profissional.id).toBe('prof-1');
    expect(profissional.ativo).toBe(false);
  });
});

function dadosAvaliacaoMinimos() {
  return {
    nota: 3,
    data: new Date('2025-01-01'),
    produtorId: 'produtor',
    projetoId: 'projeto',
    papel: Papel.EDITOR,
    genero: 'comédia',
    tipoCaptacao: TipoCaptacao.ANIMACAO,
  };
}
