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

- **Framework:** Next.js 16 (App Router, Turbopack, `src/proxy.ts` — pengganti `middleware`)
- **Bahasa:** TypeScript (strict)
- **UI:** React 19, Tailwind CSS v4, Lucide Icons, Geist font, komponen ReactBits (`SpotlightCard`, `ShinyText`, `CountUp`). Tidak memakai Shadcn/Framer Motion/GSAP.
- **State:** Zustand 5 (`useAuthStore`, `useLeaveStore`, `useThemeStore`, `useToastStore`)
- **Backend:** Supabase (PostgreSQL + RLS, Auth `@supabase/ssr`, Storage privat `leave-attachments`)
- **Mode ganda:**
  - **Live** — bila `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` terisi. Data via `src/lib/data/supabaseRepository.ts`, dijaga RLS.
  - **Demo** — bila env kosong. Data mock (`src/lib/mockData.ts`) di localStorage, termasuk pengalih profil demo.
- **Tema:** default gelap, diterapkan sebelum paint oleh skrip inline di `src/app/layout.tsx`.

---

## 👥 USER ROLES & ACCESS CONTROL

Sumber kebenaran: RLS di `supabase/migrations/20260927_security_hardening.sql`. Cermin sisi klien: `src/lib/permissions.ts`.

| Aksi | Mahasiswa | Sipen | KM | Dosen (tamu) |
| :--- | :---: | :---: | :---: | :---: |
| Lihat izin | milik sendiri | + matkul yang dikelola | semua | approved saja via token, tanpa alasan/berkas |
| Ajukan izin | diri sendiri | + proxy di matkulnya | + proxy semua matkul | – |
| Setujui/Tolak | – | matkul yang dikelola, bukan izin sendiri | semua, bukan izin sendiri | – |
| Kelola token dosen | – | lihat | buat & cabut | – |
| Ubah `role`/`nim`/`email` profil | – | – | – | hanya service role |

---

## 📂 RUTE AKTUAL

| Rute | Akses | Keterangan |
| :--- | :--- | :--- |
| `/` | login | Beranda, metrik, feed izin sesuai hak akses |
| `/login` | publik | Google SSO + NIM; `?next=` & `?error=` |
| `/leave/new` | login | Form izin (multi-hari, lampiran, proxy) |
| `/approval` | Sipen, KM | Terminal verifikasi + aksi massal |
| `/admin/tokens` | Sipen (lihat), KM (kelola) | Tautan akses dosen + QR + WhatsApp |
| `/settings/password` | login | Ganti password (wajib untuk akun NIM default) |
| `/lecturer/[token]` | publik | Rekap dosen, server-rendered via RPC `get_lecturer_recap` |
| `/api/auth/callback` | publik | Tukar kode OAuth, validasi domain `@umkt.ac.id` |

---

## ⚙️ IMPORTANT BUSINESS LOGIC & CONSTRAINTS

- **Domain SSO:** divalidasi di server (`/api/auth/callback`) dan trigger DB `handle_new_user`. Parameter `hd` Google hanya petunjuk UI.
- **Login NIM:** email sintetis `{nim}@local.sipper-ti`, password awal = NIM, dibuat oleh `scripts/seed-auth-users.mjs`. Selama `is_password_changed = false` pengguna dipaksa ke `/settings/password`.
- **Tanggal:** selalu pakai `src/lib/date.ts` (tanggal lokal). Jangan `toISOString().split('T')[0]`.
- **Lampiran:** JPG/PNG/WebP/PDF ≤ 5MB (`src/lib/attachments.ts`). Mode live: diunggah ke `leave-attachments/{uid}/...`, `file_urls` menyimpan `path`, ditampilkan via signed URL. Tidak ada lampiran pengganti/palsu.
- **Proxy:** `created_by = pengaju`, `student_id = mahasiswa`; UI menandai "Proxy".
- **Token dosen:** 48 hex acak, masa berlaku 180 hari, bisa dicabut (`revoked_at`).

---

## 🤖 INSTRUCTIONS FOR AI AGENT

- Baca `node_modules/next/dist/docs/` sebelum memakai API Next.js (lihat `AGENTS.md`).
- Setiap perubahan hak akses harus diubah di **dua tempat**: migrasi SQL baru (jangan edit migrasi lama) dan `src/lib/permissions.ts`, lalu perbarui `supabase/tests/rls_test.sql`.
- Sebelum commit: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, dan `npm run test:rls` bila menyentuh SQL.
- Gunakan tipe dari `src/types/database.ts`.
