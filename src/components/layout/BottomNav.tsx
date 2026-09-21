'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { Home, PlusCircle, CheckSquare, KeyRound } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const { requests } = useLeaveStore();

  if (!isAuthenticated || !user) return null;

  // Don't show bottom nav on guest lecturer view
  if (pathname.startsWith('/lecturer/')) return null;

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const isSupervisor = user.role === 'km' || user.role === 'sipen';

  const navItems = [
    {
      label: 'Beranda',
      href: '/',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      label: 'Ajukan Izin',
      href: '/leave/new',
      icon: PlusCircle,
      isActive: pathname === '/leave/new',
    },
    {
      label: 'Approval',
      href: '/approval',
      icon: CheckSquare,
      badge: isSupervisor && pendingCount > 0 ? pendingCount : null,
      isActive: pathname === '/approval',
    },
    {
      label: 'Link Dosen',
      href: '/admin/tokens',
      icon: KeyRound,
      isActive: pathname === '/admin/tokens',
    },
  ];

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto block md:hidden pointer-events-none">
      <nav className="liquid-glass rounded-2xl px-2 py-1.5 shadow-2xl border border-slate-200/90 dark:border-white/15 pointer-events-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200 active:scale-90 ${
                item.isActive
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    item.isActive ? 'scale-110 text-blue-600 dark:text-blue-400' : ''
                  }`}
                />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-mono text-[9px] font-bold rounded-full shadow-sm animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
              {item.isActive && (
                <span className="w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full mt-0.5" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
