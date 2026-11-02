import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrquestradorPadrao } from '../../../../src/application/orchestration/orquestrador-padrao.js';
import { AtualizadorComposicao } from '../../../../src/application/observers/atualizador-composicao.js';
import type { Sujeito } from '../../../../src/application/ports/observador.js';
import { SistemaRecomendacao } from '../../../../src/application/sistema-recomendacao.js';
import type { Equipe } from '../../../../src/domain/entidades/equipe.js';
import type { Projeto } from '../../../../src/domain/entidades/projeto.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { StatusEquipe, StatusMembro } from '../../../../src/domain/enums/status.js';
import type { EventoRecomendacao } from '../../../../src/domain/eventos/evento-recomendacao.js';
import { RepositorioProjetosMemoria } from '../../../../src/infrastructure/repositories/repositorio-projetos-memoria.js';
import {
  IDS_DEMONSTRACAO,
  criarProjetoDemonstracao,
} from '../../../fixtures/cadastro-demonstracao.js';
import { eventoRespostaConvite } from '../../../fixtures/eventos.js';
import {
  criarAmbienteOrquestracao,
  fabricaFiccao,
  ID_EDITOR_ECONOMICO,
  relogioFixo,
} from '../../../fixtures/orquestracao.js';

describe('AtualizadorComposicao (RF10)', () => {
  const ambiente = criarAmbienteOrquestracao();
  let projetos: RepositorioProjetosMemoria;
  let publicados: EventoRecomendacao[];
  let atualizador: AtualizadorComposicao;
  let sistema: SistemaRecomendacao;
  let projeto: Projeto;
  let equipe: Equipe;

  const resposta = (
    tipo: 'CONVITE_ACEITO' | 'CONVITE_RECUSADO' | 'CONVITE_EXPIRADO',
    projetoId = projeto.id,
  ) =>
    eventoRespostaConvite(tipo, {
      projetoId,
      equipeId: equipe.id,
      papel: Papel.EDITOR,
      profissionalId: IDS_DEMONSTRACAO.EDITOR,
    });

  beforeEach(async () => {
    projetos = new RepositorioProjetosMemoria(ambiente.fabricas);
    publicados = [];
    const sujeito: Sujeito = {
      adicionarObservador: () => undefined,
      removerObservador: () => undefined,
      notificarObservadores: (evento) => publicados.push(evento),
      notificarObservador: () => undefined,
    };
    sistema = new SistemaRecomendacao({
      repositorio: ambiente.repositorio,
      fabricas: ambiente.fabricas,
      estrategias: ambiente.registro,
      sujeito,
      parametros: ambiente.parametros,
      relogio: relogioFixo,
    });
    atualizador = new AtualizadorComposicao({ projetos, sistema });
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
    projeto.aceitarRecomendacao(equipe.id, Papel.EDITOR);
    await projetos.salvar(projeto);
  });

  const equipeSalva = async () => (await projetos.obter(projeto.id))?.equipe(equipe.id);

  it('convite aceito confirma o membro sem disparar nova rodada', async () => {
    await atualizador.atualizar(resposta('CONVITE_ACEITO'));

    expect((await equipeSalva())?.membro(Papel.EDITOR)?.status).toBe(StatusMembro.CONFIRMADO);
    expect(publicados).toEqual([]);
  });

  it('convite recusado dispara nova rodada só para o papel e notifica o novo recomendado', async () => {
    const diretorAntes = equipe.membro(Papel.DIRETOR);

    await atualizador.atualizar(resposta('CONVITE_RECUSADO'));

    const salva = await equipeSalva();
    expect(salva?.membro(Papel.EDITOR)?.profissional.id).toBe(ID_EDITOR_ECONOMICO);
    expect(salva?.membro(Papel.DIRETOR)?.profissional.id).toBe(diretorAntes?.profissional.id);
    expect(salva?.membro(Papel.DIRETOR)?.status).toBe(diretorAntes?.status);
    expect(publicados.map((evento) => evento.tipo)).toEqual([
      'SUBSTITUICAO_SOLICITADA',
      'RECOMENDACAO_GERADA',
    ]);
    expect(publicados[0]).toMatchObject({
      origem: 'atualizador-composicao',
      correlacaoId: 'req-1',
      dados: { profissionalAnteriorId: IDS_DEMONSTRACAO.EDITOR },
    });
    expect(publicados[1]).toMatchObject({
      dados: { profissionais: [{ profissionalId: ID_EDITOR_ECONOMICO, papel: Papel.EDITOR }] },
    });
  });

  it('sem substituto disponível publica só a solicitação de substituição', async () => {
    projeto.solicitarReavaliacao({ orcamento: 58_000 });
    await projetos.salvar(projeto);

    await atualizador.atualizar(resposta('CONVITE_RECUSADO'));

    expect((await equipeSalva())?.membro(Papel.EDITOR)?.status).toBe(StatusMembro.RECUSADO);
    expect(publicados.map((evento) => evento.tipo)).toEqual(['SUBSTITUICAO_SOLICITADA']);
  });

  it('recusa sem orçamento para substituir: grava a recusa e avisa que não há substituto automático', async () => {
    projeto.solicitarReavaliacao({ orcamento: equipe.membro(Papel.DIRETOR)?.custo ?? 1 }, 0.99);
    await projetos.salvar(projeto);

    await atualizador.atualizar(resposta('CONVITE_RECUSADO'));

    expect((await equipeSalva())?.membro(Papel.EDITOR)?.status).toBe(StatusMembro.RECUSADO);
    expect(publicados).toEqual([
      expect.objectContaining({
        tipo: 'SUBSTITUICAO_INDISPONIVEL',
        origem: 'atualizador-composicao',
        correlacaoId: 'req-1',
        dados: expect.objectContaining({
          papel: Papel.EDITOR,
          motivo: 'Não há orçamento restante para substituir o papel.',
        }) as object,
      }),
    ]);
  });

  it('convite expirado é tratado como recusa e dispara a nova rodada', async () => {
    await atualizador.atualizar(resposta('CONVITE_EXPIRADO'));

    expect((await equipeSalva())?.membro(Papel.EDITOR)?.profissional.id).toBe(ID_EDITOR_ECONOMICO);
    expect(publicados.map((evento) => evento.tipo)).toEqual([
      'SUBSTITUICAO_SOLICITADA',
      'RECOMENDACAO_GERADA',
    ]);
  });

  it('falha de infraestrutura na nova rodada não é engolida', async () => {
    vi.spyOn(sistema, 'substituir').mockRejectedValue(new Error('banco fora do ar'));

    await expect(atualizador.atualizar(resposta('CONVITE_RECUSADO'))).rejects.toThrow(
      'banco fora do ar',
    );
    expect((await equipeSalva())?.membro(Papel.EDITOR)?.status).toBe(StatusMembro.CONVIDADO);
  });

  it('ignora a resposta de um convite cuja equipe já foi descartada', async () => {
    projeto.equipe(equipe.id).descartar();
    await projetos.salvar(projeto);

    await atualizador.atualizar(resposta('CONVITE_ACEITO'));
    await atualizador.atualizar(resposta('CONVITE_EXPIRADO'));

    const salva = await equipeSalva();
    expect(publicados).toEqual([]);
    expect(salva?.status).toBe(StatusEquipe.DESCARTADA);
    expect(salva?.membro(Papel.EDITOR)?.status).toBe(StatusMembro.CONVIDADO);
  });

  it('ignora eventos fora do seu interesse e falha para projeto inexistente', async () => {
    await expect(
      atualizador.atualizar(resposta('CONVITE_ACEITO', 'projeto-fantasma')),
    ).rejects.toThrow('Projeto projeto-fantasma não encontrado');

    const outro = {
      ...resposta('CONVITE_ACEITO'),
      tipo: 'EQUIPE_FORMADA',
    } as unknown as EventoRecomendacao;
    await expect(atualizador.atualizar(outro)).resolves.toBeUndefined();
  });
});
