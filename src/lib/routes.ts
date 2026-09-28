// Rute yang bisa dibuka tanpa login (dipakai proxy server & penjaga klien).
export const PUBLIC_PREFIXES = ['/login', '/register', '/dosen/', '/kelas/', '/api/auth/'];
/** Halaman publik mandiri: tanpa navbar & bottom dock aplikasi. */
export const STANDALONE_PREFIXES = ['/dosen/', '/kelas/'];

/** Rute khusus peran tertentu. `admin` = superadmin (profiles.is_admin). */
export const ROLE_RULES: { prefix: string; roles: ('km' | 'sipen' | 'admin')[] }[] = [
  { prefix: '/approval', roles: ['km', 'sipen'] },
  { prefix: '/anggota', roles: ['km', 'sipen'] },
  { prefix: '/admin', roles: ['km', 'sipen'] },
  { prefix: '/whatsapp', roles: ['km', 'sipen'] },
  { prefix: '/superadmin', roles: ['admin'] },
];
