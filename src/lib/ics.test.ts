import { describe, expect, it } from 'vitest';
import { buildScheduleIcs, firstOccurrence } from './ics';
import type { PortalCourse } from '@/types/database';

const course = (over: Partial<PortalCourse> = {}): PortalCourse => ({
  id: 'c1',
  code: 'TI-401',
  name: 'Cloud; Computing',
  day_of_week: 'Senin',
  start_time: '08:00:00',
  end_time: '09:40:00',
  room: 'Lab 3',
  semester: '2026/2027-1',
  class_name: 'TI Internasional 2026',
  link_group: null,
  ...over,
});

describe('firstOccurrence', () => {
  it('hari ini bila harinya sama, selain itu hari berikutnya', () => {
    expect(firstOccurrence(1, '2026-09-28')).toBe('2026-09-28'); // Senin
    expect(firstOccurrence(3, '2026-09-28')).toBe('2026-09-30'); // Rabu
    expect(firstOccurrence(0, '2026-09-28')).toBe('2026-10-04'); // Minggu
  });
});

describe('buildScheduleIcs', () => {
  it('nama kalender', () => {
    expect(buildScheduleIcs('Jadwal Kelas A', [], [])).toContain('X-WR-CALNAME:Jadwal Kelas A');
  });
  const now = new Date(2026, 8, 28, 10, 0); // Senin 28 Sep 2026
  const ics = buildScheduleIcs('Jadwal Mengajar Dr. Hendra', [course(), course({ id: 'c2', day_of_week: null })], [
    { date: '2026-10-05', description: 'Libur' }, // Senin → dikecualikan
    { date: '2026-10-06', description: 'Libur Selasa' }, // bukan hari kuliah
  ], now);

  it('satu event mingguan per matkul terjadwal, CRLF', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('DTSTART;TZID=Asia/Makassar:20260928T080000');
    expect(ics).toContain('DTEND;TZID=Asia/Makassar:20260928T094000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('hari libur di hari kuliah menjadi EXDATE', () => {
    expect(ics).toContain('EXDATE;TZID=Asia/Makassar:20261005T080000');
    expect(ics).not.toContain('20261006');
  });
  it('teks di-escape', () => {
    expect(ics).toContain('SUMMARY:TI-401 Cloud\\; Computing · TI Internasional 2026');
  });
});
