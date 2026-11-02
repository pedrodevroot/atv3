import { criarSemeadores } from '../seeds/index.js';
import { executarComBanco } from './executar-com-banco.js';

await executarComBanco(async (dataSource) => {
  const aplicadas = await dataSource.runMigrations({ transaction: 'each' });
  console.info(`Migrações aplicadas: ${aplicadas.length}`);

  if (process.env.SEED_AO_INICIAR === 'false') {
    console.info('Seed automático desligado (SEED_AO_INICIAR=false).');
    return;
  }
  const [linha] = await dataSource.query<{ total: string }[]>(
    'SELECT count(*) AS total FROM profissional',
  );
  if (Number(linha?.total ?? 0) > 0) {
    console.info(`Cadastro já possui ${linha?.total ?? '0'} profissionais; seed ignorado.`);
    return;
  }
  for (const semeador of criarSemeadores({
    totalProfissionais: Number(process.env.SEED_PROFISSIONAIS ?? 10_000),
    semente: Number(process.env.SEED_SEMENTE ?? 2026),
  })) {
    const registros = await semeador.executar(dataSource);
    console.info(`Seed ${semeador.nome}: ${registros} registros.`);
  }
});
