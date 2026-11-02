import cluster from 'node:cluster';
import { construirApp } from './app.js';
import { carregarArquivoEnv, carregarConfig } from './config/config.js';
import { criarContainer } from './container.js';
import { agendarVarredura } from './infrastructure/agendamento/varredura-periodica.js';
import { criarLogger } from './infrastructure/logging/opcoes-logger.js';

carregarArquivoEnv();
const config = carregarConfig();
const logger = criarLogger(config);
const container = criarContainer(config, logger);
const app = await construirApp(container, { logger });

const varreduraConvites = agendarVarredura(
  () => container.casos.expirarConvites.executar({}),
  config.convites.varreduraMs,
  (erro) => {
    app.log.warn({ err: erro }, 'Falha ao expirar convites vencidos');
  },
);

app.addHook('onClose', async () => {
  varreduraConvites.parar();
  await container.encerrar();
});

const aquecerCadastro = () => container.cadastroProfissionais.aquecer();

try {
  await container.conexao.garantir();
  if (!(await aquecerCadastro())) {
    container.conexao.reconectarEmSegundoPlano({ aoConectar: aquecerCadastro });
  }
} catch (erro) {
  app.log.warn({ err: erro }, 'Banco indisponível na inicialização; serviço em modo degradado');
  container.conexao.reconectarEmSegundoPlano({
    aoConectar: async () => {
      const aquecido = await aquecerCadastro();
      if (aquecido) {
        app.log.info('Conexão com o banco restabelecida');
      }
      return aquecido;
    },
  });
}

await app.listen({ host: config.servidor.host, port: config.servidor.porta });

const tomada = cluster.worker?.id ?? 1;
app.log.info({ cena: 1, tomada }, `🎬 Cena 1, tomada ${tomada}: CineBridge no ar!`);

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sinal, () => {
    app.log.info({ sinal }, 'Encerrando serviço');
    void app.close().then(() => process.exit(0));
  });
}
