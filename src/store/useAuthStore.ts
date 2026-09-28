'use client';

import { create } from 'zustand';
import type { ClassInfo, Profile, ProfileSummary } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { nimToEmail } from '@/lib/supabase/config';
import * as repo from '@/lib/data/supabaseRepository';
import { safeNextPath } from '@/lib/redirect';

type Result = { success: boolean; error?: string };

interface AuthState {
  user: Profile | null;
  /** Kelas pengguna (juga saat masih pending) — nama, template pengingat, dsb. */
  klass: ClassInfo | null;
  /** Anggota sekelas (kolom publik), termasuk pendaftar pending. */
  profiles: ProfileSummary[];
  isAuthenticated: boolean;
  isLoading: boolean;
  /** `true` setelah sesi awal selesai dimuat. */
  isReady: boolean;
  /** Akun NIM yang masih memakai password default wajib mengganti password. */
  mustChangePassword: boolean;
  /** Masuk dengan NIM + password (bukan Google), sehingga bisa mengganti password. */
  usesPassword: boolean;
  /** Akun ber-2FA yang belum memasukkan kode: tanpa akses sampai verifikasi (aal2). */
  mfaPending: boolean;
  error: string | null;

  /** Memuat sesi; `true` bila berhasil (termasuk tanpa sesi), `false` bila gagal. */
  initialize: () => Promise<boolean>;
  /** Muat ulang profil, kelas & direktori (mis. setelah ACC anggota). */
  refresh: () => Promise<boolean>;
  loginWithGoogle: (nextPath?: string) => Promise<Result>;
  loginWithNIM: (nim: string, password: string) => Promise<Result & { mfaRequired?: boolean }>;
  verifyMfa: (code: string) => Promise<Result>;
  changePassword: (newPassword: string) => Promise<Result>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

let authListenerAttached = false;
/** Nomor urut pemuatan sesi: hasil yang lebih lama dibuang agar tidak menimpa sesi terbaru. */
let sessionGeneration = 0;

export const useAuthStore = create<AuthState>()((set, get) => {
  const loadSession = async (): Promise<boolean> => {
    const generation = ++sessionGeneration;
    try {
      const { profile, provider } = await repo.fetchSession();
      const mfaPending = profile ? await repo.mfaPending() : false;
      const [klass, profiles] = profile && !mfaPending
        ? await Promise.all([
            profile.class_id ? repo.fetchClass(profile.class_id) : Promise.resolve(null),
            profile.class_id && profile.status === 'active' ? repo.fetchProfiles(profile.class_id) : Promise.resolve([]),
          ])
        : [null, []];
      if (generation !== sessionGeneration) return true; // sudah ada pemuatan yang lebih baru
      const usesPassword = provider === 'email';
      set({
        user: profile,
        klass,
        profiles,
        isAuthenticated: Boolean(profile),
        mfaPending,
        usesPassword,
        mustChangePassword: Boolean(profile && usesPassword && !profile.is_password_changed),
        isReady: true,
        error: null,
      });
      return true;
    } catch (err) {
      if (generation !== sessionGeneration) return true;
      set({ user: null, klass: null, isAuthenticated: false, isReady: true, error: errorMessage(err, 'Gagal memuat sesi.') });
      return false;
    }
  };

  return {
    user: null,
    klass: null,
    profiles: [],
    isAuthenticated: false,
    isLoading: false,
    isReady: false,
    mustChangePassword: false,
    usesPassword: false,
    mfaPending: false,
    error: null,

    initialize: async () => {
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

    refresh: loadSession,

    loginWithGoogle: async (nextPath = '/') => {
      set({ isLoading: true, error: null });
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(safeNextPath(nextPath))}`,
          queryParams: { hd: 'umkt.ac.id' }, // Petunjuk UI Google; validasi domain di callback & trigger DB
        },
      });
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      return { success: true };
    },

    loginWithNIM: async (nim: string, password: string) => {
      set({ isLoading: true, error: null });
      try {
        await repo.signInWithNim(nimToEmail(nim.trim()), password);
      } catch {
        const errMsg = 'NIM atau kata sandi tidak cocok.';
        set({ isLoading: false, error: errMsg });
        return { success: false, error: errMsg };
      }
      const loaded = await loadSession();
      if (!loaded || !get().isAuthenticated) {
        const errMsg = get().error || 'Login berhasil, tetapi profil akun tidak ditemukan. Hubungi KM / admin.';
        set({ isLoading: false, error: errMsg });
        return { success: false, error: errMsg };
      }
      set({ isLoading: false });
      return { success: true, mfaRequired: get().mfaPending };
    },

    verifyMfa: async (code: string) => {
      try {
        await repo.verifyLoginTotp(code);
        await loadSession();
        return { success: true };
      } catch (err) {
        return { success: false, error: errorMessage(err, 'Verifikasi 2FA gagal.') };
      }
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
        await repo.changePassword(newPassword);
        set({ user: { ...user, is_password_changed: true }, mustChangePassword: false });
        return { success: true };
      } catch (err) {
        return { success: false, error: errorMessage(err, 'Gagal memperbarui kata sandi.') };
      }
    },

    logout: async () => {
      try {
        await repo.signOut();
      } catch {
        // Tetap bersihkan state lokal walaupun jaringan gagal
      }
      set({
        user: null,
        klass: null,
        profiles: [],
        isAuthenticated: false,
        mustChangePassword: false,
        usesPassword: false,
        mfaPending: false,
        error: null,
      });
    },

    clearError: () => set({ error: null }),
  };
});
