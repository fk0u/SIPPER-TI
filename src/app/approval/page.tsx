import { ApprovalDashboard } from '@/components/approval/ApprovalDashboard';

export const metadata = {
  title: 'Dashboard Approval - SIPPER-TI',
  description: 'Verifikasi & Validasi Surat Izin Mahasiswa TI UMKT',
};

export default function ApprovalPage() {
  return (
    <div className="py-4 sm:py-6">
      <ApprovalDashboard />
    </div>
  );
}
