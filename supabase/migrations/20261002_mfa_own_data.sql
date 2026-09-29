-- ============================================================================
-- SIPPER-TI: 2FA juga menutup data milik sendiri
-- Helper kelas/admin sudah mensyaratkan mfa_satisfied(); policy berikut punya cabang
-- "milik sendiri" yang tidak lewat helper, sehingga sesi password saja (aal1) dari akun
-- ber-2FA masih bisa membaca kelasnya, izinnya (termasuk alasan medis) dan lampirannya.
-- Profil sendiri tetap terbaca (dibutuhkan layar kode 2FA; hanya kolom publik).
-- ============================================================================

DROP POLICY IF EXISTS "Classes visible to members and admin" ON public.classes;
CREATE POLICY "Classes visible to members and admin"
    ON public.classes FOR SELECT TO authenticated
    USING (
        (public.mfa_satisfied() AND (
            id = (SELECT class_id FROM public.profiles WHERE id = auth.uid())
            OR created_by = auth.uid()
        ))
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "View leave requests policy" ON public.leave_requests;
CREATE POLICY "View leave requests policy"
    ON public.leave_requests FOR SELECT TO authenticated
    USING (
        ((student_id = auth.uid() OR created_by = auth.uid()) AND public.mfa_satisfied())
        OR public.is_sipen_of(course_id)
        OR public.is_km_for_course(course_id)
    );

DROP POLICY IF EXISTS "Users upload leave documents to own folder" ON storage.objects;
CREATE POLICY "Users upload leave documents to own folder"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'permit-proofs'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.mfa_satisfied()
    );

DROP POLICY IF EXISTS "Users delete own unattached leave documents" ON storage.objects;
CREATE POLICY "Users delete own unattached leave documents"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'permit-proofs'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.mfa_satisfied()
        AND NOT EXISTS (
            SELECT 1
            FROM public.leave_requests lr,
                 jsonb_array_elements(lr.file_urls) AS f
            WHERE f ->> 'path' = storage.objects.name
        )
    );

DROP POLICY IF EXISTS "Leave documents readable by authorized users" ON storage.objects;
CREATE POLICY "Leave documents readable by authorized users"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'permit-proofs'
        AND (
            ((storage.foldername(name))[1] = auth.uid()::text AND public.mfa_satisfied())
            OR EXISTS (
                SELECT 1
                FROM public.leave_requests lr,
                     jsonb_array_elements(lr.file_urls) AS f
                WHERE f ->> 'path' = storage.objects.name
                  AND (
                      ((lr.student_id = auth.uid() OR lr.created_by = auth.uid()) AND public.mfa_satisfied())
                      OR public.is_km_for_course(lr.course_id)
                      OR public.is_sipen_of(lr.course_id)
                  )
            )
        )
    );
