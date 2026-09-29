# SIPPER-TI: Matriks Skenario Pengujian (Test Cases)
**Proyek:** Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika UMKT  
**Versi:** 2.0.0 (platform multi-kelas, 2026-09-28)  
**Disusun oleh:** QA Tester & Tech Lead  

### Legenda Status

| Status | Arti |
| :--- | :--- |
| **Unit** | Dicakup unit test Vitest (`npm test`) |
| **RLS** | Dicakup assertion `supabase/tests/rls_test.sql` via `npm run test:rls` (PostgreSQL 16, juga di CI) |
| **E2E API** | Dicakup `scripts/e2e-api.py` (`npm run test:e2e-api`, dijalankan di server terhadap Supabase & worker sungguhan; bukan di CI) |
| **Worker** | Dicakup `go test` di `worker/` (`npm run test:worker`, juga di CI) |
| **Pending Live** | Kode tersedia, perlu diverifikasi manual di aplikasi (mode demo & E2E Playwright sudah dihapus) |

---

## 1. Modul Autentikasi (Dual Login: Google OAuth & NIM Fallback)

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **AUTH-01** | Login Google akun `@umkt.ac.id` | Masuk dan diarahkan ke `next` / beranda sesuai role. | Pending Live |
| **AUTH-02** | Login Google email non-UMKT | Callback menolak (`/login?error=domain`), trigger DB menolak registrasi. | Unit (`isCampusEmail`), RLS (trigger), Pending Live |
| **AUTH-03** | Login NIM dengan password default | Berhasil masuk lalu **dipaksa** ke `/settings/password` sampai password diganti. | Pending Live |
| **AUTH-04** | Login NIM password salah / `password123` | Pesan *"NIM atau kata sandi tidak cocok"*. | Pending Live |
| **AUTH-05** | Logout | State lokal dibersihkan; mode live memanggil `supabase.auth.signOut()`. | Pending Live |
| **AUTH-06** | Akses rute terlindungi tanpa login | Diarahkan ke `/login?next=<rute>`. | Pending Live (`src/proxy.ts`) |
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
| **LEAVE-01** | Izin mandiri | Tersimpan `created_by = student_id`, status `pending`. | Pending Live, RLS |
| **LEAVE-02** | Durasi multi-hari | Durasi inklusif benar lintas bulan. | Unit |
| **LEAVE-03** | Tanggal terbalik | Form & store menolak. | Unit (util), Pending Live |
| **LEAVE-04** | Proxy oleh Sipen di matkul yang dikelola | Diizinkan; di matkul lain ditolak. | Unit, RLS |
| **LEAVE-05** | Proxy oleh mahasiswa biasa | Opsi tersembunyi; insert ditolak RLS. | Unit, RLS |
| **LEAVE-06** | Insert langsung berstatus `approved` | Ditolak RLS. | RLS |
| **LEAVE-07** | Tanggal default | Sama dengan tanggal lokal perangkat (bukan UTC). | Unit, Pending Live |
| **LEAVE-08** | Sakit / Tugas tanpa lampiran | Ditolak dengan pesan jelas; **tidak** ada lampiran pengganti. | Pending Live |

---

## 3. Modul Lampiran & Viewer

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **DOC-01** | Unggah JPG/PNG/WebP/PDF ≤ 5MB | Diterima dan tampil di daftar lampiran. | Unit, Pending Live |
| **DOC-02** | Format tidak didukung / > 5MB | Semua berkas bermasalah dilaporkan sekaligus. | Unit, Pending Live |
| **DOC-03** | Unggah ke folder user lain di storage | Ditolak policy storage. | RLS |
| **DOC-04** | Buka lampiran (mode live) | Signed URL 60 menit; URL tanpa tanda tangan ditolak (bucket privat). | Pending Live |

---

## 4. Modul Verifikasi & Approval

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **APP-01** | Sipen hanya melihat matkul yang dikelola | Izin matkul lain tidak tampil. | Unit, RLS, Pending Live |
| **APP-02** | Approve oleh Sipen matkul terkait | `approved`, `verified_by`/`verified_at` diisi trigger. | RLS, Pending Live |
| **APP-03** | Reject tanpa alasan | Ditolak (UI & RLS). | RLS |
| **APP-04** | Approve izin milik sendiri | Ditolak (UI, store, RLS). | Unit, RLS |
| **APP-05** | Verifikator mengubah alasan/tanggal saat approve | Ditolak trigger `protect_leave_request_columns`. | RLS |
| **APP-06** | Mahasiswa membuka `/approval` | Halaman "Akses Ditolak" / redirect oleh proxy. | Pending Live |
| **APP-07** | Mengubah keputusan yang sudah final (Sipen/KM) | Ditolak — hanya izin `pending` yang dapat diverifikasi. | RLS |
| **APP-08** | Policy/RPC lama yang longgar di database live | Semua policy tabel aplikasi dibuat ulang; RPC lama dicabut dari klien. | RLS |

---

