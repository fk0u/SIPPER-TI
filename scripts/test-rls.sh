#!/usr/bin/env bash
# Menguji migrasi & RLS pada PostgreSQL biasa (tanpa Supabase).
# Pemakaian: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-rls.sh
set -euo pipefail
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
cd "$(dirname "$0")/.."

DB="${RLS_TEST_DB:-sipper_rls_test}"
if [[ ! "$DB" =~ ^[a-z_][a-z0-9_]*$ ]]; then
  echo "RLS_TEST_DB tidak valid: $DB" >&2
  exit 1
fi
# Variabel psql (:"db") hanya diekspansi dari stdin/file, bukan dari -c.
printf '%s\n' 'DROP DATABASE IF EXISTS :"db";' 'CREATE DATABASE :"db";' \
  | psql -q -v ON_ERROR_STOP=1 -d postgres -v db="$DB"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

run -f supabase/tests/00_supabase_shim.sql
run -f supabase/migrations/20260921_initial_schema.sql
run -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role; GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;"

# Simulasi database live yang punya policy/RPC longgar di luar repo
run <<'SQL'
CREATE POLICY legacy_loose_update ON public.leave_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY legacy_public_proofs ON storage.objects FOR SELECT USING (bucket_id = 'permit-proofs');
CREATE FUNCTION public.approve_leave_request(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$ UPDATE public.leave_requests SET status = 'approved' WHERE id = p_id $$;
GRANT EXECUTE ON FUNCTION public.approve_leave_request(uuid) TO authenticated;
SQL

for f in supabase/migrations/*.sql; do
  [ "$f" = supabase/migrations/20260921_initial_schema.sql ] || run -f "$f"
done

status=0
OUT=$(psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rls_test.sql 2>&1) || status=$?
echo "$OUT"
if [ "$status" -ne 0 ]; then
  echo "RLS test script error (exit $status)" >&2
  exit 1
fi

# Jumlah assertion yang diharapkan dihitung dari file uji, sehingga eksekusi yang
# terpotong (lebih sedikit PASS) tetap dianggap gagal.
expected=$(grep -cE "^SELECT pg_temp\.expect_(rows|error|value)\(" supabase/tests/rls_test.sql)
pass=$(grep -c '^PASS ' <<<"$OUT" || true)
fail=$(grep -c '^FAIL ' <<<"$OUT" || true)
echo "== $pass lulus, $fail gagal (diharapkan $expected)"
if [ "$fail" -ne 0 ] || [ "$pass" -ne "$expected" ]; then
  echo "RLS tests failed" >&2
  exit 1
fi
echo "RLS tests passed"
