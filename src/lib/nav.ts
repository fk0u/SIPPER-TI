import { CalendarDays, CheckSquare, Crown, GraduationCap, Home, LayoutGrid, MessageSquareText, PlusCircle, Users } from 'lucide-react';
import type { Profile } from '@/types/database';
import { isSupervisor } from './permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
  /** Bagian menu kelola (di mobile dikumpulkan dalam halaman /kelola). */
  manage?: boolean;
  badge?: 'pendingLeaves' | 'pendingMembers';
}

/** Sumber tunggal menu: navbar desktop, bottom dock mobile & halaman /kelola. */
export function navItemsFor(user: Pick<Profile, 'role' | 'status' | 'is_admin' | 'id'> | null): NavItem[] {
  if (!user || user.status !== 'active') return [];
  const staff = isSupervisor(user);
  return [
    { label: 'Beranda', href: '/', icon: Home },
    { label: 'Ajukan Izin', href: '/leave/new', icon: PlusCircle },
    { label: 'Jadwal', href: '/jadwal', icon: CalendarDays },
    ...(staff
      ? [
          { label: 'Approval', href: '/approval', icon: CheckSquare, badge: 'pendingLeaves' as const },
          { label: 'Anggota', href: '/anggota', icon: Users, manage: true, badge: 'pendingMembers' as const },
          { label: 'Dosen', href: '/admin/dosen', icon: GraduationCap, manage: true },
          { label: 'WhatsApp', href: '/whatsapp', icon: MessageSquareText, manage: true },
        ]
      : []),
    ...(user.is_admin ? [{ label: 'Admin', href: '/superadmin', icon: Crown, manage: true }] : []),
  ];
}

export const KELOLA_ITEM: NavItem = { label: 'Kelola', href: '/kelola', icon: LayoutGrid };
