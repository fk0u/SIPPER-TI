# SIPPER-TI

> **Platform perizinan, jadwal kuliah & pengingat dosen untuk kelas-kelas di UMKT**
> *Gabungan SIPPER-TI (perizinan & presensi) + [SiPenDosa](https://github.com/fk0u/SiPenDosa) (pengingat dosen via WhatsApp)*

Satu platform untuk banyak kelas. Mahasiswa mendaftar dengan NIM lalu memilih kelasnya; Sipen / KM kelas tersebut menyetujui. Izin kuliah diverifikasi Sipen/KM, jadwal kuliah dikelola per kelas, dosen mendapat **link pribadi tanpa login** berisi jadwal mengajarnya di semua kelas, dan pengingat kuliah dikirim otomatis ke WhatsApp dosen dari nomor WhatsApp kelas.

---

## 🚀 Fitur

### 1. Kelas & akun
- **Registrasi mandiri** dengan NIM + password, memilih kelas dari daftar kelas aktif. Akun berstatus *pending* sampai di-ACC **Sipen atau KM kelas itu** (menu *Anggota*). Menolak = akun dihapus, sehingga NIM bisa didaftarkan ulang pemilik aslinya.
- **Mengajukan kelas baru**: siapa pun bisa mengajukan; setelah di-ACC **superadmin** platform, pengaju otomatis menjadi **KM**.
- KM menunjuk Sipen, menyerahkan jabatan KM (KM lama menjadi Sipen), dan mengeluarkan anggota.
- **Migrasi KM oleh superadmin**: di menu *Admin* superadmin bisa mengganti KM kelas mana pun (mis. KM lulus / akun hilang), termasuk mengambil kembali jabatan KM di kelasnya sendiri. Status superadmin tidak pernah ikut berubah dan superadmin tidak bisa dikeluarkan KM.
- Akun massal dari KM tetap bisa dibuat lewat `scripts/seed-auth-users.mjs` (password awal = NIM, wajib diganti).

### 2. Perizinan (SIPPER-TI)
- Mahasiswa mengajukan izin (sakit / izin / keluar kampus / acara) dengan lampiran; Sipen/KM bisa mengajukan *proxy*.
- Sipen memverifikasi izin mata kuliah yang ditugaskan kepadanya, KM semua mata kuliah **di kelasnya**. Keputusan final.

### 3. Jadwal, dosen & pengingat (SiPenDosa)
- **Jadwal mingguan** per kelas (menu *Jadwal*), dilihat semua anggota, dikelola Sipen/KM.
- **Direktori dosen lintas kelas**: dosen dikenali dari nomor WhatsApp, jadi dosen yang mengajar di beberapa kelas tetap satu data dengan satu link.
- **Portal dosen** `/dosen/<token>` tanpa login: jadwal mengajar di semua kelas, hari libur mendatang, rekap izin disetujui (tanpa alasan & berkas), cetak, dan **kalender `.ics`** untuk HP.
- **Papan jadwal publik kelas** `/kelas/<token>` (+ `.ics`): diaktifkan Sipen/KM lewat *Jadwal → Bagikan*, tanpa data mahasiswa.
- **Pengingat WhatsApp** per mata kuliah: H-1 atau H-0, jam kirim, tujuan alternatif (nomor / **grup WhatsApp yang diikuti nomor kelas**), melewati hari libur, hanya dalam **jam operasional** kelas (default 08:00–16:00).
- **Pusat WhatsApp** (menu *WhatsApp*): tautkan nomor kelas via QR / kode pairing, statistik pengiriman, **hitung mundur pengingat berikutnya**, **mode uji (dry run)**, template per kelas (sintaks Go `{{.NamaDosen}}` kompatibel SiPenDosa) dengan pratinjau & **riwayat versi**, riwayat pesan dengan isi lengkap, batal & **kirim ulang**. Pengiriman memakai jeda acak 5–15 dtk, simulasi mengetik, retry 3× dengan backoff.

#### Kesetaraan fitur SiPenDosa

| SiPenDosa | Di platform |
| :--- | :--- |
| WhatsApp engine (QR, kode pairing, anti-ban presence & jitter) | ✅ worker Go, satu sesi per kelas |
| Smart scheduler H-1/H-0, WITA, hari libur, jam operasional | ✅ |
| Hitung mundur jadwal berikutnya, statistik dashboard | ✅ menu WhatsApp |
| Template dinamis + live preview + audit trail versi | ✅ per kelas |
| Antrean persisten, auto-retry 3× backoff, batal / kirim sekarang | ✅ + kirim ulang pesan gagal |
| Dry run | ✅ per kelas |
| Pemilih grup WhatsApp (Issue #2) | ✅ disinkron worker tiap 30 menit |
| Papan jadwal publik + `.ics` (Issue #4) | ✅ per kelas & per dosen |
| 2FA TOTP | ✅ menu *Keamanan*, ditegakkan di proxy & RLS |
| Terminal console, auto-updater, installer desktop/APK, jembatan C++, tunneling (Issue #3) | ➖ tidak relevan: platform sudah online di server (terminal server: Cockpit) |

### 4. Keamanan akun
- **2FA (TOTP)** opsional untuk semua akun (*Keamanan (2FA)* di menu akun). Akun dengan 2FA yang baru login password (sesi `aal1`) tidak punya hak kelas/admin apa pun sampai kode dimasukkan — ditegakkan oleh proxy **dan** helper RLS (`mfa_satisfied()`).

### 5. Superadmin
- ACC / tolak pengajuan kelas, melihat semua kelas & KM-nya, mengganti KM, mengelola hari libur global.

---

## 👥 Peran & hak akses

Sumber kebenaran: RLS & RPC di `supabase/migrations/` (diuji `supabase/tests/rls_test.sql`). Cermin sisi klien: `src/lib/permissions.ts`, `src/lib/routes.ts`.

| Aksi | Pending | Mahasiswa | Sipen | KM | Superadmin | Dosen (link) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Lihat data kelas | – | kelasnya | kelasnya | kelasnya | + daftar semua kelas | jadwal & izin approved miliknya |
| Ajukan izin | – | sendiri | + proxy matkulnya | + proxy semua matkul kelas | sesuai peran kelasnya | – |
| Verifikasi izin | – | – | matkul yang ditugaskan | semua matkul kelas | – | – |
| ACC pendaftar kelas | – | – | ✓ | ✓ | – | – |
| Atur peran / keluarkan anggota | – | – | – | ✓ | atur peran & KM semua kelas | – |
| Kelola jadwal, dosen, WhatsApp | – | – | ✓ | ✓ | – | – |
| ACC kelas baru, hari libur | – | – | – | – | ✓ | – |

---

## 🛠️ Arsitektur

```
Browser ──► Nginx ──► Next.js 16 (PM2 cluster)          app.<host>
                 └──► Supabase self-hosted (Docker)      api.<host>  (Auth, PostgREST, Storage)
                          ▲
             sipper-worker (Go, systemd) ── whatsmeow ──► WhatsApp
             • sinkron sesi WA per kelas   (wa_sessions)
             • penjadwal pengingat H-1/H-0 (courses → wa_messages)
             • pengirim antrean            (wa_messages)
```

| Komponen | Teknologi |
| :--- | :--- |
| Web | Next.js 16 (App Router, `src/proxy.ts`), React 19, TypeScript, Tailwind CSS v4, Zustand, Lucide |
| Data & Auth | Supabase self-hosted: PostgreSQL 17 + RLS, GoTrue, Storage |
| Worker WhatsApp | Go + [whatsmeow](https://github.com/tulir/whatsmeow), pgx (`worker/`) |
| Pengujian | Vitest, SQL RLS (`scripts/test-rls.sh`), Go test, uji API end-to-end (`scripts/e2e-api.py`) |

Web tidak pernah bicara langsung dengan worker: web menulis **keinginan** lewat RPC (`wa_request`, `queue_reminder_now`, `queue_test_message`), worker menulis **status** (`wa_sessions.state`, QR, kode pairing) — keduanya lewat Postgres.

---

## 📂 Struktur

```
src/app/
  register/  menunggu/            registrasi & halaman tunggu ACC
  jadwal/  anggota/  kelola/      jadwal kelas, anggota, hub menu kelola (mobile)
  admin/dosen/  whatsapp/         dosen & link pribadi, pusat WhatsApp (status, statistik, template, antrean)
  superadmin/                     ACC kelas, ganti KM, hari libur
  settings/keamanan/              2FA (TOTP)
  dosen/[token]/ (+ calendar.ics) portal dosen tanpa login
  kelas/[token]/ (+ calendar.ics) papan jadwal publik kelas
  approval/  leave/new/  settings/password/  login/  api/auth/callback/
src/lib/  permissions, routes, nav, ics, reminderTemplate, nextReminder, publicPortal, data/supabaseRepository
supabase/migrations/              skema (20260928_multi_class_platform.sql = platform multi-kelas)
worker/                           mesin WhatsApp (Go)
scripts/                          test-rls.sh, e2e-api.py, seed-auth-users.mjs
```

---

## ⚡ Pengembangan lokal

```bash
npm install
cp .env.example .env.local   # isi URL & publishable key Supabase
npm run dev                  # http://localhost:3000
```

Aplikasi butuh Supabase (tidak ada lagi mode demo). Paling mudah memakai Supabase server lewat SSH tunnel
(`ssh -L 8000:127.0.0.1:8000 …` lalu `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`) atau Supabase CLI lokal.
Migrasi dijalankan berurutan: `20260921_initial_schema.sql` → `20260927_security_hardening.sql` → `20260928_multi_class_platform.sql` → `20260929_km_handover.sql` → `20260930_sipendosa_parity.sql`.
Data contoh (staging saja): isi juga `SUPABASE_SECRET_KEY` di `.env.local`, jalankan `node --env-file=.env.local scripts/seed-auth-users.mjs` (tanpa `CLASS_ID` = kelas demo, dibuat otomatis), lalu `supabase/seed.sql`.
Roster sungguhan: `CLASS_ID=<uuid kelas aktif> node --env-file=.env.local scripts/seed-auth-users.mjs roster.csv`, dengan CSV
ber-header `id,nim,full_name,role` (tanpa tanda kutip/koma di dalam nilai; `id` boleh kosong; `role` = `mahasiswa` | `sipen` | `km`), mis.:
```csv
id,nim,full_name,role
,2611102441001,Rian Pratama,mahasiswa
,2611102441002,Sarah Amalia,sipen
```

### Kualitas & pengujian
```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:rls        # butuh PGHOST/PGUSER (PostgreSQL biasa)
npm run test:worker     # go vet + go test (worker/)
npm run test:e2e-api    # di server: registrasi → ACC → jadwal → portal → worker WA (akun uji dibersihkan)
```

---

## 🖥️ Produksi (VPS)

| Bagian | Lokasi |
| :--- | :--- |
| Aplikasi | `/project/sipper-ti` → PM2 `sipper` (`/project/ecosystem.config.js`, cluster 4) |
| Supabase | `/project/sipperti-supabase` (docker compose `sipperti`, database `sipperti`; port hanya `127.0.0.1`) |
| Worker | `/opt/sipper-worker/sipper-worker`, service `sipper-worker`, env `/etc/sipper-worker.env` (role DB `sipper_worker`, BYPASSRLS, skema `whatsmeow`) |
| Nginx | `/etc/nginx/sites-available/platform` (app / api / studio) |

Deploy ulang aplikasi: `rsync` kode → `npm ci && npm run build` → `pm2 reload sipper`.
Deploy ulang worker: `cd worker && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o sipper-worker .` → salin ke `/opt/sipper-worker/` → `sudo systemctl restart sipper-worker`.
Role DB worker (`sipper_worker`) memakai BYPASSRLS, tetapi BYPASSRLS tidak memberi hak tabel. Grant yang dibutuhkan:
`SELECT` pada `classes`, `lecturers`, `profiles`, `holidays`; `SELECT, UPDATE` pada `courses`, `wa_sessions`; `SELECT, INSERT, UPDATE` pada `wa_messages`;
`SELECT, INSERT, UPDATE, DELETE` pada `wa_groups`; `USAGE` pada `wa_messages_id_seq`.
Vercel dinonaktifkan untuk repo ini (`vercel.json` → `git.deploymentEnabled: false`).

**Superadmin pertama** (sekali saja, setelah mendaftar lewat `/register` dan mengajukan kelas):
```sql
UPDATE classes  SET status = 'active', approved_at = now() WHERE created_by = (SELECT id FROM profiles WHERE nim = '<NIM>');
UPDATE profiles SET is_admin = true, status = 'active', role = 'km' WHERE nim = '<NIM>';
```

---

## 📄 Lisensi
Dikembangkan untuk keperluan akademik Program Studi Teknik Informatika, Universitas Muhammadiyah Kalimantan Timur.
