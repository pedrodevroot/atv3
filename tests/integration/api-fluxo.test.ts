import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';
import { criarLogger } from '../../src/infrastructure/logging/opcoes-logger.js';
import { RepositorioProfissionaisTypeorm } from '../../src/infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { StatusMembro } from '../../src/domain/enums/status.js';
import { cadastroDaApi, corpoProjetoDemonstracao } from '../fixtures/api.js';
import { executarFluxoCompleto } from '../fixtures/fluxo-api.js';
import { relogioFixo } from '../fixtures/orquestracao.js';
import { limparTabelas, prepararBanco } from './banco.js';

describe('Fluxo completo da API com PostgreSQL real', () => {
  let banco: DataSource;
  let container: Container;
  let app: App;

  beforeAll(async () => {
    banco = await prepararBanco();
    await limparTabelas(banco);
    await new RepositorioProfissionaisTypeorm(banco).salvarTodos(cadastroDaApi());
    const config = carregarConfig();
    container = criarContainer(config, criarLogger(config), { relogio: relogioFixo });
    await container.dataSource.initialize();
    app = await construirApp(container);
  });

  afterAll(async () => {
    await app.close();
    await container.encerrar();
    await banco.destroy();
  });

  it('não perde a confirmação do observador quando o produtor age logo em seguida', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/projetos',
      payload: corpoProjetoDemonstracao(),
    });
    const { projeto } = criado.json<{ projeto: { id: string; equipes: { id: string }[] } }>();
    const base = `/projetos/${projeto.id}/equipes/${projeto.equipes[0]?.id ?? ''}/membros`;
    const aceite = await app.inject({ method: 'POST', url: `${base}/DIRETOR/aceite` });
    const conviteId = aceite.json<{ convite: { id: string } }>().convite.id;

    await app.inject({
      method: 'POST',
      url: `/convites/${conviteId}/resposta`,
      payload: { aceito: true },
    });
    const editor = await app.inject({ method: 'POST', url: `${base}/EDITOR/aceite` });
    await container.barramento.aguardarEntregas();

    const final = await container.repositorioProjetos.obter(projeto.id);
    const equipe = final?.equipe(projeto.equipes[0]?.id ?? '');
    expect(editor.statusCode).toBe(201);
    expect(equipe?.membro(Papel.DIRETOR)?.status).toBe(StatusMembro.CONFIRMADO);
    expect(equipe?.membro(Papel.EDITOR)?.status).toBe(StatusMembro.CONVIDADO);
  });

  it('persiste cada passo do fluxo e publica a equipe formada para os outros microsserviços', async () => {
    const projetoId = await executarFluxoCompleto(app, () =>
      container.barramento.aguardarEntregas(),
    );

    const projeto = await container.repositorioProjetos.obter(projetoId);
    const [convites] = await banco.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM convite WHERE projeto_id = $1',
      [projetoId],
    );

    expect(projeto?.equipeFormada).toBeDefined();
    expect(Number(convites?.total)).toBe(3);
    expect(container.canais.publicador.publicadas.total).toBe(2);
  });
});
