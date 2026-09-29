import { describe, expect, it } from 'vitest';
import { currentSemester, dayNameID, diffDaysInclusive, isDateInRange, todayLocalISO } from './date';

describe('date utils', () => {
  it('todayLocalISO memakai tanggal lokal, bukan UTC', () => {
    // 27 Sep 2026 06:30 waktu lokal
    expect(todayLocalISO(new Date(2026, 8, 27, 6, 30))).toBe('2026-09-27');
  });

  it('diffDaysInclusive menghitung hari inklusif', () => {
    expect(diffDaysInclusive('2026-09-21', '2026-09-21')).toBe(1);
    expect(diffDaysInclusive('2026-09-21', '2026-09-23')).toBe(3);
    expect(diffDaysInclusive('2026-09-23', '2026-09-21')).toBe(0);
    expect(diffDaysInclusive('', '2026-09-21')).toBe(0);
    // melewati akhir bulan
    expect(diffDaysInclusive('2026-09-29', '2026-10-02')).toBe(4);
  });

  it('isDateInRange inklusif', () => {
    expect(isDateInRange('2026-09-21', '2026-09-21', '2026-09-22')).toBe(true);
    expect(isDateInRange('2026-09-22', '2026-09-21', '2026-09-22')).toBe(true);
    expect(isDateInRange('2026-09-23', '2026-09-21', '2026-09-22')).toBe(false);
  });

  it('dayNameID mengikuti nama hari Indonesia', () => {
    expect(dayNameID(new Date(2026, 8, 28))).toBe('Senin');
  });
});

describe('currentSemester', () => {
  it('ganjil Agustus–Januari, genap Februari–Juli', () => {
    expect(currentSemester(new Date(2026, 8, 28))).toBe('2026/2027-1');
    expect(currentSemester(new Date(2027, 0, 10))).toBe('2026/2027-1');
    expect(currentSemester(new Date(2027, 2, 1))).toBe('2026/2027-2');
    // 1 Agustus 00:30 WITA = 31 Juli UTC: sudah semester ganjil baru
    expect(currentSemester(new Date('2027-08-01T00:30:00+08:00'))).toBe('2027/2028-1');
  });
});
