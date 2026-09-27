import { LoginForm } from '@/components/auth/LoginForm';
import { safeNextPath } from '@/lib/redirect';

export const metadata = {
  title: 'Masuk Akun - SIPPER-TI',
  description: 'Portal Masuk Perizinan Mahasiswa TI UMKT',
};

const ERROR_MESSAGES: Record<string, string> = {
  domain: 'Registrasi dibatasi hanya untuk akun civitas akademika UMKT (@umkt.ac.id).',
  auth_callback_failed: 'Login dengan akun kampus gagal. Silakan coba lagi.',
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams;
  return (
    <div className="py-8 sm:py-12 flex items-center justify-center">
      <LoginForm
        nextPath={safeNextPath(next)}
        initialError={error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.auth_callback_failed) : null}
      />
    </div>
  );
}
