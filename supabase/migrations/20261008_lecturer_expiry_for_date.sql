-- ============================================================================
-- SIPPER-TI: batas link dosen dihitung dari tanggal eksplisit (dapat diuji deterministik)
-- lecturer_token_expiry() tetap dipakai default kolom; kini membungkus versi bertanggal.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lecturer_token_expiry_for(p_date DATE)
RETURNS TIMESTAMPTZ LANGUAGE sql IMMUTABLE AS $$
    -- Akhir semester + 14 hari (pukul 00:00 WITA hari ke-15): ganjil Agu–Jan → 31 Jan, genap Feb–Jul → 31 Jul
    SELECT ((CASE
                WHEN extract(month FROM p_date) >= 8 THEN make_date(extract(year FROM p_date)::int + 1, 1, 31)
                WHEN extract(month FROM p_date) = 1 THEN make_date(extract(year FROM p_date)::int, 1, 31)
                ELSE make_date(extract(year FROM p_date)::int, 7, 31)
             END + 15)::timestamp AT TIME ZONE 'Asia/Makassar');
$$;

CREATE OR REPLACE FUNCTION public.lecturer_token_expiry()
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$
    SELECT public.lecturer_token_expiry_for((NOW() AT TIME ZONE 'Asia/Makassar')::date);
$$;
