import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarDetalhesProjeto1790580000000 implements MigrationInterface {
  readonly name = 'AdicionarDetalhesProjeto1790580000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projeto ADD COLUMN detalhes jsonb NOT NULL DEFAULT '{}'::jsonb;
      UPDATE projeto
         SET detalhes = jsonb_build_object('tema', titulo, 'entrevistados', '[]'::jsonb)
       WHERE tipo_captacao = 'DOCUMENTARIO';
      UPDATE projeto
         SET detalhes = jsonb_build_object('tecnica', '2D', 'softwares', '[]'::jsonb, 'quadrosPorSegundo', 24)
       WHERE tipo_captacao = 'ANIMACAO';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE projeto DROP COLUMN detalhes');
  }
}
