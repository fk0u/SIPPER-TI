-- ============================================================================
-- SIPPER-TI: Security Hardening Migration
-- Menutup celah yang ditemukan pada audit 2026-09-27 (docs/audit/2026-09-27-audit.md)
--
-- Migrasi ini dirancang aman diterapkan ke:
--   (a) database baru yang dibuat dari 20260921_initial_schema.sql, dan
--   (b) database live yang skemanya dibuat terpisah (enum, kolom, bucket berbeda).
-- Seluruh policy lama pada tabel aplikasi dihapus lalu dibuat ulang, sehingga
-- policy longgar yang tidak terdokumentasi tidak dapat membatalkan hardening.
-- ============================================================================

-- ============================================================================
-- 0. REKONSILIASI SKEMA (idempoten)
-- ============================================================================
ALTER TYPE leave_type_enum ADD VALUE IF NOT EXISTS 'izin_biasa';
ALTER TYPE leave_type_enum ADD VALUE IF NOT EXISTS 'keluar_kampus';
ALTER TYPE leave_type_enum ADD VALUE IF NOT EXISTS 'acara_kampus';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Jadwal mata kuliah opsional
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS lecturer_name TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS day_of_week VARCHAR(15);
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS room VARCHAR(50);
ALTER TABLE public.courses ALTER COLUMN lecturer_name DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN day_of_week DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN room DROP NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sipen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturer_tokens ENABLE ROW LEVEL SECURITY;

-- Hapus SEMUA policy lama pada tabel aplikasi & policy storage untuk bucket lampiran
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE (schemaname = 'public'
               AND tablename IN ('profiles', 'courses', 'course_sipen', 'leave_requests', 'lecturer_tokens'))
           OR (schemaname = 'storage' AND tablename = 'objects'
               AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ '(permit-proofs|leave-attachments)')
    LOOP
        EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- RPC lama (dibuat di luar repo) tidak boleh dipanggil klien karena bisa melewati aturan baru
DO $$
DECLARE fn RECORD;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('approve_leave_request', 'reject_leave_request',
                            'get_leave_requests_for_lecturer', 'is_sipen_for_course', 'get_my_role')
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    END LOOP;
END $$;

-- Kebijakan baca dasar (dibuat ulang setelah pembersihan)
CREATE POLICY "Profiles directory for authenticated users"
    ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Courses viewable by authenticated users"
    ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Course Sipen viewable by authenticated users"
    ON public.course_sipen FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecturer tokens viewable by KM and Sipen"
    ON public.lecturer_tokens FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('km', 'sipen')));

-- ============================================================================
-- 1. HELPER FUNCTIONS (SECURITY DEFINER agar tidak rekursif terhadap RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_km()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'km');
$$;

CREATE OR REPLACE FUNCTION public.is_sipen_of(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.course_sipen cs
        JOIN public.profiles p ON p.id = cs.user_id
        WHERE cs.user_id = auth.uid() AND cs.course_id = p_course_id AND p.role = 'sipen'
    );
$$;

-- ============================================================================
-- 2. updated_at TRIGGER GENERIK
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. PROFILES: cegah eskalasi role / perubahan identitas oleh pengguna sendiri
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- service_role (backend admin) dan koneksi tanpa JWT (SQL editor / migrasi) boleh mengubah semuanya
    IF auth.uid() IS NULL
       OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
       OR current_setting('sipper.trusted_update', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF NEW.is_password_changed IS DISTINCT FROM OLD.is_password_changed THEN
        RAISE EXCEPTION 'Status penggantian kata sandi hanya diperbarui oleh sistem.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.nim IS DISTINCT FROM OLD.nim
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Kolom role, nim, dan email hanya dapat diubah oleh administrator.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_columns ON public.profiles;
CREATE TRIGGER trg_profiles_protect_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Kolom privat (email, telepon, status password) tidak boleh dibaca sesama pengguna.
-- RLS membatasi baris, bukan kolom — gunakan grant per kolom.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, nim, full_name, role, avatar_url, created_at, updated_at)
    ON public.profiles TO authenticated;

