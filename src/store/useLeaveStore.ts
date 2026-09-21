'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Course,
  LeaveAttachment,
  LeaveRequestWithRelations,
  LeaveStatus,
  LeaveType,
  LecturerToken,
  Profile,
} from '@/types/database';
import { INITIAL_COURSES, INITIAL_LEAVE_REQUESTS, INITIAL_LECTURER_TOKENS } from '@/lib/mockData';
import { useAuthStore } from './useAuthStore';

interface SubmitLeavePayload {
  student_id: string;
  course_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  file_urls: LeaveAttachment[];
  created_by: string;
}

interface LeaveState {
  requests: LeaveRequestWithRelations[];
  courses: Course[];
  lecturerTokens: LecturerToken[];
  statusFilter: 'all' | LeaveStatus;
  selectedCourseFilter: string; // 'all' or course_id
  searchQuery: string;

  // Actions
  setStatusFilter: (status: 'all' | LeaveStatus) => void;
  setSelectedCourseFilter: (courseId: string) => void;
  setSearchQuery: (query: string) => void;
  
  submitLeave: (payload: SubmitLeavePayload) => Promise<{ success: boolean; error?: string; data?: LeaveRequestWithRelations }>;
  approveLeave: (requestId: string, verifier: Profile) => Promise<{ success: boolean; error?: string }>;
  rejectLeave: (requestId: string, reason: string, verifier: Profile) => Promise<{ success: boolean; error?: string }>;
  batchApproveLeaves: (requestIds: string[], verifier: Profile) => Promise<{ success: boolean; count: number }>;
  batchRejectLeaves: (requestIds: string[], reason: string, verifier: Profile) => Promise<{ success: boolean; count: number }>;
  
  generateLecturerToken: (courseId: string | null, label: string, creatorId: string) => LecturerToken;
  deleteLecturerToken: (tokenId: string) => void;
  resetToInitial: () => void;
}

export const useLeaveStore = create<LeaveState>()(
  persist(
    (set, get) => ({
      requests: INITIAL_LEAVE_REQUESTS,
      courses: INITIAL_COURSES,
      lecturerTokens: INITIAL_LECTURER_TOKENS,
      statusFilter: 'all',
      selectedCourseFilter: 'all',
      searchQuery: '',

      setStatusFilter: (status) => set({ statusFilter: status }),
      setSelectedCourseFilter: (courseId) => set({ selectedCourseFilter: courseId }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      submitLeave: async (payload) => {
        // Validation: end_date must be >= start_date
        if (new Date(payload.end_date) < new Date(payload.start_date)) {
          return { success: false, error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai perizinan.' };
        }

        const profiles = useAuthStore.getState().profiles;
        const student = profiles.find((p) => p.id === payload.student_id);
        const creator = profiles.find((p) => p.id === payload.created_by);
        const course = get().courses.find((c) => c.id === payload.course_id);

        if (!student || !creator || !course) {
          return { success: false, error: 'Data referensi mahasiswa atau mata kuliah tidak valid.' };
        }

        const newId = `leave-${Date.now()}`;
        const newRecord: LeaveRequestWithRelations = {
          id: newId,
          student_id: payload.student_id,
          course_id: payload.course_id,
          leave_type: payload.leave_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          reason: payload.reason,
          file_urls: payload.file_urls,
          status: 'pending',
          rejection_reason: null,
          created_by: payload.created_by,
          verified_by: null,
          verified_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          student,
          creator,
          course,
          verifier: null,
        };

        set((state) => ({
          requests: [newRecord, ...state.requests],
        }));

        return { success: true, data: newRecord };
      },

      approveLeave: async (requestId, verifier) => {
        set((state) => ({
          requests: state.requests.map((req) => {
            if (req.id === requestId) {
              return {
                ...req,
                status: 'approved',
                rejection_reason: null,
                verified_by: verifier.id,
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                verifier,
              };
            }
            return req;
          }),
        }));
        return { success: true };
      },

      rejectLeave: async (requestId, reason, verifier) => {
        if (!reason.trim()) {
          return { success: false, error: 'Alasan penolakan wajib diisi untuk transparansi mahasiswa.' };
        }

        set((state) => ({
          requests: state.requests.map((req) => {
            if (req.id === requestId) {
              return {
                ...req,
                status: 'rejected',
                rejection_reason: reason.trim(),
                verified_by: verifier.id,
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                verifier,
              };
            }
            return req;
          }),
        }));
        return { success: true };
      },

      batchApproveLeaves: async (requestIds, verifier) => {
        const idSet = new Set(requestIds);
        const now = new Date().toISOString();
        let count = 0;
        set((state) => ({
          requests: state.requests.map((req) => {
            if (idSet.has(req.id) && req.status === 'pending') {
              count++;
              return {
                ...req,
                status: 'approved',
                rejection_reason: null,
                verified_by: verifier.id,
                verified_at: now,
                updated_at: now,
                verifier,
              };
            }
            return req;
          }),
        }));
        return { success: true, count };
      },

      batchRejectLeaves: async (requestIds, reason, verifier) => {
        const idSet = new Set(requestIds);
        const now = new Date().toISOString();
        const trimmedReason = reason.trim() || 'Ditolak secara massal oleh verifikator.';
        let count = 0;
        set((state) => ({
          requests: state.requests.map((req) => {
            if (idSet.has(req.id) && req.status === 'pending') {
              count++;
              return {
                ...req,
                status: 'rejected',
                rejection_reason: trimmedReason,
                verified_by: verifier.id,
                verified_at: now,
                updated_at: now,
                verifier,
              };
            }
            return req;
          }),
        }));
        return { success: true, count };
      },

      generateLecturerToken: (courseId, label, creatorId) => {
        const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        const course = courseId ? get().courses.find((c) => c.id === courseId) || null : null;
        
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 180);

        const newToken: LecturerToken = {
          id: `token-${Date.now()}`,
          token: `guest-${randomHex}`,
          course_id: courseId,
          label: label.trim() || 'Link Akses Rekap Dosen',
          expires_at: expiry.toISOString(),
          created_by: creatorId,
          created_at: new Date().toISOString(),
          course,
        };

        set((state) => ({
          lecturerTokens: [newToken, ...state.lecturerTokens],
        }));

        return newToken;
      },

      deleteLecturerToken: (tokenId) => {
        set((state) => ({
          lecturerTokens: state.lecturerTokens.filter((t) => t.id !== tokenId),
        }));
      },

      resetToInitial: () => {
        set({
          requests: INITIAL_LEAVE_REQUESTS,
          courses: INITIAL_COURSES,
          lecturerTokens: INITIAL_LECTURER_TOKENS,
        });
      },
    }),
    {
      name: 'sipper-ti-leave-store',
      partialize: (state) => ({
        requests: state.requests,
        lecturerTokens: state.lecturerTokens,
      }),
    }
  )
);
