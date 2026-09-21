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
