'use client';

import React from 'react';
import { useToastStore, ToastItem } from '@/store/useToastStore';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const TOAST_META: Record<ToastItem['type'], { Icon: typeof Info; icon: string; border: string }> = {
  success: { Icon: CheckCircle2, icon: 'text-emerald-500', border: 'border-emerald-500/30' },
  error: { Icon: AlertCircle, icon: 'text-rose-500', border: 'border-rose-500/30' },
  warning: { Icon: AlertTriangle, icon: 'text-amber-500', border: 'border-amber-500/30' },
  info: { Icon: Info, icon: 'text-blue-500', border: 'border-blue-500/30' },
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const { Icon, icon, border } = TOAST_META[t.type];
        return (
        <div
          key={t.id}
          className={`liquid-glass pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl animate-in slide-in-from-top-3 fade-in duration-200 ${border}`}
        >
          <div className="mt-0.5"><Icon className={`w-4 h-4 shrink-0 ${icon}`} /></div>
          <p className="text-xs text-slate-800 dark:text-slate-100 font-medium flex-1 leading-relaxed">
            {t.message}
          </p>
          <button
            onClick={() => removeToast(t.id)}
            className="p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        );
      })}
    </div>
  );
};
