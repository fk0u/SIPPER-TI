import { describe, expect, it } from 'vitest';
import { isCampusEmail, safeNextPath } from './redirect';
import { formatFileSize, sanitizeFileName, validateAttachmentFiles } from './attachments';
import { buildLecturerRecap } from './lecturerRecap';
import { INITIAL_COURSES, INITIAL_LECTURER_TOKENS, INITIAL_LEAVE_REQUESTS } from './mockData';

describe('redirect', () => {
  it('safeNextPath menolak open redirect', () => {
    expect(safeNextPath('/approval')).toBe('/approval');
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    // ?next=a&next=b menghasilkan array
    expect(safeNextPath(['/a', '/b'])).toBe('/');
  });
  it('isCampusEmail hanya domain UMKT', () => {
    expect(isCampusEmail('a@umkt.ac.id')).toBe(true);
    expect(isCampusEmail('a@mail.umkt.ac.id')).toBe(true);
    expect(isCampusEmail('a@gmail.com')).toBe(false);
    expect(isCampusEmail('a@umkt.ac.id.evil.com')).toBe(false);
    expect(isCampusEmail(undefined)).toBe(false);
  });
});

describe('attachments', () => {
  const file = (name: string, type: string, size: number) =>
    new File([new Uint8Array(size)], name, { type });

  it('mengumpulkan semua error berkas', () => {
    const { valid, errors } = validateAttachmentFiles([
      file('ok.jpg', 'image/jpeg', 10),
      file('x.exe', 'application/x-msdownload', 10),
      file('big.pdf', 'application/pdf', 6 * 1024 * 1024),
    ]);
    expect(valid.map((f) => f.name)).toEqual(['ok.jpg']);
    expect(errors).toHaveLength(2);
  });
  it('formatFileSize menangani 0 dan undefined', () => {
    expect(formatFileSize(0)).toBe('0 KB');
    expect(formatFileSize(undefined)).toBe('-');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
  it('sanitizeFileName aman untuk path storage', () => {
    expect(sanitizeFileName('../surat dokter (1).jpg')).toBe('.._surat_dokter_1_.jpg');
    expect(sanitizeFileName('a/b\\c.pdf')).not.toMatch(/[\\/]/);
  });
});

describe('buildLecturerRecap', () => {
  it('hanya izin approved, tanpa alasan', () => {
    const recap = buildLecturerRecap('demo-dosen-semua-matkul', INITIAL_LECTURER_TOKENS, INITIAL_LEAVE_REQUESTS, INITIAL_COURSES);
    expect(recap.status).toBe('ok');
    if (recap.status !== 'ok') return;
    expect(recap.leaves.length).toBe(INITIAL_LEAVE_REQUESTS.filter((r) => r.status === 'approved').length);
    expect(JSON.stringify(recap)).not.toContain('Rawat inap');
  });
  it('token per mata kuliah membatasi cakupan', () => {
    const recap = buildLecturerRecap('demo-dosen-hendra-2026', INITIAL_LECTURER_TOKENS, INITIAL_LEAVE_REQUESTS, INITIAL_COURSES);
    if (recap.status !== 'ok') throw new Error('expected ok');
    expect(recap.courses).toHaveLength(1);
    expect(recap.leaves.every((l) => l.course_id === 'c1111111-1111-1111-1111-111111111111')).toBe(true);
  });
  it('token kedaluwarsa & tidak dikenal ditolak', () => {
    expect(buildLecturerRecap('nope', INITIAL_LECTURER_TOKENS, [], []).status).toBe('not_found');
    const later = new Date('2030-01-01T00:00:00Z');
    expect(buildLecturerRecap('demo-dosen-hendra-2026', INITIAL_LECTURER_TOKENS, [], [], later).status).toBe('expired');
  });
});
