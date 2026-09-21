'use client';

import React from 'react';
import { useToastStore, ToastItem } from '@/store/useToastStore';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  const getIcon = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/30';
      case 'error':
        return 'border-rose-500/30';
      case 'warning':
        return 'border-amber-500/30';
      case 'info':
      default:
        return 'border-blue-500/30';
    }
  };

  return (
    <div className="fixed top-5 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`liquid-glass pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl animate-in slide-in-from-top-3 fade-in duration-200 ${getBorderColor(
            t.type
          )}`}
        >
          <div className="mt-0.5">{getIcon(t.type)}</div>
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
      ))}
    </div>
  );
};
