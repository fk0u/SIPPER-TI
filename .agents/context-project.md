# 📌 CONTEXTPROJECT.md — SIPPER-TI DEVELOPMENT CONTEXT

## 🎯 ABOUT THE PROJECT

**SIPPER-TI** (Sistem Informasi Perizinan & Presensi Kelas) adalah platform web _mobile-first_ yang dirancang khusus untuk mengelola perizinan perkuliahan (sakit, izin biasa, acara kampus) secara tersentralisasi untuk kelas internasional Teknik Informatika UMKT Angkatan 2026.

Platform ini menyelesaikan masalah tercecernya surat izin di WhatsApp dengan menyediakan:

1. **Frictionless Student Submission:** Pengajuan izin cepat via mobile.
2. **Proxy Input by Sipen/KM:** Seksi Pendidikan (Sipen) atau Ketua Kelas (KM) dapat membantu menginputkan izin atas nama mahasiswa yang sakit berat/berhalangan.
3. **Multi-Format Proof Attachment:** Pengunggahan bukti izin dalam bentuk Foto/PDF dengan preview modal.
4. **Zero-Login Lecturer Guest Access:** Dosen pengampu dapat melihat rekap presensi perizinan real-time via URL Token khusus tanpa perlu registrasi/login.

---

## 🛠️ TECH STACK & SYSTEM ARCHITECTURE

- **Frontend Framework:** Next.js 14+ (App Router with Server Actions & Route Handlers)
- **Language:** TypeScript (Strict Mode)
- **Styling & Components:** Tailwind CSS, Shadcn UI, Lucide Icons, Framer Motion
- **State Management:** Zustand (Client-side state management for forms, filter stores, and modals)
- **Backend & Database:** Supabase Serverless (PostgreSQL + Supabase Auth `@supabase/ssr` + Supabase Storage)
- **Theme:** Default Dark Mode (Surfaces: `#090d16`, `#111827`, Accents: Blue `#3b82f6`, Emerald `#10b981`, Rose `#f43f5e`, Amber `#f59e0b`)

---

## 👥 USER ROLES & ACCESS CONTROL

1. **Mahasiswa (Student):**
   - Login via **Google SSO (`@umkt.ac.id`)** atau **NIM + Password Default (NIM)**.
   - Mengajukan izin pribadi, mengunggah lampiran, dan memantau status pengajuan (_Pending_, _Approved_, _Rejected_).

2. **Sipen (Seksi Pendidikan) & KM (Ketua Kelas):**
   - Memiliki akses ke Dashboard Verifikasi (`/sipen`).
   - Verifikasi pengajuan (Approve/Reject + Alasan Penolakan).
   - Menjalankan **Proxy Submission** (menginputkan izin atas nama mahasiswa lain).
   - Mengelola Token Guest Access untuk Dosen.

3. **Dosen (Lecturer - Guest Read-Only):**
   - Mengakses Halaman Rekap (`/rekap/[token]`) **tanpa login/akun**.
   - Memantau mahasiswa yang izin pada mata kuliah & tanggal berjalan.

---

## 🗄️ DATABASE SCHEMA OVERVIEW (SUPABASE POSTGRESQL)

```sql
-- ENUMS
CREATE TYPE user_role AS ENUM ('mahasiswa', 'sipen', 'km');
CREATE TYPE leave_type_enum AS ENUM ('sakit', 'izin', 'acara');
CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected');

-- TABLES
- profiles (id PK, nim UK, email UK, full_name, role, is_password_changed)
- courses (id PK, code UK, name, semester)
- course_sipen (id PK, user_id FK, course_id FK)
- leave_requests (id PK, student_id FK, course_id FK, leave_type, start_date, end_date, reason, file_urls jsonb, status, rejection_reason, created_by FK, verified_by FK)
- lecturer_tokens (id PK, token UK, course_id FK nullable, expires_at)
```

# 📂 DIRECTORY STRUCTURE (NEXT.JS APP ROUTER)

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx               # Dual Login (SSO Google + NIM)
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx           # Student View
│   │   ├── sipen/page.tsx               # Sipen/KM Verification & Proxy Input
│   │   └── settings/page.tsx            # Force Password Change & Settings
│   ├── rekap/[token]/page.tsx           # Public Guest Lecturer View (SSR)
│   ├── api/
│   │   └── auth/callback/route.ts       # Domain Restriction Validator (@umkt.ac.id)
├── components/
│   ├── forms/                           # LeaveForm, ProxySubmitModal
│   ├── modals/                          # ProofViewerModal, TokenGeneratorModal
│   ├── cards/                           # LeaveRequestCard, StatusBadge
│   └── ui/                              # Shadcn UI primitives
├── lib/
│   ├── supabase/                        # SSR & Client Supabase Instance
│   └── store/                           # Zustand Stores (leaveStore, modalStore)
└── types/                               # TypeScript Definitions
```

# ⚙️ IMPORTANT BUSINESS LOGIC & CONSTRAINTS

Strict SSO Domain Locking:

Auth callback WAJIB memvalidasi domain email pengguna. Jika email BUKAN berakhiran @umkt.ac.id, batalkan login dan tampilkan notifikasi penolakan.

Mandatory Password Change:

Jika mahasiswa login menggunakan NIM dan profiles.is_password_changed = false, panggil ForcePasswordModal secara unclosable sampai password berhasil diperbarui.

Multi-Day Leave Validation:

Pengajuan izin mendukung rentang tanggal. Pastikan validasi end_date >= start_date terpenuhi sebelum submit.

Multi-Format Attachment Handling:

Berkas pendukung disimpan di Supabase Bucket permit-proofs dengan format jsonb array URL. Mendukung pratinjau gambar dan PDF viewer.

Proxy Input Flagging:

Ketika Sipen menginputkan izin untuk mahasiswa, simpan created_by = sipen_id dan student_id = sick_student_id. Tampilkan indikator "Diinput oleh Sipen" pada UI.

# 🤖 INSTRUCTIONS FOR AI AGENT (ANTIGRAVITY)

Code Style: Gunakan TypeScript ketat, komponen modular React (Server Components jika memungkinkan, Client Components jika membutuhkan interaksi/Zustand), serta Tailwind CSS untuk responsivitas mobile-first.

Consistency: Selalu gunakan tipe data dari src/types/database.ts saat menangani request/response Supabase.

Safety First: Pastikan kebijakan Row Level Security (RLS) dan validasi formulir selalu diperiksa sebelum mengeksekusi Server Actions.
