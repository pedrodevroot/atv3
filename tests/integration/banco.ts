import type { DataSource } from 'typeorm';
import { carregarConfig } from '../../src/config/config.js';
import { criarDataSource, garantirSchema } from '../../src/infrastructure/database/data-source.js';
import { entidades } from '../../src/infrastructure/database/schemas/index.js';

export async function prepararBanco(): Promise<DataSource> {
  const { banco } = carregarConfig();
  const dataSource = criarDataSource(banco);
  await dataSource.initialize();
  await garantirSchema(dataSource, banco.schema);
  await dataSource.runMigrations({ transaction: 'each' });
  return dataSource;
}

export async function limparTabelas(dataSource: DataSource): Promise<void> {
  const tabelas = entidades.map((schema) => schema.options.tableName ?? schema.options.name);
  await dataSource.query(`TRUNCATE ${tabelas.join(', ')} RESTART IDENTITY CASCADE`);
}
