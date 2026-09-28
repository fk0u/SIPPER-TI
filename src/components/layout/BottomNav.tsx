'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useHydrated } from '@/lib/useHydrated';
import { KELOLA_ITEM, navItemsFor } from '@/lib/nav';
import { useNavBadges } from './useNavBadges';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const hydrated = useHydrated();
  const badges = useNavBadges();

  if (!hydrated || !isAuthenticated || !user || user.status !== 'active') return null;
  if (pathname.startsWith('/dosen/')) return null;

  const all = navItemsFor(user);
  const manage = all.filter((i) => i.manage);
  // Menu kelola dikumpulkan di /kelola agar dock tetap ≤ 5 ikon
  const items = [...all.filter((i) => !i.manage), ...(manage.length ? [KELOLA_ITEM] : [])];
  const manageBadge = manage.reduce((n, i) => n + (i.badge ? badges[i.badge] : 0), 0);

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto block lg:hidden pointer-events-none">
      <nav className="liquid-glass rounded-2xl px-2 py-1.5 shadow-2xl border border-slate-200/90 dark:border-white/15 pointer-events-auto flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href) || (item === KELOLA_ITEM && manage.some((m) => pathname.startsWith(m.href)));
          const badge = item === KELOLA_ITEM ? manageBadge : item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all duration-200 active:scale-90 ${
                active ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-mono text-[9px] font-bold rounded-full shadow-sm">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
              {active && <span className="w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full mt-0.5" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
