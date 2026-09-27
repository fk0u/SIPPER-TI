import { RequireRole } from '@/components/auth/RequireRole';
import { ChangePasswordForm } from '@/components/settings/ChangePasswordForm';

export const metadata = {
  title: 'Ganti Kata Sandi - SIPPER-TI',
  description: 'Perbarui kata sandi akun SIPPER-TI',
};

export default function ChangePasswordPage() {
  return (
    <div className="py-8 sm:py-12 flex items-center justify-center">
      <RequireRole>
        <ChangePasswordForm />
      </RequireRole>
    </div>
  );
}