-- Profil lengkap milik sendiri
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- ============================================================================
-- 4. LEAVE_REQUESTS: aturan insert, verifikasi, dan penguncian kolom
-- ============================================================================
DROP POLICY IF EXISTS "View leave requests policy" ON public.leave_requests;
CREATE POLICY "View leave requests policy"
    ON public.leave_requests FOR SELECT TO authenticated
    USING (
        student_id = auth.uid()
        OR created_by = auth.uid()
        OR public.is_sipen_of(course_id)
        OR public.is_km()
    );

DROP POLICY IF EXISTS "Create leave requests policy" ON public.leave_requests;
CREATE POLICY "Create leave requests policy"
    ON public.leave_requests FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND status = 'pending'
        AND verified_by IS NULL
        AND verified_at IS NULL
        AND rejection_reason IS NULL
        AND (
            student_id = auth.uid()
            OR public.is_km()
            OR public.is_sipen_of(course_id)
        )
    );

DROP POLICY IF EXISTS "Update leave requests status policy" ON public.leave_requests;
CREATE POLICY "Update leave requests status policy"
    ON public.leave_requests FOR UPDATE TO authenticated
    USING (
        status = 'pending'
        AND student_id <> auth.uid()
        AND (public.is_km() OR public.is_sipen_of(course_id))
    )
    WITH CHECK (
        student_id <> auth.uid()
        AND verified_by = auth.uid()
        AND status IN ('approved', 'rejected')
        AND (status <> 'rejected' OR length(trim(COALESCE(rejection_reason, ''))) > 0)
        AND (public.is_km() OR public.is_sipen_of(course_id))
    );

CREATE OR REPLACE FUNCTION public.protect_leave_request_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    -- Verifikator hanya boleh mengubah kolom keputusan
    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.leave_type IS DISTINCT FROM OLD.leave_type
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.file_urls IS DISTINCT FROM OLD.file_urls
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Hanya status verifikasi yang dapat diubah pada pengajuan izin.';
    END IF;

    IF NEW.status = 'approved' THEN
        NEW.rejection_reason := NULL;
    END IF;

    NEW.verified_by := auth.uid();
    NEW.verified_at := NOW();
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_requests_protect_columns ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_protect_columns
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.protect_leave_request_columns();

-- ============================================================================
-- 5. LECTURER_TOKENS: token lebih panjang, revoke, dan akses publik via RPC
-- ============================================================================
ALTER TABLE public.lecturer_tokens
    ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(24), 'hex');
ALTER TABLE public.lecturer_tokens
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE POLICY "Lecturer tokens insertable by KM"
    ON public.lecturer_tokens FOR INSERT TO authenticated
    WITH CHECK (public.is_km() AND created_by = auth.uid());
-- Semua KM boleh mencabut/menghapus token, termasuk buatan KM lain.
CREATE POLICY "Lecturer tokens updatable by KM"
    ON public.lecturer_tokens FOR UPDATE TO authenticated
    USING (public.is_km())
    WITH CHECK (public.is_km());
CREATE POLICY "Lecturer tokens deletable by KM"
    ON public.lecturer_tokens FOR DELETE TO authenticated
    USING (public.is_km());

