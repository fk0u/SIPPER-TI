# SIPPER-TI

> **Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika**  
> *Universitas Muhammadiyah Kalimantan Timur (UMKT)*

SIPPER-TI adalah aplikasi web modern kelas produksi untuk otomasi manajemen perizinan presensi mahasiswa kelas internasional, verifikasi keabsahan surat keterangan dokter/tugas oleh Sipen & KM, serta rekapitulasi kehadiran instan untuk Dosen Pengampu tanpa login.

---

## 🚀 Fitur Unggulan Sistem

### 1. 👥 Manajemen Peran Multi-Level (Role-Based Access Control)
- **Mahasiswa:** Mengajukan izin pribadi (Sakit / Izin Pribadi / Tugas Lomba), melampirkan berkas bukti (PDF/Foto), dan melacak status verifikasi secara langsung.
- **Sipen (Sie Pendidikan):** Memvalidasi bukti surat, menyetujui atau menolak perizinan dengan catatan alasan, serta mengajukan izin proxy atas nama mahasiswa lain yang berhalangan hadir.
- **KM (Ketua Kelas):** Supervisor absensi kelas penuh, berwenang mengelola tautan token dosen, memantau rekap menyeluruh, dan memverifikasi izin di semua mata kuliah. Keputusan verifikasi bersifat final (tidak dapat diubah setelah disetujui/ditolak).
- **Dosen Pengampu:** Mengakses rekapitulasi kehadiran mahasiswa secara instan melalui **Guest Access Token Link** tanpa perlu login atau registrasi akun.

### 2. 📱 Arsitektur Navigasi Terpisah (Desktop vs Mobile)
- **Desktop ($\ge 768\text{px}$):** Top Navigation Bar mengambang dengan efek *Liquid Glass*, menu rute lengkap dengan indikator aktif, badge antrean pending dinamis, popover pergantian profil demo, dan *Theme Toggle* minimalis.
- **Mobile ($< 768\text{px}$):** Antarmuka native app shell yang dirancang untuk ergonomi jempol:
  - **Top App Bar:** Menampilkan identitas sistem, tag peran aktif, dan tombol akses cepat profil.
  - **Floating Bottom Dock:** Tab navigasi mengambang 4 menu (`Beranda`, `Ajukan Izin`, `Approval`, `Link Dosen`) dengan feedback sentuhan haptic, bebas dari bug overlay atau backdrop blur yang mengunci layar.

### 3. 🎨 Estetika Visual Awwwards / Linear-Tier
- **Double-Bezel (Doppelrand):** Arsitektur kartu berlapis ganda menyerupai hardware machined fisik dengan pembiasan tepi kaca bagian dalam.
- **Tipografi:** Ditenagai oleh font teknikal **Geist** & **Geist Mono** via `next/font/google` dengan *tight tracking* dan *tabular figures* untuk angka data.
- **Komponen ReactBits Terintegrasi:**
  - `SpotlightCard`: Efek sorot kursor interaktif dengan inner edge lighting.
  - `ShinyText`: Efek kemilau dinamis pada nama pengguna dan judul portal.
  - `CountUp`: Animasi penghitungan angka live pada dashboard metrik presensi.
- **Palet Warna Disiplin:** Basis netral Slate/Graphite dengan aksen tunggal *Electric Cobalt* dan penanda status semantik yang terkalibrasi.

### 4. 🔗 Manajemen Tautan Publik Dosen
- Pembuatan tautan token akses instan dengan masa aktif 180 hari.
- Fitur **1-Klik Bagikan ke WhatsApp Dosen** dengan pesan pengantar sopan yang otomatis terformat.
- Tampilan cetak ramah kertas (*print-ready layout*) untuk arsip perkuliahan fisik.

---

## 🛠️ Tech Stack

