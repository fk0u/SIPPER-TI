# SIPPER-TI: Arsitektur Sistem & Data

## 1. Ikhtisar Arsitektur
SIPPER-TI dirancang dengan arsitektur modern Next.js 16 App Router (Turbopack) yang mengutamakan performa, aksesibilitas, dan diferensiasi pengalaman pengguna pada desktop maupun mobile.

```mermaid
graph TD
    A[Pengguna Mahasiswa / Sipen / KM] -->|Akses Web / Mobile| B[Next.js 16 App Router]
    C[Dosen Pengampu] -->|Akses Link Tamu / Guest Token| D[/lecturer/:token]
    
    B --> E[Zustand Client Stores]
    E --> F[useAuthStore: Multi-role & Session]
    E --> G[useLeaveStore: Requests & Tokens]
    
    E -.->|Optional Live Mode| H[(Supabase PostgreSQL / SSR)]
    
    B --> I[Responsive Layout Engine]
    I -->|Viewport Desktop| J[Desktop Top Navbar]
    I -->|Viewport Mobile| K[Mobile App Bar + Bottom Tab Dock]
```

## 2. Model Data & Peran Pengguna
Sistem membedakan 4 entitas peran:
1. **Mahasiswa:** Mengajukan izin pribadi, melampirkan berkas bukti, dan memantau status persetujuan.
2. **Sipen (Sie Pendidikan):** Mahasiswa penanggung jawab kelas yang memvalidasi berkas dan dapat mengajukan izin proxy.
3. **KM (Ketua Kelas):** Supervisor seluruh perizinan, mengelola token link dosen, dan memverifikasi izin.
4. **Dosen Pengampu:** Melihat rekapitulasi kehadiran secara real-time via token URL tanpa memerlukan autentikasi.

## 3. Skema Data Kunci
- `profiles`: `id, email, full_name, nim, role, avatar_url`
- `courses`: `id, code, name, lecturer_name, day_of_week, start_time, end_time, room, semester`
- `leave_requests`: `id, student_id, course_id, leave_type, start_date, end_date, reason, file_urls, status, rejection_reason, created_by, verified_by, verified_at`
- `lecturer_tokens`: `id, token, course_id, label, expires_at, created_by`
