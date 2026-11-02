import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import { carregarArquivoEnv, carregarConfig } from './config/config.js';
import { criarLogger } from './infrastructure/logging/opcoes-logger.js';

carregarArquivoEnv();
const trabalhadores = Math.max(1, Number(process.env.WEB_CONCURRENCY ?? availableParallelism()));

if (cluster.isPrimary && trabalhadores > 1) {
  cluster.schedulingPolicy = cluster.SCHED_RR;
  const config = carregarConfig();
  const logger = criarLogger(config);
  const ambienteTrabalhador = {
    DB_POOL_MAX: String(Math.max(2, Math.floor(config.banco.poolMaximo / trabalhadores))),
  };
  let encerrando = false;

  for (let indice = 0; indice < trabalhadores; indice += 1) {
    cluster.fork(ambienteTrabalhador);
  }
  logger.info(
    { trabalhadores, conexoesPorTrabalhador: ambienteTrabalhador.DB_POOL_MAX },
    'Cluster iniciado',
  );

  cluster.on('exit', (trabalhador, codigo, sinal) => {
    if (!encerrando) {
      logger.warn({ pid: trabalhador.process.pid, codigo, sinal }, 'Trabalhador caiu; reiniciando');
      cluster.fork(ambienteTrabalhador);
    }
  });

  for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(sinal, () => {
      encerrando = true;
      for (const trabalhador of Object.values(cluster.workers ?? {})) {
        trabalhador?.kill('SIGTERM');
      }
    });
  }
} else {
  await import('./server.js');
}
