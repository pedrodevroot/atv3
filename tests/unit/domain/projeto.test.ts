import { describe, expect, it } from 'vitest';
import type { Projeto } from '../../../src/domain/entidades/projeto.js';
import { RequisitoPapel } from '../../../src/domain/entidades/requisito-papel.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import { StatusEquipe, StatusMembro } from '../../../src/domain/enums/status.js';
import {
  ENTREGA_PROJETO,
  INICIO_PROJETO,
  criarEquipe,
  criarMembro,
  criarProjeto,
} from '../../fixtures/dominio.js';

function confirmarTodos(projeto: Projeto, equipeId: string) {
  for (const papel of projeto.papeisObrigatorios) {
    projeto.aceitarRecomendacao(equipeId, papel);
    projeto.registrarRespostaConvite(equipeId, papel, true);
  }
}

describe('RequisitoPapel', () => {
  it.each([0, -1, 11, Number.NaN])('rejeita peso %s', (peso) => {
    expect(() => RequisitoPapel.criar(Papel.DIRETOR, peso)).toThrow('Peso de DIRETOR');
  });
});

describe('Projeto', () => {
  it('expõe atributos do PDF, período e pesos normalizados', () => {
    const projeto = criarProjeto();

    expect(projeto.papeisObrigatorios).toEqual([Papel.DIRETOR, Papel.EDITOR]);
    expect(projeto.pesoDe(Papel.DIRETOR)).toBe(5);
    expect(projeto.pesoDe(Papel.SONOPLASTA)).toBe(0);
    expect(projeto.pesoNormalizado(Papel.DIRETOR)).toBe(0.625);
    expect(projeto.pesoNormalizado(Papel.EDITOR)).toBe(0.375);
    expect(projeto.periodo.duracaoDias).toBe(90);
    expect(projeto.dataEntrega).toEqual(ENTREGA_PROJETO);
    expect(projeto.equipes).toEqual([]);
    expect(projeto.equipeFormada).toBeUndefined();
  });

  it.each([
    [{ duracaoMinutos: 0 }, 'Duração'],
    [{ orcamento: 0 }, 'Orçamento deve ser maior que zero.'],
    [{ requisitos: [] }, 'ao menos um papel obrigatório'],
    [
      {
        requisitos: [RequisitoPapel.criar(Papel.EDITOR, 1), RequisitoPapel.criar(Papel.EDITOR, 2)],
      },
      'não podem se repetir',
    ],
    [{ dataEntrega: INICIO_PROJETO }, 'Data de entrega deve ser posterior'],
    [{ titulo: '  ' }, 'Título do projeto é obrigatório.'],
  ])('valida invariantes na criação %#', (dados, mensagem) => {
    expect(() => criarProjeto(dados)).toThrow(mensagem);
  });

  it('não aceita equipes de outro projeto', () => {
    const outro = criarProjeto();

    expect(() => criarProjeto({ id: 'p-1', equipes: [criarEquipe(outro)] })).toThrow(
      'Equipes devem pertencer ao projeto.',
    );
  });

  it('permite trocar a estratégia dinamicamente', () => {
    const projeto = criarProjeto();
    projeto.definirEstrategia('filtragem-colaborativa');

    expect(projeto.estrategia).toBe('filtragem-colaborativa');
    expect(() => {
      projeto.definirEstrategia('');
    }).toThrow('Estratégia do projeto é obrigatório.');
  });

  it('registra novas sugestões descartando as anteriores ainda ativas', () => {
    const projeto = criarProjeto();
    const primeira = criarEquipe(projeto);
    const segunda = criarEquipe(projeto);
    projeto.registrarSugestoes([primeira]);
    projeto.registrarSugestoes([segunda]);

    expect(primeira.status).toBe(StatusEquipe.DESCARTADA);
    expect(projeto.equipesAtivas).toEqual([segunda]);
    expect(projeto.equipes).toHaveLength(2);
    expect(() => {
      projeto.registrarSugestoes([]);
    }).toThrow('ao menos uma sugestão');
    expect(() => {
      projeto.registrarSugestoes([criarEquipe(criarProjeto())]);
    }).toThrow('Equipes devem pertencer ao projeto.');
  });

  it('delega aceite, rejeição, substituição e resposta à equipe correta', () => {
    const projeto = criarProjeto();
    const equipe = criarEquipe(projeto);
    projeto.registrarSugestoes([equipe]);

    expect(projeto.aceitarRecomendacao(equipe.id, Papel.DIRETOR).status).toBe(
      StatusMembro.CONVIDADO,
    );
    expect(projeto.registrarRespostaConvite(equipe.id, Papel.DIRETOR, false).status).toBe(
      StatusMembro.RECUSADO,
    );
    expect(projeto.rejeitarRecomendacao(equipe.id, Papel.EDITOR).papel).toBe(Papel.EDITOR);
    expect(projeto.substituirMembro(equipe.id, criarMembro(Papel.EDITOR))).toBeUndefined();
    expect(() => projeto.substituirMembro(equipe.id, criarMembro(Papel.SONOPLASTA))).toThrow(
      'SONOPLASTA não é um papel obrigatório do projeto.',
    );
    expect(() => projeto.equipe('inexistente')).toThrow(
      expect.objectContaining({ codigo: 'NAO_ENCONTRADO' }) as Error,
    );
  });

  it('finaliza a equipe consensual e descarta as outras sugestões', () => {
    const projeto = criarProjeto();
    const escolhida = criarEquipe(projeto);
    const alternativa = criarEquipe(projeto);
    projeto.registrarSugestoes([escolhida, alternativa]);
    confirmarTodos(projeto, escolhida.id);

    const formada = projeto.finalizarEquipe(escolhida.id);

    expect(formada.status).toBe(StatusEquipe.FORMADA);
    expect(alternativa.status).toBe(StatusEquipe.DESCARTADA);
    expect(projeto.equipeFormada).toBe(escolhida);
    expect(() => {
      projeto.registrarSugestoes([criarEquipe(projeto)]);
    }).toThrow('Projeto já possui equipe formada.');
    expect(() => projeto.solicitarReavaliacao({ orcamento: 1 })).toThrow(
      'Projeto já possui equipe formada.',
    );
  });

  describe('solicitarReavaliacao', () => {
    it('considera significativa variação de orçamento acima do limiar', () => {
      const projeto = criarProjeto();

      const resultado = projeto.solicitarReavaliacao({ orcamento: 80_000 });

      expect(resultado).toEqual({
        significativa: true,
        variacaoOrcamento: -0.2,
        variacaoPrazoDias: 0,
      });
      expect(projeto.orcamento).toBe(80_000);
    });

    it('considera significativa variação de prazo acima do limiar', () => {
      const projeto = criarProjeto();
      const novaEntrega = new Date('2027-01-29T00:00:00.000Z');

      const resultado = projeto.solicitarReavaliacao({ dataEntrega: novaEntrega });

      expect(resultado.significativa).toBe(true);
      expect(resultado.variacaoPrazoDias).toBe(30);
      expect(projeto.dataEntrega).toEqual(novaEntrega);
    });

    it('não é significativa abaixo do limiar configurável', () => {
      const projeto = criarProjeto();

      expect(projeto.solicitarReavaliacao({ orcamento: 110_000 }).significativa).toBe(false);
      expect(projeto.solicitarReavaliacao({ orcamento: 99_000 }, 0.001).significativa).toBe(true);
      expect(projeto.solicitarReavaliacao({}).variacaoOrcamento).toBe(0);
    });

    it('rejeita orçamento inválido e entrega antes do início', () => {
      const projeto = criarProjeto();

      expect(() => projeto.solicitarReavaliacao({ orcamento: -5 })).toThrow('Orçamento');
      expect(() => projeto.solicitarReavaliacao({ dataEntrega: INICIO_PROJETO })).toThrow(
        'Data de entrega deve ser posterior',
      );
    });
  });
});
