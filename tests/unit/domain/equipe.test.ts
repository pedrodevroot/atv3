import { beforeEach, describe, expect, it } from 'vitest';
import { ErroDominio } from '../../../src/domain/comum/erro-dominio.js';
import { Equipe } from '../../../src/domain/entidades/equipe.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import { StatusEquipe, StatusMembro } from '../../../src/domain/enums/status.js';
import {
  criarEquipe,
  criarMembro,
  criarProfissional,
  criarProjeto,
} from '../../fixtures/dominio.js';

const REQUISITOS = [Papel.DIRETOR, Papel.EDITOR];

describe('MembroEquipe', () => {
  it('começa como sugerido e segue convite → confirmado', () => {
    const membro = criarMembro(Papel.DIRETOR);

    expect(membro.status).toBe(StatusMembro.SUGERIDO);
    membro.convidar();
    membro.confirmar();

    expect(membro.status).toBe(StatusMembro.CONFIRMADO);
    expect(membro.confirmado).toBe(true);
  });

  it('pode recusar um convite', () => {
    const membro = criarMembro(Papel.EDITOR);
    membro.convidar();
    membro.recusar();

    expect(membro.status).toBe(StatusMembro.RECUSADO);
  });

  it('bloqueia transições fora de ordem', () => {
    const membro = criarMembro(Papel.EDITOR);

    expect(() => {
      membro.confirmar();
    }).toThrow(expect.objectContaining({ codigo: 'TRANSICAO_INVALIDA' }) as Error);
    expect(() => {
      membro.recusar();
    }).toThrow(ErroDominio);
  });

  it('exige que o profissional atue no papel e valida custo e score', () => {
    const diretor = criarProfissional({ especialidades: [Papel.DIRETOR] });

    expect(() => criarMembro(Papel.EDITOR, { profissional: diretor })).toThrow(
      'não atua como EDITOR',
    );
    expect(() => criarMembro(Papel.DIRETOR, { custo: -1 })).toThrow(
      'Custo do membro deve ser >= 0.',
    );
    expect(() => criarMembro(Papel.DIRETOR, { score: 1.2 })).toThrow('Score do membro');
  });
});

