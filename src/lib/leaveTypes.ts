import type { LeaveType } from '@/types/database';

// Selaras dengan enum `leave_type_enum` di database live.
export const LEAVE_TYPES: LeaveType[] = ['sakit', 'izin_biasa', 'keluar_kampus', 'acara_kampus'];

interface LeaveTypeMeta {
  label: string;
  short: string;
  emoji: string;
  /** Kelas warna badge (light & dark). */
  badge: string;
  /** Lampiran wajib (surat dokter / surat tugas). */
  requiresAttachment: boolean;
  attachmentHint: string;
}

export const LEAVE_TYPE_META: Record<LeaveType, LeaveTypeMeta> = {
  sakit: {
    label: 'Sakit',
    short: 'Sakit',
    emoji: '🏥',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    requiresAttachment: true,
    attachmentHint: 'Pengajuan sakit wajib melampirkan foto surat keterangan dokter / klinik.',
  },
  izin_biasa: {
    label: 'Izin Pribadi',
    short: 'Izin',
    emoji: '📄',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
    requiresAttachment: false,
    attachmentHint: '',
  },
  keluar_kampus: {
    label: 'Keluar Kampus',
    short: 'Keluar',
    emoji: '🚌',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    requiresAttachment: false,
    attachmentHint: '',
  },
  acara_kampus: {
    label: 'Acara / Tugas Kampus',
    short: 'Acara',
    emoji: '🏆',
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
    requiresAttachment: true,
    attachmentHint: 'Pengajuan acara / tugas kampus wajib melampirkan surat tugas atau dispensasi.',
  },
};
