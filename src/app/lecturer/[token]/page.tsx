import { GuestLecturerView } from '@/components/lecturer/GuestLecturerView';

export const metadata = {
  title: 'Portal Akses Dosen - SIPPER-TI',
  description: 'Rekap Presensi & Perizinan Mahasiswa TI Internasional UMKT',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function LecturerGuestPage({ params }: PageProps) {
  const resolvedParams = await params;
  return (
    <div className="py-4 sm:py-6">
      <GuestLecturerView tokenString={resolvedParams.token} />
    </div>
  );
}
