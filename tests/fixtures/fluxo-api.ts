import { expect } from 'vitest';
import type { App } from '../../src/app.js';
import { corpoProjetoDemonstracao } from './api.js';
import { IDS_DEMONSTRACAO } from './cadastro-demonstracao.js';
import { ID_EDITOR_ECONOMICO } from './orquestracao.js';

interface Membro {
  papel: string;
  status: string;
  profissional: { id: string; nome: string };
}

interface ProjetoJson {
  id: string;
  equipes: { id: string; rodada: number; membros: Membro[] }[];
  equipeFormadaId?: string;
}

interface RodadaJson {
  projeto: ProjetoJson;
  ranking: Record<string, { profissionalId: string }[]>;
}

export async function executarFluxoCompleto(
  app: App,
  aguardarEventos: () => Promise<void>,
): Promise<string> {
  const requisitar = async <T>(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    status: number,
    payload?: object,
  ): Promise<T> => {
    const resposta = await app.inject({
      method,
      url,
      headers: { 'x-request-id': 'fluxo-demonstracao' },
      ...(payload ? { payload } : {}),
    });
    expect(resposta.statusCode, `${method} ${url}: ${resposta.body}`).toBe(status);
    return resposta.json<T>();
  };
  const membro = (projeto: ProjetoJson, papel: string) =>
    projeto.equipes[0]?.membros.find((candidato) => candidato.papel === papel);
  const responderConvite = async (
    projetoId: string,
    equipeId: string,
    papel: string,
    aceito: boolean,
  ) => {
    const { convite } = await requisitar<{ convite: { id: string; status: string } }>(
      'POST',
      `/projetos/${projetoId}/equipes/${equipeId}/membros/${papel}/aceite`,
      201,
    );
    expect(convite.status).toBe('PENDENTE');
    const respondido = await requisitar<{ status: string }>(
      'POST',
      `/convites/${convite.id}/resposta`,
      200,
      { aceito },
    );
    expect(respondido.status).toBe(aceito ? 'ACEITO' : 'RECUSADO');
    await aguardarEventos();
    return requisitar<ProjetoJson>('GET', `/projetos/${projetoId}`, 200);
  };

  const estrategias = await requisitar<{ nome: string }[]>('GET', '/estrategias', 200);
  expect(estrategias.map((estrategia) => estrategia.nome)).toHaveLength(3);

  const criado = await requisitar<RodadaJson>('POST', '/projetos', 201, corpoProjetoDemonstracao());
  const projetoId = criado.projeto.id;
  const equipeId = criado.projeto.equipes[0]?.id ?? '';
  expect(criado.projeto.equipes).toHaveLength(3);
  expect(membro(criado.projeto, 'DIRETOR')?.profissional.id).toBe(
    IDS_DEMONSTRACAO.DIRETORA_TECNICA,
  );
  expect(criado.ranking.DIRETOR?.map((candidato) => candidato.profissionalId)).toHaveLength(3);

  const comDiretor = await responderConvite(projetoId, equipeId, 'DIRETOR', true);
  expect(membro(comDiretor, 'DIRETOR')?.status).toBe('CONFIRMADO');

  const aposRecusa = await responderConvite(projetoId, equipeId, 'EDITOR', false);
  expect(membro(aposRecusa, 'EDITOR')).toMatchObject({
    status: 'SUGERIDO',
    profissional: { id: ID_EDITOR_ECONOMICO },
  });
  expect(aposRecusa.equipes[0]?.rodada).toBe(2);

  const completo = await responderConvite(projetoId, equipeId, 'EDITOR', true);
  expect(membro(completo, 'EDITOR')?.status).toBe('CONFIRMADO');

  const analise = await requisitar<{
    validacao: { valido: boolean };
    compatibilidade: number;
    relatorio: string;
  }>('GET', `/projetos/${projetoId}/equipes/${equipeId}/relatorio`, 200);
  expect(analise.validacao.valido).toBe(true);
  expect(analise.compatibilidade).toBeGreaterThan(0);
  expect(analise.relatorio).toContain('Duda Corte (CONFIRMADO)');

  const finalizado = await requisitar<ProjetoJson>(
    'POST',
    `/projetos/${projetoId}/equipes/${equipeId}/finalizacao`,
    200,
  );
  expect(finalizado.equipeFormadaId).toBe(equipeId);
  expect(finalizado.equipes).toHaveLength(1);
  await aguardarEventos();

  const auditoria = await requisitar<{ tipo: string; correlacaoId?: string }[]>(
    'GET',
    `/projetos/${projetoId}/auditoria`,
    200,
  );
  expect(new Set(auditoria.map((entrada) => entrada.tipo))).toEqual(
    new Set([
      'RECOMENDACAO_GERADA',
      'CONVITE_ENVIADO',
      'CONVITE_ACEITO',
      'CONVITE_RECUSADO',
      'SUBSTITUICAO_SOLICITADA',
      'EQUIPE_FORMADA',
    ]),
  );
  expect(auditoria.every((entrada) => entrada.correlacaoId === 'fluxo-demonstracao')).toBe(true);

  const mensagens = await requisitar<{ assunto: string }[]>('GET', '/mensagens/produtor-1', 200);
  expect(mensagens.map((mensagem) => mensagem.assunto)).toEqual(
    expect.arrayContaining([
      'Convite aceito para DIRETOR',
      'Convite recusado para EDITOR',
      'Equipe formada',
    ]),
  );

  const historico = await requisitar<{ rodada: number }[]>(
    'GET',
    `/projetos/${projetoId}/recomendacoes`,
    200,
  );
  expect(new Set(historico.map((recomendacao) => recomendacao.rodada))).toEqual(new Set([1, 2]));

  return projetoId;
}
