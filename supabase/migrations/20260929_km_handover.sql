-- ============================================================================
-- SIPPER-TI: Serah terima / migrasi jabatan KM
--
-- - KM menyerahkan jabatan ke anggota aktif kelasnya (KM lama → Sipen).
-- - Superadmin dapat menunjuk KM kelas mana pun, termasuk dirinya sendiri
--   (mis. KM lulus / akun hilang, atau mengambil kembali jabatan KM).
-- - Status superadmin (profiles.is_admin) tidak pernah diubah oleh RPC mana pun;
--   hanya bisa diubah lewat SQL / service role (dikunci protect_profile_columns).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_member_role(p_user UUID, p_role user_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class UUID;
BEGIN
    SELECT class_id INTO v_class FROM public.profiles WHERE id = p_user AND status = 'active';
    -- KM mengatur anggota lain di kelasnya; superadmin mengatur siapa pun (termasuk diri sendiri)
    IF v_class IS NULL
       OR NOT (public.is_admin() OR (p_user <> auth.uid() AND public.is_km_of(v_class))) THEN
        RAISE EXCEPTION 'Anda tidak berwenang mengubah peran anggota ini.';
    END IF;
    -- Satu KM per kelas: KM lama menjadi Sipen
    IF p_role = 'km' THEN
        UPDATE public.profiles SET role = 'sipen' WHERE class_id = v_class AND role = 'km' AND id <> p_user;
    END IF;
    UPDATE public.profiles SET role = p_role WHERE id = p_user;
    IF p_role <> 'sipen' THEN
        DELETE FROM public.course_sipen WHERE user_id = p_user;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_member_role(uuid, user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, user_role) TO authenticated;
