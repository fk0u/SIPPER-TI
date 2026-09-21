-- ============================================================================
-- SIPPER-TI: Seed Data Script
-- Seeding: Mahasiswa TI Internasional, Dosen, Matkul, Sipen, dan Izin Sampel
-- ============================================================================

-- 1. SEED COURSES
INSERT INTO public.courses (id, code, name, lecturer_name, day_of_week, start_time, end_time, semester, room)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'TI-401', 'Cloud Architecture & DevOps', 'Dr. Hendra, S.Kom., M.T.', 'Senin', '08:00', '10:30', '2026/2027-1', 'Lab Komputer 3'),
    ('c2222222-2222-2222-2222-222222222222', 'TI-402', 'Machine Learning & AI Ethics', 'Ir. Nurul Hidayah, Ph.D.', 'Selasa', '13:00', '15:30', '2026/2027-1', 'Ruang Teori 4.2'),
    ('c3333333-3333-3333-3333-333333333333', 'TI-403', 'Mobile Application Development', 'Ahmad Fauzi, M.Cs.', 'Kamis', '10:00', '12:30', '2026/2027-1', 'Lab Mobile & IoT'),
    ('c4444444-4444-4444-4444-444444444444', 'TI-404', 'Software Quality Assurance & Testing', 'Prof. Bambang Setiawan, M.Sc.', 'Jumat', '08:30', '11:00', '2026/2027-1', 'Lab Rekayasa Perangkat Lunak')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    lecturer_name = EXCLUDED.lecturer_name;

-- 2. SEED SAMPLE PROFILES
-- Catatan: UUID ini dihubungkan dengan user ID Supabase Auth saat login
INSERT INTO public.profiles (id, nim, email, full_name, phone, role, is_password_changed)
VALUES
    ('a0000000-0000-0000-0000-000000000001', '2311102441101', 'rian.pratama@umkt.ac.id', 'Rian Pratama', '081234567801', 'mahasiswa', false),
    ('a0000000-0000-0000-0000-000000000002', '2311102441102', 'sarah.amalia@umkt.ac.id', 'Sarah Amalia', '081234567802', 'sipen', true),
    ('a0000000-0000-0000-0000-000000000003', '2311102441103', 'budi.santoso@umkt.ac.id', 'Budi Santoso', '081234567803', 'km', true),
    ('a0000000-0000-0000-0000-000000000004', '2311102441104', 'dinda.safitri@umkt.ac.id', 'Dinda Safitri', '081234567804', 'mahasiswa', false),
    ('a0000000-0000-0000-0000-000000000005', '2311102441105', 'kevin.angela@umkt.ac.id', 'Kevin Angela Wijaya', '081234567805', 'sipen', true),
    ('a0000000-0000-0000-0000-000000000006', '2311102441106', 'nadia.putri@umkt.ac.id', 'Nadia Putri Lestari', '081234567806', 'mahasiswa', false),
    ('a0000000-0000-0000-0000-000000000007', '2311102441107', 'farhan.ali@umkt.ac.id', 'Farhan Ali Syahputra', '081234567807', 'mahasiswa', false),
    ('a0000000-0000-0000-0000-000000000008', '2311102441108', 'aisha.azzahra@umkt.ac.id', 'Aisha Az-Zahra', '081234567808', 'mahasiswa', false),
    ('a0000000-0000-0000-0000-000000000009', '2311102441109', 'michael.tan@umkt.ac.id', 'Michael Tanujaya', '081234567809', 'mahasiswa', false),
    ('a0000000-0000-0000-0000-000000000010', '2311102441110', 'zahra.salsabila@umkt.ac.id', 'Zahra Salsabila', '081234567810', 'mahasiswa', false)
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- 3. SEED COURSE SIPEN MAPPING
INSERT INTO public.course_sipen (user_id, course_id)
VALUES
    ('a0000000-0000-0000-0000-000000000002', 'c1111111-1111-1111-1111-111111111111'), -- Sarah -> Cloud Architecture
    ('a0000000-0000-0000-0000-000000000002', 'c4444444-4444-4444-4444-444444444444'), -- Sarah -> SQA
    ('a0000000-0000-0000-0000-000000000005', 'c2222222-2222-2222-2222-222222222222'), -- Kevin -> Machine Learning
    ('a0000000-0000-0000-0000-000000000005', 'c3333333-3333-3333-3333-333333333333')  -- Kevin -> Mobile Dev
