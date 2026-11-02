import type { DataSource } from 'typeorm';
import type { VerificadorDependencia } from '../../application/ports/verificador-dependencia.js';
import { comTempoLimite } from '../resiliencia/disjuntor.js';
import { ConexaoBanco } from './conexao-banco.js';

export class VerificadorBanco implements VerificadorDependencia {
  readonly nome = 'postgres';

  constructor(
    private readonly dataSource: DataSource,
    private readonly limiteMs = 1_000,
    private readonly conexao = new ConexaoBanco(dataSource),
  ) {}

  async verificar(): Promise<boolean> {
    try {
      await comTempoLimite(this.consultar(), this.limiteMs, 'Verificação do PostgreSQL');
      return true;
    } catch {
      return false;
    }
  }

  private async consultar(): Promise<void> {
    await this.conexao.garantir();
    await this.dataSource.query('SELECT 1');
  }
}
