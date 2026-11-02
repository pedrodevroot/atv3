import type { DataSource } from 'typeorm';
import { carregarArquivoEnv, carregarConfig } from '../../../config/config.js';
import { criarDataSource, garantirSchema } from '../data-source.js';

export async function executarComBanco(tarefa: (dataSource: DataSource) => Promise<void>) {
  carregarArquivoEnv();
  const { banco } = carregarConfig();
  const dataSource = criarDataSource(banco);
  try {
    await dataSource.initialize();
    await garantirSchema(dataSource, banco.schema);
    await tarefa(dataSource);
  } catch (erro) {
    console.error(erro);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}
