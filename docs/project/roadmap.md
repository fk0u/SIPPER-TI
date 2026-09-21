# SIPPER-TI: Product & Engineering Roadmap

## Milestone 1: Core Portal & State Architecture (Completed)
- [x] Autentikasi ganda: Google SSO Kampus (`@umkt.ac.id`) & Fallback NIM.
- [x] Simulasi profil multi-role: Mahasiswa, Sipen (Sie Pendidikan), KM (Ketua Kelas).
- [x] Form perizinan multi-hari dengan upload berkas (surat dokter/tugas).
- [x] Mode pengajuan proxy khusus untuk Sipen dan KM.
- [x] Portal akses publik Dosen Pengampu berbasis guest token (tanpa login).

## Milestone 2: Production UI & Systematic Navigation Redesign (Active)
- [x] Pemisahan tegas arsitektur navigasi desktop (Top Navigation Bar) dan mobile (App Header + Floating Bottom Tab Dock).
- [x] Penghapusan komponen blocking overlay/stuck backdrop blur pada mobile.
- [x] Tampilan Asymmetrical Bento 2.0 pada Beranda dengan metrik tabular monospace.
- [x] Integrasi ReactBits yang aman dan performan (`SpotlightCard`, `ShinyText`, `CountUp`).
- [x] Tampilan form perizinan 2-kolom dengan petunjuk presensi dan dropzone unggah modern.
- [x] Terminal Approval perizinan dengan preset alasan penolakan cepat.
- [x] Fitur 1-klik bagikan tautan rekapitulasi langsung ke WhatsApp Dosen.

## Milestone 3: Database & Production Sync (Upcoming)
- [ ] Aktivasi integrasi langsung ke tabel Supabase PostgreSQL saat kredensial production dikonfigurasi.
- [ ] Push notification / webhook WhatsApp gateway untuk notifikasi izin baru ke Sipen.
- [ ] Export presensi ke format Excel (.xlsx) dan PDF resmi bertandatangan digital.