ON CONFLICT (user_id, course_id) DO NOTHING;

-- 4. SEED SAMPLE LEAVE REQUESTS
INSERT INTO public.leave_requests (
    id, student_id, course_id, leave_type, start_date, end_date, reason, file_urls, status, rejection_reason, created_by, verified_by
)
VALUES
    (
        'e1111111-1111-1111-1111-111111111111',
        'a0000000-0000-0000-0000-000000000001', -- Rian
        'c1111111-1111-1111-1111-111111111111', -- Cloud Architecture
        'sakit',
        '2026-09-21',
        '2026-09-22',
        'Demam tinggi dan radang tenggorokan setelah pemeriksaan klinik dr. Samsul.',
        '[{"name": "surat_dokter_rian.pdf", "url": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80", "type": "image/jpeg"}]'::jsonb,
        'pending',
        NULL,
        'a0000000-0000-0000-0000-000000000001', -- Self submission
        NULL
    ),
    (
        'e2222222-2222-2222-2222-222222222222',
        'a0000000-0000-0000-0000-000000000004', -- Dinda
        'c1111111-1111-1111-1111-111111111111', -- Cloud Architecture
        'sakit',
        '2026-09-21',
        '2026-09-23',
        'Rawat inap akibat tipes (Diisikan oleh KM Budi atas permintaan orang tua mahasiswa).',
        '[{"name": "bukti_rawat_inap_dinda.jpg", "url": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80", "type": "image/jpeg"}]'::jsonb,
        'approved',
        NULL,
        'a0000000-0000-0000-0000-000000000003', -- PROXY SUBMISSION oleh Budi Santoso (KM)
        'a0000000-0000-0000-0000-000000000002'  -- Verified oleh Sarah (Sipen)
    ),
    (
        'e3333333-3333-3333-3333-333333333333',
        'a0000000-0000-0000-0000-000000000007', -- Farhan
        'c2222222-2222-2222-2222-222222222222', -- Machine Learning
        'acara',
        '2026-09-22',
        '2026-09-22',
        'Mengikuti kompetisi Hackathon AI Nasional mewakili BEM Fakultas.',
        '[{"name": "surat_tugas_hackathon.pdf", "url": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80", "type": "image/jpeg"}]'::jsonb,
        'approved',
        NULL,
        'a0000000-0000-0000-0000-000000000007',
        'a0000000-0000-0000-0000-000000000005'  -- Verified oleh Kevin
    )
ON CONFLICT (id) DO NOTHING;

-- 5. SEED LECTURER GUEST ACCESS TOKENS
INSERT INTO public.lecturer_tokens (id, token, course_id, label, expires_at, created_by)
VALUES
    (
        't1111111-1111-1111-1111-111111111111',
        'demo-dosen-hendra-2026',
        'c1111111-1111-1111-1111-111111111111',
        'Link Presensi Dosen Dr. Hendra (Cloud Architecture)',
        NOW() + INTERVAL '180 days',
        'a0000000-0000-0000-0000-000000000003'
    ),
    (
        't2222222-2222-2222-2222-222222222222',
        'demo-dosen-semua-matkul',
        NULL, -- Akses Semua Matkul untuk Ketua Prodi / Koordinator
        'Link Supervisi Koordinator Kelas Internasional',
        NOW() + INTERVAL '180 days',
        'a0000000-0000-0000-0000-000000000003'
    )
ON CONFLICT (token) DO NOTHING;
