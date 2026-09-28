-- ============================================================================
-- SIPPER-TI: Melengkapi fitur SiPenDosa di platform
--   1. Jam operasional kirim per kelas (default 08:00–16:00, seperti SiPenDosa)
--   2. Mode uji (dry run): pengingat dirender & dicatat tanpa dikirim
--   3. Riwayat versi template (audit trail) + pulihkan
--   4. Grup WhatsApp yang diikuti nomor kelas (disinkron worker) untuk tujuan pengingat
--   5. Papan jadwal publik per kelas (+ kalender .ics)
--   6. Kirim ulang pesan gagal / dibatalkan, statistik pengiriman
--   7. 2FA (TOTP): akun dengan faktor terverifikasi wajib sesi aal2 untuk semua hak kelas/admin
-- ============================================================================

-- ============================================================================
-- 1–2. Pengaturan pengingat per kelas
-- ============================================================================
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS send_window_start TIME NOT NULL DEFAULT '08:00';
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS send_window_end TIME NOT NULL DEFAULT '16:00';
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS reminder_dry_run BOOLEAN NOT NULL DEFAULT FALSE;
-- NULL = papan jadwal publik nonaktif
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;
DO $$ BEGIN
    ALTER TABLE public.classes ADD CONSTRAINT classes_send_window_check CHECK (send_window_end > send_window_start);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.wa_messages DROP CONSTRAINT IF EXISTS wa_messages_status_check;
ALTER TABLE public.wa_messages ADD CONSTRAINT wa_messages_status_check
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled', 'dry_run'));

-- ============================================================================
-- 3. Riwayat versi template
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reminder_template_versions (
    id BIGSERIAL PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_template_versions_class ON public.reminder_template_versions(class_id, created_at DESC);

-- ============================================================================
-- 4. Grup WhatsApp (ditulis worker)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wa_groups (
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    jid TEXT NOT NULL,
    name TEXT NOT NULL,
    participants INT NOT NULL DEFAULT 0,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, jid)
);

-- ============================================================================
-- 7. 2FA: helper hak akses mensyaratkan aal2 bila pengguna punya faktor terverifikasi.
--    Semua policy & RPC kelas/admin memakai helper ini, sehingga sesi password saja
--    (aal1) dari akun ber-2FA tidak punya hak apa pun selain profil & izinnya sendiri.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
    SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = auth.uid() AND status = 'verified');
$$;

CREATE OR REPLACE FUNCTION public.my_class_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT class_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND public.mfa_satisfied();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE) AND public.mfa_satisfied();
$$;

CREATE OR REPLACE FUNCTION public.is_staff_of(p_class UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status = 'active' AND class_id = p_class AND role IN ('km', 'sipen')
    ) AND public.mfa_satisfied();
$$;

CREATE OR REPLACE FUNCTION public.is_km_of(p_class UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status = 'active' AND class_id = p_class AND role = 'km'
    ) AND public.mfa_satisfied();
$$;

CREATE OR REPLACE FUNCTION public.is_sipen_of(p_course_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.course_sipen cs
        JOIN public.profiles p ON p.id = cs.user_id
        JOIN public.courses c ON c.id = cs.course_id
        WHERE cs.user_id = auth.uid() AND cs.course_id = p_course_id
          AND p.role = 'sipen' AND p.status = 'active' AND p.class_id = c.class_id
    ) AND public.mfa_satisfied();
$$;

-- ============================================================================
-- RLS tabel baru
-- ============================================================================
ALTER TABLE public.reminder_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Template versions visible to class staff" ON public.reminder_template_versions;
CREATE POLICY "Template versions visible to class staff"
    ON public.reminder_template_versions FOR SELECT TO authenticated
    USING (public.is_staff_of(class_id));
DROP POLICY IF EXISTS "WA groups visible to class staff" ON public.wa_groups;
CREATE POLICY "WA groups visible to class staff"
    ON public.wa_groups FOR SELECT TO authenticated
    USING (public.is_staff_of(class_id));
REVOKE INSERT, UPDATE, DELETE ON public.reminder_template_versions, public.wa_groups FROM anon, authenticated;

