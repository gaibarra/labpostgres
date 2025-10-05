#!/usr/bin/env bash
set -euo pipefail

echo "[initMaster] Iniciando creación/actualización de base master"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Cargar .env si existe
if [ -f "$ROOT_DIR/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ROOT_DIR/.env" | grep -E '^[A-Za-z0-9_]+=' | xargs -0 -I{} bash -c 'echo {}' 2>/dev/null || true)
fi

DB_NAME="${MASTER_PGDATABASE:-${MASTER_DB:-lab_master}}"
DB_HOST="${MASTER_PGHOST:-${PGHOST:-127.0.0.1}}"
DB_PORT="${MASTER_PGPORT:-${PGPORT:-5432}}"
DB_USER="${MASTER_PGUSER:-${PGUSER:-postgres}}"
DB_PASS="${MASTER_PGPASSWORD:-${PGPASSWORD:-}}"

export PGPASSWORD="$DB_PASS"

if ! command -v psql >/dev/null 2>&1; then
  echo "[initMaster] ERROR: psql no encontrado en PATH" >&2
  exit 1
fi

echo "[initMaster] Verificando existencia de DB '$DB_NAME'..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  echo "[initMaster] DB ya existe"
else
  echo "[initMaster] Creando DB '$DB_NAME'"
  createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
fi

SCHEMA_FILE="$ROOT_DIR/sql/20251001_create_tenant_master_schema.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
  echo "[initMaster] ERROR: No se encuentra $SCHEMA_FILE" >&2
  exit 1
fi

echo "[initMaster] Aplicando esquema master ($SCHEMA_FILE)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"

echo "[initMaster] Verificando tablas esenciales"
REQ_TABLES=(tenants tenant_admins tenant_events)
missing=0
for tbl in "${REQ_TABLES[@]}"; do
  if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='${tbl}'" | grep -q 1; then
    echo "[initMaster] FALTA tabla: $tbl" >&2
    missing=1
  fi
done
if [ $missing -eq 1 ]; then
  echo "[initMaster] ERROR: Tablas faltantes. Revisar errores previos." >&2
  exit 1
fi

echo "[initMaster] OK. Base master lista: $DB_NAME"