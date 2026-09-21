'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Profile, UserRole } from '@/types/database';
import { INITIAL_PROFILES } from '@/lib/mockData';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthState {
  user: Profile | null;
  profiles: Profile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithNIM: (nim: string, password: string) => Promise<{ success: boolean; error?: string }>;
  switchUser: (userId: string) => void;
  switchRole: (role: UserRole) => void;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Default to Rian Pratama (Mahasiswa) for instant out-of-the-box experience
      user: INITIAL_PROFILES[0],
      profiles: INITIAL_PROFILES,
      isAuthenticated: true,
      isLoading: false,
      error: null,

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });

        // If Supabase live is configured, run actual OAuth
        if (isSupabaseConfigured()) {
          const supabase = createClient();
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${window.location.origin}/api/auth/callback`,
              queryParams: {
                hd: 'umkt.ac.id', // Google Workspace Hosted Domain restriction
              },
            },
          });

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        // Offline / Demo Mode: Simulate Google SSO (@umkt.ac.id domain check)
        await new Promise((resolve) => setTimeout(resolve, 600));
        const defaultGoogleUser = get().profiles.find((p) => p.email === 'rian.pratama@umkt.ac.id') || INITIAL_PROFILES[0];
        set({
          user: defaultGoogleUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return { success: true };
      },

      loginWithNIM: async (nim: string, password: string) => {
        set({ isLoading: true, error: null });
        await new Promise((resolve) => setTimeout(resolve, 500));

        const cleanNIM = nim.trim();
        const found = get().profiles.find((p) => p.nim === cleanNIM);

        if (!found) {
          const errMsg = 'NIM tidak terdaftar di pangkalan data Teknik Informatika UMKT.';
          set({ isLoading: false, error: errMsg });
          return { success: false, error: errMsg };
        }

        // Fallback default password is NIM itself, or custom password
        if (password !== cleanNIM && password !== 'password123') {
          const errMsg = 'Kata sandi tidak sesuai. (Untuk akun baru, gunakan NIM sebagai password default).';
          set({ isLoading: false, error: errMsg });
          return { success: false, error: errMsg };
        }

        set({
          user: found,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return { success: true };
      },

      switchUser: (userId: string) => {
        const found = get().profiles.find((p) => p.id === userId);
        if (found) {
          set({ user: found, isAuthenticated: true });
        }
      },

      switchRole: (role: UserRole) => {
        const currentUser = get().user;
        if (!currentUser) return;

        // Find existing profile with that role or update current user's role
        const targetProfile = get().profiles.find((p) => p.role === role);
        if (targetProfile) {
          set({ user: targetProfile, isAuthenticated: true });
        } else {
          set({
            user: { ...currentUser, role },
          });
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'sipper-ti-auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
