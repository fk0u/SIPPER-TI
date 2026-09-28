-- ============================================================================
-- SIPPER-TI: Perbaikan hasil review PR #4
--   - Pembuat dosen yang sudah bukan staf tidak lagi bisa mengelola link dosen
--   - Registrasi: email NULL ditolak dengan jelas; nama kelas duplikat → pesan ramah
--   - Template pengingat divalidasi saat disimpan (worker Go menolak template rusak)
--   - Penugasan Sipen per matkul atomik (RPC set_course_sipen)
--   - wa_sessions.requested_at: worker membedakan permintaan baru dari status lama
--   - Portal dosen & papan kelas mengirim hari libur 365 hari (EXDATE kalender .ics)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_manage_lecturer(p_lecturer UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.is_admin()
        -- pembuat hanya selama masih KM/Sipen aktif
        OR EXISTS (SELECT 1 FROM public.lecturers l WHERE l.id = p_lecturer AND l.created_by = auth.uid()
                   AND public.is_staff_of(public.my_class_id()))
        OR EXISTS (SELECT 1 FROM public.courses c WHERE c.lecturer_id = p_lecturer AND public.is_staff_of(c.class_id));
$$;

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
    IF NOT COALESCE(user_email LIKE '%@umkt.ac.id' OR user_email LIKE '%.umkt.ac.id', FALSE) THEN
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
        IF EXISTS (SELECT 1 FROM public.classes WHERE lower(trim(name)) = lower(trim(meta ->> 'new_class_name'))) THEN
            RAISE EXCEPTION 'Nama kelas sudah dipakai. Pilih kelas itu di "Gabung Kelas" atau gunakan nama lain.';
        END IF;
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

-- Validasi ringan template Go text/template: kurung seimbang, blok if/range/with ditutup
-- {{end}}, dan hanya variabel yang disediakan worker (field tak dikenal = error di Go).
CREATE OR REPLACE FUNCTION public.assert_valid_template(p_template TEXT)
RETURNS VOID LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    v_open INT := (SELECT count(*) FROM regexp_matches(p_template, '\{\{', 'g'));
    v_close INT := (SELECT count(*) FROM regexp_matches(p_template, '\}\}', 'g'));
    v_blocks INT := (SELECT count(*) FROM regexp_matches(p_template, '\{\{-?\s*(if|range|with)\M', 'g'));
    v_ends INT := (SELECT count(*) FROM regexp_matches(p_template, '\{\{-?\s*end\s*-?\}\}', 'g'));
    v_field TEXT;
BEGIN
    IF v_open <> v_close THEN
        RAISE EXCEPTION 'Template tidak valid: jumlah {{ dan }} tidak sama.';
    END IF;
    IF v_blocks <> v_ends THEN
        RAISE EXCEPTION 'Template tidak valid: setiap {{if}} harus ditutup {{end}}.';
    END IF;
    -- Hanya di dalam aksi {{ ... }} (teks biasa seperti "M.T." atau URL bukan variabel)
    FOR v_field IN
        SELECT (regexp_matches(a.action, '\.([A-Za-z_][A-Za-z0-9_]*)', 'g'))[1]
        FROM (SELECT (regexp_matches(p_template, '\{\{(.*?)\}\}', 'g'))[1] AS action) a
    LOOP
        IF v_field <> ALL (ARRAY['NamaDosen','Matkul','Kode','Hari','Tanggal','JamMulai','JamSelesai','Lokasi',
                                 'LinkGroup','Kelas','NamaMahasiswa','NIM','HariDalamBahasa','WaktuSekarang']) THEN
            RAISE EXCEPTION 'Template tidak valid: variabel .% tidak dikenal.', v_field;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_reminder_template(p_template TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id(); v_old TEXT;
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    PERFORM public.assert_valid_template(p_template);
    SELECT reminder_template INTO v_old FROM public.classes WHERE id = v_class;
    IF v_old IS DISTINCT FROM p_template THEN
        INSERT INTO public.reminder_template_versions (class_id, content, created_by)
        VALUES (v_class, v_old, auth.uid());
        UPDATE public.classes SET reminder_template = p_template WHERE id = v_class;
    END IF;
END;
$$;

-- Penugasan Sipen sebuah mata kuliah dalam satu transaksi (KM)
CREATE OR REPLACE FUNCTION public.set_course_sipen(p_course UUID, p_users UUID[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.course_class(p_course);
BEGIN
    IF v_class IS NULL OR NOT public.is_km_of(v_class) THEN
        RAISE EXCEPTION 'Hanya KM kelas ini yang dapat menugaskan Sipen.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(COALESCE(p_users, '{}')) u(id)
        WHERE NOT EXISTS (SELECT 1 FROM public.profiles p
                          WHERE p.id = u.id AND p.role = 'sipen' AND p.status = 'active' AND p.class_id = v_class)
    ) THEN
        RAISE EXCEPTION 'Hanya Sipen aktif di kelas ini yang dapat ditugaskan.';
    END IF;
    DELETE FROM public.course_sipen WHERE course_id = p_course AND NOT (user_id = ANY (COALESCE(p_users, '{}')));
    INSERT INTO public.course_sipen (user_id, course_id)
    SELECT DISTINCT u, p_course FROM unnest(COALESCE(p_users, '{}')) u
    ON CONFLICT (user_id, course_id) DO NOTHING;
END;
$$;

ALTER TABLE public.wa_sessions ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
    INSERT INTO public.wa_sessions (class_id, desired, pair_phone, pair_code, requested_at, updated_at)
    VALUES (v_class, p_action, NULLIF(public.normalize_wa_phone(p_phone), ''), NULL, NOW(), NOW())
    ON CONFLICT (class_id) DO UPDATE
    SET desired = EXCLUDED.desired, pair_phone = EXCLUDED.pair_phone, pair_code = NULL,
        requested_at = NOW(), last_error = NULL, updated_at = NOW();
END;
$$;

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
              AND h.date < (NOW() AT TIME ZONE 'Asia/Makassar')::date + 365
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_class_board(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class public.classes%ROWTYPE;
BEGIN
    IF p_token IS NULL OR length(p_token) < 32 THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    SELECT * INTO v_class FROM public.classes WHERE public_token = p_token AND status = 'active';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;
    RETURN jsonb_build_object(
        'status', 'ok',
        'class', jsonb_build_object('name', v_class.name, 'program', v_class.program, 'batch', v_class.batch),
        'courses', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id, 'code', c.code, 'name', c.name, 'day_of_week', c.day_of_week,
                'start_time', c.start_time, 'end_time', c.end_time, 'room', c.room, 'semester', c.semester,
                'class_name', v_class.name, 'link_group', NULL,
                'lecturer_name', COALESCE(l.full_name, c.lecturer_name)
            ) ORDER BY public.day_index(c.day_of_week), c.start_time)
            FROM public.courses c LEFT JOIN public.lecturers l ON l.id = c.lecturer_id
            WHERE c.class_id = v_class.id
        ), '[]'::jsonb),
        'holidays', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('date', h.date, 'description', h.description) ORDER BY h.date)
            FROM public.holidays h
            WHERE h.date >= (NOW() AT TIME ZONE 'Asia/Makassar')::date
              AND h.date < (NOW() AT TIME ZONE 'Asia/Makassar')::date + 365
        ), '[]'::jsonb)
    );
END;
$$;

DO $$
DECLARE fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY['public.can_manage_lecturer(uuid)', 'public.set_reminder_template(text)',
                              'public.set_course_sipen(uuid, uuid[])', 'public.wa_request(text, text)'] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END LOOP;
    FOREACH fn IN ARRAY ARRAY['public.get_lecturer_portal(text)', 'public.get_class_board(text)'] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', fn);
    END LOOP;
END $$;
