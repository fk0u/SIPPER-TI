// Rute yang bisa dibuka tanpa login (dipakai proxy server & penjaga klien).
export const PUBLIC_PREFIXES = ['/login', '/register', '/dosen/', '/api/auth/'];

/** Rute khusus peran tertentu. `admin` = superadmin (profiles.is_admin). */
export const ROLE_RULES: { prefix: string; roles: ('km' | 'sipen' | 'admin')[] }[] = [
  { prefix: '/approval', roles: ['km', 'sipen'] },
  { prefix: '/anggota', roles: ['km', 'sipen'] },
  { prefix: '/admin', roles: ['km', 'sipen'] },
  { prefix: '/whatsapp', roles: ['km', 'sipen'] },
  { prefix: '/superadmin', roles: ['admin'] },
];
