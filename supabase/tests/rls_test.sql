-- Uji perilaku RLS, trigger & RPC (platform multi-kelas). Jalankan lewat scripts/test-rls.sh.
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
--   Kelas A: Rian (mhs), Sarah (sipen c1), Budi (KM), Dinda (mhs), Admin (mhs + superadmin)
--   Kelas B: Eko (KM), Fina (mhs)
--   Dosen Hendra mengajar c1 (A) dan c3 (B)
-- ---------------------------------------------------------------------------
INSERT INTO classes (id, name, status) VALUES
 ('0a000000-0000-0000-0000-00000000000a', 'Kelas A', 'active'),
 ('0b000000-0000-0000-0000-00000000000b', 'Kelas B', 'active');

INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data) VALUES
 ('a0000000-0000-0000-0000-000000000001', 'rian.pratama@umkt.ac.id', '{"full_name":"Rian","class_id":"0a000000-0000-0000-0000-00000000000a"}', '{"preapproved":true}'),
 ('a0000000-0000-0000-0000-000000000002', 'sarah.amalia@umkt.ac.id', '{"full_name":"Sarah","class_id":"0a000000-0000-0000-0000-00000000000a"}', '{"preapproved":true}'),
 ('a0000000-0000-0000-0000-000000000003', 'budi.santoso@umkt.ac.id', '{"full_name":"Budi","class_id":"0a000000-0000-0000-0000-00000000000a"}', '{"preapproved":true}'),
 ('a0000000-0000-0000-0000-000000000004', 'dinda@umkt.ac.id', '{"class_id":"0a000000-0000-0000-0000-00000000000a"}', '{"preapproved":true}'),
 ('a0000000-0000-0000-0000-000000000005', 'eko@umkt.ac.id', '{"full_name":"Eko","class_id":"0b000000-0000-0000-0000-00000000000b"}', '{"preapproved":true}'),
 ('a0000000-0000-0000-0000-000000000006', 'fina@umkt.ac.id', '{"full_name":"Fina","class_id":"0b000000-0000-0000-0000-00000000000b"}', '{"preapproved":true}'),
 ('a0000000-0000-0000-0000-000000000007', 'admin@umkt.ac.id', '{"full_name":"Admin","class_id":"0a000000-0000-0000-0000-00000000000a"}', '{"preapproved":true}');
UPDATE profiles SET role = 'sipen' WHERE id = 'a0000000-0000-0000-0000-000000000002';
UPDATE profiles SET role = 'km' WHERE id IN ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005');
UPDATE profiles SET is_admin = true WHERE id = 'a0000000-0000-0000-0000-000000000007';

INSERT INTO lecturers (id, full_name, phone, created_by) VALUES
 ('d0000000-0000-0000-0000-000000000001', 'Dr. Hendra', '0812-1111-2222', 'a0000000-0000-0000-0000-000000000003');

INSERT INTO courses (id, class_id, code, name, lecturer_id, day_of_week, start_time, end_time) VALUES
 ('c1111111-1111-1111-1111-111111111111', '0a000000-0000-0000-0000-00000000000a', 'TI-401', 'Cloud', 'd0000000-0000-0000-0000-000000000001', 'Senin', '08:00', '10:00'),
 ('c2222222-2222-2222-2222-222222222222', '0a000000-0000-0000-0000-00000000000a', 'TI-402', 'ML', NULL, 'Selasa', '08:00', '10:00'),
 ('c3333333-3333-3333-3333-333333333333', '0b000000-0000-0000-0000-00000000000b', 'TI-401', 'Jaringan', 'd0000000-0000-0000-0000-000000000001', 'Rabu', '10:00', '12:00');
INSERT INTO course_sipen (user_id, course_id) VALUES
 ('a0000000-0000-0000-0000-000000000002', 'c1111111-1111-1111-1111-111111111111');
INSERT INTO leave_requests (id, student_id, course_id, leave_type, start_date, end_date, reason, created_by) VALUES
 ('eb000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'c3333333-3333-3333-3333-333333333333',
  'sakit', CURRENT_DATE, CURRENT_DATE, 'rahasia-medis', 'a0000000-0000-0000-0000-000000000006');

