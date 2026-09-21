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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800/80 px-4 py-2 shadow-lg transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition active:scale-[0.95] ${
                item.isActive
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.isActive ? 'scale-110 text-blue-600 dark:text-blue-400' : ''} transition`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-mono text-[9px] font-bold rounded-md animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
              {item.isActive && (
                <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-sm" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
