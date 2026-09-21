import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Return real client if configured, otherwise fallback gracefully
  return createBrowserClient(
    supabaseUrl || 'https://dummy.supabase.co',
    supabaseAnonKey || 'dummy-anon-key'
  );
}

export const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    key &&
    !url.includes('dummy') &&
    !url.includes('your-project-ref')
  );
};