describe('Equipe', () => {
  const projeto = criarProjeto();
  let equipe: Equipe;

  beforeEach(() => {
    equipe = criarEquipe(projeto, {
      membros: [
        criarMembro(Papel.DIRETOR, { custo: 20_000 }),
        criarMembro(Papel.EDITOR, { custo: 8_000 }),
      ],
    });
  });

  it('nasce sugerida, na rodada 1, com custo total dos membros', () => {
    expect(equipe.status).toBe(StatusEquipe.SUGERIDA);
    expect(equipe.rodada).toBe(1);
    expect(equipe.custoTotal).toBe(28_000);
    expect(equipe.ativa).toBe(true);
    expect(equipe.membro(Papel.DIRETOR)?.custo).toBe(20_000);
    expect(equipe.papeisVagos([...REQUISITOS, Papel.SONOPLASTA])).toEqual([Papel.SONOPLASTA]);
  });

  it('convidar um membro coloca a equipe em formação', () => {
    const membro = equipe.convidarMembro(Papel.DIRETOR);

    expect(membro.status).toBe(StatusMembro.CONVIDADO);
    expect(equipe.status).toBe(StatusEquipe.EM_FORMACAO);
  });

  it('rejeitar um membro libera o papel', () => {
    const rejeitado = equipe.rejeitarMembro(Papel.EDITOR);

    expect(rejeitado.papel).toBe(Papel.EDITOR);
    expect(equipe.papeisVagos(REQUISITOS)).toEqual([Papel.EDITOR]);
    expect(equipe.status).toBe(StatusEquipe.EM_FORMACAO);
  });

  it('substitui só o papel afetado mantendo os demais fixos e avança a rodada', () => {
    const diretorOriginal = equipe.membro(Papel.DIRETOR);
    const novoEditor = criarMembro(Papel.EDITOR, { custo: 9_000 });

    const anterior = equipe.substituirMembro(novoEditor);

    expect(anterior?.custo).toBe(8_000);
    expect(equipe.membro(Papel.EDITOR)).toBe(novoEditor);
    expect(equipe.membro(Papel.DIRETOR)).toBe(diretorOriginal);
    expect(equipe.membrosFixos(Papel.EDITOR)).toEqual([diretorOriginal]);
    expect(equipe.rodada).toBe(2);
  });

  it('preenche papel vago na substituição', () => {
    equipe.rejeitarMembro(Papel.EDITOR);

    expect(equipe.substituirMembro(criarMembro(Papel.EDITOR))).toBeUndefined();
    expect(equipe.papeisVagos(REQUISITOS)).toEqual([]);
  });

  it('lembra quem foi rejeitado ou substituído e não aceita essa pessoa de volta', () => {
    const editorRejeitado = equipe.rejeitarMembro(Papel.EDITOR);
    const diretorAnterior = equipe.membro(Papel.DIRETOR);
    equipe.substituirMembro(criarMembro(Papel.DIRETOR));

    expect(equipe.profissionaisDescartados).toEqual([
      editorRejeitado.profissional.id,
      diretorAnterior?.profissional.id,
    ]);
    expect(() =>
      equipe.substituirMembro(
        criarMembro(Papel.EDITOR, { profissional: editorRejeitado.profissional }),
      ),
    ).toThrow('já foi descartado nesta equipe');
  });

  it('não remove nem substitui membro confirmado', () => {
    equipe.convidarMembro(Papel.DIRETOR);
    equipe.registrarRespostaConvite(Papel.DIRETOR, true);

    expect(() => equipe.rejeitarMembro(Papel.DIRETOR)).toThrow('não pode ser removido');
    expect(() => equipe.substituirMembro(criarMembro(Papel.DIRETOR))).toThrow(
      'não pode ser removido',
    );
  });

  it('aceita substituto somente como sugestão', () => {
    const jaConvidado = criarMembro(Papel.EDITOR, { status: StatusMembro.CONVIDADO });

    expect(() => equipe.substituirMembro(jaConvidado)).toThrow(
      'O substituto deve entrar como sugestão.',
    );
  });

  it('registra recusa de convite deixando o papel pronto para nova rodada', () => {
    equipe.convidarMembro(Papel.EDITOR);
    const membro = equipe.registrarRespostaConvite(Papel.EDITOR, false);

    expect(membro.status).toBe(StatusMembro.RECUSADO);
    expect(equipe.substituirMembro(criarMembro(Papel.EDITOR))).toBe(membro);
  });

  it('só finaliza com todos os papéis obrigatórios confirmados', () => {
    equipe.convidarMembro(Papel.DIRETOR);
    equipe.registrarRespostaConvite(Papel.DIRETOR, true);

    expect(equipe.estaCompleta(REQUISITOS)).toBe(false);
    expect(() => {
      equipe.finalizar(REQUISITOS);
    }).toThrow('Pendentes: EDITOR');

    equipe.convidarMembro(Papel.EDITOR);
    equipe.registrarRespostaConvite(Papel.EDITOR, true);
    equipe.finalizar(REQUISITOS);

    expect(equipe.estaCompleta(REQUISITOS)).toBe(true);
    expect(equipe.status).toBe(StatusEquipe.FORMADA);
    expect(equipe.ativa).toBe(false);
  });

  it('não altera equipe formada ou descartada', () => {
    equipe.descartar();

    expect(equipe.status).toBe(StatusEquipe.DESCARTADA);
    expect(() => equipe.convidarMembro(Papel.DIRETOR)).toThrow('DESCARTADA não pode ser alterada');

    const formada = criarEquipe(projeto, { status: StatusEquipe.FORMADA });
    expect(() => {
      formada.descartar();
    }).toThrow('Equipe formada não pode ser descartada.');
  });

  it('acusa papel inexistente', () => {
    equipe.rejeitarMembro(Papel.EDITOR);

    expect(() => equipe.convidarMembro(Papel.EDITOR)).toThrow(
      expect.objectContaining({ codigo: 'NAO_ENCONTRADO' }) as Error,
    );
  });

  it('valida papéis repetidos e rodada', () => {
    const membros = [criarMembro(Papel.EDITOR), criarMembro(Papel.EDITOR)];

    expect(() => Equipe.criar({ projetoId: 'p', estrategia: 'x', membros })).toThrow(
      'Uma equipe não pode repetir papéis.',
    );
    expect(() => Equipe.criar({ projetoId: 'p', estrategia: 'x', membros: [], rodada: 0 })).toThrow(
      'Rodada deve ser inteira e >= 1.',
    );
  });
});
