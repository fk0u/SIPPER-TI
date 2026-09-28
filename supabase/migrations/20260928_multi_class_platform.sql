-- ============================================================================
-- SIPPER-TI: Platform Multi-Kelas + Jadwal & Pengingat Dosen (gabungan SiPenDosa)
--
-- - Kelas (classes): diajukan siapa saja, di-ACC superadmin; pengaju menjadi KM.
-- - Registrasi mandiri NIM + password, memilih kelas; akun "pending" sampai di-ACC
--   Sipen/KM kelas tersebut. Menolak = menghapus akun (NIM bisa didaftarkan ulang).
-- - Semua hak KM/Sipen kini terbatas pada kelasnya sendiri.
-- - Dosen (lecturers): direktori lintas kelas + link pribadi tanpa login.
-- - Pengingat WhatsApp: pengaturan per mata kuliah, sesi WA per kelas, antrean pesan
--   yang dikerjakan worker Go (worker/), terhubung sebagai role postgres (bypass RLS).
-- ============================================================================

-- ============================================================================
-- 0. TIPE & TABEL KELAS
-- ============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_status') THEN
        CREATE TYPE class_status AS ENUM ('pending', 'active');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN
        CREATE TYPE member_status AS ENUM ('pending', 'active');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 80),
    program TEXT NOT NULL DEFAULT 'Teknik Informatika' CHECK (length(trim(program)) BETWEEN 2 AND 80),
    batch TEXT CHECK (batch IS NULL OR length(trim(batch)) <= 20),
    status class_status NOT NULL DEFAULT 'pending',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    -- Template Go text/template (kompatibel SiPenDosa). Sumber tunggal: dibaca web & worker.
    reminder_template TEXT NOT NULL DEFAULT $tpl$*PENGINGAT PERKULIAHAN*

Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. Bapak/Ibu {{.NamaDosen}},

Mohon izin mengingatkan jadwal perkuliahan kelas {{.Kelas}}:
📚 *Mata Kuliah:* {{.Matkul}}
🗓️ *Hari/Tanggal:* {{.Hari}}, {{.Tanggal}}
⏰ *Waktu:* {{.JamMulai}} - {{.JamSelesai}} WITA
📍 *Ruang:* {{.Lokasi}}
{{if .LinkGroup}}🔗 *Tautan Kelas:* {{.LinkGroup}}
{{end}}
Demikian informasi ini kami sampaikan. Terima kasih atas perhatian Bapak/Ibu.

Hormat kami,
{{if .NamaMahasiswa}}Ketua Kelas: {{.NamaMahasiswa}}{{if .NIM}} ({{.NIM}}){{end}}{{else}}Mahasiswa {{.Kelas}}{{end}}$tpl$
        CHECK (length(reminder_template) BETWEEN 10 AND 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS classes_name_key ON public.classes (lower(trim(name)));

DROP TRIGGER IF EXISTS trg_classes_updated_at ON public.classes;
CREATE TRIGGER trg_classes_updated_at
    BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 1. PROFILES: keanggotaan kelas, status persetujuan, superadmin
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
-- Akun lama dianggap aktif; akun baru pending (default diubah setelah backfill).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status member_status NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_class ON public.profiles(class_id, status);

-- ============================================================================
-- 2. DOSEN (lintas kelas) + link pribadi
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lecturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 3 AND 120),
    -- Nomor WhatsApp ternormalisasi (62xxxxxxxxxx); satu dosen = satu nomor.
    phone TEXT NOT NULL,
    email TEXT,
    access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS lecturers_phone_key ON public.lecturers(phone);

