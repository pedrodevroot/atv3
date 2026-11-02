import { describe, expect, it } from 'vitest';
import { OrquestradorPadrao } from '../../../../src/application/orchestration/orquestrador-padrao.js';
import type { RepositorioProfissionais } from '../../../../src/application/ports/repositorio-profissionais.js';
import { resolverParametros } from '../../../../src/application/strategies/parametros-recomendacao.js';
import { RequisitoPapel } from '../../../../src/domain/entidades/requisito-papel.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { StatusEquipe } from '../../../../src/domain/enums/status.js';
import {
  IDS_DEMONSTRACAO,
  criarProjetoDemonstracao,
} from '../../../fixtures/cadastro-demonstracao.js';
import { criarEquipe, criarProfissional, criarProjeto } from '../../../fixtures/dominio.js';
import {
  criarAmbienteOrquestracao,
  fabricaFiccao,
  ID_EDITOR_ECONOMICO,
  relogioFixo,
} from '../../../fixtures/orquestracao.js';

function idsDaEquipe(equipe: {
  membros: readonly { papel: Papel; profissional: { id: string } }[];
}) {
  return Object.fromEntries(equipe.membros.map((membro) => [membro.papel, membro.profissional.id]));
}

describe('OrquestradorPadrao', () => {
  const ambiente = criarAmbienteOrquestracao();
  const orquestrador = new OrquestradorPadrao(ambiente.repositorio, fabricaFiccao, relogioFixo);
  const entrada = (projeto = criarProjetoDemonstracao(), parametros = ambiente.parametros) => ({
    projeto,
    estrategia: ambiente.cosseno,
    parametros,
  });

  it('monta várias sugestões distintas de equipe completa, todas dentro do orçamento', async () => {
    const projeto = criarProjetoDemonstracao();
    const resultado = await orquestrador.orquestrar(entrada(projeto));

    expect(resultado.equipes.map(idsDaEquipe)).toEqual([
      { DIRETOR: IDS_DEMONSTRACAO.DIRETORA_TECNICA, EDITOR: IDS_DEMONSTRACAO.EDITOR },
      { DIRETOR: IDS_DEMONSTRACAO.DIRETOR_LOCAL, EDITOR: ID_EDITOR_ECONOMICO },
      { DIRETOR: IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA, EDITOR: IDS_DEMONSTRACAO.EDITOR },
    ]);
    for (const equipe of resultado.equipes) {
      expect(equipe.custoTotal).toBeLessThanOrEqual(projeto.orcamento);
      expect(equipe.status).toBe(StatusEquipe.SUGERIDA);
      expect(equipe.estrategia).toBe('similaridade-cosseno');
      expect(equipe.papeisVagos(projeto.papeisObrigatorios)).toEqual([]);
    }
    expect(resultado.parcial).toBe(false);
    expect(resultado.avisos).toEqual([]);
  });

  it('reserva orçamento para os próximos papéis e pula quem estouraria o total', async () => {
    const resultado = await orquestrador.orquestrar(
      entrada(
        criarProjetoDemonstracao(),
        resolverParametros({ orquestracao: { numeroSugestoes: 1 } }),
      ),
    );
    const apertado = await orquestrador.orquestrar(
      entrada(
        criarProjeto({ orcamento: 60_000 }),
        resolverParametros({ orquestracao: { numeroSugestoes: 1 } }),
      ),
    );

    expect(idsDaEquipe(resultado.equipes[0] ?? { membros: [] }).DIRETOR).toBe(
      IDS_DEMONSTRACAO.DIRETORA_TECNICA,
    );
    expect(idsDaEquipe(apertado.equipes[0] ?? { membros: [] }).DIRETOR).toBe(
      IDS_DEMONSTRACAO.DIRETOR_LOCAL,
    );
    expect(apertado.equipes[0]?.custoTotal).toBeLessThanOrEqual(60_000);
  });

  it('não repete o mesmo profissional em dois papéis da mesma equipe', async () => {
    const polivalente = criarProfissional({
      id: 'polivalente',
      especialidades: [Papel.DIRETOR, Papel.ROTEIRISTA],
    });
    const { repositorio } = criarAmbienteOrquestracao([polivalente]);
    const projeto = criarProjeto({
      requisitos: [
        RequisitoPapel.criar(Papel.DIRETOR, 5),
        RequisitoPapel.criar(Papel.ROTEIRISTA, 4),
      ],
    });

    const resultado = await new OrquestradorPadrao(
      repositorio,
      fabricaFiccao,
      relogioFixo,
    ).orquestrar(entrada(projeto));

    for (const equipe of resultado.equipes) {
      const ids = equipe.membros.map((membro) => membro.profissional.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('gera recomendações auditáveis com posição, rodada e estratégia', async () => {
    const projeto = criarProjetoDemonstracao();
    projeto.registrarSugestoes([criarEquipe(projeto, { rodada: 2 })]);

    const resultado = await orquestrador.orquestrar(entrada(projeto));
    const diretores = resultado.recomendacoes.filter(
      (recomendacao) => recomendacao.papel === Papel.DIRETOR,
    );

    expect(resultado.rodada).toBe(3);
    expect(diretores.map((recomendacao) => recomendacao.posicao)).toEqual([1, 2, 3]);
    expect(diretores[0]).toMatchObject({
      profissionalId: IDS_DEMONSTRACAO.DIRETORA_TECNICA,
      estrategia: 'similaridade-cosseno',
      rodada: 3,
      criadaEm: relogioFixo(),
    });
  });

  it('descarta candidatos abaixo do score mínimo no pós-processamento', async () => {
    const resultado = await orquestrador.orquestrar(
      entrada(
        criarProjetoDemonstracao(),
        resolverParametros({ orquestracao: { scoreMinimo: 0.5 } }),
      ),
    );

    const diretores = resultado.ranking.get(Papel.DIRETOR) ?? [];
    expect(diretores.every((candidato) => candidato.score >= 0.5)).toBe(true);
    expect(diretores.map((candidato) => candidato.profissional.id)).not.toContain(
      IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
    );
  });

  it('marca resultado parcial e avisa quando um papel não tem candidatos', async () => {
    const projeto = criarProjeto({
      requisitos: [
        RequisitoPapel.criar(Papel.DIRETOR, 5),
        RequisitoPapel.criar(Papel.SONOPLASTA, 2),
      ],
    });

    const resultado = await orquestrador.orquestrar(entrada(projeto));

    expect(resultado.parcial).toBe(true);
    expect(resultado.papeisSemCandidatos).toEqual([Papel.SONOPLASTA]);
    expect(resultado.avisos).toContain('Nenhum candidato elegível para SONOPLASTA.');
    expect(resultado.equipes[0]?.papeisVagos(projeto.papeisObrigatorios)).toEqual([
      Papel.SONOPLASTA,
    ]);
  });

  it('propaga resultado parcial e avisos vindos do repositório', async () => {
    const repositorioDegradado: RepositorioProfissionais = {
      buscarCandidatos: () =>
        Promise.resolve({
          profissionais: [
            criarProfissional(),
            criarProfissional({ id: 'e', especialidades: [Papel.EDITOR] }),
          ],
          parcial: true,
          avisos: ['Repositório indisponível; usando cache.'],
        }),
    };

    const resultado = await new OrquestradorPadrao(
      repositorioDegradado,
      fabricaFiccao,
      relogioFixo,
    ).orquestrar(entrada(criarProjeto()));

    expect(resultado.parcial).toBe(true);
    expect(resultado.avisos[0]).toBe('Repositório indisponível; usando cache.');
  });

  it('avisa quando nenhuma equipe cabe no orçamento', async () => {
    const resultado = await orquestrador.orquestrar(
      entrada(
        criarProjeto({ orcamento: 5_000 }),
        resolverParametros({ folgaTetoPapel: 10, orquestracao: { scoreMinimo: 0 } }),
      ),
    );

    expect(resultado.equipes).toEqual([]);
    expect(resultado.avisos).toContain(
      'Nenhuma equipe coube no orçamento com os candidatos disponíveis.',
    );
  });

  it('normaliza o cadastro removendo duplicados e inativos', async () => {
    const duplicado = criarProfissional({ id: 'dup' });
    const repositorio: RepositorioProfissionais = {
      buscarCandidatos: () =>
        Promise.resolve({
          profissionais: [duplicado, duplicado, criarProfissional({ id: 'inativo', ativo: false })],
          parcial: false,
          avisos: [],
        }),
    };

    const resultado = await new OrquestradorPadrao(
      repositorio,
      fabricaFiccao,
      relogioFixo,
    ).orquestrar(entrada(criarProjeto()));

    expect(
      (resultado.ranking.get(Papel.DIRETOR) ?? []).map((candidato) => candidato.profissional.id),
    ).toEqual(['dup']);
  });

  describe('validarRestricoes', () => {
    it.each([
      [
        'equipe já formada',
        () => {
          const projeto = criarProjeto();
          const equipe = criarEquipe(projeto, { status: StatusEquipe.FORMADA });
          return criarProjeto({ id: projeto.id, equipes: [equipe] });
        },
        'Projeto já possui equipe formada',
      ],
      [
        'prazo vencido',
        () =>
          criarProjeto({
            dataInicio: new Date('2026-01-01T00:00:00.000Z'),
            dataEntrega: new Date('2026-06-01T00:00:00.000Z'),
          }),
        'A data de entrega do projeto já passou.',
      ],
      ['orçamento insuficiente', () => criarProjeto({ orcamento: 1_999 }), 'mínimo 2000'],
    ])('rejeita %s', async (_caso, criar, mensagem) => {
      await expect(orquestrador.orquestrar(entrada(criar()))).rejects.toThrow(mensagem);
    });
  });
});
