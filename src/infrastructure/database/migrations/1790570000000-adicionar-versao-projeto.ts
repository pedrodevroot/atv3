import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarVersaoProjeto1790570000000 implements MigrationInterface {
  readonly name = 'AdicionarVersaoProjeto1790570000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE projeto ADD COLUMN versao integer NOT NULL DEFAULT 0');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE projeto DROP COLUMN versao');
  }
}
