-- ============================================================================
-- SIPPER-TI: aturan izin di server + catatan audit
--   - Izin harus mengenai pertemuan yang BUKAN hari libur
--   - Izin ganda (mahasiswa + matkul + tanggal/jam beririsan, pending/approved) ditolak
--   - Batas pengajuan: tanggal mulai paling lambat 2 hari (2×24 jam) sebelum hari ini (WITA)
--   - Pembatalan: izin pending boleh dihapus oleh mahasiswanya atau pengajunya
--   - audit_log: ACC/tolak/batal izin, ACC/peran/keluarkan anggota, reset sandi
--   - revoke_user_sessions: reset sandi mengakhiri sesi lama (service role saja)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_leave_schedule()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_course public.courses%ROWTYPE;
    v_dow INT;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Makassar')::date;
BEGIN
    IF NEW.end_date - NEW.start_date > 180 THEN
        RAISE EXCEPTION 'Rentang izin maksimal 180 hari.';
    END IF;
    -- Batas 2×24 jam hanya untuk pengajuan pengguna (bukan impor/seed admin tanpa JWT)
    IF auth.uid() IS NOT NULL AND NEW.start_date < v_today - 2 THEN
        RAISE EXCEPTION 'Izin hanya bisa diajukan paling lambat 2×24 jam setelah tanggal kuliah (mulai % atau sesudahnya).',
            to_char(v_today - 2, 'DD-MM-YYYY');
    END IF;

    SELECT * INTO v_course FROM public.courses WHERE id = NEW.course_id;
    v_dow := public.day_index(v_course.day_of_week);
    IF v_dow IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM generate_series(NEW.start_date, NEW.end_date, interval '1 day') d
            WHERE extract(dow FROM d)::int = v_dow
              AND NOT EXISTS (SELECT 1 FROM public.holidays h WHERE h.date = d::date)
        ) THEN
            RAISE EXCEPTION 'Tidak ada jadwal % (%) pada rentang tanggal izin (hari libur tidak dihitung).',
                v_course.name, v_course.day_of_week;
        END IF;
        IF NEW.start_time IS NOT NULL AND v_course.start_time IS NOT NULL AND v_course.end_time IS NOT NULL
           AND NOT (NEW.start_time < v_course.end_time AND NEW.end_time > v_course.start_time) THEN
            RAISE EXCEPTION 'Jam izin tidak beririsan dengan jam kuliah % (%–%).',
                v_course.name, to_char(v_course.start_time, 'HH24:MI'), to_char(v_course.end_time, 'HH24:MI');
        END IF;
    END IF;

    -- Izin ganda: kunci per mahasiswa+matkul agar dua kiriman bersamaan tidak sama-sama lolos
    PERFORM pg_advisory_xact_lock(hashtext(NEW.student_id::text || NEW.course_id::text));
    IF EXISTS (
        SELECT 1 FROM public.leave_requests e
        WHERE e.student_id = NEW.student_id AND e.course_id = NEW.course_id
          AND e.status IN ('pending', 'approved')
          AND e.start_date <= NEW.end_date AND e.end_date >= NEW.start_date
          AND (e.start_time IS NULL OR NEW.start_time IS NULL
               OR (e.start_time < NEW.end_time AND e.end_time > NEW.start_time))
    ) THEN
        RAISE EXCEPTION 'Sudah ada izin % untuk tanggal/jam tersebut (menunggu atau disetujui).', v_course.name;
    END IF;
    RETURN NEW;
END;
$$;

-- Pembatalan izin yang belum diverifikasi
DROP POLICY IF EXISTS "Cancel pending leave requests" ON public.leave_requests;
CREATE POLICY "Cancel pending leave requests"
    ON public.leave_requests FOR DELETE TO authenticated
    USING (
        status = 'pending'
        AND (student_id = auth.uid() OR created_by = auth.uid())
        AND public.mfa_satisfied()
    );
GRANT DELETE ON public.leave_requests TO authenticated;

-- ----------------------------------------------------------------------------
-- Audit log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor UUID,             -- tanpa FK: riwayat tetap ada walau akun dihapus
    action TEXT NOT NULL,
    target_user UUID,
    class_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_class_at ON public.audit_log (class_id, at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audit visible to class KM and admin" ON public.audit_log;
CREATE POLICY "Audit visible to class KM and admin"
    ON public.audit_log FOR SELECT TO authenticated
    USING (public.is_admin() OR (class_id IS NOT NULL AND public.is_km_of(class_id)));
REVOKE ALL ON public.audit_log FROM anon, authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO service_role;
GRANT USAGE ON SEQUENCE public.audit_log_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.audit(p_action TEXT, p_target UUID, p_class UUID, p_details JSONB)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    INSERT INTO public.audit_log (actor, action, target_user, class_id, details)
    VALUES (auth.uid(), p_action, p_target, p_class,
            p_details || jsonb_build_object('actor_nim', (SELECT nim FROM public.profiles WHERE id = auth.uid())));
$$;

-- Hanya aksi pengguna (ada JWT) yang dicatat; migrasi/seed/pembersihan admin tidak
CREATE OR REPLACE FUNCTION public.audit_profiles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'DELETE' THEN
        PERFORM public.audit(CASE WHEN OLD.status = 'pending' THEN 'member.rejected' ELSE 'member.removed' END,
            OLD.id, OLD.class_id, jsonb_build_object('target_nim', OLD.nim, 'target_name', OLD.full_name));
    ELSIF OLD.status = 'pending' AND NEW.status = 'active' THEN
        PERFORM public.audit('member.approved', NEW.id, NEW.class_id,
            jsonb_build_object('target_nim', NEW.nim, 'target_name', NEW.full_name));
    ELSIF NEW.role IS DISTINCT FROM OLD.role AND NEW.status = 'active' THEN
        PERFORM public.audit('member.role', NEW.id, NEW.class_id,
            jsonb_build_object('target_nim', NEW.nim, 'target_name', NEW.full_name, 'from', OLD.role, 'to', NEW.role));
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
    AFTER UPDATE OF status, role OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_profiles();

CREATE OR REPLACE FUNCTION public.audit_leaves()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.leave_requests%ROWTYPE := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
BEGIN
    IF auth.uid() IS NULL OR (TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status) THEN
        RETURN NULL;
    END IF;
    -- Hapus karena matkul/akun dihapus (cascade) bukan pembatalan
    IF TG_OP = 'DELETE' AND auth.uid() NOT IN (OLD.student_id, OLD.created_by) THEN
        RETURN NULL;
    END IF;
    PERFORM public.audit(
        CASE WHEN TG_OP = 'DELETE' THEN 'leave.cancelled' ELSE 'leave.' || NEW.status END,
        r.student_id, public.course_class(r.course_id),
        jsonb_build_object(
            'target_nim', (SELECT nim FROM public.profiles WHERE id = r.student_id),
            'target_name', (SELECT full_name FROM public.profiles WHERE id = r.student_id),
            'course', (SELECT code || ' ' || name FROM public.courses WHERE id = r.course_id),
            'start_date', r.start_date, 'end_date', r.end_date,
            'rejection_reason', r.rejection_reason));
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_leaves ON public.leave_requests;
CREATE TRIGGER trg_audit_leaves
    AFTER UPDATE OF status OR DELETE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.audit_leaves();

-- Reset sandi mengakhiri semua sesi (refresh token) akun tsb; dipanggil route server
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM auth.sessions WHERE user_id = p_user;
END;
$$;

DO $$
BEGIN
    REVOKE ALL ON FUNCTION public.audit(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.audit_profiles() FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.audit_leaves() FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;
END $$;
