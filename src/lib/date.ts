// Utilitas tanggal berbasis zona waktu lokal perangkat (WITA untuk pengguna UMKT).
// Hindari `toISOString()` untuk tanggal kalender karena selalu UTC.

const pad = (n: number) => String(n).padStart(2, '0');

/** Tanggal kalender lokal dalam format `YYYY-MM-DD`. */
export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocalISO(now: Date = new Date()): string {
  return toLocalISODate(now);
}

/** Parse `YYYY-MM-DD` sebagai tanggal lokal (bukan UTC). */
export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Jumlah hari inklusif antara dua tanggal kalender; 0 bila rentang terbalik. */
export function diffDaysInclusive(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = parseISODate(start);
  const e = parseISODate(end);
  if (e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** Apakah `date` (YYYY-MM-DD) berada dalam rentang inklusif start..end. */
export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
/** Urutan tampilan jadwal kuliah (Senin dulu). Selaras dengan `day_index()` di database. */
export const DAY_NAMES_MON_FIRST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

/** Indeks hari (0 = Minggu) dari nama hari Indonesia, -1 bila tidak dikenal. */
export function dayIndexID(name: string | null | undefined): number {
  const n = (name ?? '').trim().replace(/'/g, '').toLowerCase();
  return DAY_NAMES_ID.findIndex((d) => d.toLowerCase() === n);
}

export function dayNameID(now: Date = new Date()): string {
  return DAY_NAMES_ID[now.getDay()];
}
