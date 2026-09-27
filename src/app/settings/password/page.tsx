import { RequireRole } from '@/components/auth/RequireRole';
import { ChangePasswordForm } from '@/components/settings/ChangePasswordForm';
import { safeNextPath } from '@/lib/redirect';

export const metadata = {
  title: 'Ganti Kata Sandi - SIPPER-TI',
  description: 'Perbarui kata sandi akun SIPPER-TI',
};

interface ChangePasswordPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  const { next } = await searchParams;
  return (
    <div className="py-8 sm:py-12 flex items-center justify-center">
      <RequireRole>
        <ChangePasswordForm nextPath={safeNextPath(next)} />
      </RequireRole>
    </div>
  );
}
