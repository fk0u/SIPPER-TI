'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Profile, ProfileSummary, UserRole } from '@/types/database';
import { INITIAL_PROFILES } from '@/lib/mockData';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { nimToEmail } from '@/lib/supabase/config';
import * as repo from '@/lib/data/supabaseRepository';
import { safeNextPath } from '@/lib/redirect';
import { errorMessage } from '@/lib/errors';

type Result = { success: boolean; error?: string };

interface AuthState {
  user: Profile | null;
  /** Direktori kelas (kolom publik saja) untuk pilihan mahasiswa pada mode proxy. */
  profiles: ProfileSummary[];
  isAuthenticated: boolean;
  isLoading: boolean;
  /** `true` setelah sesi awal selesai dimuat (mode live) atau langsung (mode demo). */
  isReady: boolean;
  /** Akun login NIM yang masih memakai password default wajib mengganti password. */
  mustChangePassword: boolean;
  /** Masuk dengan NIM + password (bukan Google), sehingga bisa mengganti password. */
  usesPassword: boolean;
  error: string | null;
  /** Mode demo: hash SHA-256 password yang sudah diganti, per id profil. */
  demoPasswordHashes: Record<string, string>;

  // Actions
  /** Memuat sesi; `true` bila berhasil (termasuk tanpa sesi), `false` bila gagal. */
  initialize: () => Promise<boolean>;
  loginWithGoogle: (nextPath?: string) => Promise<Result>;
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

let authListenerAttached = false;
/** Nomor urut pemuatan sesi: hasil yang lebih lama dibuang agar tidak menimpa sesi terbaru. */
let sessionGeneration = 0;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profiles: isDemoMode() ? INITIAL_PROFILES : [],
      isAuthenticated: false,
      isLoading: false,
      isReady: isDemoMode(),
      mustChangePassword: false,
      usesPassword: false,
      error: null,
      demoPasswordHashes: {},

      initialize: async () => {
        if (isDemoMode()) {
          set({ isReady: true });
          return true;
        }

        const loadSession = async (): Promise<boolean> => {
          const generation = ++sessionGeneration;
          try {
            const { profile, provider } = await repo.fetchSession();
            const profiles = profile ? await repo.fetchProfiles() : [];
            if (generation !== sessionGeneration) return true; // sudah ada pemuatan yang lebih baru
            const usesPassword = provider === 'email';
            set({
              user: profile,
              profiles,
              isAuthenticated: Boolean(profile),
              usesPassword,
              mustChangePassword: Boolean(profile && usesPassword && !profile.is_password_changed),
              isReady: true,
              error: null,
            });
            return true;
          } catch (err) {
            if (generation !== sessionGeneration) return true;
            set({ user: null, isAuthenticated: false, isReady: true, error: errorMessage(err, 'Gagal memuat sesi.') });
            return false;
          }
        };

        const ok = await loadSession();

        if (!authListenerAttached) {
          authListenerAttached = true;
          createClient().auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
              void loadSession();
            }
          });
        }
        return ok;
      },

      loginWithGoogle: async (nextPath = '/') => {
        set({ isLoading: true, error: null });

        if (!isDemoMode()) {
          const supabase = createClient();
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(safeNextPath(nextPath))}`,
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
          INITIAL_PROFILES.find((p) => p.email === 'rian.pratama@umkt.ac.id') || INITIAL_PROFILES[0];
        set({
          user: defaultGoogleUser,
          isAuthenticated: true,
          isLoading: false,
          mustChangePassword: false,
          usesPassword: false,
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
          } catch {
            const errMsg = 'NIM atau kata sandi tidak cocok.';
            set({ isLoading: false, error: errMsg });
            return { success: false, error: errMsg };
          }
          const loaded = await get().initialize();
          if (!loaded || !get().isAuthenticated) {
            const errMsg = get().error || 'Login berhasil, tetapi profil akun tidak ditemukan. Hubungi KM / admin.';
            set({ isLoading: false, error: errMsg });
            return { success: false, error: errMsg };
          }
          set({ isLoading: false });
          return { success: true };
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        const found = INITIAL_PROFILES.find((p) => p.nim === cleanNIM);
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
          usesPassword: true,
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
        const found = INITIAL_PROFILES.find((p) => p.id === userId);
        if (found) {
          set({ user: found, isAuthenticated: true, mustChangePassword: false, usesPassword: true });
        }
      },

      switchRole: (role: UserRole) => {
        if (!isDemoMode()) return;
        const targetProfile = INITIAL_PROFILES.find((p) => p.role === role);
        if (targetProfile) {
          set({ user: targetProfile, isAuthenticated: true, mustChangePassword: false, usesPassword: true });
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
          usesPassword: false,
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
              usesPassword: state.usesPassword,
              demoPasswordHashes: state.demoPasswordHashes,
            }
          : {},
      // Versi 1 selalu login otomatis sebagai Rian; mulai bersih.
      migrate: () => ({}),
    }
  )
);