## 5. Modul Guest Access Dosen

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **GST-01** | Token valid dibuka di perangkat lain | Rekap tampil tanpa login (server-rendered via RPC). | RLS (RPC), Pending Live |
| **GST-02** | Token tidak dikenal / kedaluwarsa / dicabut | Pesan sesuai status. | Unit, RLS, Pending Live |
| **GST-03** | Privasi rekap | Hanya izin `approved` (dengan alasan, jam & metadata lampiran: nama/tipe/ukuran); tanpa email, nomor, atau path storage lampiran (lihat DSN-03). | Unit, RLS, E2E API |
| **GST-04** | Mahasiswa/Sipen membuat token | Hanya KM yang bisa membuat & mencabut (termasuk token buatan KM lain). | Unit, RLS |
| **GST-05** | Cetak rekap | Tampilan cetak via `window.print()`. | Manual |

---

## 6. Platform Multi-Kelas & SiPenDosa

| ID Uji | Skenario Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- |
| **KLS-01** | Daftar NIM + pilih kelas aktif | Akun pending di kelas itu; tanpa akses data kelas sampai di-ACC. | RLS, E2E API |
| **KLS-02** | Daftar sambil mengajukan kelas baru | Kelas pending; superadmin ACC → pengaju jadi KM aktif. | RLS, E2E API |
| **KLS-03** | Nama kelas duplikat / email NULL / domain non-UMKT | Ditolak dengan pesan jelas. | RLS |
| **KLS-04** | Sipen/KM ACC atau tolak pendaftar | ACC → aktif; tolak → akun dihapus (NIM bisa daftar ulang). | RLS, E2E API |
| **KLS-05** | Isolasi antarkelas | KM/Sipen/mahasiswa hanya melihat data kelasnya. | RLS |
| **KLS-06** | Serah terima KM & ganti KM oleh superadmin | Satu KM per kelas; KM lama jadi Sipen; status superadmin tidak berubah. | RLS, E2E API |
| **KLS-07** | Penugasan Sipen per matkul | Atomik; gagal tanpa mengubah penugasan lama. | RLS |
| **KLS-08** | Sipen mengelola matkulnya | Sipen ubah/hapus/ingatkan hanya matkul tugasnya; matkul buatannya otomatis miliknya; KM semua matkul. | RLS |
| **KLS-09** | Reset kata sandi ke NIM | KM kelas / superadmin saja (bukan diri sendiri); anggota wajib ganti sandi saat login. | RLS, E2E API |
| **IZN-01** | Wizard izin: untuk siapa → tanggal → jadwal → alasan → tinjau | Mewakili hanya untuk KM/Sipen; hari tanpa kuliah & libur tidak dihitung; satu baris per matkul terdampak. | Unit, RLS |
| **IZN-02** | Izin per jam (satu hari) | Hanya matkul yang jamnya beririsan; lintas hari / di luar jam kuliah ditolak server. | Unit, RLS, E2E API |
| **DSN-01** | Portal dosen tanpa login + `.ics` | Jadwal lintas kelas, izin approved dengan alasan & jam; kalender WITA, dibatasi horizon libur. | RLS, Unit, E2E API |
| **DSN-03** | Lampiran surat di portal dosen | Dibuka lewat route server (token divalidasi DB, signed URL 5 menit); path storage tidak pernah dikirim. | RLS, E2E API |
| **DSN-04** | Export Excel / ZIP | Excel rekap + ringkasan; ZIP berisi Excel + folder lampiran dengan tautan relatif; mengikuti filter. | E2E API |
| **DSN-02** | Link dosen baru | Link lama langsung tidak berlaku; staf yang sudah diturunkan tidak bisa mengganti. | RLS, E2E API |
| **JDW-01** | Papan jadwal publik kelas | Aktif/nonaktif/rotasi oleh staf; tanpa data mahasiswa. | RLS, E2E API |
| **WA-01** | Tautkan WhatsApp kelas (QR / kode pairing) | Worker menulis QR dari server WhatsApp; putus/keluarkan merapikan status. | E2E API (isi QR dari server WhatsApp diperiksa), Pending Live (scan & kirim sungguhan) |
| **WA-02** | Penjadwal H-1/H-0, jam operasional, hari libur | Diantrekan sekali per hari dalam jam operasional; libur dilewati. | Unit (hitung mundur), E2E API |
| **WA-03** | Mode uji (dry run) | Pengingat dirender & dicatat tanpa dikirim. | E2E API |
| **WA-04** | Template: pratinjau, validasi, riwayat versi | Template rusak / variabel tak dikenal ditolak di web & database; versi lama tersimpan. | Unit, RLS, Worker, E2E API |
| **WA-05** | Kirim ulang, batal, statistik | Hanya staf; pesan gagal/dibatalkan/uji bisa dikirim ulang. | RLS, E2E API |
| **SEC-01** | 2FA TOTP | Sesi password saja (aal1) tanpa hak kelas/admin; kode benar → aal2. | RLS, E2E API |
