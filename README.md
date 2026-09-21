# SIPPER-TI

> **Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika**  
> *Universitas Muhammadiyah Kalimantan Timur (UMKT)*

SIPPER-TI adalah aplikasi web modern kelas produksi untuk otomasi manajemen perizinan presensi mahasiswa kelas internasional, verifikasi keabsahan surat keterangan dokter/tugas oleh Sipen & KM, serta rekapitulasi kehadiran instan untuk Dosen Pengampu tanpa login.

---

## 🚀 Fitur Unggulan Sistem

### 1. 👥 Manajemen Peran Multi-Level (Role-Based Access Control)
- **Mahasiswa:** Mengajukan izin pribadi (Sakit / Izin Pribadi / Tugas Lomba), melampirkan berkas bukti (PDF/Foto), dan melacak status verifikasi secara langsung.
- **Sipen (Sie Pendidikan):** Memvalidasi bukti surat, menyetujui atau menolak perizinan dengan catatan alasan, serta mengajukan izin proxy atas nama mahasiswa lain yang berhalangan hadir.
- **KM (Ketua Kelas):** Supervisor absensi kelas penuh, berwenang mengelola tautan token dosen, memantau rekap menyeluruh, dan mengoverride keputusan izin.
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
| **Micro-Interactions** | [ReactBits](https://reactbits.dev/) & [GSAP](https://gsap.com/) |
| **Font** | Geist Sans & Geist Mono |
| **Database & Auth (Opsional)** | [Supabase PostgreSQL](https://supabase.com/) |

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
│   │   ├── lecturer/[token]/    # Portal Tamu Dosen Pengampu
│   │   ├── login/               # Portal Masuk Akun Kampus
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
│   ├── lib/                     # Mock data & Supabase client
│   ├── store/                   # Zustand stores (useAuthStore, useLeaveStore)
│   └── types/                   # TypeScript interfaces & database schemas
└── package.json
```

---

## ⚡ Memulai Pengembangan Lokal

### 1. Prasyarat
- Node.js versi 18.18+ atau 20+
- npm atau pnpm

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka peramban di [http://localhost:3000](http://localhost:3000) (atau port yang dialokasikan).

### 4. Membangun untuk Produksi
```bash
npm run build
npm run start
```

---

## 👥 Pengujian Akun Demo

Untuk kemudahan pengujian tanpa konfigurasi OAuth, aplikasi dilengkapi dengan akun demo bawaan:
1. **Rian Pratama (Mahasiswa):** `rian.pratama@umkt.ac.id` (NIM: `2311102441101`)
2. **Sarah Amalia (Sipen):** `sarah.amalia@umkt.ac.id` (NIM: `2311102441102`)
3. **Budi Santoso (KM):** `budi.santoso@umkt.ac.id` (NIM: `2311102441103`)

Gunakan tombol **"Akses Cepat Profil Demo"** di halaman login atau menu popover profil di header untuk berpindah akun secara instan.

---

## 📄 Lisensi
Dikembangkan untuk keperluan akademik Kelas Internasional Program Studi Teknik Informatika, Universitas Muhammadiyah Kalimantan Timur.
