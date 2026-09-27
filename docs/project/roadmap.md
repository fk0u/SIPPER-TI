# SIPPER-TI: Product & Engineering Roadmap

## Milestone 1: Core Portal & State Architecture (Completed)
- [x] Autentikasi ganda: Google SSO Kampus (`@umkt.ac.id`) & Fallback NIM.
- [x] Simulasi profil multi-role: Mahasiswa, Sipen (Sie Pendidikan), KM (Ketua Kelas).
- [x] Form perizinan multi-hari dengan upload berkas (surat dokter/tugas).
- [x] Mode pengajuan proxy khusus untuk Sipen dan KM.
- [x] Portal akses publik Dosen Pengampu berbasis guest token (tanpa login).

## Milestone 2: Production UI & Systematic Navigation Redesign (Completed)
- [x] Pemisahan tegas arsitektur navigasi desktop (Top Navigation Bar) dan mobile (App Header + Floating Bottom Tab Dock).
- [x] Penghapusan komponen blocking overlay/stuck backdrop blur pada mobile.
- [x] Tampilan Asymmetrical Bento 2.0 pada Beranda dengan metrik tabular monospace.
- [x] Integrasi ReactBits yang aman dan performan (`SpotlightCard`, `ShinyText`, `CountUp`).
- [x] Tampilan form perizinan 2-kolom dengan petunjuk presensi dan dropzone unggah modern.
- [x] Terminal Approval perizinan dengan preset alasan penolakan cepat.
- [x] Multi-select & floating action bar untuk persetujuan / penolakan izin massal (Bulk Approval).
- [x] Modal generator QR Code instan untuk scan kamera HP dosen langsung di kelas.
- [x] Fitur 1-klik bagikan tautan rekapitulasi langsung ke WhatsApp Dosen.
- [x] Sistem notifikasi toast global (`useToastStore` & `ToastContainer`) untuk setiap interaksi.
- [x] Validasi produksi Next.js 16 (`npm run build` lolos). *Catatan audit: ESLint saat itu masih 4 error — diperbaiki di Milestone 2.5.*

## Milestone 2.5: Audit & Security Hardening (Completed — 27 Sep 2026)
- [x] Audit teknis menyeluruh (`docs/audit/2026-09-27-audit.md`).
- [x] Migrasi hardening RLS: kunci kolom `role`/`nim`/`email`, insert izin hanya `pending`, verifikasi tanpa self-approval & sesuai `course_sipen`.
- [x] Bucket lampiran privat + signed URL, upload per folder user.
- [x] RPC `get_lecturer_recap` untuk akses dosen anonim dengan kedaluwarsa/pencabutan token.
- [x] Route guard `src/proxy.ts` (live) + `RequireRole` (demo); pengalih profil hanya di mode demo.
- [x] Validasi domain `@umkt.ac.id` di server & sanitasi `next`.
- [x] Perbaikan bug: lampiran palsu, blob URL, tanggal UTC, jadwal hari ini, hydration mismatch, kedipan tema.
- [x] Test: Vitest (unit), `scripts/test-rls.sh` (PostgreSQL), CI GitHub Actions.

## Milestone 3: Database & Production Sync (Upcoming)
- [x] Data layer Supabase (`src/lib/data/supabaseRepository.ts`) aktif otomatis saat env terisi; mode demo sebagai fallback.
- [x] Login NIM via Supabase Auth + halaman ganti password wajib + `scripts/seed-auth-users.mjs`.
- [ ] Terapkan migrasi & seed ke project Supabase produksi, lalu jalankan skenario "Pending Live" di `docs/test-cases.md`.
- [ ] Pembatasan kolom `profiles` (email/telepon) yang terlihat oleh sesama mahasiswa.
- [ ] Push notification / webhook WhatsApp gateway untuk notifikasi izin baru ke Sipen.
- [ ] Export presensi ke format Excel (.xlsx) dan PDF resmi bertandatangan digital.

