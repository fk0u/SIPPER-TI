-- Uji perilaku RLS & trigger. Jalankan lewat scripts/test-rls.sh.
-- Setiap pemeriksaan mencetak satu baris "PASS <nama>" atau "FAIL <nama> ...".
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned

-- ---------------------------------------------------------------------------
-- Helper assertion (schema pg_temp: hanya hidup selama sesi uji)
-- ---------------------------------------------------------------------------
CREATE FUNCTION pg_temp.expect_rows(name text, stmt text, expected int) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN CASE WHEN n = expected THEN 'PASS ' || name
                ELSE format('FAIL %s (rows=%s, expected=%s)', name, n, expected) END;
EXCEPTION WHEN others THEN
    RETURN format('FAIL %s (error: %s)', name, SQLERRM);
END $$;

CREATE FUNCTION pg_temp.expect_error(name text, stmt text, pattern text) RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE stmt;
    RETURN format('FAIL %s (no error)', name);
EXCEPTION WHEN others THEN
    RETURN CASE WHEN SQLERRM ~* pattern THEN 'PASS ' || name
                ELSE format('FAIL %s (unexpected error: %s)', name, SQLERRM) END;
END $$;

CREATE FUNCTION pg_temp.expect_value(name text, query text, expected text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
    EXECUTE query INTO v;
    RETURN CASE WHEN v IS NOT DISTINCT FROM expected THEN 'PASS ' || name
                ELSE format('FAIL %s (got=%s, expected=%s)', name, v, expected) END;
EXCEPTION WHEN others THEN
    RETURN format('FAIL %s (error: %s)', name, SQLERRM);
END $$;


CREATE FUNCTION pg_temp.act_as(uid text) RETURNS void LANGUAGE sql AS $$
    SELECT set_config('request.jwt.claims',
        CASE WHEN uid IS NULL THEN '' ELSE json_build_object('sub', uid, 'role', 'authenticated')::text END,
        false);
$$;

-- ---------------------------------------------------------------------------
-- Seed (sebagai superuser, tanpa JWT)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('a0000000-0000-0000-0000-000000000001', 'rian.pratama@umkt.ac.id', '{"full_name":"Rian"}'),
 ('a0000000-0000-0000-0000-000000000002', 'sarah.amalia@umkt.ac.id', '{"full_name":"Sarah"}'),
 ('a0000000-0000-0000-0000-000000000003', 'budi.santoso@umkt.ac.id', '{"full_name":"Budi"}'),
 ('a0000000-0000-0000-0000-000000000004', 'dinda@umkt.ac.id', '{}');
UPDATE profiles SET role = 'sipen' WHERE id = 'a0000000-0000-0000-0000-000000000002';
UPDATE profiles SET role = 'km' WHERE id = 'a0000000-0000-0000-0000-000000000003';
INSERT INTO courses (id, code, name, lecturer_name, day_of_week, start_time, end_time) VALUES
 ('c1111111-1111-1111-1111-111111111111', 'TI-401', 'Cloud', 'Hendra', 'Senin', '08:00', '10:00'),
 ('c2222222-2222-2222-2222-222222222222', 'TI-402', 'ML', 'Nurul', 'Selasa', '08:00', '10:00');
INSERT INTO course_sipen (user_id, course_id) VALUES
 ('a0000000-0000-0000-0000-000000000002', 'c1111111-1111-1111-1111-111111111111');
INSERT INTO lecturer_tokens (token, course_id, label) VALUES
 ('tok-ok', 'c1111111-1111-1111-1111-111111111111', 'ok'),
 ('tok-exp', NULL, 'exp'),
 ('tok-anon', NULL, 'anon');
UPDATE lecturer_tokens SET expires_at = now() - interval '1 day' WHERE token = 'tok-exp';

-- ---------------------------------------------------------------------------
-- Registrasi (trigger handle_new_user)
-- ---------------------------------------------------------------------------
SELECT pg_temp.expect_error('signup non-UMKT ditolak',
    $q$INSERT INTO auth.users (email) VALUES ('x@gmail.com')$q$, 'umkt');
SELECT pg_temp.expect_rows('signup NIM email',
    $q$INSERT INTO auth.users (id, email) VALUES ('a0000000-0000-0000-0000-000000000098', '2311102441198@umkt.ac.id')$q$, 1);
SELECT pg_temp.expect_value('NIM diturunkan dari email',
    $q$SELECT nim FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000098'$q$, '2311102441198');
SELECT pg_temp.expect_rows('signup dengan metadata NIM orang lain',
    $q$INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('a0000000-0000-0000-0000-000000000099', 'penyusup@umkt.ac.id', '{"nim":"2311102441198"}')$q$, 1);
SELECT pg_temp.expect_value('metadata NIM diabaikan',
    $q$SELECT (nim LIKE 'P-%')::text FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000099'$q$, 'true');

-- ---------------------------------------------------------------------------
-- Mahasiswa (Rian)
-- ---------------------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000001');

SELECT pg_temp.expect_error('mahasiswa ubah role sendiri',
    $q$UPDATE profiles SET role = 'km' WHERE id = auth.uid()$q$, 'administrator');
SELECT pg_temp.expect_error('mahasiswa set is_password_changed sendiri',
    $q$UPDATE profiles SET is_password_changed = true WHERE id = auth.uid()$q$, 'sistem');
SELECT pg_temp.expect_rows('mahasiswa ubah telepon sendiri',
    $q$UPDATE profiles SET phone = '0811' WHERE id = auth.uid()$q$, 1);
SELECT pg_temp.expect_rows('mahasiswa tidak bisa ubah profil orang lain',
    $q$UPDATE profiles SET phone = '0811' WHERE id = 'a0000000-0000-0000-0000-000000000004'$q$, 0);
SELECT pg_temp.expect_error('mahasiswa baca email teman',
    $q$SELECT email FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000004'$q$, 'permission denied');
SELECT pg_temp.expect_rows('mahasiswa baca kolom direktori',
    $q$SELECT id, nim, full_name, role FROM profiles$q$, 6);
SELECT pg_temp.expect_value('get_my_profile mengembalikan email sendiri',
    $q$SELECT email FROM get_my_profile()$q$, 'rian.pratama@umkt.ac.id');

SELECT pg_temp.expect_error('mahasiswa insert izin approved',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, status, created_by)
       VALUES (auth.uid(), 'c1111111-1111-1111-1111-111111111111', 'sakit', '2026-09-21', '2026-09-21', 'x', 'approved', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_error('mahasiswa proxy untuk orang lain',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('a0000000-0000-0000-0000-000000000004', 'c1111111-1111-1111-1111-111111111111', 'sakit', '2026-09-21', '2026-09-21', 'x', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_rows('mahasiswa ajukan izin sendiri (pending)',
    $q$INSERT INTO leave_requests (id, student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('e0000000-0000-0000-0000-000000000001', auth.uid(), 'c1111111-1111-1111-1111-111111111111', 'sakit', '2026-09-21', '2026-09-21', 'x', auth.uid())$q$, 1);
SELECT pg_temp.expect_rows('mahasiswa setujui izin sendiri',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid()$q$, 0);
SELECT pg_temp.expect_error('mahasiswa buat token dosen',
    $q$INSERT INTO lecturer_tokens (label, created_by) VALUES ('hack', auth.uid())$q$, 'row-level security');
SELECT pg_temp.expect_rows('upload ke folder sendiri',
    $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('permit-proofs', 'a0000000-0000-0000-0000-000000000001/f.jpg')$q$, 1);
SELECT pg_temp.expect_error('upload ke folder orang lain',
    $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('permit-proofs', 'a0000000-0000-0000-0000-000000000004/f.jpg')$q$,
    'row-level security');

-- Password diganti lewat Supabase Auth (tanpa JWT) → flag diperbarui trigger
RESET ROLE;
SELECT pg_temp.act_as(NULL);
UPDATE auth.users SET encrypted_password = 'hash-baru' WHERE id = 'a0000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_value('flag password diperbarui saat password auth berubah',
    $q$SELECT is_password_changed::text FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000001'$q$, 'true');

-- Lampiran dirujuk oleh izin → tidak boleh dihapus pemilik
UPDATE leave_requests SET file_urls = '[{"path":"a0000000-0000-0000-0000-000000000001/f.jpg"}]'
    WHERE id = 'e0000000-0000-0000-0000-000000000001';
INSERT INTO storage.objects (bucket_id, name) VALUES ('permit-proofs', 'a0000000-0000-0000-0000-000000000001/draft.jpg');
SET ROLE authenticated;
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_rows('hapus bukti yang sudah dirujuk',
    $q$DELETE FROM storage.objects WHERE name = 'a0000000-0000-0000-0000-000000000001/f.jpg'$q$, 0);
SELECT pg_temp.expect_rows('hapus berkas draf sendiri',
    $q$DELETE FROM storage.objects WHERE name = 'a0000000-0000-0000-0000-000000000001/draft.jpg'$q$, 1);

-- ---------------------------------------------------------------------------
-- Sipen (Sarah, matkul Cloud)
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
SELECT pg_temp.expect_rows('sipen proxy di matkulnya',
    $q$INSERT INTO leave_requests (id, student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'c1111111-1111-1111-1111-111111111111', 'sakit', '2026-09-21', '2026-09-21', 'x', auth.uid())$q$, 1);
SELECT pg_temp.expect_error('sipen proxy di matkul lain',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('a0000000-0000-0000-0000-000000000004', 'c2222222-2222-2222-2222-222222222222', 'sakit', '2026-09-21', '2026-09-21', 'x', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_rows('sipen ajukan izin sendiri di matkul lain',
    $q$INSERT INTO leave_requests (id, student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('e0000000-0000-0000-0000-000000000003', auth.uid(), 'c2222222-2222-2222-2222-222222222222', 'izin_biasa', '2026-09-21', '2026-09-21', 'x', auth.uid())$q$, 1);
SELECT pg_temp.expect_error('sipen ubah alasan saat verifikasi',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid(), reason = 'hack' WHERE id = 'e0000000-0000-0000-0000-000000000001'$q$,
    'Hanya status verifikasi');
SELECT pg_temp.expect_error('sipen ubah id saat verifikasi',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid(), id = gen_random_uuid() WHERE id = 'e0000000-0000-0000-0000-000000000001'$q$,
    'Hanya status verifikasi');
SELECT pg_temp.expect_error('sipen tolak tanpa alasan',
    $q$UPDATE leave_requests SET status = 'rejected', verified_by = auth.uid() WHERE id = 'e0000000-0000-0000-0000-000000000001'$q$,
    'row-level security');
SELECT pg_temp.expect_rows('sipen setujui izin di matkulnya',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid() WHERE id = 'e0000000-0000-0000-0000-000000000001'$q$, 1);
SELECT pg_temp.expect_rows('sipen ubah keputusan final',
    $q$UPDATE leave_requests SET status = 'rejected', rejection_reason = 'ubah', verified_by = auth.uid() WHERE id = 'e0000000-0000-0000-0000-000000000001'$q$, 0);
SELECT pg_temp.expect_rows('sipen setujui izin sendiri',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid() WHERE id = 'e0000000-0000-0000-0000-000000000003'$q$, 0);
SELECT pg_temp.expect_rows('sipen melihat izin sendiri + matkulnya',
    $q$SELECT 1 FROM leave_requests$q$, 3);
SELECT pg_temp.expect_rows('sipen tidak bisa mencabut token',
    $q$UPDATE lecturer_tokens SET revoked_at = now()$q$, 0);

-- ---------------------------------------------------------------------------
-- KM (Budi)
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
SELECT pg_temp.expect_rows('KM setujui izin matkul mana pun',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid() WHERE id = 'e0000000-0000-0000-0000-000000000003'$q$, 1);
SELECT pg_temp.expect_rows('KM ubah keputusan final',
    $q$UPDATE leave_requests SET status = 'rejected', rejection_reason = 'ubah', verified_by = auth.uid() WHERE id = 'e0000000-0000-0000-0000-000000000001'$q$, 0);
SELECT pg_temp.expect_rows('KM buat token',
    $q$INSERT INTO lecturer_tokens (label, created_by) VALUES ('baru', auth.uid())$q$, 1);
SELECT pg_temp.expect_value('token acak 48 hex',
    $q$SELECT (token ~ '^[0-9a-f]{48}$')::text FROM lecturer_tokens WHERE label = 'baru'$q$, 'true');
SELECT pg_temp.expect_rows('KM cabut token buatan orang lain',
    $q$UPDATE lecturer_tokens SET revoked_at = now() WHERE token = 'tok-ok'$q$, 1);

-- ---------------------------------------------------------------------------
-- Dosen tamu (anon)
-- ---------------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.act_as(NULL);
SET ROLE anon;
SELECT pg_temp.expect_value('RPC token valid', $q$SELECT get_lecturer_recap('tok-anon') ->> 'status'$q$, 'ok');
SELECT pg_temp.expect_value('RPC hanya izin approved',
    $q$SELECT jsonb_array_length(get_lecturer_recap('tok-anon') -> 'leaves')::text$q$, '2');
SELECT pg_temp.expect_value('RPC tanpa alasan izin',
    $q$SELECT (get_lecturer_recap('tok-anon')::text LIKE '%reason%')::text$q$, 'false');
SELECT pg_temp.expect_value('RPC token kedaluwarsa', $q$SELECT get_lecturer_recap('tok-exp') ->> 'status'$q$, 'expired');
SELECT pg_temp.expect_value('RPC token dicabut', $q$SELECT get_lecturer_recap('tok-ok') ->> 'status'$q$, 'revoked');
SELECT pg_temp.expect_value('RPC token tidak dikenal', $q$SELECT get_lecturer_recap('nope') ->> 'status'$q$, 'not_found');
SELECT pg_temp.expect_rows('anon tidak bisa membaca tabel token', $q$SELECT 1 FROM lecturer_tokens$q$, 0);
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Policy & RPC lama (disimulasikan scripts/test-rls.sh sebelum migrasi hardening)
-- ---------------------------------------------------------------------------
SELECT pg_temp.expect_value('policy lama yang longgar sudah dihapus',
    $q$SELECT count(*)::text FROM pg_policies WHERE policyname LIKE 'legacy_%'$q$, '0');
SET ROLE authenticated;
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error('RPC lama tidak bisa dipanggil klien',
    $q$SELECT approve_leave_request('e0000000-0000-0000-0000-000000000002')$q$, 'permission denied');
RESET ROLE;
SELECT pg_temp.act_as(NULL);

-- ---------------------------------------------------------------------------
-- Keadaan akhir
-- ---------------------------------------------------------------------------
SELECT pg_temp.expect_value('status akhir izin',
    $q$SELECT string_agg(status::text || ':' || (verified_by IS NOT NULL)::text, ',' ORDER BY id) FROM leave_requests$q$,
    'approved:true,pending:false,approved:true');
