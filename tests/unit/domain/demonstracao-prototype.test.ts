import { describe, expect, it } from 'vitest';
import { ProjetoAnimacao } from '../../../src/domain/entidades/projetos/projeto-animacao.js';
import { ProjetoDocumentario } from '../../../src/domain/entidades/projetos/projeto-documentario.js';
import { ProjetoFiccao } from '../../../src/domain/entidades/projetos/projeto-ficcao.js';
import { ProjetoPublicitario } from '../../../src/domain/entidades/projetos/projeto-publicitario.js';
import { DURACAO_MAXIMA_MINUTOS, ORCAMENTO_MAXIMO } from '../../../src/domain/entidades/projeto.js';
import { RequisitoPapel } from '../../../src/domain/entidades/requisito-papel.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import { RIO_DE_JANEIRO, criarEquipe, dadosProjetoBase } from '../../fixtures/dominio.js';
import { confirmarTodos } from '../../fixtures/arvore-projeto.js';

function documentario() {
  return ProjetoDocumentario.criar({
    ...dadosProjetoBase(),
    tema: 'Rios do cerrado',
    entrevistados: ['Seu Tião', 'Dona Lia'],
  });
}

function animacao() {
  return ProjetoAnimacao.criar({
    ...dadosProjetoBase({
      requisitos: [
        RequisitoPapel.criar(Papel.DIRETOR, 5),
        RequisitoPapel.criar(Papel.EFEITOS_VISUAIS, 4),
      ],
    }),
    tecnica: '3D',
    softwares: ['Blender'],
    quadrosPorSegundo: 24,
  });
}

function publicitario() {
  return ProjetoPublicitario.criar({
    ...dadosProjetoBase(),
    marca: 'Café Serrano',
    veiculacao: ['TV', 'DIGITAL'],
    pecas: 3,
  });
}

const PROTOTIPOS = [
  ['documentário', documentario, ProjetoDocumentario],
  ['animação', animacao, ProjetoAnimacao],
  ['publicitário', publicitario, ProjetoPublicitario],
  ['ficção', () => ProjetoFiccao.criar(dadosProjetoBase()), ProjetoFiccao],
] as const;

describe('Demonstração do Prototype: clonar cria cópias profundas e independentes', () => {
  it.each(PROTOTIPOS)(
    '%s: clonar devolve a mesma subclasse, com os mesmos valores e id novo',
    (_nome, criar, classe) => {
      const original = criar();
      const clone = original.clonar();

      expect(clone).toBeInstanceOf(classe);
      expect(clone).not.toBe(original);
      expect(clone.id).not.toBe(original.id);
      expect(clone.tipoCaptacao).toBe(original.tipoCaptacao);
      expect(clone.detalhes).toEqual(original.detalhes);
      expect(clone.titulo).toBe(original.titulo);
      expect(clone.orcamento).toBe(original.orcamento);
      expect(clone.estrategia).toBe(original.estrategia);
      expect(clone.periodo.equivale(original.periodo)).toBe(true);
      expect(clone.requisitos).toEqual(original.requisitos);
    },
  );

  it('a cópia é profunda: requisitos, local, datas e listas específicas são objetos novos', () => {
    const original = documentario();
    const clone = original.clonar();

    expect(clone.requisitos).not.toBe(original.requisitos);
    clone.requisitos.forEach((requisito, indice) => {
      expect(requisito).not.toBe(original.requisitos[indice]);
    });
    expect(clone.localizacao).not.toBe(original.localizacao);
    expect(clone.localizacao).toEqual(original.localizacao);
    expect(clone.periodo).not.toBe(original.periodo);
    expect(clone.periodo.inicio).not.toBe(original.periodo.inicio);
    expect(clone.entrevistados).toEqual(original.entrevistados);
    expect(clone.detalhes['entrevistados']).not.toBe(original.detalhes['entrevistados']);
  });

  it('alterar o clone não altera o original', () => {
    const original = documentario();
    const clone = original.clonar();

    clone.solicitarReavaliacao({
      orcamento: 150_000,
      dataEntrega: new Date('2027-01-30T00:00:00.000Z'),
    });
    clone.registrarSugestoes([criarEquipe(clone)]);

    expect(original.orcamento).toBe(100_000);
    expect(original.dataEntrega.toISOString()).toBe('2026-12-30T00:00:00.000Z');
    expect(original.equipes).toHaveLength(0);
    expect(clone.equipes).toHaveLength(1);
  });

  it('o clone nasce sem as equipes do original: um projeto novo não herda sugestões de outro', () => {
    const original = documentario();
    original.registrarSugestoes([criarEquipe(original)]);

    expect(original.clonar().equipes).toEqual([]);
  });

  it('aceita ajustes finos nos atributos comuns e nos específicos do tipo', () => {
    const original = animacao();
    const clone = original.clonar({
      titulo: 'Curta 2',
      orcamento: 300_000,
      localizacao: RIO_DE_JANEIRO,
      detalhes: { softwares: ['Maya', 'Houdini'] },
    });

    expect(clone.titulo).toBe('Curta 2');
    expect(clone.orcamento).toBe(300_000);
    expect(clone.localizacao.cidade).toBe('Rio de Janeiro');
    expect(clone.softwares).toEqual(['Maya', 'Houdini']);
    expect(clone.tecnica).toBe('3D');
    expect(clone.quadrosPorSegundo).toBe(24);
    expect(original.titulo).toBe('Vozes do Sertão');
    expect(original.softwares).toEqual(['Blender']);
  });

  it('os ajustes passam pelas mesmas validações do tipo', () => {
    expect(() => documentario().clonar({ detalhes: { entrevistados: ['Ana', 'ana'] } })).toThrow(
      'Entrevistados não pode ter itens repetidos.',
    );
    expect(() => animacao().clonar({ detalhes: { tecnica: 'VR' } })).toThrow(
      'Técnica de animação deve ser um de: 2D, 3D, STOP_MOTION.',
    );
    expect(() => publicitario().clonar({ detalhes: { veiculacao: ['RADIO'] } })).toThrow(
      'Veiculação deve conter apenas: TV, DIGITAL, CINEMA.',
    );
    expect(() => publicitario().clonar({ orcamento: 0 })).toThrow(
      'Orçamento deve ser maior que zero.',
    );
  });
});

