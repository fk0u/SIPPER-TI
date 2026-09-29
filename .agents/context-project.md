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
- **Backend:** Supabase self-hosted (PostgreSQL + RLS, Auth `@supabase/ssr`, Storage privat `permit-proofs`). Data via `src/lib/data/supabaseRepository.ts`, dijaga RLS.
- **Worker:** Go + whatsmeow (`worker/`), systemd `sipper-worker` di VPS: sesi WA per kelas, penjadwal pengingat, pengirim antrean.
- **Tema:** default gelap, diterapkan sebelum paint oleh skrip inline di `src/app/layout.tsx`.

---

## 👥 USER ROLES & ACCESS CONTROL (platform multi-kelas, sejak 2026-09-28)

Sumber kebenaran: RLS & RPC di `supabase/migrations/20260928_multi_class_platform.sql`. Cermin klien: `src/lib/permissions.ts`, rute: `src/lib/routes.ts`, menu: `src/lib/nav.ts`.

- `profiles.class_id` + `status` (`pending` | `active`) + `is_admin` (superadmin). Semua hak KM/Sipen hanya berlaku di kelasnya dan hanya bila `status = active`.
- Registrasi mandiri → pending → di-ACC Sipen/KM kelas (`approve_member`); menolak = `remove_member` (hapus akun).
- Kelas baru diajukan saat registrasi → di-ACC superadmin (`approve_class`) → pengaju jadi KM.
- Dosen: tabel `lecturers` lintas kelas (unik per nomor WA), link pribadi `/dosen/<access_token>` via RPC `get_lecturer_portal`.
- WhatsApp: `wa_sessions` (per kelas) & `wa_messages` (antrean) hanya ditulis lewat RPC; worker Go (`worker/`) menulis status.
- Mode demo sudah dihapus: aplikasi selalu butuh Supabase.
- RPC yang memakai pgcrypto (`gen_random_bytes`) wajib `SET search_path = public, extensions` (di Supabase pgcrypto ada di skema `extensions`; tes RLS di PostgreSQL biasa tidak menangkap ini — jalankan `scripts/e2e-api.py`).

---

## 📂 RUTE AKTUAL

| Rute | Akses | Keterangan |
| :--- | :--- | :--- |
| `/` | aktif | Beranda, metrik, feed izin |
| `/login`, `/register` | publik | NIM + password; registrasi pilih/ajukan kelas |
| `/menunggu` | pending | Status ACC, pilih ulang kelas |
| `/leave/new`, `/jadwal` | aktif | Ajukan izin; jadwal kelas (Sipen/KM mengelola) |
| `/approval`, `/anggota`, `/admin/dosen`, `/whatsapp` | Sipen, KM | Verifikasi izin, anggota, dosen & link, WhatsApp kelas |
| `/kelola` | aktif | Hub menu kelola untuk mobile |
| `/superadmin` | superadmin | ACC kelas, ganti KM, hari libur |
| `/settings/keamanan` | aktif | 2FA TOTP (ditegakkan proxy + helper RLS `mfa_satisfied()`) |
| `/kelas/[token]` (+`/calendar.ics`) | publik | Papan jadwal publik kelas |
| `/dosen/[token]` (+`/calendar.ics`) | publik | Portal dosen tanpa login |
| `/settings/password` | login | Ganti password (wajib untuk akun NIM default) |

---

## ⚙️ IMPORTANT BUSINESS LOGIC & CONSTRAINTS

- **Domain SSO:** divalidasi di server (`/api/auth/callback`) dan trigger DB `handle_new_user`. Parameter `hd` Google hanya petunjuk UI.
- **Login NIM:** email kampus `{nim}@umkt.ac.id` (akun yang sama dengan Google SSO), password awal = NIM, dibuat oleh `scripts/seed-auth-users.mjs`. Selama `is_password_changed = false` pengguna dipaksa ke `/settings/password`.
- **Tanggal:** selalu pakai `src/lib/date.ts` (tanggal lokal). Jangan `toISOString().split('T')[0]`.
- **Lampiran:** JPG/PNG/WebP/PDF ≤ 5MB (`src/lib/attachments.ts`). Mode live: diunggah ke `permit-proofs/{uid}/...`, `file_urls` menyimpan `path`, ditampilkan via signed URL. Tidak ada lampiran pengganti/palsu.
- **Proxy:** `created_by = pengaju`, `student_id = mahasiswa`; UI menandai "Proxy".
- **Link dosen:** 48 hex acak per dosen (`lecturers.access_token`); "buat link baru" langsung mematikan link lama.

---

## 🤖 INSTRUCTIONS FOR AI AGENT

- Baca `node_modules/next/dist/docs/` sebelum memakai API Next.js (lihat `AGENTS.md`).
- Setiap perubahan hak akses harus diubah di **dua tempat**: migrasi SQL baru (jangan edit migrasi lama) dan `src/lib/permissions.ts`, lalu perbarui `supabase/tests/rls_test.sql`.
- Sebelum commit: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:rls` bila menyentuh SQL, `npm run test:worker` bila menyentuh `worker/`.
- Gunakan tipe dari `src/types/database.ts`.
