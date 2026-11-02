import { criarSemeadores } from '../seeds/index.js';
import { executarComBanco } from './executar-com-banco.js';

await executarComBanco(async (dataSource) => {
  const semeadores = criarSemeadores({
    totalProfissionais: Number(process.env.SEED_PROFISSIONAIS ?? 10_000),
    semente: Number(process.env.SEED_SEMENTE ?? 2026),
  });
  for (const semeador of semeadores) {
    const inicio = performance.now();
    const registros = await semeador.executar(dataSource);
    const duracao = Math.round(performance.now() - inicio);
    console.info(`${semeador.nome}: ${registros} registros em ${duracao} ms`);
  }
});
