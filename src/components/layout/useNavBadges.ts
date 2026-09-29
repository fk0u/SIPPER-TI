'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { canVerifyRequest } from '@/lib/permissions';

/** Angka badge menu: izin yang bisa diverifikasi & pendaftar kelas yang menunggu ACC. */
export function useNavBadges() {
  const { user, profiles } = useAuthStore();
  const { requests, courseSipen } = useLeaveStore();
  return {
    pendingLeaves: requests.filter((r) => canVerifyRequest(user, r, courseSipen)).length,
    pendingMembers: profiles.filter((p) => p.status === 'pending').length,
  };
}
