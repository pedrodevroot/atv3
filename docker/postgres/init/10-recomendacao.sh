#!/bin/sh
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v usuario="$RECOMENDACAO_DB_USER" \
  -v senha="$RECOMENDACAO_DB_PASSWORD" \
  -v banco="$RECOMENDACAO_DB_NAME" <<'SQL'
CREATE ROLE :"usuario" WITH LOGIN PASSWORD :'senha';
CREATE DATABASE :"banco" OWNER :"usuario";
REVOKE ALL ON DATABASE :"banco" FROM PUBLIC;
SQL
