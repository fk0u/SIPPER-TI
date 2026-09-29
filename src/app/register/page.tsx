import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata = {
  title: 'Daftar Akun - SIPPER-TI',
  description: 'Registrasi mahasiswa dengan NIM dan pilihan kelas',
};

export default function RegisterPage() {
  return (
    <div className="py-8 sm:py-12 flex items-center justify-center">
      <RegisterForm />
    </div>
  );
}
