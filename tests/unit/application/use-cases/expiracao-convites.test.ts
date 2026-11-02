import { describe, expect, it } from 'vitest';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { StatusConvite } from '../../../../src/domain/enums/status.js';
import { cadastroDaApi, criarCasosMemoria } from '../../../fixtures/api.js';
import { AGORA, ID_EDITOR_ECONOMICO } from '../../../fixtures/orquestracao.js';

const HORA = 3_600_000;

async function cenarioComConvite() {
  let agora = AGORA.getTime();
  const ambiente = criarCasosMemoria(cadastroDaApi(), () => new Date(agora));
  const { projeto, resultado } = await ambiente.casos.criarProjeto.executar(
    {
      titulo: 'Vozes do Sertão',
      produtorId: 'produtor-1',
      genero: 'drama',
      tipoCaptacao: 'FICCAO',
      duracaoMinutos: 90,
      orcamento: 100_000,
      dataInicio: new Date('2026-10-01T00:00:00.000Z'),
      dataEntrega: new Date('2026-12-30T00:00:00.000Z'),
      localizacao: { cidade: 'São Paulo', uf: 'SP', latitude: -23.5505, longitude: -46.6333 },
      requisitos: [
        { papel: Papel.DIRETOR, peso: 5 },
        { papel: Papel.EDITOR, peso: 3 },
      ],
      estrategia: 'similaridade-cosseno',
    },
    {},
  );
  const equipeId = resultado.equipes[0]?.id ?? '';
  const { convite } = await ambiente.casos.aceitarMembro.executar(
    { projetoId: projeto.id, equipeId, papel: Papel.EDITOR },
    {},
  );
  await ambiente.barramento.aguardarEntregas();
  return {
    ambiente,
    projetoId: projeto.id,
    equipeId,
    convite,
    avancarHoras: (horas: number) => {
      agora += horas * HORA;
    },
  };
}

describe('Expiração de convites', () => {
  it('convites dentro do prazo não expiram', async () => {
    const { ambiente, avancarHoras } = await cenarioComConvite();
    avancarHoras(71);

    expect(await ambiente.casos.expirarConvites.executar({})).toEqual([]);
  });

  it('convite vencido expira, libera o papel, avisa os envolvidos e dispara nova rodada', async () => {
    const { ambiente, projetoId, equipeId, convite, avancarHoras } = await cenarioComConvite();
    avancarHoras(73);

    const vencidos = await ambiente.casos.expirarConvites.executar({ correlacaoId: 'varredura-1' });
    await ambiente.barramento.aguardarEntregas();

    expect(vencidos.map((vencido) => [vencido.id, vencido.status])).toEqual([
      [convite.id, StatusConvite.EXPIRADO],
    ]);
    const projeto = await ambiente.casos.consultas.obterProjeto(projetoId);
    expect(projeto.equipe(equipeId).membro(Papel.EDITOR)?.profissional.id).toBe(
      ID_EDITOR_ECONOMICO,
    );
    expect(
      ambiente.canais.caixa.mensagensDe('produtor-1').map((mensagem) => mensagem.assunto),
    ).toContain('Convite expirado para EDITOR');
    expect(
      ambiente.canais.caixa.mensagensDe(convite.profissionalId).map((mensagem) => mensagem.assunto),
    ).toContain('Convite expirado para EDITOR');
    const auditoria = await ambiente.casos.consultas.listarAuditoria(projetoId);
    expect(auditoria).toContainEqual(
      expect.objectContaining({
        tipo: 'CONVITE_EXPIRADO',
        tipoAtor: 'SISTEMA',
        atorId: 'expiracao-convites',
        correlacaoId: 'varredura-1',
      }),
    );
    expect(await ambiente.casos.expirarConvites.executar({})).toEqual([]);
  });

  it('responder depois do prazo devolve erro e deixa o convite gravado como expirado', async () => {
    const { ambiente, convite, avancarHoras } = await cenarioComConvite();
    avancarHoras(73);

    await expect(
      ambiente.casos.responderConvite.executar(convite.id, true, {}),
    ).rejects.toMatchObject({ codigo: 'TRANSICAO_INVALIDA' });
    await ambiente.barramento.aguardarEntregas();

    expect(convite.status).toBe(StatusConvite.EXPIRADO);
    expect(ambiente.canais.auditoria.entradas.todos.map((entrada) => entrada.tipo)).toContain(
      'CONVITE_EXPIRADO',
    );
  });
});