describe('Subclasses de Projeto', () => {
  it('leem e validam os detalhes específicos de cada tipo', () => {
    expect(() => ProjetoDocumentario.detalhesDe({ entrevistados: [] })).toThrow(
      'Tema do documentário é obrigatório.',
    );
    expect(() => ProjetoDocumentario.detalhesDe({ tema: 'Rios', entrevistados: 'Ana' })).toThrow(
      'Entrevistados deve ser uma lista de textos.',
    );
    expect(ProjetoDocumentario.detalhesDe({ tema: 'Rios' })).toEqual({
      tema: 'Rios',
      entrevistados: [],
    });
    expect(ProjetoAnimacao.detalhesDe({ tecnica: '2D' })).toEqual({
      tecnica: '2D',
      softwares: [],
      quadrosPorSegundo: 24,
    });
    expect(() => ProjetoAnimacao.detalhesDe({ tecnica: '2D', quadrosPorSegundo: 0 })).toThrow(
      'Quadros por segundo deve ser um inteiro entre 1 e 120.',
    );
    expect(ProjetoPublicitario.detalhesDe({ marca: 'Café Serrano' })).toEqual({
      marca: 'Café Serrano',
      veiculacao: [],
      pecas: 1,
    });
    expect(() => ProjetoPublicitario.detalhesDe({ marca: '  ' })).toThrow(
      'Marca anunciante é obrigatório.',
    );
  });

  it('o construtor de cada subclasse protege as próprias invariantes', () => {
    expect(() =>
      ProjetoAnimacao.criar({
        ...dadosProjetoBase(),
        tecnica: '3D',
        softwares: [],
        quadrosPorSegundo: 1.5,
      }),
    ).toThrow('Quadros por segundo devem estar entre 1 e 120.');
    expect(() =>
      ProjetoPublicitario.criar({
        ...dadosProjetoBase(),
        marca: 'Café Serrano',
        veiculacao: [],
        pecas: 0,
      }),
    ).toThrow('Quantidade de peças deve estar entre 1 e 50.');
    expect(() =>
      ProjetoDocumentario.criar({ ...dadosProjetoBase(), tema: ' ', entrevistados: [] }),
    ).toThrow('Tema do documentário é obrigatório.');
  });

  it('cada subclasse informa o seu tipo e expõe cópias das listas', () => {
    const projeto = publicitario();
    const veiculacao = projeto.veiculacao;
    veiculacao.push('CINEMA');

    expect(projeto.tipoCaptacao).toBe('PUBLICITARIO');
    expect(projeto.veiculacao).toEqual(['TV', 'DIGITAL']);
    expect(ProjetoFiccao.criar(dadosProjetoBase()).detalhes).toEqual({});
  });
});

