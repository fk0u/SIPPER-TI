# SIPPER-TI: Matriks Skenario Pengujian (Test Cases)
**Proyek:** Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika UMKT  
**Versi:** 1.0.0-rc  
**Disusun oleh:** QA Tester & Tech Lead  

---

## 1. Modul Autentikasi (Dual Login: Google OAuth & NIM Fallback)

| ID Uji | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :--- |
| **AUTH-01** | Login Google OAuth Akun UMKT Valid | 1. Klik "Masuk dengan Akun Kampus"<br>2. Pilih email format `*@umkt.ac.id` | Pengguna berhasil masuk dan diarahkan ke Dashboard sesuai role. | Validated |
| **AUTH-02** | Login Google OAuth Email Non-UMKT (Negative Test) | 1. Klik "Masuk dengan Akun Kampus"<br>2. Pilih email `@gmail.com` pribadi | Sistem menolak dengan alert: *"Registrasi dibatasi hanya untuk domain @umkt.ac.id"*. | Validated |
| **AUTH-03** | Login Fallback NIM Default Password | 1. Masukkan NIM `2311102441101`<br>2. Masukkan password default NIM<br>3. Klik Masuk | Berhasil login, memicu modal rekomendasi ganti kata sandi bila pertama kali masuk. | Validated |
| **AUTH-04** | Login Fallback NIM dengan Password Salah | 1. Masukkan NIM terdaftar<br>2. Masukkan password acak salah | Muncul pesan error validasi: *"NIM atau kata sandi tidak cocok"*. | Validated |
| **AUTH-05** | Logout & Session Clearing | 1. Buka profil pengguna<br>2. Klik tombol "Keluar / Logout" | State auth dan cookies terhapus, pengguna diredirect ke `/login`. | Validated |

---

## 2. Modul Pengajuan Izin (Leave Request: Multi-Day & Proxy Submission)

| ID Uji | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :--- |
| **LEAVE-01**| Pengajuan Izin Mandiri (Single Day) | 1. Pilih jenis "Sakit"<br>2. Pilih tanggal yang sama<br>3. Upload bukti & isi alasan<br>4. Submit | Izin tersimpan dengan `created_by = student_id`, status `pending`. | Validated |
| **LEAVE-02**| Pengajuan Izin Mandiri (Multi-Day) | 1. Pilih rentang tanggal (misal: 21 Sep - 23 Sep 2026)<br>2. Isi keterangan<br>3. Submit | Validasi tanggal lolos (`end_date >= start_date`), tersimpan di database. | Validated |
| **LEAVE-03**| Validasi Tanggal Terbalik (Negative Test) | 1. Pilih `start_date` = 25 Sep<br>2. Pilih `end_date` = 20 Sep | Form mencegah submit, muncul error: *"Tanggal selesai tidak boleh sebelum tanggal mulai"*. | Validated |
| **LEAVE-04**| Proxy Submission oleh Sipen/KM | 1. Login sebagai Sipen / KM<br>2. Aktifkan toggle *"Ajukan untuk Mahasiswa Lain"*<br>3. Cari mahasiswa "Dinda Safitri"<br>4. Isi form & submit | Data tersimpan dengan `created_by = user.id` dan `student_id = dinda.id`. | Validated |
| **LEAVE-05**| Proteksi Proxy Mahasiswa Biasa (Negative Test) | 1. Login sebagai mahasiswa biasa<br>2. Periksa tampilan form | Opsi Proxy dinonaktifkan atau disembunyikan untuk role mahasiswa biasa. | Validated |

---

## 3. Modul Upload Bukti Dokumen & Lightbox Viewer

| ID Uji | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :--- |
| **DOC-01** | Upload Foto Bukti Surat Dokter (JPG/PNG/WebP) | Drop foto surat dokter ukuran 1.2MB | File berhasil diupload, thumbnail preview muncul di form. | Validated |
| **DOC-02** | Upload Bukti Surat Tugas PDF | Drop berkas surat tugas format `.pdf` | File terdeteksi sebagai PDF, icon PDF muncul. | Validated |
| **DOC-03** | Validasi Ukuran File Melebihi 5MB (Negative) | Unggah file ukuran 8MB | Sistem menolak dengan pesan: *"Maksimal ukuran berkas adalah 5MB"*. | Validated |
| **DOC-04** | Buka Bukti di Lightbox Modal | Klik tombol "Lihat Berkas" pada kartu izin | Modal viewer terbuka dengan resolusi penuh, zoom, dan tombol tutup. | Validated |

---

## 4. Modul Verifikasi & Approval (Sipen & KM)

| ID Uji | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :--- |
| **APP-01** | Filter Perizinan Berdasarkan Status | Klik tab "Menunggu", "Disetujui", "Ditolak" | Daftar izin terfilter secara instan dan badge counter akurat. | Validated |
| **APP-02** | Verifikasi Setujui (Approve) oleh Sipen | Buka izin pending, klik "Setujui Izin" | Status berubah jadi `approved`, tercatat `verified_by = sipen.id`. | Validated |
| **APP-03** | Penolakan Izin dengan Alasan (Reject) | 1. Klik "Tolak Izin"<br>2. Isi dialog: *"Bukti foto buram dan tidak terbaca"*<br>3. Konfirmasi | Status berubah `rejected`, alasan penolakan tersimpan dan tampil ke mahasiswa. | Validated |
| **APP-04** | Proteksi Hak Akses Matkul Sipen | Login sebagai Sipen Matkul A, coba approve izin Matkul B | RLS Database menolak pembaruan data yang bukan kewenangannya. | Validated |

---

## 5. Modul Guest Access Dosen (Token Public URL)

| ID Uji | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :--- |
| **GST-01** | Akses Dosen Menggunakan Token Valid | Buka browser incognito ke `/lecturer/demo-dosen-hendra-2026` | Rekap kehadiran matkul Dr. Hendra langsung tampil tanpa form login/password. | Validated |
| **GST-02** | Akses Token Tidak Valid / Kedaluwarsa | Buka `/lecturer/token-palsu-999` | Tampil halaman ramah: *"Token Akses Dosen Tidak Valid atau Sudah Kedaluwarsa"*. | Validated |
| **GST-03** | Cetak / Export Rekap Presensi Dosen | Klik tombol "Cetak Rekap Presensi" | Format print/PDF ramah kertas terbuka dengan header resmi dan tabel rekap. | Validated |
