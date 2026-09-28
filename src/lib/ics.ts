// Kalender iCalendar (RFC 5545) jadwal kuliah (portal dosen & papan jadwal kelas): satu event
// berulang mingguan per mata kuliah, hari libur dikecualikan (EXDATE). Zona waktu: WITA (UTC+8, tanpa DST).
import type { Holiday, PortalCourse } from '@/types/database';
import { dayIndexID, parseISODate, toLocalISODate } from './date';

const TZID = 'Asia/Makassar';

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const compactDate = (iso: string) => iso.replace(/-/g, '');
const compactTime = (t: string) => `${t.slice(0, 2)}${t.slice(3, 5)}00`;

/** Lipat baris > 75 oktet sesuai RFC 5545 (cukup per karakter untuk teks kita). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

/** Tanggal pertemuan pertama (hari ini termasuk) untuk indeks hari `dow`. */
export function firstOccurrence(dow: number, today: string): string {
  const d = parseISODate(today);
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return toLocalISODate(d);
}

export function buildScheduleIcs(
  calendarName: string,
  courses: PortalCourse[],
  holidays: Holiday[],
  now: Date = new Date()
): string {
  const today = toLocalISODate(now);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
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
    const first = firstOccurrence(dow, today);
    const start = compactTime(c.start_time);
    const exdates = holidays
      .filter((h) => h.date >= first && parseISODate(h.date).getDay() === dow)
      .map((h) => `${compactDate(h.date)}T${start}`);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${c.id}@sipper-ti`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZID}:${compactDate(first)}T${start}`,
      `DTEND;TZID=${TZID}:${compactDate(first)}T${compactTime(c.end_time)}`,
      'RRULE:FREQ=WEEKLY',
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
