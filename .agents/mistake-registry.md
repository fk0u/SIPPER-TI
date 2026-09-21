# Mistake Registry & Error Prevention Database

## Entry 001: Mobile Navigation Blur Trap & Redundant Overlays
- **Error Description:** Menggunakan komponen overlay menu multi-layer GSAP (StaggeredMenu) pada navigasi mobile saat sudah ada Bottom Navigation Bar. Hal ini menyebabkan backdrop blur menetap di viewport mobile, tampilan terkunci kabur, dan menu tidak sistematis.
- **Root Cause:** Tidak membedakan secara tegas sistem navigasi desktop dan mobile; menumpuk menu drawer di header mobile bersamaan dengan tab bar bawah.
- **Prevention Rule:** 
  1. Selalu pisahkan arsitektur navigasi desktop dan mobile secara sistematis (`hidden md:flex` untuk desktop navbar, `block md:hidden` untuk mobile top bar & bottom tab bar).
  2. Jangan gunakan overlay/backdrop fullscreen yang dapat mengaburkan atau mengunci interaksi mobile kecuali modal spesifik yang memiliki kontrol tutup jelas dan handler klik luar.
  3. Gunakan navigasi mobile bergaya aplikasi nyata (native app shell: compact header + thumb-friendly bottom dock).