-- ---------------------------------------------------------------------------
-- Registrasi (trigger handle_new_user)
-- ---------------------------------------------------------------------------
SELECT pg_temp.expect_value('akun seed preapproved langsung aktif',
    $q$SELECT status::text FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000001'$q$, 'active');
SELECT pg_temp.expect_error('signup non-UMKT ditolak',
    $q$INSERT INTO auth.users (email) VALUES ('x@gmail.com')$q$, 'umkt');
SELECT pg_temp.expect_rows('daftar mandiri memilih kelas A',
    $q$INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('a0000000-0000-0000-0000-000000000010', '2611100000010@umkt.ac.id',
       '{"full_name":"Pendaftar","class_id":"0a000000-0000-0000-0000-00000000000a","self_registered":true}')$q$, 1);
SELECT pg_temp.expect_value('pendaftar mandiri pending di kelas A, password sendiri',
    $q$SELECT status || ':' || (class_id = '0a000000-0000-0000-0000-00000000000a') || ':' || is_password_changed
       FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000010'$q$, 'pending:true:true');
SELECT pg_temp.expect_value('NIM diturunkan dari email',
    $q$SELECT nim FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000010'$q$, '2611100000010');
SELECT pg_temp.expect_rows('signup dengan metadata NIM orang lain',
    $q$INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('a0000000-0000-0000-0000-000000000099', 'penyusup@umkt.ac.id', '{"nim":"2611100000010"}')$q$, 1);
SELECT pg_temp.expect_value('metadata NIM diabaikan',
    $q$SELECT (nim LIKE 'P-%')::text FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000099'$q$, 'true');
SELECT pg_temp.expect_value('preapproved lewat user metadata diabaikan',
    $q$WITH u AS (INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('a0000000-0000-0000-0000-000000000098', 'nakal@umkt.ac.id',
       '{"preapproved":true,"class_id":"0a000000-0000-0000-0000-00000000000a"}') RETURNING id)
       SELECT 'x'$q$, 'x');
SELECT pg_temp.expect_value('akun tetap pending walau klien kirim preapproved',
    $q$SELECT status::text FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000098'$q$, 'pending');
SELECT pg_temp.expect_error('memilih kelas yang tidak ada ditolak',
    $q$INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('2611100000011@umkt.ac.id', '{"class_id":"00000000-0000-0000-0000-000000000000"}')$q$,
    'Kelas yang dipilih');
SELECT pg_temp.expect_rows('mengajukan kelas baru C',
    $q$INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('a0000000-0000-0000-0000-000000000011', '2611100000012@umkt.ac.id',
       '{"full_name":"Calon KM","new_class_name":"Kelas C","new_class_batch":"2026"}')$q$, 1);
SELECT pg_temp.expect_value('kelas baru pending, pengaju pending sebagai mahasiswa',
    $q$SELECT c.status || ':' || p.status || ':' || p.role FROM profiles p JOIN classes c ON c.id = p.class_id
       WHERE p.id = 'a0000000-0000-0000-0000-000000000011'$q$, 'pending:pending:mahasiswa');
SELECT pg_temp.expect_error('nama kelas duplikat ditolak',
    $q$INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('2611100000013@umkt.ac.id', '{"new_class_name":"  kelas a "}')$q$,
    'duplicate|unique');
-- Pengajuan kelas lain (untuk uji tolak admin) dan pendaftar lain (untuk uji hapus KM)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('a0000000-0000-0000-0000-000000000013', '2611100000014@umkt.ac.id', '{"new_class_name":"Kelas D"}'),
 ('a0000000-0000-0000-0000-000000000012', '2611100000015@umkt.ac.id', '{"class_id":"0a000000-0000-0000-0000-00000000000a"}');

-- ---------------------------------------------------------------------------
-- Pendaftar pending (kelas A)
-- ---------------------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000010');
SELECT pg_temp.expect_rows('pending hanya melihat profil sendiri', $q$SELECT 1 FROM profiles$q$, 1);
SELECT pg_temp.expect_rows('pending belum melihat mata kuliah', $q$SELECT 1 FROM courses$q$, 0);
SELECT pg_temp.expect_rows('pending melihat kelas pilihannya', $q$SELECT 1 FROM classes$q$, 1);
SELECT pg_temp.expect_error('pending tidak bisa mengajukan izin',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES (auth.uid(), 'c1111111-1111-1111-1111-111111111111', 'sakit', CURRENT_DATE, CURRENT_DATE, 'x', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_error('pending menyetujui diri sendiri',
    $q$SELECT approve_member(auth.uid())$q$, 'berwenang');
SELECT pg_temp.expect_rows('pending memilih ulang kelas B',
    $q$SELECT choose_class('0b000000-0000-0000-0000-00000000000b')$q$, 1);
SELECT pg_temp.expect_value('kelas pilihan berubah ke B',
    $q$SELECT (class_id = '0b000000-0000-0000-0000-00000000000b')::text FROM profiles WHERE id = auth.uid()$q$, 'true');
SELECT pg_temp.expect_rows('pending kembali memilih kelas A',
    $q$SELECT choose_class('0a000000-0000-0000-0000-00000000000a')$q$, 1);

-- ---------------------------------------------------------------------------
-- Mahasiswa aktif (Rian, kelas A)
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error('mahasiswa ubah role sendiri',
    $q$UPDATE profiles SET role = 'km' WHERE id = auth.uid()$q$, 'administrator');
SELECT pg_temp.expect_error('mahasiswa pindah kelas sendiri',
    $q$UPDATE profiles SET class_id = '0b000000-0000-0000-0000-00000000000b' WHERE id = auth.uid()$q$, 'administrator');
SELECT pg_temp.expect_error('mahasiswa jadikan diri superadmin',
    $q$UPDATE profiles SET is_admin = true WHERE id = auth.uid()$q$, 'administrator');
SELECT pg_temp.expect_error('GUC palsu tidak membuka kunci role',
    $q$SELECT set_config('sipper.trusted_update', 'on', false); UPDATE profiles SET role = 'km' WHERE id = auth.uid()$q$, 'administrator');
SELECT pg_temp.expect_error('mahasiswa set is_password_changed sendiri',
    $q$UPDATE profiles SET is_password_changed = true WHERE id = auth.uid()$q$, 'sistem');
SELECT pg_temp.expect_rows('mahasiswa ubah telepon sendiri',
    $q$UPDATE profiles SET phone = '0811' WHERE id = auth.uid()$q$, 1);
SELECT pg_temp.expect_rows('mahasiswa tidak bisa ubah profil orang lain',
    $q$UPDATE profiles SET phone = '0811' WHERE id = 'a0000000-0000-0000-0000-000000000004'$q$, 0);
SELECT pg_temp.expect_error('mahasiswa baca email teman',
    $q$SELECT email FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000004'$q$, 'permission denied');
SELECT pg_temp.expect_rows('direktori hanya kelas A (5 aktif + 3 pendaftar)',
    $q$SELECT id, nim, full_name, role, status FROM profiles$q$, 8);
SELECT pg_temp.expect_rows('mata kuliah hanya kelas A', $q$SELECT 1 FROM courses$q$, 2);
SELECT pg_temp.expect_value('get_my_profile mengembalikan email sendiri',
    $q$SELECT email FROM get_my_profile()$q$, 'rian.pratama@umkt.ac.id');
SELECT pg_temp.expect_rows('mahasiswa melihat nama dosen', $q$SELECT full_name FROM lecturers$q$, 1);
SELECT pg_temp.expect_error('mahasiswa baca nomor dosen', $q$SELECT phone FROM lecturers$q$, 'permission denied');
SELECT pg_temp.expect_error('mahasiswa baca token dosen', $q$SELECT access_token FROM lecturers$q$, 'permission denied');
SELECT pg_temp.expect_error('mahasiswa buka daftar dosen staf', $q$SELECT * FROM get_class_lecturers()$q$, 'Khusus');
SELECT pg_temp.expect_error('mahasiswa menyetujui pendaftar',
    $q$SELECT approve_member('a0000000-0000-0000-0000-000000000010')$q$, 'berwenang');
SELECT pg_temp.expect_error('mahasiswa menyambungkan WhatsApp', $q$SELECT wa_request('on')$q$, 'Khusus');
SELECT pg_temp.expect_error('mahasiswa menambah matkul',
    $q$INSERT INTO courses (class_id, code, name) VALUES ('0a000000-0000-0000-0000-00000000000a', 'X-1', 'X')$q$, 'row-level security');

SELECT pg_temp.expect_error('mahasiswa insert izin approved',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, status, created_by)
       VALUES (auth.uid(), 'c1111111-1111-1111-1111-111111111111', 'sakit', CURRENT_DATE, CURRENT_DATE, 'x', 'approved', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_error('mahasiswa proxy untuk orang lain',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('a0000000-0000-0000-0000-000000000004', 'c1111111-1111-1111-1111-111111111111', 'sakit', CURRENT_DATE, CURRENT_DATE, 'x', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_error('mahasiswa ajukan izin di matkul kelas lain',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES (auth.uid(), 'c3333333-3333-3333-3333-333333333333', 'sakit', CURRENT_DATE, CURRENT_DATE, 'x', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_rows('mahasiswa ajukan izin sendiri (pending)',
    $q$INSERT INTO leave_requests (id, student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('e0000000-0000-0000-0000-000000000001', auth.uid(), 'c1111111-1111-1111-1111-111111111111', 'sakit', CURRENT_DATE, CURRENT_DATE, 'x', auth.uid())$q$, 1);
SELECT pg_temp.expect_rows('mahasiswa setujui izin sendiri',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid()$q$, 0);
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
-- Sipen (Sarah, kelas A, matkul Cloud)
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
SELECT pg_temp.expect_rows('sipen proxy di matkulnya',
    $q$INSERT INTO leave_requests (id, student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'c1111111-1111-1111-1111-111111111111', 'sakit', CURRENT_DATE, CURRENT_DATE, 'x', auth.uid())$q$, 1);
SELECT pg_temp.expect_error('sipen proxy di matkul lain',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('a0000000-0000-0000-0000-000000000004', 'c2222222-2222-2222-2222-222222222222', 'sakit', CURRENT_DATE, CURRENT_DATE, 'x', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_error('sipen proxy untuk mahasiswa kelas lain',
    $q$INSERT INTO leave_requests (student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('a0000000-0000-0000-0000-000000000006', 'c1111111-1111-1111-1111-111111111111', 'sakit', CURRENT_DATE, CURRENT_DATE, 'x', auth.uid())$q$,
    'row-level security');
SELECT pg_temp.expect_rows('sipen ajukan izin sendiri di matkul lain',
    $q$INSERT INTO leave_requests (id, student_id, course_id, leave_type, start_date, end_date, reason, created_by)
       VALUES ('e0000000-0000-0000-0000-000000000003', auth.uid(), 'c2222222-2222-2222-2222-222222222222', 'izin_biasa', CURRENT_DATE, CURRENT_DATE, 'x', auth.uid())$q$, 1);
SELECT pg_temp.expect_error('sipen ubah alasan saat verifikasi',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid(), reason = 'hack' WHERE id = 'e0000000-0000-0000-0000-000000000001'$q$,
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
SELECT pg_temp.expect_rows('sipen melihat izin sendiri + matkulnya', $q$SELECT 1 FROM leave_requests$q$, 3);

SELECT pg_temp.expect_rows('sipen menyetujui pendaftar kelasnya',
    $q$SELECT approve_member('a0000000-0000-0000-0000-000000000010')$q$, 1);
SELECT pg_temp.expect_value('pendaftar kini aktif',
    $q$SELECT status::text FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000010'$q$, 'active');
SELECT pg_temp.expect_error('sipen mengatur peran anggota',
    $q$SELECT set_member_role('a0000000-0000-0000-0000-000000000004', 'sipen')$q$, 'berwenang');
SELECT pg_temp.expect_error('sipen mengeluarkan anggota aktif',
    $q$SELECT remove_member('a0000000-0000-0000-0000-000000000004')$q$, 'berwenang');
SELECT pg_temp.expect_rows('sipen menambah matkul kelasnya',
    $q$INSERT INTO courses (class_id, code, name) VALUES ('0a000000-0000-0000-0000-00000000000a', 'TI-499', 'Etika')$q$, 1);
SELECT pg_temp.expect_error('sipen menambah matkul kelas lain',
    $q$INSERT INTO courses (class_id, code, name) VALUES ('0b000000-0000-0000-0000-00000000000b', 'TI-499', 'Etika')$q$, 'row-level security');
SELECT pg_temp.expect_error('hari kuliah tidak dikenal ditolak',
    $q$UPDATE courses SET day_of_week = 'Senen' WHERE code = 'TI-499'$q$, 'courses_day_check');
SELECT pg_temp.expect_rows('sipen minta sambungan WhatsApp + kode pairing',
    $q$SELECT wa_request('on', '0812 3333 4444')$q$, 1);
SELECT pg_temp.expect_value('nomor pairing dinormalisasi',
    $q$SELECT pair_phone FROM wa_sessions$q$, '6281233334444');
SELECT pg_temp.expect_error('sipen menulis status sesi WA langsung',
    $q$UPDATE wa_sessions SET state = 'connected'$q$, 'permission denied');
SELECT pg_temp.expect_rows('sipen kirim pengingat sekarang',
    $q$SELECT queue_reminder_now('c1111111-1111-1111-1111-111111111111')$q$, 1);
SELECT pg_temp.expect_value('tanggal pengingat = Senin berikutnya',
    $q$SELECT extract(dow FROM lecture_date)::text FROM wa_messages WHERE course_id = 'c1111111-1111-1111-1111-111111111111'$q$, '1');
SELECT pg_temp.expect_error('pengingat untuk matkul tanpa dosen',
    $q$SELECT queue_reminder_now('c2222222-2222-2222-2222-222222222222')$q$, 'Pilih dosen');
SELECT pg_temp.expect_error('pengingat untuk matkul kelas lain',
    $q$SELECT queue_reminder_now('c3333333-3333-3333-3333-333333333333')$q$, 'berwenang');
SELECT pg_temp.expect_rows('sipen kirim pesan uji',
    $q$SELECT queue_test_message('081200000000', 'halo')$q$, 1);
SELECT pg_temp.expect_error('sipen insert antrean WA langsung',
    $q$INSERT INTO wa_messages (class_id, recipient, body) VALUES ('0a000000-0000-0000-0000-00000000000a', '62812', 'spam')$q$, 'permission denied');
SELECT pg_temp.expect_rows('sipen batalkan pesan uji',
    $q$SELECT cancel_wa_message((SELECT max(id) FROM wa_messages WHERE course_id IS NULL))$q$, 1);
SELECT pg_temp.expect_rows('sipen melihat antrean kelasnya', $q$SELECT 1 FROM wa_messages$q$, 2);
SELECT pg_temp.expect_rows('sipen ubah template pengingat',
    $q$SELECT set_reminder_template('Yth. {{.NamaDosen}}, kuliah {{.Matkul}} {{.Hari}}.')$q$, 1);

-- ---------------------------------------------------------------------------
-- KM (Budi, kelas A)
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
SELECT pg_temp.expect_rows('KM setujui izin matkul mana pun di kelasnya',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid() WHERE id = 'e0000000-0000-0000-0000-000000000003'$q$, 1);
SELECT pg_temp.expect_rows('KM tidak bisa memverifikasi izin kelas lain',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid() WHERE id = 'eb000000-0000-0000-0000-000000000001'$q$, 0);
SELECT pg_temp.expect_rows('KM hanya melihat izin kelasnya', $q$SELECT 1 FROM leave_requests$q$, 3);
SELECT pg_temp.expect_rows('KM tidak melihat profil kelas lain',
    $q$SELECT 1 FROM profiles WHERE class_id = '0b000000-0000-0000-0000-00000000000b'$q$, 0);
SELECT pg_temp.expect_rows('KM menunjuk Dinda jadi Sipen',
    $q$SELECT set_member_role('a0000000-0000-0000-0000-000000000004', 'sipen')$q$, 1);
SELECT pg_temp.expect_rows('KM menugaskan Sipen ke matkul',
    $q$INSERT INTO course_sipen (user_id, course_id) VALUES ('a0000000-0000-0000-0000-000000000004', 'c2222222-2222-2222-2222-222222222222')$q$, 1);
SELECT pg_temp.expect_error('KM menugaskan mahasiswa kelas lain',
    $q$INSERT INTO course_sipen (user_id, course_id) VALUES ('a0000000-0000-0000-0000-000000000006', 'c2222222-2222-2222-2222-222222222222')$q$,
    'row-level security');
SELECT pg_temp.expect_error('KM mengubah peran anggota kelas lain',
    $q$SELECT set_member_role('a0000000-0000-0000-0000-000000000006', 'sipen')$q$, 'berwenang');
SELECT pg_temp.expect_rows('KM menolak pendaftar (akun dihapus)',
    $q$SELECT remove_member('a0000000-0000-0000-0000-000000000012')$q$, 1);
SELECT pg_temp.expect_error('KM mengeluarkan KM kelas lain',
    $q$SELECT remove_member('a0000000-0000-0000-0000-000000000005')$q$, 'berwenang');
SELECT pg_temp.expect_error('KM menyetujui pengajuan kelas',
    $q$SELECT approve_class((SELECT id FROM classes WHERE name = 'Kelas C'))$q$, 'superadmin');
SELECT pg_temp.expect_value('KM melihat nomor dosen kelasnya',
    $q$SELECT phone FROM get_class_lecturers() WHERE id = 'd0000000-0000-0000-0000-000000000001'$q$, '6281211112222');
SELECT pg_temp.expect_rows('KM membuat link dosen baru',
    $q$SELECT regenerate_lecturer_token('d0000000-0000-0000-0000-000000000001')$q$, 1);
SELECT pg_temp.expect_rows('KM menambah dosen baru',
    $q$SELECT save_lecturer(NULL, 'Dr. Baru', '0813-5555-6666', NULL)$q$, 1);
SELECT pg_temp.expect_error('nomor dosen tidak valid ditolak',
    $q$SELECT save_lecturer(NULL, 'Dr. Salah', '123', NULL)$q$, 'tidak valid');
SELECT pg_temp.expect_error('KM menambah hari libur',
    $q$INSERT INTO holidays (date, description) VALUES (CURRENT_DATE + 3, 'Libur')$q$, 'row-level security');

-- ---------------------------------------------------------------------------
-- KM kelas lain (Eko, kelas B)
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000005');
SELECT pg_temp.expect_rows('KM B hanya melihat izin kelas B', $q$SELECT 1 FROM leave_requests$q$, 1);
SELECT pg_temp.expect_rows('KM B menyetujui izin kelasnya',
    $q$UPDATE leave_requests SET status = 'approved', verified_by = auth.uid() WHERE id = 'eb000000-0000-0000-0000-000000000001'$q$, 1);
SELECT pg_temp.expect_rows('KM B tidak melihat sesi WA kelas A', $q$SELECT 1 FROM wa_sessions$q$, 0);
SELECT pg_temp.expect_rows('KM B tidak melihat antrean WA kelas A', $q$SELECT 1 FROM wa_messages$q$, 0);
SELECT pg_temp.expect_rows('KM B membuat link dosen yang mengajar di kelasnya',
    $q$SELECT regenerate_lecturer_token('d0000000-0000-0000-0000-000000000001')$q$, 1);
SELECT pg_temp.expect_error('KM B mengubah data dosen buatan KM A',
    $q$SELECT save_lecturer('d0000000-0000-0000-0000-000000000001', 'Hack', '081211112222', NULL)$q$, 'pembuatnya');
SELECT pg_temp.expect_value('nomor dosen yang sama tidak menduplikasi',
    $q$SELECT save_lecturer(NULL, 'Hendra lagi', '+62 812-1111-2222', NULL)::text$q$, 'd0000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error('KM B mengirim pengingat matkul kelas A',
    $q$SELECT queue_reminder_now('c1111111-1111-1111-1111-111111111111')$q$, 'berwenang');

-- ---------------------------------------------------------------------------
-- Superadmin
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000007');
SELECT pg_temp.expect_rows('admin melihat pengajuan kelas', $q$SELECT * FROM list_pending_classes()$q$, 2);
SELECT pg_temp.expect_rows('admin menyetujui kelas C',
    $q$SELECT approve_class((SELECT id FROM list_pending_classes() WHERE name = 'Kelas C'))$q$, 1);
SELECT pg_temp.expect_value('pengaju kelas C kini KM aktif',
    $q$SELECT role || ':' || status FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000011'$q$, 'km:active');
SELECT pg_temp.expect_rows('admin menolak kelas D',
    $q$SELECT reject_class((SELECT id FROM list_pending_classes() WHERE name = 'Kelas D'))$q$, 1);
SELECT pg_temp.expect_rows('admin menambah hari libur',
    $q$INSERT INTO holidays (date, description) VALUES (CURRENT_DATE + 3, 'Libur uji')$q$, 1);

-- Migrasi jabatan KM
SELECT pg_temp.expect_rows('admin menunjuk KM baru di kelas lain',
    $q$SELECT set_member_role('a0000000-0000-0000-0000-000000000006', 'km')$q$, 1);
SELECT pg_temp.expect_value('KM lama kelas B menjadi Sipen, satu KM per kelas',
    $q$SELECT string_agg(full_name || ':' || role, ',' ORDER BY full_name) FROM profiles
       WHERE class_id = '0b000000-0000-0000-0000-00000000000b' AND status = 'active'$q$, 'Eko:sipen,Fina:km');
SELECT pg_temp.expect_rows('admin mengambil jabatan KM kelasnya sendiri',
    $q$SELECT set_member_role(auth.uid(), 'km')$q$, 1);
SELECT pg_temp.expect_value('admin kini KM, KM lama jadi Sipen',
    $q$SELECT (SELECT role::text FROM profiles WHERE id = auth.uid()) || ',' ||
              (SELECT role::text FROM profiles WHERE id = 'a0000000-0000-0000-0000-000000000003')$q$, 'km,sipen');
SELECT pg_temp.expect_rows('admin menyerahkan KM kembali ke Budi',
    $q$SELECT set_member_role('a0000000-0000-0000-0000-000000000003', 'km')$q$, 1);
SELECT pg_temp.expect_value('admin tetap superadmin setelah serah terima',
    $q$SELECT role || ':' || is_admin FROM get_my_profile()$q$, 'sipen:true');
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
SELECT pg_temp.expect_error('KM tidak bisa mengeluarkan superadmin',
    $q$SELECT remove_member('a0000000-0000-0000-0000-000000000007')$q$, 'tidak dapat dihapus');
SELECT pg_temp.expect_error('KM tidak bisa turun jabatan tanpa menunjuk pengganti',
    $q$SELECT set_member_role(auth.uid(), 'mahasiswa')$q$, 'berwenang');
SELECT pg_temp.expect_rows('KM tidak bisa mencabut status superadmin',
    $q$UPDATE profiles SET is_admin = false WHERE id = 'a0000000-0000-0000-0000-000000000007'$q$, 0);
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000007');
SELECT pg_temp.expect_value('status superadmin tetap utuh',
    $q$SELECT is_admin::text FROM get_my_profile()$q$, 'true');

-- ---------------------------------------------------------------------------
-- Fitur SiPenDosa: jam operasional, dry run, versi template, papan publik, kirim ulang, grup, statistik
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
SELECT pg_temp.expect_rows('sipen atur jam operasional + dry run',
    $q$SELECT update_reminder_settings('07:00', '17:00', true)$q$, 1);
SELECT pg_temp.expect_value('pengaturan pengingat tersimpan',
    $q$SELECT send_window_start || '-' || send_window_end || ':' || reminder_dry_run FROM classes$q$, '07:00:00-17:00:00:true');
SELECT pg_temp.expect_error('jam operasional terbalik ditolak',
    $q$SELECT update_reminder_settings('17:00', '07:00', false)$q$, 'setelah');
SELECT pg_temp.expect_rows('sipen ubah template lagi',
    $q$SELECT set_reminder_template('Versi ketiga {{.Matkul}}')$q$, 1);
SELECT pg_temp.expect_rows('riwayat versi template tersimpan', $q$SELECT 1 FROM reminder_template_versions$q$, 2);
SELECT pg_temp.expect_value('papan jadwal publik aktif (token 48 hex)',
    $q$SELECT (set_class_board('on') ~ '^[0-9a-f]{48}$')::text$q$, 'true');
SELECT pg_temp.expect_value('papan jadwal dinonaktifkan',
    $q$SELECT COALESCE(set_class_board('off'), 'null')$q$, 'null');
SELECT pg_temp.expect_rows('kirim ulang pesan yang dibatalkan',
    $q$SELECT retry_wa_message((SELECT max(id) FROM wa_messages WHERE course_id IS NULL))$q$, 1);
SELECT pg_temp.expect_error('pesan pending tidak bisa dikirim ulang',
    $q$SELECT retry_wa_message((SELECT max(id) FROM wa_messages WHERE course_id IS NULL))$q$, 'tidak dapat');
SELECT pg_temp.expect_value('statistik antrean kelas', $q$SELECT wa_stats() ->> 'pending'$q$, '2');
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error('mahasiswa baca statistik WA', $q$SELECT wa_stats()$q$, 'Khusus');
SELECT pg_temp.expect_rows('mahasiswa tidak melihat riwayat template', $q$SELECT 1 FROM reminder_template_versions$q$, 0);
SELECT pg_temp.expect_error('mahasiswa mengaktifkan papan publik', $q$SELECT set_class_board('on')$q$, 'Khusus');

RESET ROLE;
SELECT pg_temp.act_as(NULL);
INSERT INTO wa_groups (class_id, jid, name, participants) VALUES
 ('0a000000-0000-0000-0000-00000000000a', '120363000000000001@g.us', 'Grup Kelas A', 30);
UPDATE classes SET public_token = repeat('ef', 24) WHERE id = '0a000000-0000-0000-0000-00000000000a';
-- Budi mengaktifkan 2FA (faktor TOTP terverifikasi)
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('a0000000-0000-0000-0000-000000000003', 'verified');
SET ROLE authenticated;
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
SELECT pg_temp.expect_rows('staf melihat grup WA kelasnya', $q$SELECT 1 FROM wa_groups$q$, 1);
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000005');
SELECT pg_temp.expect_rows('staf kelas lain tidak melihat grup WA', $q$SELECT 1 FROM wa_groups$q$, 0);
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
SELECT pg_temp.expect_rows('2FA: sesi password saja tidak melihat data kelas', $q$SELECT 1 FROM courses$q$, 0);
SELECT pg_temp.expect_rows('2FA: sesi password saja tetap melihat profil sendiri', $q$SELECT 1 FROM profiles$q$, 1);
SELECT pg_temp.expect_error('2FA: sesi password saja kehilangan hak KM', $q$SELECT wa_request('on')$q$, 'Khusus');
SELECT set_config('request.jwt.claims',
    json_build_object('sub', 'a0000000-0000-0000-0000-000000000003', 'role', 'authenticated', 'aal', 'aal2')::text, false);
SELECT pg_temp.expect_rows('2FA: sesi aal2 mendapat data kelas', $q$SELECT 1 FROM courses$q$, 3);
SELECT pg_temp.expect_rows('2FA: sesi aal2 mendapat hak KM', $q$SELECT wa_request('off')$q$, 1);
RESET ROLE;
SELECT pg_temp.act_as(NULL);
DELETE FROM auth.mfa_factors;
SET ROLE authenticated;
SELECT pg_temp.act_as('a0000000-0000-0000-0000-000000000007');

RESET ROLE;
SELECT pg_temp.act_as(NULL);
SELECT pg_temp.expect_value('akun pendaftar yang ditolak terhapus',
    $q$SELECT count(*)::text FROM auth.users WHERE id IN ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000013')$q$, '0');
UPDATE lecturers SET access_token = repeat('ab', 24) WHERE id = 'd0000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Tamu (anon): registrasi & portal dosen
-- ---------------------------------------------------------------------------
SET ROLE anon;
SELECT pg_temp.expect_rows('anon melihat kelas aktif untuk registrasi', $q$SELECT * FROM list_open_classes()$q$, 3);
SELECT pg_temp.expect_rows('anon tidak membaca tabel kelas', $q$SELECT 1 FROM classes$q$, 0);
SELECT pg_temp.expect_error('anon membaca tabel dosen', $q$SELECT 1 FROM lecturers$q$, 'permission denied');
SELECT pg_temp.expect_error('anon memanggil RPC staf', $q$SELECT approve_member('a0000000-0000-0000-0000-000000000010')$q$, 'permission denied');
SELECT pg_temp.expect_value('portal dosen: token valid',
    $q$SELECT get_lecturer_portal(repeat('ab', 24)) ->> 'status'$q$, 'ok');
SELECT pg_temp.expect_value('portal dosen: jadwal lintas kelas',
    $q$SELECT jsonb_array_length(get_lecturer_portal(repeat('ab', 24)) -> 'courses')::text$q$, '2');
SELECT pg_temp.expect_value('portal dosen: hanya izin approved di matkulnya',
    $q$SELECT jsonb_array_length(get_lecturer_portal(repeat('ab', 24)) -> 'leaves')::text$q$, '2');
SELECT pg_temp.expect_value('portal dosen: tanpa alasan izin',
    $q$SELECT (get_lecturer_portal(repeat('ab', 24))::text LIKE '%rahasia-medis%')::text$q$, 'false');
SELECT pg_temp.expect_value('portal dosen: hari libur mendatang',
    $q$SELECT jsonb_array_length(get_lecturer_portal(repeat('ab', 24)) -> 'holidays')::text$q$, '1');
SELECT pg_temp.expect_value('portal dosen: token tidak dikenal',
    $q$SELECT get_lecturer_portal(repeat('cd', 24)) ->> 'status'$q$, 'not_found');
SELECT pg_temp.expect_value('papan jadwal publik: token valid',
    $q$SELECT get_class_board(repeat('ef', 24)) ->> 'status'$q$, 'ok');
SELECT pg_temp.expect_value('papan jadwal publik: semua matkul kelas',
    $q$SELECT jsonb_array_length(get_class_board(repeat('ef', 24)) -> 'courses')::text$q$, '3');
SELECT pg_temp.expect_value('papan jadwal publik: tanpa data mahasiswa',
    $q$SELECT (get_class_board(repeat('ef', 24))::text ~* '(nim|student|reason)')::text$q$, 'false');
SELECT pg_temp.expect_value('papan jadwal publik: token salah',
    $q$SELECT get_class_board(repeat('00', 24)) ->> 'status'$q$, 'not_found');
SELECT pg_temp.expect_error('anon mengubah papan publik', $q$SELECT set_class_board('on')$q$, 'permission denied');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Policy & RPC lama
-- ---------------------------------------------------------------------------
SELECT pg_temp.expect_value('policy lama yang longgar sudah dihapus',
    $q$SELECT count(*)::text FROM pg_policies WHERE policyname LIKE 'legacy_%'$q$, '0');
SELECT pg_temp.expect_value('tabel token dosen lama dihapus',
    $q$SELECT (to_regclass('public.lecturer_tokens') IS NULL)::text$q$, 'true');
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
    'approved:true,pending:false,approved:true,approved:true');
SELECT pg_temp.expect_value('bucket lama leave-attachments privat',
    $q$SELECT public::text FROM storage.buckets WHERE id = 'leave-attachments'$q$, 'false');
