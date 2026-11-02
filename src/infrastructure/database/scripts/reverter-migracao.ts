import { executarComBanco } from './executar-com-banco.js';

await executarComBanco(async (dataSource) => {
  await dataSource.undoLastMigration({ transaction: 'each' });
  console.info('Última migração revertida.');
});
