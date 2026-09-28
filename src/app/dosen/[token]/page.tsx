import { connection } from 'next/server';
import { LecturerPortalView } from '@/components/lecturer/LecturerPortalView';
import { fetchLecturerPortal } from '@/lib/publicPortal';

export const metadata = {
  title: 'Portal Dosen - SIPPER-TI',
  description: 'Jadwal mengajar & rekap izin mahasiswa',
  robots: { index: false, follow: false },
};

export default async function LecturerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection();
  const portal = await fetchLecturerPortal(token);
  return (
    <div className="py-4 sm:py-6">
      <LecturerPortalView portal={portal} token={token} />
    </div>
  );
}