-- ============================================================================
-- RPC
-- ============================================================================
-- Simpan template; versi lama masuk riwayat (audit trail SiPenDosa)
CREATE OR REPLACE FUNCTION public.set_reminder_template(p_template TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id(); v_old TEXT;
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    SELECT reminder_template INTO v_old FROM public.classes WHERE id = v_class;
    IF v_old IS DISTINCT FROM p_template THEN
        INSERT INTO public.reminder_template_versions (class_id, content, created_by)
        VALUES (v_class, v_old, auth.uid());
        UPDATE public.classes SET reminder_template = p_template WHERE id = v_class;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_reminder_settings(p_window_start TIME, p_window_end TIME, p_dry_run BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id();
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    IF p_window_end <= p_window_start THEN
        RAISE EXCEPTION 'Jam selesai operasional harus setelah jam mulai.';
    END IF;
    UPDATE public.classes
    SET send_window_start = p_window_start, send_window_end = p_window_end, reminder_dry_run = p_dry_run
    WHERE id = v_class;
END;
$$;

-- Kirim ulang pesan gagal / dibatalkan / dry run (percobaan dari awal)
CREATE OR REPLACE FUNCTION public.retry_wa_message(p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.wa_messages
    SET status = 'pending', attempts = 0, last_error = NULL, send_after = NOW(), created_at = NOW(), sent_at = NULL,
        -- pengingat dirender ulang dengan data & template terbaru
        body = CASE WHEN course_id IS NOT NULL THEN NULL ELSE body END,
        recipient = CASE WHEN course_id IS NOT NULL THEN NULL ELSE recipient END
    WHERE id = p_id AND status IN ('failed', 'cancelled', 'dry_run') AND public.is_staff_of(class_id);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pesan tidak dapat dikirim ulang.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.wa_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id();
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    RETURN (
        SELECT jsonb_build_object(
            'sent_today', count(*) FILTER (WHERE status = 'sent'
                AND (sent_at AT TIME ZONE 'Asia/Makassar')::date = (NOW() AT TIME ZONE 'Asia/Makassar')::date),
            'sent_total', count(*) FILTER (WHERE status = 'sent'),
            'failed_total', count(*) FILTER (WHERE status = 'failed'),
            'pending', count(*) FILTER (WHERE status IN ('pending', 'sending')),
            'dry_run_total', count(*) FILTER (WHERE status = 'dry_run')
        )
        FROM public.wa_messages WHERE class_id = v_class
    );
END;
$$;

-- Papan jadwal publik: on = aktifkan (token dibuat bila belum ada), rotate = token baru, off = nonaktif
CREATE OR REPLACE FUNCTION public.set_class_board(p_action TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID := public.my_class_id(); v_token TEXT;
BEGIN
    IF v_class IS NULL OR NOT public.is_staff_of(v_class) THEN
        RAISE EXCEPTION 'Khusus KM / Sipen.';
    END IF;
    UPDATE public.classes SET public_token = CASE p_action
            WHEN 'on' THEN COALESCE(public_token, encode(gen_random_bytes(24), 'hex'))
            WHEN 'rotate' THEN encode(gen_random_bytes(24), 'hex')
            WHEN 'off' THEN NULL
        END
    WHERE id = v_class AND p_action IN ('on', 'rotate', 'off')
    RETURNING public_token INTO v_token;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aksi tidak dikenal.';
    END IF;
    RETURN v_token;
END;
$$;

-- Papan jadwal publik (tanpa login): jadwal kelas + libur. Tanpa data mahasiswa / izin.
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
              AND h.date < (NOW() AT TIME ZONE 'Asia/Makassar')::date + 120
        ), '[]'::jsonb)
    );
END;
$$;

DO $$
DECLARE fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'public.mfa_satisfied()', 'public.set_reminder_template(text)',
        'public.update_reminder_settings(time, time, boolean)', 'public.retry_wa_message(bigint)',
        'public.wa_stats()', 'public.set_class_board(text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END LOOP;
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_class_board(text) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_class_board(text) TO anon, authenticated';
END $$;

-- Supabase memasang pgcrypto di skema `extensions`: fungsi yang membuat token acak
-- harus bisa menemukannya (di PostgreSQL biasa skema ini tidak ada dan diabaikan).
ALTER FUNCTION public.regenerate_lecturer_token(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.set_class_board(text) SET search_path = public, extensions;
