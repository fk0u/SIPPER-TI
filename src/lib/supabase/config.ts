// Konfigurasi Supabase dibaca saat build (NEXT_PUBLIC_* di-inline oleh Next.js).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** `true` bila kredensial Supabase valid tersedia; selain itu aplikasi berjalan dalam mode demo. */
export const isSupabaseConfigured = (): boolean =>
  Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_URL.includes('dummy') &&
      !SUPABASE_URL.includes('your-project-ref')
  );

/** Domain email sintetis untuk akun login NIM (lihat handle_new_user di migrasi). */
export const NIM_EMAIL_DOMAIN = 'local.sipper-ti';
export const nimToEmail = (nim: string) => `${nim.trim()}@${NIM_EMAIL_DOMAIN}`;
export const isNimAccountEmail = (email: string | null | undefined) =>
  Boolean(email && email.toLowerCase().endsWith(`@${NIM_EMAIL_DOMAIN}`));

export const ATTACHMENT_BUCKET = 'leave-attachments';
