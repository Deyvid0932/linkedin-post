#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v app_user="$DB_APP_USER" -v app_password="$DB_APP_PASSWORD" <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT, TEMPORARY ON DATABASE linkedin_automation TO :"app_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
SQL
