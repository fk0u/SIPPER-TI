-- ============================================================================
-- SIPPER-TI: Database Migration Script (Sprint 1)
-- Project: Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika UMKT
-- Author: Database Engineer & Tech Lead
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('mahasiswa', 'sipen', 'km');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type_enum') THEN
        CREATE TYPE leave_type_enum AS ENUM ('sakit', 'izin', 'acara');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status_enum') THEN
        CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- 3. PROFILES TABLE (Linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nim VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone VARCHAR(20),
    role user_role DEFAULT 'mahasiswa' NOT NULL,
    avatar_url TEXT,
    is_password_changed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for searching profiles in Proxy submission
CREATE INDEX IF NOT EXISTS idx_profiles_nim ON public.profiles(nim);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. COURSES TABLE
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    lecturer_name TEXT NOT NULL,
    day_of_week VARCHAR(15) NOT NULL, -- e.g., 'Senin', 'Rabu'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    semester VARCHAR(20) DEFAULT '2026/2027-1' NOT NULL,
    room VARCHAR(50) DEFAULT 'Lab Komputer 3 / Online' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. COURSE_SIPEN TABLE (Mapping Sipen ke Mata Kuliah yang Diampu)
CREATE TABLE IF NOT EXISTS public.course_sipen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_sipen_user ON public.course_sipen(user_id);
CREATE INDEX IF NOT EXISTS idx_course_sipen_course ON public.course_sipen(course_id);

-- 6. LEAVE_REQUESTS TABLE (Multi-Day & Proxy Submission)
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    leave_type leave_type_enum NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    file_urls JSONB DEFAULT '[]'::jsonb NOT NULL,
    status leave_status_enum DEFAULT 'pending' NOT NULL,
    rejection_reason TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT check_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_student ON public.leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_course ON public.leave_requests(course_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON public.leave_requests(start_date, end_date);

-- 7. LECTURER_TOKENS TABLE (Guest Access Link Tanpa Login)
CREATE TABLE IF NOT EXISTS public.lecturer_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE, -- NULL = Akses semua matkul
    label TEXT NOT NULL,                                           -- e.g., 'Akses Dosen Dr. Hendra'
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lecturer_tokens_token ON public.lecturer_tokens(token);

-- ============================================================================
-- 8. AUTOMATIC PROFILE TRIGGER (Google OAuth @umkt.ac.id Handler)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
    email_domain TEXT;
    derived_nim VARCHAR(20);
    raw_name TEXT;
BEGIN
    user_email := NEW.email;
    email_domain := split_part(user_email, '@', 2);
    raw_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(user_email, '@', 1));
    derived_nim := COALESCE(NEW.raw_user_meta_data->>'nim', split_part(user_email, '@', 1));

    -- Enforce UMKT Domain check for OAuth logins
    IF email_domain != 'umkt.ac.id' AND email_domain != 'mail.umkt.ac.id' THEN
        -- Check if it's fallback email or throw
        IF NOT (user_email LIKE '%@umkt.ac.id' OR user_email LIKE '%@local.sipper-ti') THEN
            RAISE EXCEPTION 'Registrasi dibatasi hanya untuk akun civitas akademika UMKT (@umkt.ac.id)';
        END IF;
    END IF;

    INSERT INTO public.profiles (id, nim, email, full_name, role)
    VALUES (
        NEW.id,
        derived_nim,
        user_email,
        raw_name,
        'mahasiswa'
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sipen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturer_tokens ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can view profiles (for student directory & proxy selection)
CREATE POLICY "Profiles viewable by authenticated users" 
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Courses: Authenticated users can view all courses
CREATE POLICY "Courses viewable by authenticated users" 
    ON public.courses FOR SELECT TO authenticated USING (true);

-- Course Sipen: Authenticated users can view assignments
CREATE POLICY "Course Sipen viewable by authenticated users" 
    ON public.course_sipen FOR SELECT TO authenticated USING (true);

-- Leave Requests Policies:
-- 1. Read access: Student who filed or owns, Sipen of that course, or KM
CREATE POLICY "View leave requests policy" 
    ON public.leave_requests FOR SELECT TO authenticated
    USING (
        student_id = auth.uid() 
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.course_sipen cs 
            WHERE cs.user_id = auth.uid() AND cs.course_id = leave_requests.course_id
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'km'
        )
    );

-- 2. Insert access: Authenticated user can create an application
CREATE POLICY "Create leave requests policy" 
    ON public.leave_requests FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- 3. Update access: Only assigned Sipen or KM can approve/reject
CREATE POLICY "Update leave requests status policy" 
    ON public.leave_requests FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.course_sipen cs 
            WHERE cs.user_id = auth.uid() AND cs.course_id = leave_requests.course_id
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'km'
        )
    );

-- Lecturer Tokens Policies:
-- KM and Sipen can create and manage tokens
CREATE POLICY "Lecturer tokens viewable by KM and Sipen" 
    ON public.lecturer_tokens FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('km', 'sipen')
        )
    );

CREATE POLICY "Lecturer tokens manageable by KM" 
    ON public.lecturer_tokens FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role = 'km'
        )
    );

-- ============================================================================
-- 10. SUPABASE STORAGE BUCKET CONFIGURATION & RLS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'leave-attachments',
    'leave-attachments',
    true, -- public URLs for easy viewing in lightbox, secured via path prefix/random uuid
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Storage Policies
CREATE POLICY "Authenticated users can upload leave documents"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'leave-attachments');

CREATE POLICY "Anyone can view leave attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'leave-attachments');
