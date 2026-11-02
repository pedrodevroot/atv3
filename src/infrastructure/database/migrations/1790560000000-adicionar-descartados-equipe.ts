import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarDescartadosEquipe1790560000000 implements MigrationInterface {
  readonly name = 'AdicionarDescartadosEquipe1790560000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE equipe ADD COLUMN descartados text[] NOT NULL DEFAULT '{}'",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE equipe DROP COLUMN descartados');
  }
}
