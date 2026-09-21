import React from 'react';
import { LeaveStatus } from '@/types/database';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: LeaveStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  const iconSize = isSm ? 'w-3 h-3' : 'w-3.5 h-3.5';

  switch (status) {
    case 'pending':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-md uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40 ${sizeClasses}`}
        >
          <Clock className={`${iconSize} animate-spin`} style={{ animationDuration: '4s' }} />
          Menunggu Review
        </span>
      );
    case 'approved':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-md uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 ${sizeClasses}`}
        >
          <CheckCircle2 className={iconSize} />
          Disetujui
        </span>
      );
    case 'rejected':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-md uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40 ${sizeClasses}`}
        >
          <XCircle className={iconSize} />
          Ditolak
        </span>
      );
    default:
      return null;
  }
};
