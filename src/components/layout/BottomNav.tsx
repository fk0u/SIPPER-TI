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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800/80 px-4 py-2">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
                item.isActive
                  ? 'text-blue-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.isActive ? 'scale-110 text-blue-400' : ''} transition`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-mono text-[9px] font-bold rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
              {item.isActive && (
                <span className="w-1 h-1 bg-blue-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
