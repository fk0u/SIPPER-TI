-- ============================================================================
-- SIPPER-TI: sesi yang dicabut langsung kehilangan akses (tidak menunggu JWT kedaluwarsa)
-- JWT Supabase membawa klaim session_id. Semua helper hak akses & cabang "milik sendiri"
-- sudah melewati mfa_satisfied(), jadi pemeriksaan sesi ditambahkan di sana: sesi yang
-- dihapus (reset sandi → revoke_user_sessions, atau logout) langsung tidak melihat data kelas.
-- JWT tanpa session_id (service role / uji) tidak terpengaruh.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
    SELECT (
        COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = auth.uid() AND status = 'verified')
    )
    AND (
        auth.jwt() ->> 'session_id' IS NULL
        OR EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id::text = auth.jwt() ->> 'session_id')
    );
$$;
