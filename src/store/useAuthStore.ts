'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Profile, UserRole } from '@/types/database';
import { INITIAL_PROFILES } from '@/lib/mockData';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { isNimAccountEmail, nimToEmail } from '@/lib/supabase/config';
import * as repo from '@/lib/data/supabaseRepository';

type Result = { success: boolean; error?: string };

interface AuthState {
  user: Profile | null;
  profiles: Profile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  /** `true` setelah sesi awal selesai dimuat (mode live) atau langsung (mode demo). */
  isReady: boolean;
  /** Akun login NIM yang masih memakai password default wajib mengganti password. */
  mustChangePassword: boolean;
  error: string | null;
  /** Mode demo: hash SHA-256 password yang sudah diganti, per id profil. */
  demoPasswordHashes: Record<string, string>;

  // Actions
  initialize: () => Promise<void>;
  loginWithGoogle: () => Promise<Result>;
  loginWithNIM: (nim: string, password: string) => Promise<Result>;
  changePassword: (newPassword: string) => Promise<Result>;
  /** Hanya tersedia pada mode demo. */
  switchUser: (userId: string) => void;
  /** Hanya tersedia pada mode demo: berpindah ke profil demo pertama dengan peran tsb. */
  switchRole: (role: UserRole) => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const isDemoMode = () => !isSupabaseConfigured();

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

let authListenerAttached = false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profiles: isDemoMode() ? INITIAL_PROFILES : [],
      isAuthenticated: false,
      isLoading: false,
      isReady: isDemoMode(),
      mustChangePassword: false,
      error: null,
      demoPasswordHashes: {},

      initialize: async () => {
        if (isDemoMode()) {
          set({ isReady: true });
          return;
        }

        const loadSession = async () => {
          try {
            const profile = await repo.fetchSessionProfile();
            const profiles = profile ? await repo.fetchProfiles() : [];
            set({
              user: profile,
              profiles,
              isAuthenticated: Boolean(profile),
              mustChangePassword: Boolean(
                profile && isNimAccountEmail(profile.email) && !profile.is_password_changed
              ),
              isReady: true,
            });
          } catch (err) {
            set({ user: null, isAuthenticated: false, isReady: true, error: errorMessage(err, 'Gagal memuat sesi.') });
          }
        };

        await loadSession();

        if (!authListenerAttached) {
          authListenerAttached = true;
          createClient().auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
              void loadSession();
            }
          });
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });

        if (!isDemoMode()) {
          const supabase = createClient();
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${window.location.origin}/api/auth/callback`,
              queryParams: {
                hd: 'umkt.ac.id', // Petunjuk UI Google; validasi domain sebenarnya di callback & trigger DB
              },
            },
          });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        // Mode demo: simulasi SSO kampus
        await new Promise((resolve) => setTimeout(resolve, 600));
        const defaultGoogleUser =
          get().profiles.find((p) => p.email === 'rian.pratama@umkt.ac.id') || INITIAL_PROFILES[0];
        set({
          user: defaultGoogleUser,
          isAuthenticated: true,
          isLoading: false,
          mustChangePassword: false,
          error: null,
        });
        return { success: true };
      },

      loginWithNIM: async (nim: string, password: string) => {
        set({ isLoading: true, error: null });
        const cleanNIM = nim.trim();

        if (!isDemoMode()) {
          try {
            await repo.signInWithNim(nimToEmail(cleanNIM), password);
            await get().initialize();
            set({ isLoading: false });
            return { success: true };
          } catch {
            const errMsg = 'NIM atau kata sandi tidak cocok.';
            set({ isLoading: false, error: errMsg });
            return { success: false, error: errMsg };
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        const found = get().profiles.find((p) => p.nim === cleanNIM);
        const storedHash = found ? get().demoPasswordHashes[found.id] : undefined;
        const passwordOk = found
          ? storedHash
            ? storedHash === (await sha256(password))
            : password === cleanNIM
          : false;

        if (!found || !passwordOk) {
          const errMsg = 'NIM atau kata sandi tidak cocok. (Akun baru: gunakan NIM sebagai password default.)';
          set({ isLoading: false, error: errMsg });
          return { success: false, error: errMsg };
        }

        set({
          user: found,
          isAuthenticated: true,
          isLoading: false,
          mustChangePassword: !storedHash && !found.is_password_changed,
          error: null,
        });
        return { success: true };
      },

      changePassword: async (newPassword: string) => {
        const user = get().user;
        if (!user) return { success: false, error: 'Sesi berakhir, silakan masuk kembali.' };
        if (newPassword.length < 8) {
          return { success: false, error: 'Kata sandi minimal 8 karakter.' };
        }
        if (newPassword === user.nim) {
          return { success: false, error: 'Kata sandi baru tidak boleh sama dengan NIM.' };
        }

        try {
          if (isDemoMode()) {
            const hash = await sha256(newPassword);
            set((state) => ({ demoPasswordHashes: { ...state.demoPasswordHashes, [user.id]: hash } }));
          } else {
            await repo.changePassword(newPassword);
          }
          const updated = { ...user, is_password_changed: true };
          set((state) => ({
            user: updated,
            profiles: state.profiles.map((p) => (p.id === user.id ? updated : p)),
            mustChangePassword: false,
          }));
          return { success: true };
        } catch (err) {
          return { success: false, error: errorMessage(err, 'Gagal memperbarui kata sandi.') };
        }
      },

      switchUser: (userId: string) => {
        if (!isDemoMode()) return;
        const found = get().profiles.find((p) => p.id === userId);
        if (found) {
          set({ user: found, isAuthenticated: true, mustChangePassword: false });
        }
      },

      switchRole: (role: UserRole) => {
        if (!isDemoMode()) return;
        const targetProfile = get().profiles.find((p) => p.role === role);
        if (targetProfile) {
          set({ user: targetProfile, isAuthenticated: true, mustChangePassword: false });
        }
      },

      logout: async () => {
        if (!isDemoMode()) {
          try {
            await repo.signOut();
          } catch {
            // Tetap bersihkan state lokal walaupun jaringan gagal
          }
        }
        set({
          user: null,
          isAuthenticated: false,
          mustChangePassword: false,
          error: null,
          profiles: isDemoMode() ? INITIAL_PROFILES : [],
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'sipper-ti-auth-store',
      version: 2,
      // Mode live: sesi berasal dari cookie Supabase, bukan localStorage.
      partialize: (state) =>
        isDemoMode()
          ? {
              user: state.user,
              isAuthenticated: state.isAuthenticated,
              mustChangePassword: state.mustChangePassword,
              demoPasswordHashes: state.demoPasswordHashes,
            }
          : {},
      // Versi 1 selalu login otomatis sebagai Rian; mulai bersih.
      migrate: () => ({}),
    }
  )
);
