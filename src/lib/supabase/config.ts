// Konfigurasi Supabase dibaca saat build (NEXT_PUBLIC_* di-inline oleh Next.js).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// Mendukung publishable key baru (sb_publishable_...) maupun anon key JWT lama.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** `true` bila kredensial Supabase valid tersedia; selain itu aplikasi berjalan dalam mode demo. */
export const isSupabaseConfigured = (): boolean =>
  Boolean(
    SUPABASE_URL &&
      SUPABASE_PUBLISHABLE_KEY &&
      !SUPABASE_URL.includes('dummy') &&
      !SUPABASE_URL.includes('your-project-ref')
  );

/**
 * Login NIM memakai email kampus `{nim}@umkt.ac.id` + password, sehingga akun NIM
 * dan akun Google SSO mahasiswa yang sama adalah satu akun Supabase.
 */
export const NIM_EMAIL_DOMAIN = 'umkt.ac.id';
export const nimToEmail = (nim: string) => `${nim.trim()}@${NIM_EMAIL_DOMAIN}`;

export const ATTACHMENT_BUCKET = 'permit-proofs';