| Komponen | Teknologi |
| :--- | :--- |
| **Framework** | [Next.js 16 (App Router + Turbopack)](https://nextjs.org/) |
| **Bahasa** | [TypeScript 5](https://www.typescriptlang.org/) |
| **UI Library** | [React 19](https://react.dev/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **State Management** | [Zustand 5](https://github.com/pmndrs/zustand) (dengan persist middleware) |
| **Iconography** | [Lucide React](https://lucide.dev/) |
| **Micro-Interactions** | [ReactBits](https://reactbits.dev/) |
| **Font** | Geist Sans & Geist Mono |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + RLS, Auth, Storage) — opsional, fallback mode demo |
| **Testing** | Vitest, SQL checks (`scripts/test-rls.sh`), GitHub Actions |

---

## 📂 Struktur Direktori Proyek

```
SIPPER-TI/
├── docs/                        # Dokumentasi arsitektur & roadmap
│   ├── architecture.md          # Diagram sistem & skema relasi
│   ├── design-system.md         # Standar desain, token, & komponen
│   ├── user-manual.md           # Panduan penggunaan pengguna
│   └── project/roadmap.md       # Roadmap milestone proyek
├── src/
│   ├── app/                     # Next.js App Router Pages
│   │   ├── admin/tokens/        # Kelola Link Akses Dosen
│   │   ├── approval/            # Terminal Review Perizinan
│   │   ├── leave/new/           # Formulir Pengajuan Izin
│   │   ├── lecturer/[token]/    # Portal Tamu Dosen (server-rendered via RPC)
│   │   ├── login/               # Portal Masuk Akun Kampus
│   │   ├── settings/password/   # Ganti kata sandi (wajib untuk akun NIM baru)
│   │   ├── globals.css          # Desain tokens, doppelrand, liquid-glass
│   │   ├── layout.tsx           # Root layout dengan Geist font
│   │   └── page.tsx             # Beranda Bento 2.0 & Feed Izin
│   ├── components/
│   │   ├── admin/               # Komponen Token Dosen
│   │   ├── approval/            # Komponen Review & Validasi
│   │   ├── auth/                # Komponen Login SSO & NIM
│   │   ├── layout/              # Navbar (Desktop) & BottomNav (Mobile)
│   │   ├── leave/               # Form Izin, Kartu Izin, Document Viewer
│   │   ├── lecturer/            # Rekap Presensi Dosen & Cetak
│   │   └── reactbits/           # SpotlightCard, ShinyText, CountUp
│   ├── lib/                     # permissions, date, attachments, data/ (Supabase repo), supabase/
│   ├── proxy.ts                 # Guard rute & refresh sesi (Next.js 16)
│   ├── store/                   # Zustand stores (useAuthStore, useLeaveStore)
│   └── types/                   # TypeScript interfaces & database schemas
├── supabase/
│   ├── migrations/              # Skema awal + security hardening
│   ├── tests/                   # Shim Supabase + uji RLS
│   └── seed.sql                 # Data contoh (dev/staging)
├── scripts/                     # test-rls.sh, seed-auth-users.mjs
└── package.json
```

---

## ⚡ Memulai Pengembangan Lokal

### 1. Prasyarat
- Node.js 20+ (CI memakai 22)
- (Opsional) PostgreSQL 16 client untuk `npm run test:rls`

### 2. Instalasi & Menjalankan
```bash
npm install
npm run dev          # http://localhost:3000
```
Tanpa file `.env.local`, aplikasi berjalan dalam **mode demo** (data contoh di browser).

### 3. Mode Live (Supabase)
1. Salin `.env.example` → `.env.local`, isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY`.
2. Jalankan migrasi berurutan di Supabase SQL Editor / CLI:
   `supabase/migrations/20260921_initial_schema.sql` lalu `20260927_security_hardening.sql`.
3. Buat akun login NIM: `node --env-file=.env.local scripts/seed-auth-users.mjs [roster.csv]`.
   Password awal = NIM dan wajib diganti saat login pertama (ditegakkan `src/proxy.ts`). Karena NIM mudah ditebak,
   buat akun per batch sesaat sebelum dipakai dan minta mahasiswa segera masuk & mengganti password.
4. (Dev/staging saja) jalankan `supabase/seed.sql` untuk data contoh.
5. Aktifkan provider Google di Supabase Auth dan tambahkan `https://<domain>/api/auth/callback` ke Redirect URLs.

### 4. Kualitas & Pengujian
```bash
npm run lint
npm run typecheck
npm test             # unit test (Vitest)
npm run test:rls     # uji RLS di PostgreSQL (butuh PGHOST/PGUSER)
# E2E mode demo (Playwright): build dulu, jalankan server, tunggu siap, lalu uji
npx playwright install chromium
npm run build
PORT=3100 npm run start & SERVER_PID=$!
E2E_BASE_URL=http://localhost:3100 npm run test:e2e   # menunggu server siap (maks. 120 dtk)
kill $SERVER_PID
npm run build
```

---

## 👥 Pengujian Akun Demo

Untuk kemudahan pengujian tanpa konfigurasi OAuth, aplikasi dilengkapi dengan akun demo bawaan:
1. **Rian Pratama (Mahasiswa):** `rian.pratama@umkt.ac.id` (NIM: `2311102441101`)
2. **Sarah Amalia (Sipen):** `sarah.amalia@umkt.ac.id` (NIM: `2311102441102`)
3. **Budi Santoso (KM):** `budi.santoso@umkt.ac.id` (NIM: `2311102441103`)

Pada **mode demo**, gunakan tombol **"Akses Cepat Profil Demo"** di halaman login atau menu profil di header untuk berpindah akun. Login NIM memakai NIM sebagai password awal dan akan meminta penggantian password. Fitur pengalih profil otomatis nonaktif pada mode live.

---

## 📄 Lisensi
Dikembangkan untuk keperluan akademik Kelas Internasional Program Studi Teknik Informatika, Universitas Muhammadiyah Kalimantan Timur.
