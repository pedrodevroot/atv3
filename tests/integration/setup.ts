import { carregarArquivoEnv } from '../../src/config/config.js';

carregarArquivoEnv();
process.env.NODE_ENV = 'test';
process.env.DB_SCHEMA ??= 'teste_integracao';
