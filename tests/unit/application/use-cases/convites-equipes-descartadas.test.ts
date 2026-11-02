import { describe, expect, it } from 'vitest';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { StatusConvite } from '../../../../src/domain/enums/status.js';
import { cadastroDaApi, criarCasosMemoria } from '../../../fixtures/api.js';
import { AGORA } from '../../../fixtures/orquestracao.js';

const HORA = 3_600_000;

async function cenario() {
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
  const [primeira, segunda] = resultado.equipes;
  if (!primeira || !segunda) {
    throw new Error('O cenário precisa de duas equipes sugeridas');
  }
  const convidar = async (equipeId: string, papel: Papel) =>
    (await ambiente.casos.aceitarMembro.executar({ projetoId: projeto.id, equipeId, papel }, {}))
      .convite;
  const assuntosDoProdutor = () =>
    ambiente.canais.caixa.mensagensDe('produtor-1').map((mensagem) => mensagem.assunto);
  return {
    ambiente,
    projetoId: projeto.id,
    primeira,
    segunda,
    convidar,
    assuntosDoProdutor,
    avancarHoras: (horas: number) => {
      agora += horas * HORA;
    },
  };
}

const cancelado = {
  codigo: 'TRANSICAO_INVALIDA',
  message: 'Convite CANCELADO não pode mais ser alterado.',
};

describe('Convites pendentes de equipes descartadas', () => {
  it('nova rodada cancela os convites pendentes e o profissional não consegue mais aceitar', async () => {
    const { ambiente, projetoId, primeira, convidar, assuntosDoProdutor } = await cenario();
    const convite = await convidar(primeira.id, Papel.DIRETOR);

    await ambiente.casos.recomendarNovamente.executar(projetoId, {}, {});

    expect(convite.status).toBe(StatusConvite.CANCELADO);
    await expect(
      ambiente.casos.responderConvite.executar(convite.id, true, {}),
    ).rejects.toMatchObject(cancelado);
    await ambiente.barramento.aguardarEntregas();
    expect(assuntosDoProdutor()).not.toContain('Convite aceito para DIRETOR');
  });

  it('reavaliação significativa também cancela os convites da equipe descartada', async () => {
    const { ambiente, projetoId, primeira, convidar } = await cenario();
    const convite = await convidar(primeira.id, Papel.EDITOR);

    const { reavaliacao } = await ambiente.casos.reavaliarProjeto.executar(
      projetoId,
      { orcamento: 150_000 },
      {},
    );

    expect(reavaliacao.significativa).toBe(true);
    expect(convite.status).toBe(StatusConvite.CANCELADO);
  });

  it('convite cancelado não expira nem gera aviso depois do prazo', async () => {
    const { ambiente, projetoId, primeira, convidar, assuntosDoProdutor, avancarHoras } =
      await cenario();
    await convidar(primeira.id, Papel.DIRETOR);
    await ambiente.casos.recomendarNovamente.executar(projetoId, {}, {});
    avancarHoras(73);

    expect(await ambiente.casos.expirarConvites.executar({})).toEqual([]);
    await ambiente.barramento.aguardarEntregas();
    expect(assuntosDoProdutor()).not.toContain('Convite expirado para DIRETOR');
  });

  it('formar a equipe cancela os convites pendentes das outras sugestões', async () => {
    const { ambiente, projetoId, primeira, segunda, convidar } = await cenario();
    const conviteDaOutra = await convidar(segunda.id, Papel.EDITOR);
    for (const papel of [Papel.DIRETOR, Papel.EDITOR]) {
      const convite = await convidar(primeira.id, papel);
      await ambiente.casos.responderConvite.executar(convite.id, true, {});
      await ambiente.barramento.aguardarEntregas();
    }

    await ambiente.casos.finalizarEquipe.executar(projetoId, primeira.id, {});

    expect(conviteDaOutra.status).toBe(StatusConvite.CANCELADO);
    await expect(
      ambiente.casos.responderConvite.executar(conviteDaOutra.id, true, {}),
    ).rejects.toMatchObject(cancelado);
  });
});
