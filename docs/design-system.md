# SIPPER-TI: Design System & UI Specifications

## 1. Tipografi & Hierarki Visual
- **Primary Font:** Geist Sans (Display & Body)
- **Monospace Font:** Geist Mono (Data NIM, Tanggal, Counter Metrik, Token)
- **Scale:**
  - Display Title: `text-2xl sm:text-3xl font-extrabold tracking-tight`
  - Section Heading: `text-base sm:text-lg font-bold tracking-tight`
  - Body Text: `text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed`
  - Metadata / Tag: `text-[10px] font-mono uppercase tracking-[0.16em]`

## 2. Palet Warna Berdisiplin
- **Neutral Base:**
  - Light: `#f8fafc` (Slate 50), Surface: `rgba(255, 255, 255, 0.92)`
  - Dark: `#06090e` (Graphite Deep), Surface: `rgba(11, 15, 25, 0.88)`
- **Primary Accent:**
  - Light: `#2563eb` (Cobalt Blue)
  - Dark: `#3b82f6` (Electric Blue)
- **Semantic Accents:**
  - Success / Disetujui: Emerald (`#10b981`)
  - Warning / Menunggu: Amber (`#f59e0b`)
  - Error / Ditolak: Rose (`#f43f5e`)
  - Proxy / Role KM: Purple (`#8b5cf6`)

## 3. Komponen Fisik & Hardware Architecture (Doppelrand)
- **Double-Bezel (Doppelrand):**
  - Cangkang Luar (`.doppelrand-shell`): Padding `p-1.5 sm:p-2`, radius `rounded-2xl`, border halus bergradien.
  - Inti Kartu (`.doppelrand-core`): Radius konsentris, inner highlight `shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]`.
- **Button-in-Button:**
  - Tombol aksi utama dengan lingkaran panah bersarang flush di sisi kanan (`group hover:translate-x-0.5`).

## 4. Sistem Navigasi Sistematis
- **Desktop Viewport ($\ge 768\text{px}$):**
  - Top Navigation Bar mengambang dengan liquid-glass, brand, tautan lengkap, dropdown profil, dan switch mode terang/gelap.
- **Mobile Viewport ($< 768\text{px}$):**
  - Top App Bar kompak (Brand, Role Tag, dan Avatar trigger).
  - Floating Bottom Dock Navigation (4 tabs dengan haptic scale `active:scale-90`, bebas dari stuck blur overlay).
