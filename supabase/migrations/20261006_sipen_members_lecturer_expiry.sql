-- ============================================================================
-- SIPPER-TI: penugasan matkul dari halaman Anggota + masa berlaku link dosen
--   - KM juga boleh tercatat sebagai Sipen matkul (hak KM tetap penuh)
--   - set_member_courses: KM kelas / superadmin mengatur matkul seorang Sipen/KM sekaligus
--   - lecturers.token_expires_at: link dosen berlaku sampai akhir semester + 14 hari;
--     diperpanjang otomatis saat link dibuat ulang
--   - lecturers.last_accessed_at / access_count: kapan link terakhir dibuka
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_course_sipen(p_course UUID, p_users UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.course_class(p_course);
BEGIN
    IF v_class IS NULL OR NOT (public.is_km_of(v_class) OR public.is_admin()) THEN
        RAISE EXCEPTION 'Hanya KM kelas ini yang dapat menugaskan Sipen.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(COALESCE(p_users, '{}')) u(id)
        WHERE NOT EXISTS (SELECT 1 FROM public.profiles p
                          WHERE p.id = u.id AND p.role IN ('sipen', 'km') AND p.status = 'active' AND p.class_id = v_class)
    ) THEN
        RAISE EXCEPTION 'Hanya Sipen / KM aktif di kelas ini yang dapat ditugaskan.';
    END IF;
    DELETE FROM public.course_sipen WHERE course_id = p_course AND NOT (user_id = ANY (COALESCE(p_users, '{}')));
    INSERT INTO public.course_sipen (user_id, course_id)
    SELECT DISTINCT u, p_course FROM unnest(COALESCE(p_users, '{}')) u
    ON CONFLICT (user_id, course_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_member_courses(p_user UUID, p_courses UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID;
BEGIN
    SELECT class_id INTO v_class FROM public.profiles
    WHERE id = p_user AND role IN ('sipen', 'km') AND status = 'active';
    IF v_class IS NULL THEN
        RAISE EXCEPTION 'Hanya Sipen / KM aktif yang dapat ditugaskan ke mata kuliah.';
    END IF;
    IF NOT (public.is_km_of(v_class) OR public.is_admin()) THEN
        RAISE EXCEPTION 'Hanya KM kelas ini yang dapat menugaskan Sipen.';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_courses, '{}')) c(id)
               WHERE public.course_class(c.id) IS DISTINCT FROM v_class) THEN
        RAISE EXCEPTION 'Mata kuliah harus dari kelas yang sama.';
    END IF;
    DELETE FROM public.course_sipen WHERE user_id = p_user AND NOT (course_id = ANY (COALESCE(p_courses, '{}')));
    INSERT INTO public.course_sipen (user_id, course_id)
    SELECT DISTINCT p_user, c FROM unnest(COALESCE(p_courses, '{}')) c
    ON CONFLICT (user_id, course_id) DO NOTHING;
END;
$$;

-- Penugasan langsung ke tabel (policy lama) juga menerima KM
DROP POLICY IF EXISTS "Course Sipen assignable by KM" ON public.course_sipen;
CREATE POLICY "Course Sipen assignable by KM"
    ON public.course_sipen FOR INSERT TO authenticated
    WITH CHECK (
        public.is_km_for_course(course_id)
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = user_id AND p.role IN ('sipen', 'km') AND p.status = 'active'
              AND p.class_id = public.course_class(course_id)
        )
    );

-- ----------------------------------------------------------------------------
-- Masa berlaku & jejak akses link dosen
-- ----------------------------------------------------------------------------
-- Akhir semester (WITA) + 14 hari: ganjil Agu–Jan → 31 Jan, genap Feb–Jul → 31 Jul
CREATE OR REPLACE FUNCTION public.lecturer_token_expiry()
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$
    SELECT ((CASE
                WHEN extract(month FROM d) >= 8 THEN make_date(extract(year FROM d)::int + 1, 1, 31)
                WHEN extract(month FROM d) = 1 THEN make_date(extract(year FROM d)::int, 1, 31)
                ELSE make_date(extract(year FROM d)::int, 7, 31)
             END + 15)::timestamp AT TIME ZONE 'Asia/Makassar')
    FROM (SELECT (NOW() AT TIME ZONE 'Asia/Makassar')::date AS d) t;
$$;

ALTER TABLE public.lecturers
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS access_count INT NOT NULL DEFAULT 0;
UPDATE public.lecturers SET token_expires_at = public.lecturer_token_expiry() WHERE token_expires_at IS NULL;
ALTER TABLE public.lecturers ALTER COLUMN token_expires_at SET DEFAULT public.lecturer_token_expiry();
ALTER TABLE public.lecturers ALTER COLUMN token_expires_at SET NOT NULL;

-- Link baru (dibuat ulang) = masa berlaku baru; jejak akses direset
CREATE OR REPLACE FUNCTION public.renew_lecturer_token()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.access_token IS DISTINCT FROM OLD.access_token THEN
        NEW.token_expires_at := public.lecturer_token_expiry();
        NEW.last_accessed_at := NULL;
        NEW.access_count := 0;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_lecturers_renew_token ON public.lecturers;
CREATE TRIGGER trg_lecturers_renew_token
    BEFORE UPDATE OF access_token ON public.lecturers
    FOR EACH ROW EXECUTE FUNCTION public.renew_lecturer_token();

