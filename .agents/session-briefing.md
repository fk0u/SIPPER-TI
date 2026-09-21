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
- **Integrasi Graphify:** Guardrails `.gitignore` & `.graphifyignore` aktif, hook terpasang, siap diindeks secara berkala.
