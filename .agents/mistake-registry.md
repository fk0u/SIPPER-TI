# Mistake Registry & Error Prevention Database

## Entry 001: Mobile Navigation Blur Trap & Redundant Overlays
- **Error Description:** Menggunakan komponen overlay menu multi-layer GSAP (StaggeredMenu) pada navigasi mobile saat sudah ada Bottom Navigation Bar. Hal ini menyebabkan backdrop blur menetap di viewport mobile, tampilan terkunci kabur, dan menu tidak sistematis.
- **Root Cause:** Tidak membedakan secara tegas sistem navigasi desktop dan mobile; menumpuk menu drawer di header mobile bersamaan dengan tab bar bawah.
- **Prevention Rule:** 
  1. Selalu pisahkan arsitektur navigasi desktop dan mobile secara sistematis (`hidden md:flex` untuk desktop navbar, `block md:hidden` untuk mobile top bar & bottom tab bar).
  2. Jangan gunakan overlay/backdrop fullscreen yang dapat mengaburkan atau mengunci interaksi mobile kecuali modal spesifik yang memiliki kontrol tutup jelas dan handler klik luar.
  3. Gunakan navigasi mobile bergaya aplikasi nyata (native app shell: compact header + thumb-friendly bottom dock).

## Entry 002: TypeScript Strict Boolean Evaluation for Component Props
- **Error Description:** Kesalahan kompilasi Next.js/TypeScript `Type 'boolean | null' is not assignable to type 'boolean | undefined'`.
- **Root Cause:** Menulis ekspresi `user && (user.role === 'km' || user.role === 'sipen')` di mana `user` bertipe `Profile | null`, menghasilkan tipe evaluasi gabungan `boolean | null` alih-alih `boolean` murni.
- **Prevention Rule:**
  1. Selalu bungkus ekspresi kondisi yang melibatkan objek nullable dengan `Boolean(...)` atau `!!(...)` saat dioper ke prop bertipe boolean (misalnya `canManage = Boolean(user && ...)`).
  2. Selalu sediakan fallback aman untuk properti opsional angka/string (misalnya `file.size ? (file.size / 1024).toFixed(0) : '-'`) untuk menghindari kompilasi `TS18048: 'size' is possibly 'undefined'`.

## Entry 003: Lampiran Palsu & Blob URL yang Dipersist
- **Error Description:** Form izin menyisipkan gambar `picsum.photos` sebagai "surat keterangan resmi" bila pengguna tidak mengunggah berkas, dan menyimpan `URL.createObjectURL()` ke localStorage.
- **Root Cause:** Mengejar tampilan demo yang "selalu terisi" tanpa memikirkan integritas data; blob URL hanya hidup selama tab terbuka.
- **Prevention Rule:**
  1. Jangan pernah membuat data bukti/record pengganti. Tolak submit dengan pesan jelas.
  2. Jangan persist `blob:` URL. Mode live simpan `path` storage + signed URL; mode demo data URL kecil atau metadata saja.

## Entry 004: RLS yang Mengizinkan Eskalasi Hak Akses
- **Error Description:** Policy `UPDATE profiles USING (auth.uid() = id)` membuat mahasiswa bisa mengubah `role` sendiri menjadi `km`; policy insert izin mengizinkan `status = 'approved'` langsung.
- **Root Cause:** RLS hanya membatasi baris, bukan kolom; tidak ada `WITH CHECK`.
- **Prevention Rule:**
  1. Kolom sensitif dikunci dengan trigger `BEFORE UPDATE` (lihat `protect_profile_columns`, `protect_leave_request_columns`).
  2. Setiap policy INSERT/UPDATE wajib punya `WITH CHECK` yang membatasi nilai kolom status/verifikator.
  3. Tambahkan kasus negatif di `supabase/tests/rls_test.sql` untuk setiap policy baru.

## Entry 005: Klaim "Validated" Tanpa Implementasi
- **Error Description:** `docs/test-cases.md` dan roadmap menandai fitur sebagai tervalidasi (domain check, logout cookie, zoom viewer, `npm run build` 100%) padahal belum ada implementasi/lint gagal.
- **Root Cause:** Status "Validated" ditulis tanpa bukti yang dapat diulang; belum ada test/lint yang dijalankan.
- **Prevention Rule:** Status "Validated" hanya bila ada bukti yang dapat diulang (unit test, `scripts/test-rls.sh`, atau skenario E2E yang dijalankan). Bedakan "Validated (demo)" dan "Validated (live)".

