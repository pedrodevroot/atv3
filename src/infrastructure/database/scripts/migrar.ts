import { executarComBanco } from './executar-com-banco.js';

await executarComBanco(async (dataSource) => {
  const aplicadas = await dataSource.runMigrations({ transaction: 'each' });
  console.info(
    aplicadas.length === 0
      ? 'Nenhuma migração pendente.'
      : `Migrações aplicadas: ${aplicadas.map((migracao) => migracao.name).join(', ')}`,
  );
});
