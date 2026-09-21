import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Masuk Akun - SIPPER-TI',
  description: 'Portal Masuk Perizinan Mahasiswa TI UMKT',
};

export default function LoginPage() {
  return (
    <div className="py-8 sm:py-12 flex items-center justify-center">
      <LoginForm />
    </div>
  );
}
