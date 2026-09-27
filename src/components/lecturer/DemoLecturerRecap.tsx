'use client';

import { useLeaveStore } from '@/store/useLeaveStore';
import { useHydrated } from '@/lib/useHydrated';
import { buildLecturerRecap } from '@/lib/lecturerRecap';
import { PageLoader } from '@/components/auth/RequireRole';
import { GuestLecturerView } from './GuestLecturerView';

/** Mode demo: rekap dibangun dari data lokal browser. */
export function DemoLecturerRecap({ tokenString }: { tokenString: string }) {
  const hydrated = useHydrated();
  const { lecturerTokens, requests, courses } = useLeaveStore();

  if (!hydrated) return <PageLoader />;

  return (
    <GuestLecturerView
      recap={buildLecturerRecap(tokenString, lecturerTokens, requests, courses)}
      demo
    />
  );
}
