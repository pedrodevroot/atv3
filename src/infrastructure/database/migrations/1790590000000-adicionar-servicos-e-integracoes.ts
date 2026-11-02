import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdicionarServicosEIntegracoes1790590000000 implements MigrationInterface {
  readonly name = 'AdicionarServicosEIntegracoes1790590000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE projeto ADD COLUMN servico_principal jsonb;
      UPDATE projeto p
         SET servico_principal = jsonb_build_object(
           'nome', 'Pacote do projeto',
           'subservicos', COALESCE((
             SELECT jsonb_agg(
               jsonb_build_object(
                 'nome', 'Serviço de ' || r.papel,
                 'papel', r.papel,
                 'custo', 0,
                 'prazoDias', 0,
                 'peso', r.peso
               ) ORDER BY r.ordem)
             FROM requisito_papel r WHERE r.projeto_id = p.id), '[]'::jsonb));
      ALTER TABLE projeto ALTER COLUMN servico_principal SET NOT NULL;

      CREATE TABLE objeto_externo (
        sistema varchar(32) NOT NULL,
        chave text NOT NULL,
        tipo_conteudo varchar(120) NOT NULL,
        conteudo bytea NOT NULL,
        PRIMARY KEY (sistema, chave)
      );

      CREATE TABLE transacao_externa (
        sistema varchar(32) NOT NULL,
        id varchar(64) NOT NULL,
        valor numeric(16,2) NOT NULL CHECK (valor > 0),
        dados jsonb NOT NULL,
        status varchar(20) NOT NULL,
        criada_em timestamptz NOT NULL,
        PRIMARY KEY (sistema, id)
      );

      CREATE TABLE pagamento_membro (
        id varchar(64) PRIMARY KEY,
        projeto_id varchar(64) NOT NULL REFERENCES projeto (id) ON DELETE CASCADE,
        equipe_id varchar(64) NOT NULL,
        papel varchar(32) NOT NULL,
        profissional_id varchar(64) NOT NULL,
        valor numeric(14,2) NOT NULL CHECK (valor > 0),
        provedor varchar(32) NOT NULL,
        criado_em timestamptz NOT NULL,
        cancelado boolean NOT NULL DEFAULT false
      );
      CREATE INDEX ix_pagamento_membro_projeto ON pagamento_membro (projeto_id);
      CREATE UNIQUE INDEX ux_pagamento_membro_ativo
        ON pagamento_membro (equipe_id, papel) WHERE NOT cancelado;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE pagamento_membro;
      DROP TABLE transacao_externa;
      DROP TABLE objeto_externo;
      ALTER TABLE projeto DROP COLUMN servico_principal;
    `);
  }
}
