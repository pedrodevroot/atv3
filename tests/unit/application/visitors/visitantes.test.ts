import { describe, expect, it } from 'vitest';
import {
  CalculadorCompatibilidade,
  calcularCompatibilidade,
} from '../../../../src/application/visitors/calculador-compatibilidade.js';
import { gerarRelatorio } from '../../../../src/application/visitors/gerador-relatorio.js';
import { formatarMoeda } from '../../../../src/application/visitors/navegacao.js';
import {
  combinarValidacoes,
  validarProjeto,
} from '../../../../src/application/visitors/validador-consistencia.js';
import type { MembroEquipe } from '../../../../src/domain/entidades/membro-equipe.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { StatusEquipe } from '../../../../src/domain/enums/status.js';
import { Intervalo } from '../../../../src/domain/value-objects/intervalo.js';
import { confirmarTodos, criarArvoreProjeto } from '../../../fixtures/arvore-projeto.js';
import {
  criarAvaliacao,
  criarEquipe,
  criarMembro,
  criarProfissional,
  criarProjeto,
} from '../../../fixtures/dominio.js';

const foraDoPeriodo = [Intervalo.criar(new Date('2025-01-01'), new Date('2025-02-01'))];

function projetoComMembros(membros: readonly MembroEquipe[]) {
  const projeto = criarProjeto();
  projeto.registrarSugestoes([criarEquipe(projeto, { membros })]);
  return projeto;
}

describe('ValidadorConsistencia', () => {
  it('acusa projeto sem equipe', () => {
    expect(validarProjeto(criarProjeto())).toEqual({
      valido: false,
      problemas: [expect.objectContaining({ codigo: 'SEM_EQUIPE', severidade: 'ERRO' })],
    });
  });

  it('acusa papel obrigatório vago e membro que recusou', async () => {
    const { projeto, principal } = await criarArvoreProjeto();
    projeto.rejeitarRecomendacao(principal.id, Papel.EDITOR);
    projeto.aceitarRecomendacao(principal.id, Papel.DIRETOR);
    projeto.registrarRespostaConvite(principal.id, Papel.DIRETOR, false);

    const problemasDaPrincipal = validarProjeto(projeto).problemas.filter(
      (problema) => problema.equipeId === principal.id,
    );

    expect(problemasDaPrincipal.map((problema) => [problema.codigo, problema.papel])).toEqual([
      ['PAPEL_VAGO', Papel.EDITOR],
      ['MEMBRO_RECUSADO', Papel.DIRETOR],
    ]);
  });

  it('acusa orçamento insuficiente depois de um corte', async () => {
    const { projeto, principal } = await criarArvoreProjeto();
    projeto.solicitarReavaliacao({ orcamento: 60_000 });

    const resultado = validarProjeto(projeto);

    expect(resultado.valido).toBe(false);
    expect(resultado.problemas).toContainEqual(
      expect.objectContaining({ codigo: 'ORCAMENTO_INSUFICIENTE', equipeId: principal.id }),
    );
  });

  it('acusa agenda conflitante, profissional inativo e profissional duplicado', () => {
    const ocupado = criarProfissional({ id: 'ocupado', disponibilidades: foraDoPeriodo });
    const inativo = criarProfissional({
      id: 'inativo',
      especialidades: [Papel.EDITOR],
      ativo: false,
    });
    const polivalente = criarProfissional({
      id: 'polivalente',
      especialidades: [Papel.DIRETOR, Papel.EDITOR],
    });

    const codigos = (membros: readonly MembroEquipe[]) =>
      validarProjeto(projetoComMembros(membros)).problemas.map((problema) => problema.codigo);

    expect(
      codigos([
        criarMembro(Papel.DIRETOR, { profissional: ocupado }),
        criarMembro(Papel.EDITOR, { profissional: inativo }),
      ]),
    ).toEqual(['AGENDA_CONFLITANTE', 'PROFISSIONAL_INATIVO']);
    expect(
      codigos([
        criarMembro(Papel.DIRETOR, { profissional: polivalente }),
        criarMembro(Papel.EDITOR, { profissional: polivalente }),
      ]),
    ).toEqual(['PROFISSIONAL_DUPLICADO']);
  });

  it('custo fora da faixa é só um alerta e não invalida a equipe', () => {
    const projeto = projetoComMembros([
      criarMembro(Papel.DIRETOR, { custo: 1 }),
      criarMembro(Papel.EDITOR),
    ]);

    const resultado = validarProjeto(projeto);

    expect(resultado.valido).toBe(true);
    expect(resultado.problemas).toEqual([
      expect.objectContaining({ codigo: 'CUSTO_FORA_DA_FAIXA', severidade: 'ALERTA' }),
    ]);
  });

  it('valida só a equipe formada quando ela existe', async () => {
    const { projeto, principal } = await criarArvoreProjeto();
    confirmarTodos(projeto, principal);
    projeto.finalizarEquipe(principal.id);

    expect(validarProjeto(projeto)).toEqual({ valido: true, problemas: [] });
    expect(
      projeto.equipes.filter((equipe) => equipe.status === StatusEquipe.DESCARTADA),
    ).toHaveLength(2);
  });

  it('combina resultados considerando só erros para a validade', () => {
    expect(combinarValidacoes([])).toEqual({ valido: true, problemas: [] });
  });
});

