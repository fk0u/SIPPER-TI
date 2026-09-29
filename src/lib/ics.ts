// Kalender iCalendar (RFC 5545) jadwal kuliah (portal dosen & papan jadwal kelas): satu event
// berulang mingguan per mata kuliah, hari libur dikecualikan (EXDATE). Zona waktu: WITA (UTC+8, tanpa DST).
import type { Holiday, PortalCourse } from '@/types/database';
import { dayIndexID } from './date';

const TZID = 'Asia/Makassar';
const WITA_OFFSET_MS = 8 * 3600_000;
const DAY_MS = 86_400_000;
/** Sama dengan cakupan hari libur yang dikirim RPC portal (365 hari): di luar itu EXDATE tidak diketahui. */
export const ICS_HORIZON_DAYS = 365;

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/([,;])/g, '\\$1');
const compactDate = (iso: string) => iso.replace(/-/g, '');
const compactTime = (t: string) => `${t.slice(0, 2)}${t.slice(3, 5)}00`;

const utf8 = new TextEncoder();
/** Lipat baris > 75 oktet UTF-8 (RFC 5545) tanpa memotong di tengah karakter. */
function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = utf8.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // baris lanjutan diawali satu spasi
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

/** Tengah malam hari ini menurut WITA, sebagai milidetik "jam dinding WITA" (dibaca dengan getUTC*). */
const witaMidnight = (now: Date) => {
  const t = now.getTime() + WITA_OFFSET_MS;
  return t - (t % DAY_MS);
};
const isoOf = (witaMs: number) => new Date(witaMs).toISOString().slice(0, 10);

/** Tanggal pertemuan pertama (hari ini termasuk, WITA) untuk indeks hari `dow`. */
export function firstOccurrence(dow: number, now: Date = new Date()): string {
  const today = witaMidnight(now);
  const todayDow = new Date(today).getUTCDay();
  return isoOf(today + ((dow - todayDow + 7) % 7) * DAY_MS);
}

export function buildScheduleIcs(
  calendarName: string,
  courses: PortalCourse[],
  holidays: Holiday[],
  now: Date = new Date()
): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // Pengulangan dibatasi sampai batas data hari libur agar tidak ada pertemuan di hari libur yang tak tercatat
  const until = compactDate(isoOf(witaMidnight(now) + ICS_HORIZON_DAYS * DAY_MS));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIPPER-TI//Jadwal Kuliah//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${TZID}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:WITA',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const c of courses) {
    const dow = dayIndexID(c.day_of_week);
    if (dow < 0 || !c.start_time || !c.end_time) continue;
    const first = firstOccurrence(dow, now);
    const start = compactTime(c.start_time);
    const exdates = holidays
      .filter((h) => h.date >= first && new Date(`${h.date}T00:00:00Z`).getUTCDay() === dow)
      .map((h) => `${compactDate(h.date)}T${start}`);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${c.id}@sipper-ti`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZID}:${compactDate(first)}T${start}`,
      `DTEND;TZID=${TZID}:${compactDate(first)}T${compactTime(c.end_time)}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${until}T235959Z`,
      ...(exdates.length ? [`EXDATE;TZID=${TZID}:${exdates.join(',')}`] : []),
      `SUMMARY:${escapeText(`${c.code} ${c.name} · ${c.class_name}`)}`,
      ...(c.room ? [`LOCATION:${escapeText(c.room)}`] : []),
      `DESCRIPTION:${escapeText(`Kelas ${c.class_name}${c.link_group ? `\nTautan: ${c.link_group}` : ''}`)}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
