# SIPPER-TI: Petunjuk Penggunaan Pengguna (User Manual)
**Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika UMKT**

---

## 👥 DAFTAR PERAN PENGGUNA (USER ROLES)

Sistem SIPPER-TI memiliki 4 peran pengguna:
1. **Mahasiswa:** Mengajukan izin mandiri, mengunggah berkas surat sakit/tugas, dan memantau status persetujuan.
2. **Sipen (Sie Pendidikan):** Mahasiswa penanggung jawab mata kuliah tertentu yang bertugas mereview perizinan, memvalidasi surat bukti, dan membantu pengajuan izin proxy jika teman sekelas berhalangan.
3. **KM (Ketua Kelas):** Supervisor seluruh perizinan kelas, berwenang mengelola token dosen, melihat rekap kelas penuh, dan melakukan override persetujuan jika Sipen berhalangan.
4. **Dosen Pengampu:** Mengakses rekapitulasi kehadiran mahasiswa secara instan tanpa perlu registrasi melalui **Guest Access Link**.

---

## 🔑 1. PANDUAN AUTENTIKASI (MASUK KE SISTEM)

### Opsi A: Masuk dengan Google SSO Akun Kampus (Direkomendasikan)
1. Buka halaman utama aplikasi di browser Anda.
2. Klik tombol **"Masuk dengan Akun Kampus (@umkt.ac.id)"**.
3. Pilih akun Google resmi kampus Anda (`nama@umkt.ac.id`).
4. Sistem secara otomatis memverifikasi domain Anda dan langsung membuka Dashboard.

### Opsi B: Masuk dengan NIM & Kata Sandi (Fallback)
1. Pada form login, masukkan **NIM** Anda (contoh: `2311102441101`).
2. Masukkan kata sandi (untuk akun baru, kata sandi default adalah NIM Anda).
3. Klik tombol **"Masuk dengan NIM"**.

---

## 📝 2. PANDUAN PENGAJUAN IZIN (UNTUK MAHASISWA)

1. Pada menu navigasi bawah atau dashboard, klik tombol **"Ajukan Izin (+)"**.
2. Pilih mata kuliah yang bersangkutan dari daftar dropdown.
3. Pilih jenis izin:
   - **Sakit:** Memerlukan lampiran surat dokter/klinik.
   - **Izin Keperluan Keluarga / Penting:** Memerlukan surat pernyataan/keterangan.
   - **Tugas Kampus / Acara:** Memerlukan surat dispensasi/tugas resmi.
4. Tentukan rentang tanggal:
   - Jika hanya 1 hari, isi tanggal mulai dan tanggal selesai dengan tanggal yang sama.
   - Jika beberapa hari (multi-day), pilih tanggal awal dan tanggal akhir.
5. Unggah berkas bukti (dapat berupa foto HP, screenshot, atau dokumen PDF maks. 5MB).
6. Tuliskan alasan singkat yang jelas pada kotak keterangan.
7. Klik **"Kirim Pengajuan Izin"**.

---

## 🤝 3. PANDUAN PROXY SUBMISSION (KHUSUS SIPEN & KM)

Bila ada teman sekelas yang sakit parah/mengalami kecelakaan dan tidak dapat mengakses gawai secara mandiri:
1. Masuk ke halaman **"Ajukan Izin"**.
2. Aktifkan sakelar toggle **"Ajukan untuk Mahasiswa Lain (Proxy)"**.
3. Cari nama atau NIM rekan mahasiswa yang bersangkutan.
4. Masukkan data perizinan dan lampirkan bukti (misal foto surat dokter yang dikirimkan orang tua via WA).
5. Klik kirim. Sistem akan mencatat riwayat bahwa izin ini diajukan secara sah atas nama Anda untuk rekan tersebut.

---

## ⚖️ 4. PANDUAN APPROVAL PERIZINAN (KHUSUS SIPEN & KM)

1. Buka tab menu **"Approval"**.
2. Anda akan melihat kartu-kartu perizinan yang berstatus **"Menunggu Review"**.
3. Klik tombol **"Lihat Berkas"** untuk memeriksa keabsahan surat keterangan dokter.
4. Ambil keputusan:
   - **Setujui Izin:** Klik tombol hijau. Mahasiswa akan menerima status persetujuan.
   - **Tolak Izin:** Klik tombol merah, lalu ketikkan alasan penolakan (misal: "Foto surat dokter tidak terbaca, mohon unggah ulang").

---

## 🎓 5. PANDUAN GUEST ACCESS UNTUK DOSEN PENGAMPU

Dosen pengampu tidak perlu menghafal password atau membuat akun:
1. Sipen atau KM akan mengirimkan link khusus via WhatsApp (contoh: `https://sipper-ti.umkt.ac.id/lecturer/demo-dosen-hendra-2026`).
2. Klik link tersebut di ponsel atau laptop.
3. Rekap presensi dan daftar mahasiswa yang izin hari ini akan tampil secara langsung.
4. Dosen dapat mengklik nama mahasiswa untuk melihat lampiran surat dokter atau menekan tombol **"Cetak Rekap Presensi"** untuk arsip akademik.
