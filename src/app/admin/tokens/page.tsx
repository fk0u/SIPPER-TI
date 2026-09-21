import { LecturerTokenManager } from '@/components/admin/LecturerTokenManager';

export const metadata = {
  title: 'Kelola Link Akses Dosen - SIPPER-TI',
  description: 'Manajemen Token URL Publik Dosen Pengampu',
};

export default function AdminTokensPage() {
  return (
    <div className="py-4 sm:py-6">
      <LecturerTokenManager />
    </div>
  );
}
