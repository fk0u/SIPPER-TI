# Session Briefing: SIPPER-TI

## Project Identity
- **Name:** SIPPER-TI (Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika UMKT)
- **Domain:** Akademik & Manajemen Presensi Mahasiswa Kelas Internasional UMKT
- **Tech Stack:** Next.js 16 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS v4, Zustand, Lucide Icons, Geist Font, ReactBits.
- **Roles:** Mahasiswa, Sipen (Sie Pendidikan), KM (Ketua Kelas), Dosen Pengampu (Guest Token Access).

## Status & Goals
- **Active Goal:** Menyelenggarakan redesign penuh tingkat produksi (bukan prototype) dengan arsitektur navigasi desktop vs mobile yang sistematis dan terpisah tegas.
- **Navigation Architecture:**
  - Desktop: Top app bar lengkap dengan link navigasi, indikator rute aktif, dropdown profil akun, role switch, dan theme toggle.
  - Mobile: Native mobile layout. Top bar ringkas (Logo + Active Role + Profile Avatar trigger), Bottom Tab Bar (Beranda, Ajukan Izin, Approval, Link Dosen) yang ergonomis dan bebas blur/overlay bug.
- **Fitur Lanjutan Selesai:**
  - Multi-select & floating action dock bar untuk persetujuan / penolakan izin massal (Bulk Approval).
  - Generator modal QR Code instan untuk pemindaian kamera HP dosen langsung di kelas beserta tombol download PNG & direct link.
  - Sistem notifikasi toast global terpadu (`useToastStore` & `ToastContainer`) untuk semua aksi CRUD & autentikasi.
  - Validasi produksi Next.js 16 (`npm run build` sukses 100% tanpa error TypeScript).
- **Integrasi Graphify:** Guardrails `.gitignore` & `.graphifyignore` aktif, hook terpasang, knowledge graph terupdate secara berkala.

