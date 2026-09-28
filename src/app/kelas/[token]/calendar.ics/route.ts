import { fetchClassBoard } from '@/lib/publicPortal';
import { buildScheduleIcs } from '@/lib/ics';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const board = await fetchClassBoard(token);
  if (board.status !== 'ok') {
    return new Response('Kalender tidak ditemukan.', { status: board.status === 'not_found' ? 404 : 503 });
  }
  return new Response(buildScheduleIcs(`Jadwal Kuliah ${board.class.name}`, board.courses, board.holidays), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="jadwal-kelas.ics"',
      'Cache-Control': 'public, max-age=900',
      'X-Robots-Tag': 'noindex',
    },
  });
}