DROP FUNCTION IF EXISTS public.get_class_lecturers();
CREATE FUNCTION public.get_class_lecturers()
RETURNS TABLE (id UUID, full_name TEXT, phone TEXT, email TEXT, access_token TEXT,
               course_count BIGINT, can_edit BOOLEAN,
               token_expires_at TIMESTAMPTZ, last_accessed_at TIMESTAMPTZ, access_count INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id();
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    RETURN QUERY
    SELECT l.id, l.full_name, l.phone, l.email, l.access_token,
           (SELECT count(*) FROM public.courses c WHERE c.lecturer_id = l.id AND c.class_id = v_class),
           (l.created_by = auth.uid() OR public.is_admin()),
           l.token_expires_at, l.last_accessed_at, l.access_count
    FROM public.lecturers l
    WHERE l.created_by = auth.uid()
       OR EXISTS (SELECT 1 FROM public.courses c WHERE c.lecturer_id = l.id AND c.class_id = v_class)
    ORDER BY l.full_name;
END;
$$;

-- Portal: tolak link kedaluwarsa, catat akses (maks. sekali per 5 menit dihitung kunjungan)
CREATE OR REPLACE FUNCTION public.get_lecturer_portal(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lecturer public.lecturers%ROWTYPE;
BEGIN
    IF p_token IS NULL OR length(p_token) < 32 THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    SELECT * INTO v_lecturer FROM public.lecturers WHERE access_token = p_token;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    IF v_lecturer.token_expires_at <= NOW() THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;
    UPDATE public.lecturers
    SET last_accessed_at = NOW(),
        access_count = access_count + CASE WHEN last_accessed_at IS NULL OR last_accessed_at < NOW() - interval '5 minutes' THEN 1 ELSE 0 END
    WHERE id = v_lecturer.id;

    RETURN jsonb_build_object(
        'status', 'ok',
        'lecturer', jsonb_build_object('full_name', v_lecturer.full_name, 'token_expires_at', v_lecturer.token_expires_at),
        'courses', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id, 'code', c.code, 'name', c.name, 'day_of_week', c.day_of_week,
                'start_time', c.start_time, 'end_time', c.end_time, 'room', c.room,
                'semester', c.semester, 'class_name', k.name, 'link_group', c.link_group,
                'student_count', (SELECT count(*) FROM public.profiles p
                                  WHERE p.class_id = c.class_id AND p.status = 'active')
            ) ORDER BY public.day_index(c.day_of_week), c.start_time)
            FROM public.courses c JOIN public.classes k ON k.id = c.class_id
            WHERE c.lecturer_id = v_lecturer.id AND k.status = 'active'
        ), '[]'::jsonb),
        'leaves', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', lr.id, 'course_id', lr.course_id, 'leave_type', lr.leave_type,
                'start_date', lr.start_date, 'end_date', lr.end_date,
                'start_time', lr.start_time, 'end_time', lr.end_time,
                'reason', lr.reason, 'batch_id', lr.batch_id,
                'created_at', lr.created_at, 'verified_at', lr.verified_at,
                'verifier_name', v.full_name,
                'student_name', p.full_name, 'student_nim', p.nim,
                'files', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('name', f ->> 'name', 'type', f ->> 'type',
                                                        'size', (f ->> 'size')::bigint) ORDER BY i)
                    FROM jsonb_array_elements(lr.file_urls) WITH ORDINALITY AS a(f, i)
                ), '[]'::jsonb)
            ) ORDER BY lr.start_date DESC, p.full_name)
            FROM public.leave_requests lr
            JOIN public.courses c ON c.id = lr.course_id
            JOIN public.profiles p ON p.id = lr.student_id
            LEFT JOIN public.profiles v ON v.id = lr.verified_by
            WHERE c.lecturer_id = v_lecturer.id AND lr.status = 'approved'
              AND lr.end_date >= (NOW() AT TIME ZONE 'Asia/Makassar')::date - 180
        ), '[]'::jsonb),
        'holidays', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('date', h.date, 'description', h.description) ORDER BY h.date)
            FROM public.holidays h
            WHERE h.date >= (NOW() AT TIME ZONE 'Asia/Makassar')::date - 180
              AND h.date < (NOW() AT TIME ZONE 'Asia/Makassar')::date + 365
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.lecturer_attachment(p_token TEXT, p_leave UUID, p_index INT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT lr.file_urls -> p_index
    FROM public.leave_requests lr
    JOIN public.courses c ON c.id = lr.course_id
    JOIN public.lecturers l ON l.id = c.lecturer_id
    WHERE lr.id = p_leave AND lr.status = 'approved'
      AND p_token IS NOT NULL AND length(p_token) >= 32 AND l.access_token = p_token
      AND l.token_expires_at > NOW()
      AND lr.end_date >= (NOW() AT TIME ZONE 'Asia/Makassar')::date - 180;
$$;

DO $$
BEGIN
    REVOKE ALL ON FUNCTION public.set_member_courses(uuid, uuid[]) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.set_member_courses(uuid, uuid[]) TO authenticated;
    REVOKE ALL ON FUNCTION public.get_class_lecturers() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.get_class_lecturers() TO authenticated;
    REVOKE ALL ON FUNCTION public.get_lecturer_portal(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_lecturer_portal(text) TO anon, authenticated, service_role;
    REVOKE ALL ON FUNCTION public.lecturer_attachment(text, uuid, int) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.lecturer_attachment(text, uuid, int) TO service_role;
    REVOKE ALL ON FUNCTION public.renew_lecturer_token() FROM PUBLIC, anon, authenticated;
END $$;
