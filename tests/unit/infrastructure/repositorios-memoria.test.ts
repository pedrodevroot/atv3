import { describe, expect, it } from 'vitest';
import { Convite } from '../../../src/domain/entidades/convite.js';
import { Recomendacao } from '../../../src/domain/entidades/recomendacao.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import {
  RepositorioConvitesMemoria,
  RepositorioRecomendacoesMemoria,
} from '../../../src/infrastructure/repositories/repositorios-memoria.js';
import { CaixaMensagensMemoria } from '../../../src/infrastructure/notifications/canais-simulados.js';
import { RepositorioProjetosMemoria } from '../../../src/infrastructure/repositories/repositorio-projetos-memoria.js';
import { TipoCaptacao } from '../../../src/domain/enums/tipo-captacao.js';
import { criarEquipe, criarProjeto } from '../../fixtures/dominio.js';
import { fabricasTeste } from '../../fixtures/fabricas.js';

function convite(papel: Papel) {
  return Convite.criar({
    projetoId: 'p',
    equipeId: 'e',
    papel,
    profissionalId: 'prof',
    produtorId: 'prod',
  });
}

describe('RepositorioConvitesMemoria', () => {
  it('salva, obtém e encontra o convite pendente do papel', async () => {
    const repositorio = new RepositorioConvitesMemoria();
    const doEditor = convite(Papel.EDITOR);
    await repositorio.salvar(doEditor);
    await repositorio.salvar(convite(Papel.DIRETOR));

    expect(await repositorio.obter(doEditor.id)).toBe(doEditor);
    expect(await repositorio.pendenteDoPapel('e', Papel.EDITOR)).toBe(doEditor);

    doEditor.recusar();
    expect(await repositorio.pendenteDoPapel('e', Papel.EDITOR)).toBeUndefined();
  });
});

describe('RepositorioConvitesMemoria.expirarVencidos', () => {
  it('expira só os convites pendentes vencidos', async () => {
    const repositorio = new RepositorioConvitesMemoria();
    const vencido = Convite.criar({
      projetoId: 'p',
      equipeId: 'e',
      papel: Papel.EDITOR,
      profissionalId: 'prof',
      produtorId: 'prod',
      criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    });
    const respondido = Convite.criar({
      projetoId: 'p',
      equipeId: 'e',
      papel: Papel.DIRETOR,
      profissionalId: 'prof-2',
      produtorId: 'prod',
      criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    });
    respondido.aceitar(new Date('2026-01-02T00:00:00.000Z'));
    await repositorio.salvar(vencido);
    await repositorio.salvar(respondido);

    const expirados = await repositorio.expirarVencidos(new Date('2026-01-10T00:00:00.000Z'));

    expect(expirados).toEqual([vencido]);
    expect(await repositorio.expirarVencidos(new Date('2026-01-10T00:00:00.000Z'))).toEqual([]);
  });
});

describe('RepositorioConvitesMemoria.cancelarPendentesDasEquipes', () => {
  it('cancela só os convites pendentes das equipes indicadas', async () => {
    const repositorio = new RepositorioConvitesMemoria();
    const dados = { projetoId: 'p', produtorId: 'prod' };
    const pendente = Convite.criar({
      ...dados,
      equipeId: 'e1',
      papel: Papel.EDITOR,
      profissionalId: 'a',
    });
    const respondido = Convite.criar({
      ...dados,
      equipeId: 'e1',
      papel: Papel.DIRETOR,
      profissionalId: 'b',
    });
    respondido.aceitar();
    const deOutraEquipe = Convite.criar({
      ...dados,
      equipeId: 'e2',
      papel: Papel.EDITOR,
      profissionalId: 'c',
    });
    for (const convite of [pendente, respondido, deOutraEquipe]) {
      await repositorio.salvar(convite);
    }

    expect(await repositorio.cancelarPendentesDasEquipes(['e1'])).toEqual([pendente]);
    expect(pendente.status).toBe('CANCELADO');
    expect(respondido.status).toBe('ACEITO');
    expect(deOutraEquipe.status).toBe('PENDENTE');
    expect(await repositorio.cancelarPendentesDasEquipes([])).toEqual([]);
  });
});

describe('RepositorioProjetosMemoria', () => {
  it('guarda uma cópia: alterar o objeto lido não muda o projeto salvo até salvar de novo', async () => {
    const repositorio = new RepositorioProjetosMemoria(fabricasTeste);
    const projeto = criarProjeto({ tipoCaptacao: TipoCaptacao.DOCUMENTARIO });
    const equipe = criarEquipe(projeto);
    projeto.registrarSugestoes([equipe]);
    await repositorio.salvar(projeto);

    const lido = await repositorio.obter(projeto.id);
    lido?.aceitarRecomendacao(equipe.id, Papel.DIRETOR);
    lido?.ajustarDetalhes({ entrevistados: ['Outra pessoa'] });
    const relido = await repositorio.obter(projeto.id);

    expect(lido).not.toBe(projeto);
    expect(relido?.detalhes).toEqual(projeto.detalhes);
    expect(relido?.equipe(equipe.id).membro(Papel.DIRETOR)?.status).toBe('SUGERIDO');
    expect(await repositorio.obter('inexistente')).toBeUndefined();
  });
});

describe('CaixaMensagensMemoria', () => {
  it('devolve as mensagens mais recentes primeiro, como o banco', async () => {
    const caixa = new CaixaMensagensMemoria();
    const mensagem = (assunto: string) => ({
      destinatarioId: 'produtor-1',
      tipoDestinatario: 'PRODUTOR' as const,
      assunto,
      corpo: assunto,
      eventoId: assunto,
    });
    await caixa.entregar([mensagem('primeira')]);
    await caixa.entregar([mensagem('segunda')]);

    expect(caixa.mensagensDe('produtor-1').map((item) => item.assunto)).toEqual([
      'segunda',
      'primeira',
    ]);
  });
});

describe('RepositorioRecomendacoesMemoria', () => {
  it('lista as recomendações do projeto', async () => {
    const repositorio = new RepositorioRecomendacoesMemoria();
    const base = {
      papel: Papel.DIRETOR,
      profissionalId: 'prof',
      score: 0.5,
      posicao: 1,
      estrategia: 'x',
      rodada: 1,
    };
    await repositorio.salvarTodas([
      Recomendacao.criar({ ...base, projetoId: 'p-1' }),
      Recomendacao.criar({ ...base, projetoId: 'p-2' }),
    ]);

    expect(await repositorio.listarPorProjeto('p-1')).toHaveLength(1);
  });
});
