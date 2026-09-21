'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { LeaveCard } from '@/components/leave/LeaveCard';
import { LeaveStatus } from '@/types/database';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  Search,
  BookOpen,
  Inbox,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const ApprovalDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { requests, courses } = useLeaveStore();

  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('pending');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Counters
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (statusFilter !== 'all' && req.status !== statusFilter) return false;
    if (courseFilter !== 'all' && req.course_id !== courseFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = req.student.full_name.toLowerCase().includes(q);
      const matchNim = req.student.nim.toLowerCase().includes(q);
      const matchCourse = req.course.name.toLowerCase().includes(q);
      return matchName || matchNim || matchCourse;
    }

    return true;
  });

  const isSupervisor = user?.role === 'km' || user?.role === 'sipen';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header Bento Banner */}
      <div className="doppelrand-shell">
        <div className="doppelrand-core p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-semibold">
                Verifikasi & Presensi
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
              Dashboard Approval Perizinan
            </h1>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Tinjau surat sakit, dispensasi tugas lomba, dan validasi absensi kelas TI Internasional.
            </p>
          </div>

          <span className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
            Akses: {user?.role.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`p-4 sm:p-5 rounded-3xl border text-left transition-all active:scale-[0.98] ${
            statusFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/30'
              : 'bg-slate-900/60 border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Menunggu</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">{pendingCount}</div>
          <span className="text-[10px] text-amber-400 font-medium mt-1 block">Perlu Tindakan</span>
        </button>

        <button
          onClick={() => setStatusFilter('approved')}
          className={`p-4 sm:p-5 rounded-3xl border text-left transition-all active:scale-[0.98] ${
            statusFilter === 'approved'
              ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/30'
              : 'bg-slate-900/60 border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Disetujui</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">{approvedCount}</div>
          <span className="text-[10px] text-emerald-400 font-medium mt-1 block">Telah Diverifikasi</span>
        </button>

        <button
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 sm:p-5 rounded-3xl border text-left transition-all active:scale-[0.98] ${
            statusFilter === 'rejected'
              ? 'bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/30'
              : 'bg-slate-900/60 border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Ditolak</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">{rejectedCount}</div>
          <span className="text-[10px] text-rose-400 font-medium mt-1 block">Tidak Sah / Buram</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-white/5 p-4 rounded-3xl flex flex-col sm:flex-row gap-3 shadow-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama mahasiswa, NIM, atau matkul..."
            className="w-full bg-slate-950 border border-white/10 rounded-full pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Semua Mata Kuliah</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-full text-xs font-medium transition active:scale-[0.98] ${
            statusFilter === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
              : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
          }`}
        >
          Semua Status
        </button>
      </div>

      {/* List of Requests */}
      {filteredRequests.length > 0 ? (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <LeaveCard key={req.id} request={req} />
          ))}
        </div>
      ) : (
        <div className="doppelrand-shell">
          <div className="doppelrand-core text-center py-16 px-4 space-y-3">
            <Inbox className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">Tidak Ada Pengajuan yang Perlu Diproses</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {statusFilter === 'pending'
                ? 'Seluruh perizinan yang masuk telah berhasil diverifikasi. Tidak ada antrean pending!'
                : 'Tidak ditemukan data perizinan dengan kriteria filter yang dipilih.'}
            </p>
          </div>
        </div>
      )}

    </div>
  );
};