CREATE OR REPLACE FUNCTION public.normalize_wa_phone(p_phone TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN d ~ '^0' THEN '62' || substr(d, 2)
        WHEN d ~ '^8' THEN '62' || d
        ELSE d
    END
    FROM (SELECT regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g') AS d) s;
$$;

CREATE OR REPLACE FUNCTION public.lecturers_before_write()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.phone := public.normalize_wa_phone(NEW.phone);
    IF NEW.phone !~ '^62[0-9]{8,13}$' THEN
        RAISE EXCEPTION 'Nomor WhatsApp dosen tidak valid (contoh: 081234567890).';
    END IF;
    NEW.full_name := trim(NEW.full_name);
    NEW.email := NULLIF(trim(COALESCE(NEW.email, '')), '');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_lecturers_before_write ON public.lecturers;
CREATE TRIGGER trg_lecturers_before_write
    BEFORE INSERT OR UPDATE ON public.lecturers
    FOR EACH ROW EXECUTE FUNCTION public.lecturers_before_write();

-- ============================================================================
-- 3. COURSES: milik kelas + dosen + pengaturan pengingat
-- ============================================================================
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS lecturer_id UUID REFERENCES public.lecturers(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS reminder_mode TEXT NOT NULL DEFAULT 'H-1';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS reminder_time TIME NOT NULL DEFAULT '08:00';
-- Tujuan alternatif (nomor / JID grup). NULL = WhatsApp dosen.
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS reminder_target TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS link_group TEXT;
-- Ditulis worker: tanggal terakhir pengingat otomatis diantrekan.
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS last_reminded_on DATE;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Nama hari Indonesia → indeks (0 = Minggu), NULL bila tidak dikenal
CREATE OR REPLACE FUNCTION public.day_index(p_day TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
    SELECT array_position(ARRAY['minggu','senin','selasa','rabu','kamis','jumat','sabtu'],
                          lower(replace(trim(COALESCE(p_day, '')), '''', ''))) - 1;
$$;

DO $$ BEGIN
    ALTER TABLE public.courses ADD CONSTRAINT courses_reminder_mode_check CHECK (reminder_mode IN ('H-1', 'H-0'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE public.courses ADD CONSTRAINT courses_day_check
        CHECK (day_of_week IS NULL OR public.day_index(day_of_week) IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Kode matkul unik per kelas, bukan global
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS courses_class_code_key ON public.courses(class_id, code);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer ON public.courses(lecturer_id);

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Data lama (satu kelas) dipindahkan ke kelas awal agar tidak yatim
DO $$
DECLARE v_class UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE class_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.courses WHERE class_id IS NULL) THEN
        INSERT INTO public.classes (name, status, approved_at)
        VALUES ('TI Internasional 2026', 'active', NOW())
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_class;
        IF v_class IS NULL THEN
            SELECT id INTO v_class FROM public.classes WHERE lower(trim(name)) = 'ti internasional 2026';
        END IF;
        UPDATE public.profiles SET class_id = v_class WHERE class_id IS NULL;
        UPDATE public.courses SET class_id = v_class WHERE class_id IS NULL;
    END IF;
END $$;
ALTER TABLE public.courses ALTER COLUMN class_id SET NOT NULL;

-- ============================================================================
-- 4. HARI LIBUR (global, dikelola superadmin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.holidays (
    date DATE PRIMARY KEY,
    description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 2 AND 120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. WHATSAPP: sesi per kelas & antrean pesan (dikerjakan worker)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wa_sessions (
    class_id UUID PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
    -- Keinginan pengguna (via RPC wa_request): on | off | logout
    desired TEXT NOT NULL DEFAULT 'off' CHECK (desired IN ('on', 'off', 'logout')),
    -- Ditulis worker
    state TEXT NOT NULL DEFAULT 'disconnected'
        CHECK (state IN ('disconnected', 'connecting', 'need_qr', 'connected', 'logged_out', 'error')),
    qr_code TEXT,
    pair_phone TEXT,
    pair_code TEXT,
    device_jid TEXT,
    push_name TEXT,
    last_error TEXT,
    worker_seen_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wa_messages (
    id BIGSERIAL PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    -- Pengingat: body & recipient diisi worker saat dikirim (template terbaru).
    lecture_date DATE,
    recipient TEXT,
    recipient_name TEXT,
    body TEXT CHECK (body IS NULL OR length(body) <= 4000),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    send_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL = penjadwal otomatis
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wa_messages_kind_check CHECK (
        (body IS NOT NULL AND recipient IS NOT NULL)
        OR (course_id IS NOT NULL AND lecture_date IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_wa_messages_queue ON public.wa_messages(status, send_after) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_wa_messages_class ON public.wa_messages(class_id, created_at DESC);

-- ============================================================================
-- 6. FITUR LAMA YANG DIGANTIKAN: token dosen per matkul → link pribadi dosen
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_lecturer_recap(TEXT);
DROP TABLE IF EXISTS public.lecturer_tokens;

-- ============================================================================
-- 7. HELPER HAK AKSES (SECURITY DEFINER agar tidak rekursif terhadap RLS)
-- ============================================================================
-- Kelas pengguna yang sudah di-ACC (NULL bila pending / tanpa kelas)
CREATE OR REPLACE FUNCTION public.my_class_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT class_id FROM public.profiles WHERE id = auth.uid() AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_staff_of(p_class UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status = 'active' AND class_id = p_class AND role IN ('km', 'sipen')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_km_of(p_class UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status = 'active' AND class_id = p_class AND role = 'km'
    );
$$;

CREATE OR REPLACE FUNCTION public.course_class(p_course UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT class_id FROM public.courses WHERE id = p_course;
$$;

CREATE OR REPLACE FUNCTION public.member_class(p_user UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT class_id FROM public.profiles WHERE id = p_user AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_km_for_course(p_course UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.is_km_of(public.course_class(p_course));
$$;

-- Sipen yang ditugaskan pada matkul tsb (dan masih aktif di kelas matkul itu)
CREATE OR REPLACE FUNCTION public.is_sipen_of(p_course_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.course_sipen cs
        JOIN public.profiles p ON p.id = cs.user_id
        JOIN public.courses c ON c.id = cs.course_id
        WHERE cs.user_id = auth.uid() AND cs.course_id = p_course_id
          AND p.role = 'sipen' AND p.status = 'active' AND p.class_id = c.class_id
    );
$$;

-- Tanggal kuliah berikutnya (hari ini termasuk) untuk nama hari, zona WITA
CREATE OR REPLACE FUNCTION public.next_lecture_date(p_day TEXT)
RETURNS DATE LANGUAGE sql STABLE AS $$
    SELECT today + ((public.day_index(p_day) - extract(dow FROM today)::int + 7) % 7)
    FROM (SELECT (NOW() AT TIME ZONE 'Asia/Makassar')::date AS today) t;
$$;

-- ============================================================================
-- 8. PROFIL OTOMATIS: registrasi mandiri + pilihan kelas
-- ============================================================================
-- raw_user_meta_data diisi klien saat signup: hanya dipercaya untuk nama & pilihan kelas
-- (akun tetap pending). raw_app_meta_data hanya bisa diisi service role (skrip seed).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_email TEXT := lower(NEW.email);
    local_part TEXT := split_part(lower(NEW.email), '@', 1);
    meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
    app_meta JSONB := COALESCE(to_jsonb(NEW) -> 'raw_app_meta_data', '{}'::jsonb);
    derived_nim VARCHAR(20);
    raw_name TEXT;
    v_class UUID;
    v_preapproved BOOLEAN := COALESCE((app_meta ->> 'preapproved')::boolean, FALSE);
BEGIN
    IF NOT (user_email LIKE '%@umkt.ac.id' OR user_email LIKE '%.umkt.ac.id') THEN
        RAISE EXCEPTION 'Registrasi dibatasi hanya untuk akun civitas akademika UMKT (@umkt.ac.id)';
    END IF;

    raw_name := left(trim(COALESCE(meta ->> 'full_name', meta ->> 'name', local_part)), 120);
    -- NIM hanya dari email kampus ({nim}@umkt.ac.id), bukan dari metadata klien
    derived_nim := CASE
        WHEN local_part ~ '^[0-9]{8,20}$' THEN local_part
        ELSE 'P-' || substr(md5(NEW.id::text), 1, 18)
    END;

    INSERT INTO public.profiles (id, nim, email, full_name, role, status, is_password_changed)
    VALUES (
        NEW.id, derived_nim, user_email, raw_name, 'mahasiswa',
        CASE WHEN v_preapproved THEN 'active' ELSE 'pending' END::member_status,
        -- Pendaftar mandiri memilih password sendiri; akun seed memakai NIM → wajib ganti
        COALESCE((meta ->> 'self_registered')::boolean, FALSE)
    )
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW();

    IF meta ? 'new_class_name' THEN
        -- Mengajukan kelas baru: kelas pending, pengaju menjadi KM setelah di-ACC superadmin
        INSERT INTO public.classes (name, program, batch, created_by)
        VALUES (
            trim(meta ->> 'new_class_name'),
            COALESCE(NULLIF(trim(meta ->> 'new_class_program'), ''), 'Teknik Informatika'),
            NULLIF(trim(meta ->> 'new_class_batch'), ''),
            NEW.id
        )
        RETURNING id INTO v_class;
        UPDATE public.profiles SET class_id = v_class, status = 'pending' WHERE id = NEW.id;
    ELSIF NULLIF(meta ->> 'class_id', '') IS NOT NULL THEN
        SELECT id INTO v_class FROM public.classes
        WHERE id = (meta ->> 'class_id')::uuid AND status = 'active';
        IF v_class IS NULL THEN
            RAISE EXCEPTION 'Kelas yang dipilih tidak ditemukan atau belum aktif.';
        END IF;
        UPDATE public.profiles SET class_id = v_class WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Kolom keanggotaan hanya diubah lewat RPC / sistem
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.uid() IS NULL
       OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
       OR current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF NEW.is_password_changed IS DISTINCT FROM OLD.is_password_changed THEN
        RAISE EXCEPTION 'Status penggantian kata sandi hanya diperbarui oleh sistem.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.nim IS DISTINCT FROM OLD.nim
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.class_id IS DISTINCT FROM OLD.class_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        RAISE EXCEPTION 'Kolom role, nim, email, kelas, dan status hanya dapat diubah oleh administrator.';
    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- 9. RLS: hapus semua policy tabel aplikasi lalu buat ulang (berbasis kelas)
-- ============================================================================
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE (schemaname = 'public'
               AND tablename IN ('profiles', 'courses', 'course_sipen', 'leave_requests', 'classes',
                                 'lecturers', 'holidays', 'wa_sessions', 'wa_messages'))
           OR (schemaname = 'storage' AND tablename = 'objects'
               AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ '(permit-proofs|leave-attachments)')
    LOOP
        EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;
-- KM kini per kelas (is_km_of / is_km_for_course)
DROP FUNCTION IF EXISTS public.is_km();

-- Profiles: diri sendiri + anggota sekelas (termasuk pendaftar pending untuk di-ACC)
CREATE POLICY "Profiles visible to self and classmates"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR (class_id IS NOT NULL AND class_id = public.my_class_id()) OR public.is_admin());
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, nim, full_name, role, avatar_url, class_id, status, created_at, updated_at)
    ON public.profiles TO authenticated;

-- Classes: kelas sendiri (status apa pun), atau superadmin. Perubahan lewat RPC.
CREATE POLICY "Classes visible to members and admin"
    ON public.classes FOR SELECT TO authenticated
    USING (
        id = (SELECT class_id FROM public.profiles WHERE id = auth.uid())
        OR created_by = auth.uid()
        OR public.is_admin()
    );

-- Courses: anggota aktif sekelas melihat; KM & Sipen kelas mengelola
CREATE POLICY "Courses visible to classmates"
    ON public.courses FOR SELECT TO authenticated
    USING (class_id = public.my_class_id());
CREATE POLICY "Courses insertable by class staff"
    ON public.courses FOR INSERT TO authenticated
    WITH CHECK (public.is_staff_of(class_id) AND last_reminded_on IS NULL);
CREATE POLICY "Courses updatable by class staff"
    ON public.courses FOR UPDATE TO authenticated
    USING (public.is_staff_of(class_id))
    WITH CHECK (public.is_staff_of(class_id));
CREATE POLICY "Courses deletable by class staff"
    ON public.courses FOR DELETE TO authenticated
    USING (public.is_staff_of(class_id));

-- Course Sipen: terlihat sekelas; penugasan oleh KM ke Sipen sekelas
CREATE POLICY "Course Sipen visible to classmates"
    ON public.course_sipen FOR SELECT TO authenticated
    USING (public.course_class(course_id) = public.my_class_id());
CREATE POLICY "Course Sipen assignable by KM"
    ON public.course_sipen FOR INSERT TO authenticated
    WITH CHECK (
        public.is_km_for_course(course_id)
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = user_id AND p.role = 'sipen' AND p.status = 'active'
              AND p.class_id = public.course_class(course_id)
        )
    );
CREATE POLICY "Course Sipen removable by KM"
    ON public.course_sipen FOR DELETE TO authenticated
    USING (public.is_km_for_course(course_id));

-- Leave requests: seperti sebelumnya, KM kini hanya untuk matkul kelasnya
CREATE POLICY "View leave requests policy"
    ON public.leave_requests FOR SELECT TO authenticated
    USING (
        student_id = auth.uid()
        OR created_by = auth.uid()
        OR public.is_sipen_of(course_id)
        OR public.is_km_for_course(course_id)
    );
CREATE POLICY "Create leave requests policy"
    ON public.leave_requests FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND status = 'pending'
        AND verified_by IS NULL
        AND verified_at IS NULL
        AND rejection_reason IS NULL
        AND public.course_class(course_id) = public.my_class_id()
        AND (
            student_id = auth.uid()
            OR (
                (public.is_km_for_course(course_id) OR public.is_sipen_of(course_id))
                AND public.member_class(student_id) = public.course_class(course_id)
            )
        )
    );
CREATE POLICY "Update leave requests status policy"
    ON public.leave_requests FOR UPDATE TO authenticated
    USING (
        status = 'pending'
        AND student_id <> auth.uid()
        AND (public.is_km_for_course(course_id) OR public.is_sipen_of(course_id))
    )
    WITH CHECK (
        student_id <> auth.uid()
        AND verified_by = auth.uid()
        AND status IN ('approved', 'rejected')
        AND (status <> 'rejected' OR length(trim(COALESCE(rejection_reason, ''))) > 0)
        AND (public.is_km_for_course(course_id) OR public.is_sipen_of(course_id))
    );

-- Lecturers: nama boleh dilihat anggota aktif; nomor, email & token hanya lewat RPC staf
CREATE POLICY "Lecturer names visible to active members"
    ON public.lecturers FOR SELECT TO authenticated
    USING (public.my_class_id() IS NOT NULL);
REVOKE ALL ON public.lecturers FROM anon, authenticated;
GRANT SELECT (id, full_name) ON public.lecturers TO authenticated;

-- Holidays: dibaca semua pengguna login; dikelola superadmin
CREATE POLICY "Holidays readable" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Holidays insertable by admin" ON public.holidays FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Holidays deletable by admin" ON public.holidays FOR DELETE TO authenticated USING (public.is_admin());

-- WhatsApp: staf kelas membaca; perubahan lewat RPC, status ditulis worker
CREATE POLICY "WA session visible to class staff"
    ON public.wa_sessions FOR SELECT TO authenticated
    USING (public.is_staff_of(class_id));
CREATE POLICY "WA messages visible to class staff"
    ON public.wa_messages FOR SELECT TO authenticated
    USING (public.is_staff_of(class_id));
REVOKE INSERT, UPDATE, DELETE ON public.wa_sessions, public.wa_messages FROM anon, authenticated;

-- Storage: sama seperti sebelumnya, KM dibatasi kelasnya
CREATE POLICY "Users upload leave documents to own folder"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'permit-proofs'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
CREATE POLICY "Users delete own unattached leave documents"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'permit-proofs'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND NOT EXISTS (
            SELECT 1
            FROM public.leave_requests lr,
                 jsonb_array_elements(lr.file_urls) AS f
            WHERE f ->> 'path' = storage.objects.name
        )
    );
CREATE POLICY "Leave documents readable by authorized users"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'permit-proofs'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR EXISTS (
                SELECT 1
                FROM public.leave_requests lr,
                     jsonb_array_elements(lr.file_urls) AS f
                WHERE f ->> 'path' = storage.objects.name
                  AND (
                      lr.student_id = auth.uid()
                      OR lr.created_by = auth.uid()
                      OR public.is_km_for_course(lr.course_id)
                      OR public.is_sipen_of(lr.course_id)
                  )
            )
        )
    );

-- ============================================================================
-- 10. RPC: registrasi & keanggotaan
-- ============================================================================
-- Daftar kelas aktif untuk halaman registrasi (tanpa login)
CREATE OR REPLACE FUNCTION public.list_open_classes()
RETURNS TABLE (id UUID, name TEXT, program TEXT, batch TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id, name, program, batch FROM public.classes WHERE status = 'active' ORDER BY program, name;
$$;

-- Pengguna tanpa kelas / masih pending memilih (ulang) kelas yang dituju
CREATE OR REPLACE FUNCTION public.choose_class(p_class UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class AND status = 'active') THEN
        RAISE EXCEPTION 'Kelas tidak ditemukan atau belum aktif.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.classes WHERE created_by = auth.uid() AND status = 'pending') THEN
        RAISE EXCEPTION 'Pengajuan kelas baru Anda masih menunggu persetujuan admin.';
    END IF;
    UPDATE public.profiles SET class_id = p_class, status = 'pending', role = 'mahasiswa'
    WHERE id = auth.uid() AND status = 'pending';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Hanya akun yang belum disetujui yang dapat memilih kelas.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_member(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID;
BEGIN
    SELECT class_id INTO v_class FROM public.profiles WHERE id = p_user AND status = 'pending';
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Anda tidak berwenang menyetujui pendaftar ini.';
    END IF;
    UPDATE public.profiles SET status = 'active' WHERE id = p_user;
END;
$$;

-- Menolak pendaftar (Sipen/KM) atau mengeluarkan anggota (KM): akun dihapus
CREATE OR REPLACE FUNCTION public.remove_member(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD;
BEGIN
    SELECT class_id, status, role, is_admin INTO v FROM public.profiles WHERE id = p_user;
    IF NOT FOUND OR p_user = auth.uid() OR v.is_admin THEN
        RAISE EXCEPTION 'Anggota tidak dapat dihapus.';
    END IF;
    IF NOT (
        (v.status = 'pending' AND public.is_staff_of(v.class_id))
        OR (v.status = 'active' AND v.role <> 'km' AND public.is_km_of(v.class_id))
    ) THEN
        RAISE EXCEPTION 'Anda tidak berwenang menghapus anggota ini.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.classes WHERE created_by = p_user AND status = 'pending') THEN
        RAISE EXCEPTION 'Pengajuan kelas hanya dapat ditolak oleh admin.';
    END IF;
    DELETE FROM auth.users WHERE id = p_user;
END;
$$;

-- KM mengatur peran anggota aktif kelasnya. Menunjuk KM baru = serah terima (KM lama → Sipen).
CREATE OR REPLACE FUNCTION public.set_member_role(p_user UUID, p_role user_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID;
BEGIN
    SELECT class_id INTO v_class FROM public.profiles WHERE id = p_user AND status = 'active';
    IF v_class IS NULL OR p_user = auth.uid() OR NOT (public.is_km_of(v_class) OR public.is_admin()) THEN
        RAISE EXCEPTION 'Anda tidak berwenang mengubah peran anggota ini.';
    END IF;
    IF p_role = 'km' THEN
        UPDATE public.profiles SET role = 'sipen' WHERE class_id = v_class AND role = 'km';
    END IF;
    UPDATE public.profiles SET role = p_role WHERE id = p_user;
    IF p_role <> 'sipen' THEN
        DELETE FROM public.course_sipen WHERE user_id = p_user;
    END IF;
END;
$$;

-- ============================================================================
-- 11. RPC: superadmin (persetujuan kelas)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_pending_classes()
RETURNS TABLE (id UUID, name TEXT, program TEXT, batch TEXT, created_at TIMESTAMPTZ,
               applicant_id UUID, applicant_name TEXT, applicant_nim TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Khusus superadmin.';
    END IF;
    RETURN QUERY
    SELECT c.id, c.name, c.program, c.batch, c.created_at, p.id, p.full_name, p.nim::text
    FROM public.classes c LEFT JOIN public.profiles p ON p.id = c.created_by
    WHERE c.status = 'pending'
    ORDER BY c.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_class(p_class UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_creator UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Khusus superadmin.';
    END IF;
    UPDATE public.classes SET status = 'active', approved_by = auth.uid(), approved_at = NOW()
    WHERE id = p_class AND status = 'pending'
    RETURNING created_by INTO v_creator;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pengajuan kelas tidak ditemukan.';
    END IF;
    UPDATE public.profiles SET status = 'active', role = 'km'
    WHERE id = v_creator AND class_id = p_class;
END;
$$;

-- Tolak = hapus kelas beserta akun pengaju (NIM bisa mendaftar ulang)
CREATE OR REPLACE FUNCTION public.reject_class(p_class UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_creator UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Khusus superadmin.';
    END IF;
    DELETE FROM public.classes WHERE id = p_class AND status = 'pending' RETURNING created_by INTO v_creator;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pengajuan kelas tidak ditemukan.';
    END IF;
    DELETE FROM auth.users WHERE id = v_creator AND NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = v_creator), FALSE);
END;
$$;

-- ============================================================================
-- 12. RPC: dosen
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_manage_lecturer(p_lecturer UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.is_admin()
        OR EXISTS (SELECT 1 FROM public.lecturers l WHERE l.id = p_lecturer AND l.created_by = auth.uid()
                   AND public.my_class_id() IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.courses c WHERE c.lecturer_id = p_lecturer AND public.is_staff_of(c.class_id));
$$;

-- Dosen yang relevan untuk staf kelas: mengajar di kelasnya atau dibuat olehnya
CREATE OR REPLACE FUNCTION public.get_class_lecturers()
RETURNS TABLE (id UUID, full_name TEXT, phone TEXT, email TEXT, access_token TEXT,
               course_count BIGINT, can_edit BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id();
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    RETURN QUERY
    SELECT l.id, l.full_name, l.phone, l.email, l.access_token,
           (SELECT count(*) FROM public.courses c WHERE c.lecturer_id = l.id AND c.class_id = v_class),
           (l.created_by = auth.uid() OR public.is_admin())
    FROM public.lecturers l
    WHERE l.created_by = auth.uid()
       OR EXISTS (SELECT 1 FROM public.courses c WHERE c.lecturer_id = l.id AND c.class_id = v_class)
    ORDER BY l.full_name;
END;
$$;

-- Tambah dosen; bila nomor sudah terdaftar (dosen dipakai kelas lain) kembalikan data yang ada.
CREATE OR REPLACE FUNCTION public.save_lecturer(p_id UUID, p_name TEXT, p_phone TEXT, p_email TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
    IF NOT public.is_staff_of(public.my_class_id()) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    IF p_id IS NULL THEN
        SELECT id INTO v_id FROM public.lecturers WHERE phone = public.normalize_wa_phone(p_phone);
        IF v_id IS NOT NULL THEN
            RETURN v_id;
        END IF;
        INSERT INTO public.lecturers (full_name, phone, email, created_by)
        VALUES (p_name, p_phone, p_email, auth.uid())
        RETURNING id INTO v_id;
        RETURN v_id;
    END IF;
    IF NOT (public.is_admin() OR EXISTS (SELECT 1 FROM public.lecturers WHERE id = p_id AND created_by = auth.uid())) THEN
        RAISE EXCEPTION 'Data dosen hanya dapat diubah oleh pembuatnya atau admin.';
    END IF;
    UPDATE public.lecturers SET full_name = p_name, phone = p_phone, email = p_email WHERE id = p_id;
    RETURN p_id;
END;
$$;

-- Buat link baru (link lama langsung tidak berlaku)
CREATE OR REPLACE FUNCTION public.regenerate_lecturer_token(p_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token TEXT;
BEGIN
    IF NOT public.can_manage_lecturer(p_id) THEN
        RAISE EXCEPTION 'Anda tidak berwenang mengelola link dosen ini.';
    END IF;
    UPDATE public.lecturers SET access_token = encode(gen_random_bytes(24), 'hex')
    WHERE id = p_id RETURNING access_token INTO v_token;
    RETURN v_token;
END;
$$;

-- Portal dosen tanpa login: jadwal lintas kelas + rekap izin approved (tanpa alasan & berkas)
CREATE OR REPLACE FUNCTION public.get_lecturer_portal(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lecturer public.lecturers%ROWTYPE;
BEGIN
    IF p_token IS NULL OR length(p_token) < 32 THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    SELECT * INTO v_lecturer FROM public.lecturers WHERE access_token = p_token;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    RETURN jsonb_build_object(
        'status', 'ok',
        'lecturer', jsonb_build_object('full_name', v_lecturer.full_name),
        'courses', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id, 'code', c.code, 'name', c.name, 'day_of_week', c.day_of_week,
                'start_time', c.start_time, 'end_time', c.end_time, 'room', c.room,
                'semester', c.semester, 'class_name', k.name, 'link_group', c.link_group
            ) ORDER BY public.day_index(c.day_of_week), c.start_time)
            FROM public.courses c JOIN public.classes k ON k.id = c.class_id
            WHERE c.lecturer_id = v_lecturer.id AND k.status = 'active'
        ), '[]'::jsonb),
        'leaves', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', lr.id, 'course_id', lr.course_id, 'leave_type', lr.leave_type,
                'start_date', lr.start_date, 'end_date', lr.end_date,
                'student_name', p.full_name, 'student_nim', p.nim
            ) ORDER BY lr.start_date DESC)
            FROM public.leave_requests lr
            JOIN public.courses c ON c.id = lr.course_id
            JOIN public.profiles p ON p.id = lr.student_id
            WHERE c.lecturer_id = v_lecturer.id AND lr.status = 'approved'
              AND lr.end_date >= (NOW() AT TIME ZONE 'Asia/Makassar')::date - 180
        ), '[]'::jsonb),
        'holidays', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('date', h.date, 'description', h.description) ORDER BY h.date)
            FROM public.holidays h
            WHERE h.date >= (NOW() AT TIME ZONE 'Asia/Makassar')::date
              AND h.date < (NOW() AT TIME ZONE 'Asia/Makassar')::date + 120
        ), '[]'::jsonb)
    );
END;
$$;

-- ============================================================================
-- 13. RPC: pengingat & WhatsApp (staf kelas)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_reminder_template(p_template TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id();
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    UPDATE public.classes SET reminder_template = p_template WHERE id = v_class;
END;
$$;

-- on: sambungkan (QR / kode pairing bila p_phone diisi) | off: putuskan | logout: hapus perangkat
CREATE OR REPLACE FUNCTION public.wa_request(p_action TEXT, p_phone TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id();
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    IF p_action NOT IN ('on', 'off', 'logout') THEN
        RAISE EXCEPTION 'Aksi tidak dikenal.';
    END IF;
    INSERT INTO public.wa_sessions (class_id, desired, pair_phone, pair_code, updated_at)
    VALUES (v_class, p_action, NULLIF(public.normalize_wa_phone(p_phone), ''), NULL, NOW())
    ON CONFLICT (class_id) DO UPDATE
    SET desired = EXCLUDED.desired, pair_phone = EXCLUDED.pair_phone, pair_code = NULL, updated_at = NOW();
END;
$$;

-- Kirim pengingat sekarang untuk pertemuan berikutnya
CREATE OR REPLACE FUNCTION public.queue_reminder_now(p_course UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_course public.courses%ROWTYPE; v_id BIGINT;
BEGIN
    SELECT * INTO v_course FROM public.courses WHERE id = p_course;
    IF NOT FOUND OR NOT public.is_staff_of(v_course.class_id) THEN
        RAISE EXCEPTION 'Anda tidak berwenang mengirim pengingat untuk mata kuliah ini.';
    END IF;
    IF public.day_index(v_course.day_of_week) IS NULL OR v_course.start_time IS NULL THEN
        RAISE EXCEPTION 'Lengkapi hari & jam kuliah terlebih dahulu.';
    END IF;
    IF v_course.lecturer_id IS NULL AND v_course.reminder_target IS NULL THEN
        RAISE EXCEPTION 'Pilih dosen atau isi nomor tujuan pengingat terlebih dahulu.';
    END IF;
    INSERT INTO public.wa_messages (class_id, course_id, lecture_date, created_by)
    VALUES (v_course.class_id, p_course, public.next_lecture_date(v_course.day_of_week), auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_test_message(p_recipient TEXT, p_body TEXT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id(); v_id BIGINT;
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    IF length(trim(COALESCE(p_body, ''))) = 0 THEN
        RAISE EXCEPTION 'Isi pesan wajib diisi.';
    END IF;
    -- Batas sederhana anti-spam: maksimal 20 pesan manual per kelas per jam
    IF (SELECT count(*) FROM public.wa_messages
        WHERE class_id = v_class AND course_id IS NULL AND created_at > NOW() - interval '1 hour') >= 20 THEN
        RAISE EXCEPTION 'Terlalu banyak pesan uji. Coba lagi nanti.';
    END IF;
    INSERT INTO public.wa_messages (class_id, recipient, recipient_name, body, created_by)
    VALUES (v_class,
            CASE WHEN p_recipient LIKE '%@%' THEN trim(p_recipient) ELSE public.normalize_wa_phone(p_recipient) END,
            'Pesan uji', p_body, auth.uid())
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_wa_message(p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.wa_messages SET status = 'cancelled'
    WHERE id = p_id AND status = 'pending' AND public.is_staff_of(class_id);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pesan tidak dapat dibatalkan.';
    END IF;
END;
$$;

-- ============================================================================
-- 14. GRANT EXECUTE: default Supabase memberi EXECUTE ke anon; batasi eksplisit
-- ============================================================================
DO $$
DECLARE fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'public.my_class_id()', 'public.is_admin()', 'public.is_staff_of(uuid)', 'public.is_km_of(uuid)',
        'public.course_class(uuid)', 'public.member_class(uuid)', 'public.is_km_for_course(uuid)',
        'public.is_sipen_of(uuid)', 'public.can_manage_lecturer(uuid)',
        'public.choose_class(uuid)', 'public.approve_member(uuid)', 'public.remove_member(uuid)',
        'public.set_member_role(uuid, user_role)', 'public.list_pending_classes()',
        'public.approve_class(uuid)', 'public.reject_class(uuid)', 'public.get_class_lecturers()',
        'public.save_lecturer(uuid, text, text, text)', 'public.regenerate_lecturer_token(uuid)',
        'public.set_reminder_template(text)', 'public.wa_request(text, text)',
        'public.queue_reminder_now(uuid)', 'public.queue_test_message(text, text)',
        'public.cancel_wa_message(bigint)', 'public.get_my_profile()'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END LOOP;

    FOREACH fn IN ARRAY ARRAY['public.list_open_classes()', 'public.get_lecturer_portal(text)'] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', fn);
    END LOOP;
END $$;
