'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, KeyRound, LayoutGrid } from 'lucide-react';
import { RequireRole } from '@/components/auth/RequireRole';
import { useAuthStore } from '@/store/useAuthStore';
import { navItemsFor } from '@/lib/nav';
import { useNavBadges } from '@/components/layout/useNavBadges';
import { Badge, Card, PageHeader } from '@/components/ui/kit';

function ManageHub() {
  const { user, klass, usesPassword } = useAuthStore();
  const badges = useNavBadges();
  const items = navItemsFor(user).filter((i) => i.manage);

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-16">
      <PageHeader icon={LayoutGrid} eyebrow={klass?.name ?? 'Kelas'} title="Kelola" />
      <Card className="!p-2">
        {[...items, ...(usesPassword ? [{ label: 'Ganti Kata Sandi', href: '/settings/password', icon: KeyRound }] : [])].map((item) => {
          const Icon = item.icon;
          const count = 'badge' in item && item.badge ? badges[item.badge] : 0;
          return (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.05] transition">
              <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="flex-1 text-sm text-slate-900 dark:text-white">{item.label}</span>
              {count > 0 && <Badge tone="amber">{count}</Badge>}
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          );
        })}
      </Card>
    </div>
  );
}

export default function ManagePage() {
  return (
    <div className="py-4 sm:py-6">
      <RequireRole>
        <ManageHub />
      </RequireRole>
    </div>
  );
}
