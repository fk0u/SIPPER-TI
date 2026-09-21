import { LeaveForm } from '@/components/leave/LeaveForm';

export const metadata = {
  title: 'Formulir Pengajuan Izin - SIPPER-TI',
  description: 'Form Pengajuan Izin dan Dispensasi Kelas Mahasiswa TI UMKT',
};

export default function NewLeavePage() {
  return (
    <div className="py-4 sm:py-6">
      <LeaveForm />
    </div>
  );
}
