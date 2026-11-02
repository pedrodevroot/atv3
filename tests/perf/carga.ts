import { readFileSync } from 'node:fs';
import autocannon from 'autocannon';

const url = process.env.PERF_URL ?? 'http://localhost:3000/health';
const metodo = (process.env.PERF_METODO ?? 'GET') as autocannon.Request['method'];
const corpo = process.env.PERF_CORPO ? readFileSync(process.env.PERF_CORPO, 'utf8') : undefined;
const conexoes = Number(process.env.PERF_CONEXOES ?? 100);
const quantidade = process.env.PERF_QUANTIDADE ? Number(process.env.PERF_QUANTIDADE) : undefined;
const duracao = Number(process.env.PERF_DURACAO ?? 10);
const limiteMs = Number(process.env.PERF_LIMITE_MS ?? 2000);
const percentilLimite = (process.env.PERF_PERCENTIL ?? 'p99') as 'p90' | 'p97_5' | 'p99' | 'max';

const resultado = await autocannon({
  url,
  method: metodo,
  connections: conexoes,
  ...(quantidade === undefined ? { duration: duracao } : { amount: quantidade }),
  headers: { 'content-type': 'application/json' },
  ...(corpo === undefined ? {} : { body: corpo }),
});

const resumo = {
  url,
  metodo,
  conexoes,
  modo: quantidade === undefined ? `sustentado por ${duracao} s` : `rajada de ${quantidade}`,
  requisicoes: resultado.requests.total,
  requisicoesPorSegundo: resultado.requests.average,
  latenciaMediaMs: resultado.latency.average,
  latenciaP50Ms: resultado.latency.p50,
  latenciaP90Ms: resultado.latency.p90,
  latenciaP97_5Ms: resultado.latency.p97_5,
  latenciaP99Ms: resultado.latency.p99,
  latenciaMaximaMs: resultado.latency.max,
  erros: resultado.errors,
  timeouts: resultado.timeouts,
  respostasNao2xx: resultado.non2xx,
  criterio: `${percentilLimite} < ${limiteMs} ms`,
};

console.table(resumo);

const aprovado =
  resultado.latency[percentilLimite] < limiteMs &&
  resultado.errors === 0 &&
  resultado.timeouts === 0 &&
  resultado.non2xx === 0;

console.info(aprovado ? 'APROVADO' : 'REPROVADO');
process.exitCode = aprovado ? 0 : 1;