describe('Ajuste dos detalhes de um projeto existente', () => {
  it('mescla os detalhes novos com os atuais e valida pelo tipo', () => {
    const projeto = documentario();

    projeto.ajustarDetalhes({ entrevistados: ['Seu Tião', 'Dona Lia', 'Zé do Rio'] });

    expect(projeto.detalhes).toEqual({
      tema: 'Rios do cerrado',
      entrevistados: ['Seu Tião', 'Dona Lia', 'Zé do Rio'],
    });
    expect(() => {
      projeto.ajustarDetalhes({ entrevistados: ['Ana', 'ana'] });
    }).toThrow('Entrevistados não pode ter itens repetidos.');
    expect(projeto.entrevistados).toHaveLength(3);
  });

  it('cada tipo aceita só os próprios campos', () => {
    expect(() => {
      animacao().ajustarDetalhes({ tema: 'x' });
    }).toThrow(
      'Detalhes não reconhecidos para ANIMACAO: tema. Aceitos: tecnica, softwares, quadrosPorSegundo.',
    );
    expect(() => {
      ProjetoFiccao.criar(dadosProjetoBase()).ajustarDetalhes({ marca: 'x' });
    }).toThrow('Detalhes não reconhecidos para FICCAO: marca. Aceitos: nenhum.');
    expect(() => ProjetoFiccao.criar(dadosProjetoBase()).clonar({ detalhes: { x: 1 } })).toThrow(
      'Detalhes não reconhecidos para FICCAO: x. Aceitos: nenhum.',
    );
    const projeto = publicitario();
    projeto.ajustarDetalhes({ veiculacao: ['CINEMA'], pecas: 5 });
    expect(projeto.detalhes).toEqual({ marca: 'Café Serrano', veiculacao: ['CINEMA'], pecas: 5 });
    const imersivo = animacao();
    imersivo.ajustarDetalhes({ tecnica: 'STOP_MOTION', quadrosPorSegundo: 12 });
    expect(imersivo.detalhes).toEqual({
      tecnica: 'STOP_MOTION',
      softwares: ['Blender'],
      quadrosPorSegundo: 12,
    });
  });

  it('não altera detalhes depois que a equipe foi formada', () => {
    const projeto = documentario();
    const equipe = criarEquipe(projeto);
    projeto.registrarSugestoes([equipe]);
    confirmarTodos(projeto, equipe);
    projeto.finalizarEquipe(equipe.id);

    expect(() => {
      projeto.ajustarDetalhes({ entrevistados: ['Outro'] });
    }).toThrow(expect.objectContaining({ codigo: 'TRANSICAO_INVALIDA' }) as Error);
  });

  it('limita tamanho de textos e listas e os valores que o banco suporta', () => {
    expect(() => {
      documentario().ajustarDetalhes({ tema: 't'.repeat(201) });
    }).toThrow('Tema do documentário deve ter no máximo 200 caracteres.');
    expect(() => {
      animacao().ajustarDetalhes({
        softwares: Array.from({ length: 51 }, (_, indice) => `software-${indice}`),
      });
    }).toThrow('Softwares deve ter no máximo 50 itens.');
    expect(() =>
      ProjetoFiccao.criar(dadosProjetoBase({ orcamento: ORCAMENTO_MAXIMO + 1 })),
    ).toThrow(`Orçamento deve ser de no máximo ${ORCAMENTO_MAXIMO}.`);
    expect(() =>
      ProjetoFiccao.criar(dadosProjetoBase({ duracaoMinutos: DURACAO_MAXIMA_MINUTOS + 1 })),
    ).toThrow(`Duração deve ser de no máximo ${DURACAO_MAXIMA_MINUTOS} minutos.`);
    expect(() => documentario().solicitarReavaliacao({ orcamento: ORCAMENTO_MAXIMO + 1 })).toThrow(
      `Orçamento deve ser de no máximo ${ORCAMENTO_MAXIMO}.`,
    );
  });
});
