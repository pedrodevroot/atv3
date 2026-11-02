import { describe, expect, it } from 'vitest';
import { ValidadorEstrutura } from '../../../../src/application/visitors/validador-estrutura.js';
import { ProjetoFiccao } from '../../../../src/domain/entidades/projetos/projeto-ficcao.js';
import { servicoDeDados } from '../../../../src/domain/entidades/servicos/pacote-servico.js';
import { dadosProjetoBase, criarEquipe, criarProjeto } from '../../../fixtures/dominio.js';
import { SERVICO_QUATRO_NIVEIS, semRequisitos } from '../../../fixtures/servicos.js';

function projetoComArvore(sobrescritas: { orcamento?: number; dataEntrega?: Date } = {}) {
  const dados = semRequisitos(dadosProjetoBase(sobrescritas));
  return ProjetoFiccao.criar({
    ...dados,
    servicoPrincipal: servicoDeDados(SERVICO_QUATRO_NIVEIS),
  });
}

describe('ValidadorEstrutura', () => {
  it('aceita a árvore que cabe no orçamento e no período', () => {
    expect(projetoComArvore().aceitar(new ValidadorEstrutura())).toEqual({
      valido: true,
      problemas: [],
    });
  });

  it('acusa custo acima do orçamento', () => {
    const { valido, problemas } = projetoComArvore({ orcamento: 41_999 }).aceitar(
      new ValidadorEstrutura(),
    );

    expect(valido).toBe(false);
    expect(problemas[0]?.codigo).toBe('ESTRUTURA_SERVICOS');
    expect(problemas[0]?.mensagem).toContain('excede o orçamento');
  });

  it('acusa prazo acima do período do projeto', () => {
    const { valido, problemas } = projetoComArvore({
      dataEntrega: new Date('2026-10-20T00:00:00.000Z'),
    }).aceitar(new ValidadorEstrutura());

    expect(valido).toBe(false);
    expect(problemas[0]?.mensagem).toBe(
      'Prazo dos serviços (40 dias) excede o período do projeto (19 dias).',
    );
  });

  it('não aplica regras a equipes, membros ou profissionais', () => {
    const projeto = criarProjeto();
    const equipe = criarEquipe(projeto);
    const validador = new ValidadorEstrutura();

    expect(equipe.aceitar(validador).problemas).toEqual([]);
    expect(validador.visitarMembro().problemas).toEqual([]);
    expect(validador.visitarProfissional().problemas).toEqual([]);
  });
});
