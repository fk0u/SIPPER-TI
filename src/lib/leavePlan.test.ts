import { describe, expect, it } from 'vitest';
import type { Course } from '@/types/database';
import { affectedCourses, lectureDays } from './leavePlan';

const course = (id: string, day: string | null, start: string | null, end: string | null) =>
  ({ id, day_of_week: day, start_time: start, end_time: end }) as Course;

// 2026-10-05 = Senin
const cloud = course('cloud', 'Senin', '10:00:00', '13:00:00');
const ml = course('ml', 'Senin', '14:00:00', '16:00:00');
const net = course('net', 'Jumat', '08:00:00', '10:00:00');
const tba = course('tba', null, null, null);
const all = [cloud, ml, net, tba];

describe('lectureDays', () => {
  it('menghitung hanya hari yang ada matkul (akhir pekan terlewati)', () => {
    const days = lectureDays(all, [], '2026-10-02', '2026-10-06'); // Jum..Sel
    expect(days.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-05']);
    expect(days[1].courses.map((c) => c.id)).toEqual(['cloud', 'ml']);
  });

  it('melewati hari libur', () => {
    expect(lectureDays(all, ['2026-10-05'], '2026-10-05', '2026-10-05')).toEqual([]);
  });

  it('izin per jam hanya mengenai matkul yang beririsan', () => {
    const days = lectureDays(all, [], '2026-10-05', '2026-10-05', { start: '10:00', end: '11:00' });
    expect(days[0].courses.map((c) => c.id)).toEqual(['cloud']);
    // batas bersinggungan tidak dihitung
    expect(lectureDays(all, [], '2026-10-05', '2026-10-05', { start: '13:00', end: '14:00' })).toEqual([]);
  });

  it('rentang terbalik kosong', () => {
    expect(lectureDays(all, [], '2026-10-06', '2026-10-05')).toEqual([]);
  });

  it('meringkas pertemuan per matkul', () => {
    const summary = affectedCourses(lectureDays(all, [], '2026-10-05', '2026-10-16'));
    expect(summary.map((a) => [a.course.id, a.dates.length])).toEqual([
      ['cloud', 2],
      ['ml', 2],
      ['net', 2],
    ]);
  });
});
