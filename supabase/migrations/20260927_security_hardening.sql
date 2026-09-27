-- ============================================================================
-- SIPPER-TI: Security Hardening Migration
-- Menutup celah yang ditemukan pada audit 2026-09-27 (docs/audit/2026-09-27-audit.md)
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTIONS (SECURITY DEFINER agar tidak rekursif terhadap RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

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
    IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
        RETURN NEW;
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
        student_id <> auth.uid()
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
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
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

DROP POLICY IF EXISTS "Lecturer tokens manageable by KM" ON public.lecturer_tokens;
CREATE POLICY "Lecturer tokens manageable by KM"
    ON public.lecturer_tokens FOR ALL TO authenticated
    USING (public.is_km())
    WITH CHECK (public.is_km() AND created_by = auth.uid());

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
UPDATE storage.buckets SET public = false WHERE id = 'leave-attachments';

DROP POLICY IF EXISTS "Authenticated users can upload leave documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view leave attachments" ON storage.objects;

-- Path wajib: {auth.uid()}/{uuid}-{nama_file}
CREATE POLICY "Users upload leave documents to own folder"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'leave-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users delete own unattached leave documents"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'leave-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Baca: pemilik folder, atau siapa pun yang berhak melihat izin yang mereferensikan path tsb
CREATE POLICY "Leave documents readable by authorized users"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'leave-attachments'
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
-- 7. PROFIL OTOMATIS: domain UMKT + NIM dari metadata
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_email TEXT := lower(NEW.email);
    derived_nim VARCHAR(20);
    raw_name TEXT;
BEGIN
    -- Hanya domain kampus (termasuk subdomain) atau akun NIM internal
    IF NOT (
        user_email LIKE '%@umkt.ac.id'
        OR user_email LIKE '%.umkt.ac.id'
        OR user_email LIKE '%@local.sipper-ti'
    ) THEN
        RAISE EXCEPTION 'Registrasi dibatasi hanya untuk akun civitas akademika UMKT (@umkt.ac.id)';
    END IF;

    raw_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(user_email, '@', 1));
    -- NIM wajib dari metadata; akun Google tanpa NIM diberi placeholder unik
    -- yang nantinya diperbarui admin melalui service role.
    derived_nim := COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'nim', ''),
        'PENDING-' || substr(replace(NEW.id::text, '-', ''), 1, 12)
    );

    INSERT INTO public.profiles (id, nim, email, full_name, role)
    VALUES (NEW.id, derived_nim, user_email, raw_name, 'mahasiswa')
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- ============================================================================
-- 8. RPC: tandai password sudah diganti (dipanggil setelah auth.updateUser)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    UPDATE public.profiles SET is_password_changed = TRUE WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.mark_password_changed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;
