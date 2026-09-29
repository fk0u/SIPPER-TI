// Potongan UI bersama untuk halaman kelola (gaya sama dengan komponen yang sudah ada).
import React from 'react';

export const inputCls =
  'w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-60';
export const labelCls = 'text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-900/20 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none';
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-slate-300/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none';
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="doppelrand-shell">
      <div className={`doppelrand-core p-5 sm:p-6 ${className}`}>{children}</div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center shadow-inner">
          <Icon className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 font-semibold">
            {eyebrow}
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {description && <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </Card>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-10 text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-300/80 dark:border-white/10 rounded-2xl">
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' }) {
  const tones = {
    slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25',
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-md border ${tones[tone]}`}>
      {children}
    </span>
  );
}

export const errorText = (err: unknown, fallback = 'Terjadi kesalahan.') =>
  err instanceof Error && err.message ? err.message : fallback;
