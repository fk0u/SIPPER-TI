import { fetchLecturerPortal } from '@/lib/lecturerPortal';
import { buildLecturerIcs } from '@/lib/ics';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await fetchLecturerPortal(token);
  if (portal.status !== 'ok') {
    return new Response('Kalender tidak ditemukan.', { status: portal.status === 'not_found' ? 404 : 503 });
  }
  return new Response(buildLecturerIcs(portal.lecturer.full_name, portal.courses, portal.holidays), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="jadwal-mengajar.ics"',
      'Cache-Control': 'private, max-age=900',
      'X-Robots-Tag': 'noindex',
    },
  });
}
