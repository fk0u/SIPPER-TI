import { connection } from 'next/server';
import { LecturerPortalView } from '@/components/lecturer/LecturerPortalView';
import { fetchLecturerPortal } from '@/lib/publicPortal';

export const metadata = {
  title: 'Portal Dosen - SIPPER-TI',
  description: 'Jadwal mengajar & rekap izin mahasiswa',
  robots: { index: false, follow: false },
  // Token ada di URL: jangan bocorkan lewat header Referer ke tautan/lampiran
  referrer: 'no-referrer' as const,
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
