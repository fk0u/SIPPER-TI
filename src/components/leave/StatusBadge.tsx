import React from 'react';
import { LeaveStatus } from '@/types/database';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';

const STATUS_META: Record<LeaveStatus, { label: string; Icon: typeof Clock; badge: string; dot: string }> = {
  pending: {
    label: 'Menunggu',
    Icon: Clock,
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    dot: 'bg-amber-500 animate-pulse',
  },
  approved: {
    label: 'Disetujui',
    Icon: CheckCircle2,
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Ditolak',
    Icon: XCircle,
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    dot: 'bg-rose-500',
  },
};

export const StatusBadge: React.FC<{ status: LeaveStatus }> = ({ status }) => {
  const meta = STATUS_META[status];
  if (!meta) return null;
  const { label, Icon, badge, dot } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-lg uppercase tracking-wider border px-2.5 py-1 text-[10px] ${badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};
