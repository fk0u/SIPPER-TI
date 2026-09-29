-- ============================================================================
-- SIPPER-TI: KM tidak boleh mereset sandi superadmin (walau sekelas)
-- Tanpa ini KM bisa mengubah sandi superadmin ke NIM-nya lewat route reset (service key).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.authorize_password_reset(p_user UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target public.profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_target FROM public.profiles WHERE id = p_user;
    IF NOT FOUND OR p_user = auth.uid()
       OR NOT (
           public.is_admin()
           OR (NOT v_target.is_admin AND v_target.class_id IS NOT NULL AND public.is_km_of(v_target.class_id))
       ) THEN
        RAISE EXCEPTION 'Anda tidak berwenang mereset kata sandi akun ini.';
    END IF;
    RETURN v_target.nim;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_password_reset(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_password_reset(uuid) TO authenticated;
