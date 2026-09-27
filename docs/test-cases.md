# SIPPER-TI: Matriks Skenario Pengujian (Test Cases)
**Proyek:** Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika UMKT  
**Versi:** 1.1.0 (pasca audit 2026-09-27)  
**Disusun oleh:** QA Tester & Tech Lead  

### Legenda Status

| Status | Arti |
| :--- | :--- |
| **Unit** | Dicakup unit test Vitest (`npm test`) |
| **RLS** | Dicakup assertion `supabase/tests/rls_test.sql` via `npm run test:rls` (PostgreSQL 16, juga di CI) |
| **E2E Demo** | Dicakup `e2e/demo.e2e.mjs` via `npm run test:e2e` (Playwright, mode demo, juga di CI) |
| **Pending Live** | Kode tersedia, perlu diverifikasi manual dengan project Supabase nyata |

---

## 1. Modul Autentikasi (Dual Login: Google OAuth & NIM Fallback)

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **AUTH-01** | Login Google akun `@umkt.ac.id` | Masuk dan diarahkan ke `next` / beranda sesuai role. | Pending Live |
| **AUTH-02** | Login Google email non-UMKT | Callback menolak (`/login?error=domain`), trigger DB menolak registrasi. | Unit (`isCampusEmail`), RLS (trigger), Pending Live |
| **AUTH-03** | Login NIM dengan password default | Berhasil masuk lalu **dipaksa** ke `/settings/password` sampai password diganti. | E2E Demo, Pending Live |
| **AUTH-04** | Login NIM password salah / `password123` | Pesan *"NIM atau kata sandi tidak cocok"*. | E2E Demo |
| **AUTH-05** | Logout | State lokal dibersihkan; mode live memanggil `supabase.auth.signOut()`. | E2E Demo, Pending Live |
| **AUTH-06** | Akses rute terlindungi tanpa login | Diarahkan ke `/login?next=<rute>`. | E2E Demo (klien), Pending Live (`src/proxy.ts`) |
| **AUTH-07** | Open redirect via `next` | `//evil.com`, `https://…` ditolak → `/`. | Unit |
| **AUTH-08** | Mahasiswa mengubah `role` sendiri | Ditolak trigger `protect_profile_columns`. | RLS |
| **AUTH-09** | Mahasiswa menandai `is_password_changed` sendiri | Ditolak; flag hanya diubah trigger saat password auth berubah. | RLS |
| **AUTH-10** | Signup dengan metadata NIM orang lain | NIM diturunkan dari email kampus; metadata diabaikan. | RLS |
| **AUTH-11** | Akses halaman lain dengan password default (live) | `src/proxy.ts` mengalihkan ke `/settings/password`. | Pending Live |
| **AUTH-12** | Membaca email/telepon teman | Ditolak (grant per kolom); profil sendiri via `get_my_profile()`. | RLS |

---

## 2. Modul Pengajuan Izin (Multi-Day & Proxy)

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **LEAVE-01** | Izin mandiri | Tersimpan `created_by = student_id`, status `pending`. | E2E Demo, RLS |
| **LEAVE-02** | Durasi multi-hari | Durasi inklusif benar lintas bulan. | Unit |
| **LEAVE-03** | Tanggal terbalik | Form & store menolak. | Unit (util), E2E Demo |
| **LEAVE-04** | Proxy oleh Sipen di matkul yang dikelola | Diizinkan; di matkul lain ditolak. | Unit, RLS |
| **LEAVE-05** | Proxy oleh mahasiswa biasa | Opsi tersembunyi; insert ditolak RLS. | Unit, RLS |
| **LEAVE-06** | Insert langsung berstatus `approved` | Ditolak RLS. | RLS |
| **LEAVE-07** | Tanggal default | Sama dengan tanggal lokal perangkat (bukan UTC). | Unit, E2E Demo |
| **LEAVE-08** | Sakit / Tugas tanpa lampiran | Ditolak dengan pesan jelas; **tidak** ada lampiran pengganti. | E2E Demo |

---

## 3. Modul Lampiran & Viewer

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **DOC-01** | Unggah JPG/PNG/WebP/PDF ≤ 5MB | Diterima dan tampil di daftar lampiran. | Unit, E2E Demo |
| **DOC-02** | Format tidak didukung / > 5MB | Semua berkas bermasalah dilaporkan sekaligus. | Unit, E2E Demo |
| **DOC-03** | Unggah ke folder user lain di storage | Ditolak policy storage. | RLS |
| **DOC-04** | Buka lampiran (mode live) | Signed URL 60 menit; URL tanpa tanda tangan ditolak (bucket privat). | Pending Live |

---

## 4. Modul Verifikasi & Approval

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **APP-01** | Sipen hanya melihat matkul yang dikelola | Izin matkul lain tidak tampil. | Unit, RLS, E2E Demo |
| **APP-02** | Approve oleh Sipen matkul terkait | `approved`, `verified_by`/`verified_at` diisi trigger. | RLS, E2E Demo |
| **APP-03** | Reject tanpa alasan | Ditolak (UI & RLS). | RLS |
| **APP-04** | Approve izin milik sendiri | Ditolak (UI, store, RLS). | Unit, RLS |
| **APP-05** | Verifikator mengubah alasan/tanggal saat approve | Ditolak trigger `protect_leave_request_columns`. | RLS |
| **APP-06** | Mahasiswa membuka `/approval` | Halaman "Akses Ditolak" / redirect oleh proxy. | E2E Demo, Pending Live |
| **APP-07** | Mengubah keputusan yang sudah final (Sipen/KM) | Ditolak — hanya izin `pending` yang dapat diverifikasi. | RLS |
| **APP-08** | Policy/RPC lama yang longgar di database live | Semua policy tabel aplikasi dibuat ulang; RPC lama dicabut dari klien. | RLS |

---

## 5. Modul Guest Access Dosen

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **GST-01** | Token valid dibuka di perangkat lain | Rekap tampil tanpa login (server-rendered via RPC). | RLS (RPC), Pending Live |
| **GST-02** | Token tidak dikenal / kedaluwarsa / dicabut | Pesan sesuai status. | Unit, RLS, E2E Demo |
| **GST-03** | Privasi rekap | Hanya izin `approved`; tanpa alasan & lampiran. | Unit, RLS, E2E Demo |
| **GST-04** | Mahasiswa/Sipen membuat token | Hanya KM yang bisa membuat & mencabut (termasuk token buatan KM lain). | Unit, RLS |
| **GST-05** | Cetak rekap | Tampilan cetak via `window.print()`. | Manual |
