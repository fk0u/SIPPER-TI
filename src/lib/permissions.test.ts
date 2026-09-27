import { describe, expect, it } from 'vitest';
import {
  canManageTokens,
  canSubmitFor,
  canVerifyRequest,
  canViewRequest,
  getTokenState,
} from './permissions';
import { INITIAL_COURSE_SIPEN } from './mockData';

const CLOUD = 'c1111111-1111-1111-1111-111111111111';
const ML = 'c2222222-2222-2222-2222-222222222222';
const rian = { id: 'a0000000-0000-0000-0000-000000000001', role: 'mahasiswa' as const };
const sarah = { id: 'a0000000-0000-0000-0000-000000000002', role: 'sipen' as const }; // Cloud & SQA
const budi = { id: 'a0000000-0000-0000-0000-000000000003', role: 'km' as const };
const cs = INITIAL_COURSE_SIPEN;

const req = (over: Partial<{ student_id: string; created_by: string; course_id: string; status: 'pending' | 'approved' | 'rejected' }> = {}) => ({
  student_id: rian.id,
  created_by: rian.id,
  course_id: CLOUD,
  status: 'pending' as const,
  ...over,
});

describe('canViewRequest', () => {
  it('mahasiswa hanya melihat izinnya sendiri', () => {
    expect(canViewRequest(rian, req(), cs)).toBe(true);
    expect(canViewRequest(rian, req({ student_id: 'x', created_by: 'x' }), cs)).toBe(false);
  });
  it('sipen melihat mata kuliah yang dikelolanya saja', () => {
    expect(canViewRequest(sarah, req(), cs)).toBe(true);
    expect(canViewRequest(sarah, req({ course_id: ML }), cs)).toBe(false);
  });
  it('KM melihat semua', () => {
    expect(canViewRequest(budi, req({ course_id: ML }), cs)).toBe(true);
  });
  it('tanpa login tidak melihat apa pun', () => {
    expect(canViewRequest(null, req(), cs)).toBe(false);
  });
});

describe('canVerifyRequest', () => {
  it('mahasiswa tidak bisa memverifikasi', () => {
    expect(canVerifyRequest(rian, req({ student_id: 'x' }), cs)).toBe(false);
  });
  it('sipen hanya pada mata kuliahnya', () => {
    expect(canVerifyRequest(sarah, req(), cs)).toBe(true);
    expect(canVerifyRequest(sarah, req({ course_id: ML }), cs)).toBe(false);
  });
  it('tidak boleh menyetujui izin sendiri', () => {
    expect(canVerifyRequest(sarah, req({ student_id: sarah.id }), cs)).toBe(false);
    expect(canVerifyRequest(budi, req({ student_id: budi.id }), cs)).toBe(false);
  });
  it('hanya status pending', () => {
    expect(canVerifyRequest(budi, req({ status: 'approved' }), cs)).toBe(false);
  });
});

describe('canSubmitFor', () => {
  it('pengajuan mandiri selalu boleh', () => {
    expect(canSubmitFor(rian, rian.id, ML, cs)).toBe(true);
  });
  it('proxy: mahasiswa tidak boleh, sipen sesuai mata kuliah, KM bebas', () => {
    expect(canSubmitFor(rian, 'x', CLOUD, cs)).toBe(false);
    expect(canSubmitFor(sarah, 'x', CLOUD, cs)).toBe(true);
    expect(canSubmitFor(sarah, 'x', ML, cs)).toBe(false);
    expect(canSubmitFor(budi, 'x', ML, cs)).toBe(true);
  });
});

describe('tokens', () => {
  it('hanya KM yang mengelola token', () => {
    expect(canManageTokens(budi)).toBe(true);
    expect(canManageTokens(sarah)).toBe(false);
    expect(canManageTokens(rian)).toBe(false);
  });
  it('status token', () => {
    const now = new Date('2026-09-27T00:00:00Z');
    expect(getTokenState({ expires_at: '2027-01-01T00:00:00Z', revoked_at: null }, now)).toBe('active');
    expect(getTokenState({ expires_at: '2026-01-01T00:00:00Z', revoked_at: null }, now)).toBe('expired');
    expect(getTokenState({ expires_at: null, revoked_at: '2026-09-01T00:00:00Z' }, now)).toBe('revoked');
  });
});
