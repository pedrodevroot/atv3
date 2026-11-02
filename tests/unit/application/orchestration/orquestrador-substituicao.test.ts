import { beforeEach, describe, expect, it } from 'vitest';
import { OrquestradorPadrao } from '../../../../src/application/orchestration/orquestrador-padrao.js';
import {
  OrquestradorSubstituicao,
  type EntradaSubstituicao,
} from '../../../../src/application/orchestration/orquestrador-substituicao.js';
import type { Equipe } from '../../../../src/domain/entidades/equipe.js';
import type { Projeto } from '../../../../src/domain/entidades/projeto.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { StatusMembro } from '../../../../src/domain/enums/status.js';
import {
  IDS_DEMONSTRACAO,
  criarProjetoDemonstracao,
} from '../../../fixtures/cadastro-demonstracao.js';
import {
  criarAmbienteOrquestracao,
  fabricaFiccao,
  ID_EDITOR_ECONOMICO,
  relogioFixo,
} from '../../../fixtures/orquestracao.js';

describe('OrquestradorSubstituicao', () => {
  const ambiente = criarAmbienteOrquestracao();
  const substituicao = new OrquestradorSubstituicao(
    ambiente.repositorio,
    fabricaFiccao,
    relogioFixo,
  );
  let projeto: Projeto;
  let equipe: Equipe;

  const entrada = (papel: Papel = Papel.EDITOR): EntradaSubstituicao => ({
    projeto,
    estrategia: ambiente.cosseno,
    parametros: ambiente.parametros,
    equipeId: equipe.id,
    papel,
  });

  beforeEach(async () => {
    projeto = criarProjetoDemonstracao();
    const resultado = await new OrquestradorPadrao(
      ambiente.repositorio,
      fabricaFiccao,
      relogioFixo,
    ).orquestrar({
      projeto,
      estrategia: ambiente.cosseno,
      parametros: ambiente.parametros,
    });
    projeto.registrarSugestoes(resultado.equipes);
    const [primeira] = resultado.equipes;
    if (!primeira) {
      throw new Error('Nenhuma equipe sugerida');
    }
    equipe = primeira;
  });

  it('substitui só o papel afetado e mantém as demais escolhas fixas', async () => {
    const diretorAntes = equipe.membro(Papel.DIRETOR);

    const resultado = await substituicao.orquestrar(entrada());

    expect(resultado.equipes).toEqual([equipe]);
    expect(equipe.membro(Papel.DIRETOR)).toBe(diretorAntes);
    expect(equipe.membro(Papel.EDITOR)?.profissional.id).toBe(ID_EDITOR_ECONOMICO);
    expect(equipe.membro(Papel.EDITOR)?.status).toBe(StatusMembro.SUGERIDO);
    expect(equipe.rodada).toBe(2);
    expect(resultado.rodada).toBe(2);
  });

  it('não sugere de novo quem já está na equipe e ranqueia só o papel afetado', async () => {
    const resultado = await substituicao.orquestrar(entrada());

    expect([...resultado.ranking.keys()]).toEqual([Papel.EDITOR]);
    expect(
      (resultado.ranking.get(Papel.EDITOR) ?? []).map((candidato) => candidato.profissional.id),
    ).toEqual([ID_EDITOR_ECONOMICO]);
    expect(
      resultado.recomendacoes.every((recomendacao) => recomendacao.papel === Papel.EDITOR),
    ).toBe(true);
  });

  it('usa apenas o orçamento que sobra depois dos membros fixos', async () => {
    projeto.solicitarReavaliacao({ orcamento: 58_000 });

    const resultado = await substituicao.orquestrar(entrada());

    expect(resultado.avisos).toContain('Nenhum substituto para EDITOR cabe no orçamento restante.');
    expect(equipe.membro(Papel.EDITOR)?.profissional.id).toBe(IDS_DEMONSTRACAO.EDITOR);
  });

  it('substitui membro que recusou o convite', async () => {
    projeto.aceitarRecomendacao(equipe.id, Papel.EDITOR);
    projeto.registrarRespostaConvite(equipe.id, Papel.EDITOR, false);

    await substituicao.orquestrar(entrada());

    expect(equipe.membro(Papel.EDITOR)?.profissional.id).toBe(ID_EDITOR_ECONOMICO);
  });

  describe('validarRestricoes', () => {
    it('não substitui membro que já confirmou', async () => {
      projeto.aceitarRecomendacao(equipe.id, Papel.EDITOR);
      projeto.registrarRespostaConvite(equipe.id, Papel.EDITOR, true);

      await expect(substituicao.orquestrar(entrada())).rejects.toThrow('já confirmou');
    });

    it('não substitui papel que não é obrigatório', async () => {
      await expect(substituicao.orquestrar(entrada(Papel.SONOPLASTA))).rejects.toThrow(
        'SONOPLASTA não é um papel obrigatório do projeto.',
      );
    });

    it('não altera equipe descartada', async () => {
      equipe.descartar();

      await expect(substituicao.orquestrar(entrada())).rejects.toThrow(
        'Equipe DESCARTADA não aceita substituições.',
      );
    });

    it('exige orçamento restante', async () => {
      projeto.solicitarReavaliacao({ orcamento: 55_000 });

      await expect(substituicao.orquestrar(entrada())).rejects.toThrow(
        'Não há orçamento restante para substituir o papel.',
      );
    });
  });
});
