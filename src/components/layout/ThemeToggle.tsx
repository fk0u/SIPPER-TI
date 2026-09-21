'use client';

import React, { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    }
  }, [theme]);

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-300/40 dark:border-white/10 animate-pulse" />
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-slate-100/90 dark:bg-white/[0.06] hover:bg-slate-200/80 dark:hover:bg-white/[0.12] border border-slate-300/60 dark:border-white/10 text-slate-700 dark:text-slate-200 transition-all duration-300 active:scale-90 shadow-sm"
      aria-label={`Beralih ke mode ${isDark ? 'terang' : 'gelap'}`}
      title={`Mode ${isDark ? 'Gelap' : 'Terang'} (Klik untuk mengubah)`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        <Sun
          className={`w-4 h-4 text-amber-500 absolute transition-all duration-500 ${
            isDark
              ? 'rotate-90 scale-0 opacity-0'
              : 'rotate-0 scale-100 opacity-100'
          }`}
        />
        <Moon
          className={`w-4 h-4 text-blue-400 absolute transition-all duration-500 ${
            isDark
              ? 'rotate-0 scale-100 opacity-100'
              : '-rotate-90 scale-0 opacity-0'
          }`}
        />
      </div>
    </button>
  );
};
