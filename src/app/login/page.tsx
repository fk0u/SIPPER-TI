import { LoginForm } from '@/components/auth/LoginForm';
import { safeNextPath } from '@/lib/redirect';

export const metadata = {
  title: 'Masuk Akun - SIPPER-TI',
  description: 'Portal Masuk Perizinan Mahasiswa TI UMKT',
};

const ERROR_MESSAGES: Record<string, string> = {
  domain: 'Registrasi dibatasi hanya untuk akun civitas akademika UMKT (@umkt.ac.id).',
  auth_callback_failed: 'Login dengan akun kampus gagal. Silakan coba lagi.',
  profile_unavailable: 'Profil akun tidak dapat dimuat. Coba lagi beberapa saat, atau hubungi KM bila berlanjut.',
};

function errorMessageFor(error: string | string[] | undefined): string | null {
  if (typeof error !== 'string' || !error) return null;
  return Object.hasOwn(ERROR_MESSAGES, error) ? ERROR_MESSAGES[error] : ERROR_MESSAGES.auth_callback_failed;
}

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams;
  return (
    <div className="py-8 sm:py-12 flex items-center justify-center">
      <LoginForm
        nextPath={safeNextPath(next)}
        initialError={errorMessageFor(error)}
      />
    </div>
  );
}
