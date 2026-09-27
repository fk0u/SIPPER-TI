#!/usr/bin/env bash
# Menguji migrasi & RLS pada PostgreSQL biasa (tanpa Supabase).
# Pemakaian: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-rls.sh
set -euo pipefail
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
cd "$(dirname "$0")/.."

DB="${RLS_TEST_DB:-sipper_rls_test}"
psql -q -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

run -f supabase/tests/00_supabase_shim.sql
run -f supabase/migrations/20260921_initial_schema.sql
run -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role; GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;"
for f in supabase/migrations/*.sql; do
  [ "$f" = supabase/migrations/20260921_initial_schema.sql ] || run -f "$f"
done

OUT=$(psql -d "$DB" -q -f supabase/tests/rls_test.sql 2>&1)
echo "$OUT"

# Ekspektasi: jumlah ERROR dan hasil akhir status baris
expected_errors=8
actual_errors=$(grep -c "ERROR:" <<<"$OUT" || true)
if [ "$actual_errors" -ne "$expected_errors" ]; then
  echo "FAIL: diharapkan $expected_errors ERROR, didapat $actual_errors" >&2
  exit 1
fi
grep -q "e0000000-0000-0000-0000-000000000002 | pending  | f | f" <<<"$OUT" || { echo "FAIL: status akhir tidak sesuai" >&2; exit 1; }
grep -q "^ expired" <<<"$OUT" || { echo "FAIL: token kedaluwarsa tidak ditolak" >&2; exit 1; }
echo "RLS tests passed"
