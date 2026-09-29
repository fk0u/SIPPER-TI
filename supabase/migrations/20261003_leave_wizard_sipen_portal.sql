-- ============================================================================
-- SIPPER-TI: wizard izin (multi-hari / per jam), Sipen per matkul, portal dosen lanjutan
--   - leave_requests.batch_id: satu pengajuan wizard = satu baris per matkul terdampak
--   - leave_requests.start_time/end_time: izin sebagian jam (hanya untuk izin satu hari)
--   - Validasi server: rentang izin harus mengenai jadwal matkul tsb (hari & jam)
--   - Sipen mengelola matkul yang ditugaskan kepadanya; matkul buatan Sipen otomatis miliknya
--   - Reset kata sandi anggota ke NIM (KM kelas / superadmin) lewat route server
--   - Portal dosen: detail izin (alasan, jam, lampiran) + akses lampiran via route server
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Izin per batch & per jam
-- ----------------------------------------------------------------------------
ALTER TABLE public.leave_requests
    ADD COLUMN IF NOT EXISTS batch_id UUID,
    ADD COLUMN IF NOT EXISTS start_time TIME,
    ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_partial_hours;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_partial_hours CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time AND start_date = end_date)
);
CREATE INDEX IF NOT EXISTS idx_leave_batch ON public.leave_requests(batch_id);

-- Izin harus mengenai minimal satu pertemuan matkul (hari kuliah dalam rentang,
-- dan untuk izin per jam: jamnya beririsan dengan jam kuliah). Matkul tanpa jadwal lolos.
CREATE OR REPLACE FUNCTION public.validate_leave_schedule()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_course public.courses%ROWTYPE; v_dow INT;
BEGIN
    SELECT * INTO v_course FROM public.courses WHERE id = NEW.course_id;
    v_dow := public.day_index(v_course.day_of_week);
    IF v_dow IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.end_date - NEW.start_date > 180 THEN
        RAISE EXCEPTION 'Rentang izin maksimal 180 hari.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM generate_series(NEW.start_date, NEW.end_date, interval '1 day') d
        WHERE extract(dow FROM d)::int = v_dow
    ) THEN
        RAISE EXCEPTION 'Tidak ada jadwal % (%) pada rentang tanggal izin.', v_course.name, v_course.day_of_week;
    END IF;
    IF NEW.start_time IS NOT NULL AND v_course.start_time IS NOT NULL AND v_course.end_time IS NOT NULL
       AND NOT (NEW.start_time < v_course.end_time AND NEW.end_time > v_course.start_time) THEN
        RAISE EXCEPTION 'Jam izin tidak beririsan dengan jam kuliah % (%–%).',
            v_course.name, to_char(v_course.start_time, 'HH24:MI'), to_char(v_course.end_time, 'HH24:MI');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_requests_validate_schedule ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_validate_schedule
    BEFORE INSERT ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.validate_leave_schedule();

-- Kolom baru ikut dikunci setelah diajukan (verifikator hanya mengubah keputusan)
CREATE OR REPLACE FUNCTION public.protect_leave_request_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.leave_type IS DISTINCT FROM OLD.leave_type
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_time IS DISTINCT FROM OLD.end_time
       OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
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

-- ----------------------------------------------------------------------------
-- 2. Sipen per matkul: KM mengelola semua matkul kelas, Sipen hanya matkul tugasnya
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Courses updatable by class staff" ON public.courses;
DROP POLICY IF EXISTS "Courses deletable by class staff" ON public.courses;
DROP POLICY IF EXISTS "Courses updatable by KM or course Sipen" ON public.courses;
DROP POLICY IF EXISTS "Courses deletable by KM or course Sipen" ON public.courses;
CREATE POLICY "Courses updatable by KM or course Sipen"
    ON public.courses FOR UPDATE TO authenticated
    USING (public.is_km_of(class_id) OR public.is_sipen_of(id))
    WITH CHECK (public.is_km_of(class_id) OR (public.is_sipen_of(id) AND public.is_staff_of(class_id)));
CREATE POLICY "Courses deletable by KM or course Sipen"
    ON public.courses FOR DELETE TO authenticated
    USING (public.is_km_of(class_id) OR public.is_sipen_of(id));

-- Matkul yang dibuat Sipen langsung menjadi tanggung jawabnya
CREATE OR REPLACE FUNCTION public.assign_creator_sipen()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'sipen' AND status = 'active' AND class_id = NEW.class_id
    ) THEN
        INSERT INTO public.course_sipen (user_id, course_id) VALUES (auth.uid(), NEW.id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_courses_assign_creator_sipen ON public.courses;
CREATE TRIGGER trg_courses_assign_creator_sipen
    AFTER INSERT ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.assign_creator_sipen();

CREATE OR REPLACE FUNCTION public.queue_reminder_now(p_course UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_course public.courses%ROWTYPE; v_id BIGINT;
BEGIN
    SELECT * INTO v_course FROM public.courses WHERE id = p_course;
    IF NOT FOUND OR NOT (public.is_km_of(v_course.class_id) OR public.is_sipen_of(p_course)) THEN
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

-- ----------------------------------------------------------------------------
-- 3. Reset kata sandi ke NIM: otorisasi (route server memakai service key setelahnya)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.authorize_password_reset(p_user UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target public.profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_target FROM public.profiles WHERE id = p_user;
    IF NOT FOUND OR p_user = auth.uid()
       OR NOT (public.is_admin() OR (v_target.class_id IS NOT NULL AND public.is_km_of(v_target.class_id))) THEN
        RAISE EXCEPTION 'Anda tidak berwenang mereset kata sandi akun ini.';
    END IF;
    RETURN v_target.nim;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Portal dosen lanjutan
-- ----------------------------------------------------------------------------
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
                'semester', c.semester, 'class_name', k.name, 'link_group', c.link_group,
                'student_count', (SELECT count(*) FROM public.profiles p
                                  WHERE p.class_id = c.class_id AND p.status = 'active')
            ) ORDER BY public.day_index(c.day_of_week), c.start_time)
            FROM public.courses c JOIN public.classes k ON k.id = c.class_id
            WHERE c.lecturer_id = v_lecturer.id AND k.status = 'active'
        ), '[]'::jsonb),
        -- Hanya izin yang sudah diverifikasi Sipen/KM. Lampiran tanpa path: dibuka lewat
        -- /dosen/[token]/lampiran/[id]/[index] yang memvalidasi token di server.
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

-- Path lampiran untuk route server (service role saja): token harus milik dosen matkul izin tsb
CREATE OR REPLACE FUNCTION public.lecturer_attachment(p_token TEXT, p_leave UUID, p_index INT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT lr.file_urls -> p_index
    FROM public.leave_requests lr
    JOIN public.courses c ON c.id = lr.course_id
    JOIN public.lecturers l ON l.id = c.lecturer_id
    WHERE lr.id = p_leave AND lr.status = 'approved'
      AND p_token IS NOT NULL AND length(p_token) >= 32 AND l.access_token = p_token
      AND lr.end_date >= (NOW() AT TIME ZONE 'Asia/Makassar')::date - 180;
$$;

DO $$
BEGIN
    REVOKE ALL ON FUNCTION public.authorize_password_reset(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.authorize_password_reset(uuid) TO authenticated;
    REVOKE ALL ON FUNCTION public.lecturer_attachment(text, uuid, int) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.lecturer_attachment(text, uuid, int) TO service_role;
    REVOKE ALL ON FUNCTION public.validate_leave_schedule() FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.assign_creator_sipen() FROM PUBLIC, anon, authenticated;
END $$;
