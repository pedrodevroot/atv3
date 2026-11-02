import type { MigrationInterface, QueryRunner } from 'typeorm';

const CRIAR = `
CREATE TABLE profissional (
  id varchar(64) PRIMARY KEY,
  nome varchar(200) NOT NULL,
  especialidades text[] NOT NULL CHECK (cardinality(especialidades) > 0),
  preco_minimo numeric(14,2) NOT NULL CHECK (preco_minimo >= 0),
  preco_maximo numeric(14,2) NOT NULL,
  cidade varchar(120) NOT NULL,
  uf char(2) NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  ativo boolean NOT NULL DEFAULT true,
  nota_media numeric(3,2) NOT NULL DEFAULT 0,
  total_avaliacoes integer NOT NULL DEFAULT 0,
  CONSTRAINT ck_profissional_faixa_preco CHECK (preco_maximo >= preco_minimo)
);
CREATE INDEX ix_profissional_especialidades ON profissional USING gin (especialidades);
CREATE INDEX ix_profissional_preco_ativos ON profissional (preco_minimo) WHERE ativo;
CREATE INDEX ix_profissional_nota ON profissional (nota_media DESC, total_avaliacoes DESC);

CREATE TABLE competencia (
  id bigserial PRIMARY KEY,
  profissional_id varchar(64) NOT NULL REFERENCES profissional (id) ON DELETE CASCADE,
  nome varchar(120) NOT NULL,
  nivel smallint NOT NULL CHECK (nivel BETWEEN 1 AND 5)
);
CREATE INDEX ix_competencia_profissional ON competencia (profissional_id);

CREATE TABLE avaliacao (
  id varchar(64) PRIMARY KEY,
  profissional_id varchar(64) NOT NULL REFERENCES profissional (id) ON DELETE CASCADE,
  nota numeric(2,1) NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario text NOT NULL DEFAULT '',
  data timestamptz NOT NULL,
  produtor_id varchar(64) NOT NULL,
  projeto_id varchar(64) NOT NULL,
  papel varchar(32) NOT NULL,
  genero varchar(80) NOT NULL,
  tipo_captacao varchar(20) NOT NULL
);
CREATE INDEX ix_avaliacao_profissional ON avaliacao (profissional_id);

CREATE TABLE participacao_projeto (
  id bigserial PRIMARY KEY,
  profissional_id varchar(64) NOT NULL REFERENCES profissional (id) ON DELETE CASCADE,
  projeto_id varchar(64) NOT NULL,
  titulo varchar(200) NOT NULL,
  papel varchar(32) NOT NULL,
  genero varchar(80) NOT NULL,
  tipo_captacao varchar(20) NOT NULL,
  ano smallint NOT NULL
);
CREATE INDEX ix_participacao_profissional ON participacao_projeto (profissional_id);

CREATE TABLE disponibilidade (
  id bigserial PRIMARY KEY,
  profissional_id varchar(64) NOT NULL REFERENCES profissional (id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  CONSTRAINT ck_disponibilidade_periodo CHECK (inicio <= fim)
);
CREATE INDEX ix_disponibilidade_periodo ON disponibilidade (profissional_id, inicio, fim);

CREATE TABLE projeto (
  id varchar(64) PRIMARY KEY,
  titulo varchar(200) NOT NULL,
  produtor_id varchar(64) NOT NULL,
  genero varchar(80) NOT NULL,
  tipo_captacao varchar(20) NOT NULL,
  duracao_minutos integer NOT NULL CHECK (duracao_minutos > 0),
  orcamento numeric(14,2) NOT NULL CHECK (orcamento > 0),
  data_inicio timestamptz NOT NULL,
  data_entrega timestamptz NOT NULL,
  cidade varchar(120) NOT NULL,
  uf char(2) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  estrategia varchar(64) NOT NULL,
  criado_em timestamptz NOT NULL,
  CONSTRAINT ck_projeto_periodo CHECK (data_entrega > data_inicio)
);
CREATE INDEX ix_projeto_produtor ON projeto (produtor_id);

CREATE TABLE requisito_papel (
  projeto_id varchar(64) NOT NULL REFERENCES projeto (id) ON DELETE CASCADE,
  papel varchar(32) NOT NULL,
  peso numeric(4,2) NOT NULL CHECK (peso > 0),
  ordem smallint NOT NULL,
  PRIMARY KEY (projeto_id, papel)
);

CREATE TABLE equipe (
  id varchar(64) PRIMARY KEY,
  projeto_id varchar(64) NOT NULL REFERENCES projeto (id) ON DELETE CASCADE,
  estrategia varchar(64) NOT NULL,
  status varchar(20) NOT NULL,
  rodada integer NOT NULL CHECK (rodada >= 1),
  criada_em timestamptz NOT NULL
);
CREATE INDEX ix_equipe_projeto ON equipe (projeto_id);

CREATE TABLE membro_equipe (
  equipe_id varchar(64) NOT NULL REFERENCES equipe (id) ON DELETE CASCADE,
  papel varchar(32) NOT NULL,
  profissional_id varchar(64) NOT NULL REFERENCES profissional (id) ON DELETE CASCADE,
  custo numeric(14,2) NOT NULL CHECK (custo >= 0),
  score double precision NOT NULL CHECK (score BETWEEN 0 AND 1),
  status varchar(20) NOT NULL,
  ordem smallint NOT NULL,
  PRIMARY KEY (equipe_id, papel)
);
CREATE INDEX ix_membro_profissional ON membro_equipe (profissional_id);

CREATE TABLE recomendacao (
  id varchar(64) PRIMARY KEY,
  projeto_id varchar(64) NOT NULL REFERENCES projeto (id) ON DELETE CASCADE,
  equipe_id varchar(64),
  papel varchar(32) NOT NULL,
  profissional_id varchar(64) NOT NULL,
  score double precision NOT NULL,
  posicao integer NOT NULL,
  estrategia varchar(64) NOT NULL,
  rodada integer NOT NULL,
  justificativa text NOT NULL,
  criada_em timestamptz NOT NULL
);
CREATE INDEX ix_recomendacao_projeto ON recomendacao (projeto_id, rodada, papel, posicao);

CREATE TABLE convite (
  id varchar(64) PRIMARY KEY,
  projeto_id varchar(64) NOT NULL REFERENCES projeto (id) ON DELETE CASCADE,
  equipe_id varchar(64) NOT NULL,
  papel varchar(32) NOT NULL,
  profissional_id varchar(64) NOT NULL,
  produtor_id varchar(64) NOT NULL,
  status varchar(20) NOT NULL,
  criado_em timestamptz NOT NULL,
  expira_em timestamptz NOT NULL,
  respondido_em timestamptz
);
CREATE INDEX ix_convite_equipe ON convite (equipe_id, papel, status);
CREATE INDEX ix_convite_profissional ON convite (profissional_id, status);

CREATE TABLE auditoria (
  id bigserial PRIMARY KEY,
  evento_id varchar(64) NOT NULL,
  tipo varchar(40) NOT NULL,
  ocorrido_em timestamptz NOT NULL,
  origem varchar(64) NOT NULL,
  correlacao_id varchar(64),
  projeto_id varchar(64) NOT NULL,
  ator_id varchar(64) NOT NULL,
  tipo_ator varchar(20) NOT NULL,
  dados jsonb NOT NULL
);
CREATE INDEX ix_auditoria_projeto ON auditoria (projeto_id, ocorrido_em);
CREATE INDEX ix_auditoria_tipo ON auditoria (tipo, ocorrido_em);

CREATE TABLE mensagem_interna (
  id bigserial PRIMARY KEY,
  destinatario_id varchar(64) NOT NULL,
  tipo_destinatario varchar(20) NOT NULL,
  assunto varchar(200) NOT NULL,
  corpo text NOT NULL,
  evento_id varchar(64) NOT NULL,
  criada_em timestamptz NOT NULL DEFAULT now(),
  lida boolean NOT NULL DEFAULT false
);
CREATE INDEX ix_mensagem_destinatario ON mensagem_interna (destinatario_id, criada_em DESC);
`;

const REMOVER = `
DROP TABLE IF EXISTS mensagem_interna;
DROP TABLE IF EXISTS auditoria;
DROP TABLE IF EXISTS convite;
DROP TABLE IF EXISTS recomendacao;
DROP TABLE IF EXISTS membro_equipe;
DROP TABLE IF EXISTS equipe;
DROP TABLE IF EXISTS requisito_papel;
DROP TABLE IF EXISTS projeto;
DROP TABLE IF EXISTS disponibilidade;
DROP TABLE IF EXISTS participacao_projeto;
DROP TABLE IF EXISTS avaliacao;
DROP TABLE IF EXISTS competencia;
DROP TABLE IF EXISTS profissional;
`;

export class CriarEsquemaInicial1790540000000 implements MigrationInterface {
  readonly name = 'CriarEsquemaInicial1790540000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CRIAR);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(REMOVER);
  }
}
