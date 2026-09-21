'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { LeaveCard } from '@/components/leave/LeaveCard';
import { LeaveStatus } from '@/types/database';
import {
  PlusCircle,
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Users,
  KeyRound,
  GraduationCap,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

export default function HomePage() {
  const { user, isAuthenticated } = useAuthStore();
  const { requests, courses, resetToInitial } = useLeaveStore();

  const [activeTab, setActiveTab] = useState<'all' | 'my' | LeaveStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="p-4 bg-blue-600/20 text-blue-400 rounded-3xl border border-blue-500/30">
          <GraduationCap className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-white">Selamat Datang di SIPPER-TI</h1>
        <p className="text-xs text-slate-400 max-w-md">
          Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika UMKT.
          Silakan masuk menggunakan Akun Kampus atau NIM untuk melanjutkan.
        </p>
        <Link
          href="/login"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition"
        >
          Masuk ke Akun
        </Link>
      </div>
    );
  }

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    // Tab filter
    if (activeTab === 'my') {
      if (req.student_id !== user.id && req.created_by !== user.id) return false;
    } else if (activeTab !== 'all') {
      if (req.status !== activeTab) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = req.student.full_name.toLowerCase().includes(q);
      const matchNim = req.student.nim.toLowerCase().includes(q);
      const matchCourse = req.course.name.toLowerCase().includes(q);
      const matchReason = req.reason.toLowerCase().includes(q);
      return matchName || matchNim || matchCourse || matchReason;
    }

    return true;
  });

  const myRequestsCount = requests.filter(
    (r) => r.student_id === user.id || r.created_by === user.id
  ).length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  const isSupervisor = user.role === 'km' || user.role === 'sipen';

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
              Semester 2026/2027-1
            </span>
            <span className="text-xs text-slate-400">Kelas Internasional TI</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Halo, {user.full_name}! 👋
          </h1>
          <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
            NIM: <strong className="text-slate-300 font-mono">{user.nim}</strong> • Status Akun:{' '}
            <strong className="text-blue-400 uppercase font-semibold">{user.role}</strong>.
            Gunakan portal ini untuk pengajuan surat sakit, dispensasi acara, atau verifikasi kehadiran kelas.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/leave/new"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Ajukan Izin Baru
          </Link>

          {isSupervisor && (
            <Link
              href="/approval"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-xl transition flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" /> Review Izin ({pendingCount})
            </Link>
          )}

          <Link
            href="/admin/tokens"
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-purple-400 border border-purple-500/30 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
            title="Kelola Link Dosen"
          >
            <KeyRound className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 block text-[11px] mb-1">Pengajuan Saya</span>
          <span className="text-2xl font-bold text-white font-mono">{myRequestsCount}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Diajukan/Diterima</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 block text-[11px] mb-1">Perlu Review</span>
          <span className="text-2xl font-bold text-amber-400 font-mono">{pendingCount}</span>
          <span className="text-[10px] text-amber-400/80 block mt-1">Izin belum ditinjau</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 block text-[11px] mb-1">Izin Disetujui</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono">{approvedCount}</span>
          <span className="text-[10px] text-emerald-400/80 block mt-1">Telah diverifikasi</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-slate-400 block text-[11px] mb-1">Mata Kuliah Aktif</span>
          <span className="text-2xl font-bold text-blue-400 font-mono">{courses.length}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Semester 2026/2027</span>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'all', label: 'Semua Izin' },
              { id: 'my', label: 'Pengajuan Saya' },
              { id: 'pending', label: 'Menunggu' },
              { id: 'approved', label: 'Disetujui' },
              { id: 'rejected', label: 'Ditolak' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap border ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/20'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box & reset data button */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIM, atau matkul..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <button
              onClick={resetToInitial}
              title="Reset data demo ke awal"
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Requests Feed */}
        {filteredRequests.length > 0 ? (
          <div className="space-y-4">
            {filteredRequests.map((req) => (
              <LeaveCard key={req.id} request={req} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4 bg-slate-900/40 rounded-3xl border border-slate-800/60 space-y-3">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">Tidak Ada Catatan Perizinan</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Belum ada data pengajuan perizinan yang sesuai dengan filter atau kata kunci pencarian Anda.
            </p>
            <Link
              href="/leave/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition mt-2"
            >
              <PlusCircle className="w-4 h-4" /> Ajukan Izin Sekarang
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
