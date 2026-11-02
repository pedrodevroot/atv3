import { beforeEach, describe, expect, it } from 'vitest';
import { CalculadorCompatibilidade } from '../../../../src/application/visitors/calculador-compatibilidade.js';
import { GeradorRelatorio } from '../../../../src/application/visitors/gerador-relatorio.js';
import { ValidadorConsistencia } from '../../../../src/application/visitors/validador-consistencia.js';
import { Equipe } from '../../../../src/domain/entidades/equipe.js';
import { MembroEquipe } from '../../../../src/domain/entidades/membro-equipe.js';
import { Profissional } from '../../../../src/domain/entidades/profissional.js';
import { Projeto } from '../../../../src/domain/entidades/projeto.js';
import type { VisitanteProjeto } from '../../../../src/domain/visitante/visitante-projeto.js';
import {
  criarArvoreProjeto,
  fotografar,
  type ArvoreProjeto,
} from '../../../fixtures/arvore-projeto.js';

class ContadorDeCustos implements VisitanteProjeto<number> {
  visitarProjeto(projeto: Projeto): number {
    return projeto.equipesAtivas.reduce((soma, equipe) => soma + equipe.aceitar(this), 0);
  }

  visitarEquipe(equipe: Equipe): number {
    return equipe.membros.reduce((soma, membro) => soma + membro.aceitar(this), 0);
  }

  visitarMembro(membro: MembroEquipe): number {
    return membro.custo;
  }

  visitarProfissional(): number {
    return 0;
  }
}

describe('Demonstração do Visitor: operações distintas sobre a mesma árvore, sem alterar o domínio', () => {
  let arvore: ArvoreProjeto;

  beforeEach(async () => {
    arvore = await criarArvoreProjeto();
  });

  it('três visitantes percorrem a mesma árvore e produzem três resultados de tipos diferentes', () => {
    const { projeto } = arvore;

    const validacao = projeto.aceitar(new ValidadorConsistencia(projeto));
    const compatibilidade = projeto.aceitar(new CalculadorCompatibilidade(projeto));
    const relatorio = projeto.aceitar(new GeradorRelatorio(projeto, new Date('2026-09-27')));

    expect(validacao).toEqual({ valido: true, problemas: [] });
    expect(compatibilidade).toBeGreaterThan(0.7);
    expect(compatibilidade).toBeLessThanOrEqual(1);
    expect(relatorio).toContain('# Relatório do projeto "Vozes do Sertão"');
    expect(relatorio).toContain('- DIRETOR: Helena Técnica (SUGERIDO)');
  });

  it('a árvore fica idêntica depois das visitas', () => {
    const { projeto } = arvore;
    const antes = fotografar(projeto);

    projeto.aceitar(new ValidadorConsistencia(projeto));
    projeto.aceitar(new CalculadorCompatibilidade(projeto));
    projeto.aceitar(new GeradorRelatorio(projeto));

    expect(fotografar(projeto)).toEqual(antes);
  });

  it('as classes de domínio não têm lógica de validação, cálculo ou relatório: só aceitar()', () => {
    const metodosDeVisita = [Projeto, Equipe, MembroEquipe, Profissional].map((classe) =>
      Object.getOwnPropertyNames(classe.prototype).filter((nome) =>
        /aceitar|validar|compatib|relatorio/i.test(nome),
      ),
    );

    expect(metodosDeVisita).toEqual([
      ['aceitarRecomendacao', 'aceitar'],
      ['aceitar'],
      ['aceitar'],
      ['aceitar'],
    ]);
  });

  it('cada elemento despacha para o método do seu tipo em cada visitante (double dispatch)', () => {
    const { projeto, principal } = arvore;
    const calculador = new CalculadorCompatibilidade(projeto);
    const [membro] = principal.membros;
    if (!membro) {
      throw new Error('equipe vazia');
    }

    expect(principal.aceitar(calculador)).toBe(calculador.visitarEquipe(principal));
    expect(membro.aceitar(calculador)).toBe(calculador.visitarMembro(membro));
    expect(membro.profissional.aceitar(new GeradorRelatorio(projeto))).toContain(
      'Rio de Janeiro/RJ',
    );
  });

  it('uma operação nova é um visitante novo, sem tocar nas classes de domínio', () => {
    const custoDasSugestoes = arvore.projeto.aceitar(new ContadorDeCustos());

    expect(custoDasSugestoes).toBe(
      arvore.equipes.reduce((soma, equipe) => soma + equipe.custoTotal, 0),
    );
  });
});
