-- Inspeksi skema live (read-only). Jalankan di Supabase SQL Editor atau via
-- Management API, lalu gunakan hasilnya untuk menyusun migrasi rekonsiliasi.
-- Tidak membaca isi data pengguna.

-- 1. Policy RLS (public & storage)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- 2. Status RLS per tabel/view
SELECT c.relname, c.relkind, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
ORDER BY 1;

-- 3. Fungsi di schema public (definisi lengkap)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY 1;

-- 4. Trigger (public & auth.users)
SELECT event_object_schema, event_object_table, trigger_name, action_timing,
       event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema IN ('public', 'auth')
ORDER BY 1, 2, 3;

-- 5. Kolom, default, dan constraint
SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY 1, 2;

-- 6. Enum
SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
GROUP BY t.typname;

-- 7. Grant ke anon / authenticated
SELECT table_name, grantee, string_agg(privilege_type, ',') AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
GROUP BY 1, 2 ORDER BY 1, 2;

-- 8. Definisi view / materialized view
SELECT c.relname, c.relkind, pg_get_viewdef(c.oid, true) AS definition
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
ORDER BY 1;

-- 9. EXECUTE grant fungsi public ke anon / authenticated (permukaan RPC)
SELECT p.oid::regprocedure AS function, r.rolname AS grantee
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND r.rolname IN ('anon', 'authenticated')
  AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
ORDER BY 1, 2;

-- 10. Grant storage.objects
SELECT grantee, string_agg(privilege_type, ',') AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'storage' AND table_name = 'objects' AND grantee IN ('anon', 'authenticated')
GROUP BY 1 ORDER BY 1;