describe('CalculadorCompatibilidade', () => {
  it('pondera score e reputação de cada membro pelo peso do papel', () => {
    const projeto = projetoComMembros([
      criarMembro(Papel.DIRETOR, { score: 1 }),
      criarMembro(Papel.EDITOR, { score: 0 }),
    ]);

    expect(calcularCompatibilidade(projeto)).toBeCloseTo(0.625 * 0.85 + 0.375 * 0.15, 4);
  });

  it('usa a nota das avaliações como reputação e aceita pesos customizados', () => {
    const avaliado = criarProfissional({ avaliacoes: [criarAvaliacao({ nota: 5 })] });
    const projeto = projetoComMembros([
      criarMembro(Papel.DIRETOR, { profissional: avaliado, score: 0 }),
      criarMembro(Papel.EDITOR, { score: 0 }),
    ]);
    const soReputacao = new CalculadorCompatibilidade(projeto, { score: 0, reputacao: 1 });

    expect(projeto.aceitar(soReputacao)).toBeCloseTo(0.625 * 1 + 0.375 * 0.5, 4);
  });

  it('zera o papel vago, o membro que recusou e quem não tem agenda', async () => {
    const { projeto, principal } = await criarArvoreProjeto();
    const completa = principal.aceitar(new CalculadorCompatibilidade(projeto));
    projeto.rejeitarRecomendacao(principal.id, Papel.EDITOR);
    const semEditor = principal.aceitar(new CalculadorCompatibilidade(projeto));
    const ocupado = projetoComMembros([
      criarMembro(Papel.DIRETOR, {
        profissional: criarProfissional({ disponibilidades: foraDoPeriodo }),
      }),
    ]);

    expect(semEditor).toBeLessThan(completa);
    expect(calcularCompatibilidade(ocupado)).toBe(0);
    expect(calcularCompatibilidade(criarProjeto())).toBe(0);
  });

  it('a compatibilidade do projeto é a da melhor sugestão', async () => {
    const { projeto, equipes } = await criarArvoreProjeto();
    const porEquipe = equipes.map((equipe) =>
      equipe.aceitar(new CalculadorCompatibilidade(projeto)),
    );

    expect(calcularCompatibilidade(projeto)).toBe(Math.max(...porEquipe));
  });
});

describe('GeradorRelatorio', () => {
  it('descreve projeto, equipes, membros, profissionais e pendências', async () => {
    const { projeto, principal } = await criarArvoreProjeto();
    projeto.rejeitarRecomendacao(principal.id, Papel.EDITOR);

    const relatorio = gerarRelatorio(projeto, new Date('2026-09-27T12:00:00.000Z'));

    expect(relatorio).toContain('Gerado em 2026-09-27');
    expect(relatorio).toContain(`- Orçamento: ${formatarMoeda(100_000)}`);
    expect(relatorio).toContain('- Papéis obrigatórios: DIRETOR (peso 5), EDITOR (peso 3)');
    expect(relatorio).toContain(`## Equipe ${principal.id} (EM_FORMACAO, rodada 1)`);
    expect(relatorio).toContain('- EDITOR: vago');
    expect(relatorio).toContain('### Pendências');
    expect(relatorio).toContain('- [ERRO] O papel obrigatório EDITOR não está preenchido.');
    expect(relatorio).toContain(
      'Belo Horizonte/MG; nota 5.0 (6 avaliações); 0 projeto(s) no histórico',
    );
    expect(relatorio).toContain('Rio de Janeiro/RJ; sem avaliações; 5 projeto(s) no histórico');
  });

  it('informa quando não há equipe', () => {
    expect(gerarRelatorio(criarProjeto())).toContain('Nenhuma equipe sugerida ou formada.');
  });

  it('formata valores em reais', () => {
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50');
  });
});
