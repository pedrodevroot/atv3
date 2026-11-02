import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarOrdemEquipe1790550000000 implements MigrationInterface {
  readonly name = 'AdicionarOrdemEquipe1790550000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE equipe ADD COLUMN ordem integer NOT NULL DEFAULT 0;
      DROP INDEX ix_equipe_projeto;
      CREATE INDEX ix_equipe_projeto ON equipe (projeto_id, ordem);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX ix_equipe_projeto;
      ALTER TABLE equipe DROP COLUMN ordem;
      CREATE INDEX ix_equipe_projeto ON equipe (projeto_id);
    `);
  }
}