-- Rekap untuk dosen tamu. Hanya mengembalikan izin berstatus approved dan
-- kolom minimum yang diperlukan (tanpa alasan medis & lampiran).
CREATE OR REPLACE FUNCTION public.get_lecturer_recap(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_token public.lecturer_tokens%ROWTYPE;
    v_result JSONB;
BEGIN
    SELECT * INTO v_token FROM public.lecturer_tokens WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    IF v_token.revoked_at IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'revoked');
    END IF;
    IF v_token.expires_at IS NOT NULL AND v_token.expires_at < NOW() THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    SELECT jsonb_build_object(
        'status', 'ok',
        'token', jsonb_build_object(
            'label', v_token.label,
            'course_id', v_token.course_id,
            'expires_at', v_token.expires_at
        ),
        'courses', COALESCE((
            SELECT jsonb_agg(to_jsonb(c) ORDER BY c.code)
            FROM public.courses c
            WHERE v_token.course_id IS NULL OR c.id = v_token.course_id
        ), '[]'::jsonb),
        'leaves', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', lr.id,
                'course_id', lr.course_id,
                'leave_type', lr.leave_type,
                'start_date', lr.start_date,
                'end_date', lr.end_date,
                'student_name', p.full_name,
                'student_nim', p.nim
            ) ORDER BY lr.start_date DESC)
            FROM public.leave_requests lr
            JOIN public.profiles p ON p.id = lr.student_id
            WHERE lr.status = 'approved'
              AND (v_token.course_id IS NULL OR lr.course_id = v_token.course_id)
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_lecturer_recap(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lecturer_recap(TEXT) TO anon, authenticated;

-- ============================================================================
-- 6. STORAGE: bucket privat, upload per folder user, baca sesuai hak akses izin
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('permit-proofs', 'permit-proofs', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Path wajib: {auth.uid()}/{uuid}-{nama_file}
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
        -- Bukti yang sudah dirujuk pengajuan izin tidak boleh dihapus
        AND NOT EXISTS (
            SELECT 1
            FROM public.leave_requests lr,
                 jsonb_array_elements(lr.file_urls) AS f
            WHERE f ->> 'path' = storage.objects.name
        )
    );

-- Baca: pemilik folder, atau siapa pun yang berhak melihat izin yang mereferensikan path tsb
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
                      OR public.is_km()
                      OR public.is_sipen_of(lr.course_id)
                  )
            )
        )
    );

-- ============================================================================
-- 7. PROFIL OTOMATIS: domain UMKT + NIM dari email kampus
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_email TEXT := lower(NEW.email);
    local_part TEXT := split_part(lower(NEW.email), '@', 1);
    derived_nim VARCHAR(20);
    raw_name TEXT;
BEGIN
    -- Hanya domain kampus (termasuk subdomain)
    IF NOT (user_email LIKE '%@umkt.ac.id' OR user_email LIKE '%.umkt.ac.id') THEN
        RAISE EXCEPTION 'Registrasi dibatasi hanya untuk akun civitas akademika UMKT (@umkt.ac.id)';
    END IF;

    raw_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', local_part);
    -- NIM diturunkan dari email kampus ({nim}@umkt.ac.id). raw_user_meta_data dapat diisi
    -- klien saat signup sehingga TIDAK dipakai untuk NIM (mencegah klaim NIM orang lain).
    derived_nim := CASE
        WHEN local_part ~ '^[0-9]{8,20}$' THEN local_part
        -- Placeholder unik (≤ 20 karakter) sampai NIM diisi admin
        ELSE 'P-' || substr(md5(NEW.id::text), 1, 18)
    END;

    INSERT INTO public.profiles (id, nim, email, full_name, role)
    VALUES (NEW.id, derived_nim, user_email, raw_name, 'mahasiswa')
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 8. STATUS GANTI KATA SANDI: ditandai hanya ketika kredensial auth benar-benar berubah
-- ============================================================================
DROP FUNCTION IF EXISTS public.mark_password_changed();

CREATE OR REPLACE FUNCTION public.handle_password_changed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
        PERFORM set_config('sipper.trusted_update', 'on', true);
        UPDATE public.profiles SET is_password_changed = TRUE WHERE id = NEW.id;
        PERFORM set_config('sipper.trusted_update', 'off', true);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_password_changed ON auth.users;
CREATE TRIGGER on_auth_user_password_changed
    AFTER UPDATE OF encrypted_password ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_password_changed();
