import { describe, expect, it } from 'vitest';
import { formatCountdown, nextReminder, outsideWindow } from './nextReminder';
import type { Course } from '@/types/database';

const course = (over: Partial<Course> = {}): Course => ({
  id: 'c1', class_id: 'k', code: 'TI-401', name: 'Cloud', lecturer_name: null, lecturer_id: 'l1',
  day_of_week: 'Senin', start_time: '08:00:00', end_time: '09:40:00', semester: 's', room: null,
  reminder_enabled: true, reminder_mode: 'H-1', reminder_time: '08:00:00', reminder_target: null,
  link_group: null, last_reminded_on: null, created_at: '', ...over,
});
const win = { start: '08:00:00', end: '16:00:00' };
// Jam dinding WITA → Date sebenarnya
const wita = (iso: string) => new Date(`${iso}+08:00`);

describe('nextReminder', () => {
  it('H-1: Minggu pukul 08:00 untuk kuliah Senin', () => {
    const r = nextReminder([course()], [], win, wita('2026-10-04T07:00:00'));
    expect(r?.fireAt.toISOString()).toBe(wita('2026-10-04T08:00:00').toISOString());
    expect(r?.lectureDate).toBe('2026-10-05');
  });
  it('jam sudah lewat & belum terkirim: dikirim sekarang', () => {
    const now = wita('2026-10-04T09:30:00');
    expect(nextReminder([course()], [], win, now)?.fireAt.getTime()).toBe(wita('2026-10-04T09:30:00').getTime());
  });
  it('sudah terkirim hari ini: minggu depan', () => {
    const r = nextReminder([course({ last_reminded_on: '2026-10-04' })], [], win, wita('2026-10-04T09:30:00'));
    expect(r?.lectureDate).toBe('2026-10-12');
  });
  it('jam pengingat sebelum jam operasional dimulai: menunggu jam operasional', () => {
    const r = nextReminder([course({ reminder_time: '06:00:00' })], [], win, wita('2026-10-04T05:00:00'));
    expect(r?.fireAt.getTime()).toBe(wita('2026-10-04T08:00:00').getTime());
  });
  it('kuliah jatuh di hari libur dilewati', () => {
    const r = nextReminder([course()], [{ date: '2026-10-05', description: 'Libur' }], win, wita('2026-10-04T07:00:00'));
    expect(r?.lectureDate).toBe('2026-10-12');
  });
  it('di luar jam operasional / tanpa tujuan: tidak pernah terkirim', () => {
    expect(nextReminder([course({ reminder_time: '18:00:00' })], [], win, wita('2026-10-04T07:00:00'))).toBeNull();
    expect(nextReminder([course({ lecturer_id: null })], [], win, wita('2026-10-04T07:00:00'))).toBeNull();
    expect(outsideWindow(course({ reminder_time: '18:00:00' }), win)).toBe(true);
  });
  it('memilih yang paling awal', () => {
    const r = nextReminder(
      [course(), course({ id: 'c2', day_of_week: 'Selasa', reminder_mode: 'H-0' })],
      [], win, wita('2026-10-04T07:00:00')
    );
    expect(r?.course.id).toBe('c1');
  });
});

describe('formatCountdown', () => {
  it('format ringkas', () => {
    expect(formatCountdown(30_000)).toBe('sebentar lagi');
    expect(formatCountdown((26 * 60 + 5) * 60_000)).toBe('1 hari 2 jam 5 menit');
  });
});
