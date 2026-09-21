'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { LeaveCard } from '@/components/leave/LeaveCard';
import { LeaveStatus } from '@/types/database';
import {
  Plus,
  CheckSquare,
  Search,
  KeyRound,
  GraduationCap,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Layers,
} from 'lucide-react';

export default function HomePage() {
  const { user, isAuthenticated } = useAuthStore();
  const { requests, courses, resetToInitial } = useLeaveStore();

  const [activeTab, setActiveTab] = useState<'all' | 'my' | LeaveStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[75dvh] flex flex-col items-center justify-center text-center p-6 space-y-6">
        <div className="doppelrand-shell max-w-md w-full">
          <div className="doppelrand-core p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/15 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-inner">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">SIPPER-TI Portal</h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika Universitas Muhammadiyah Kalimantan Timur.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
              <span>Masuk ke Akun Kampus</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (activeTab === 'my') {
      if (req.student_id !== user.id && req.created_by !== user.id) return false;
    } else if (activeTab !== 'all') {
      if (req.status !== activeTab) return false;
    }

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
    <div className="space-y-8">
      
      {/* ========================================================================= */}
      {/* 1. HERO BENTO SECTION (Asymmetrical Bento with Double-Bezel Hardware Look) */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Hero Main Card (col-span-8) */}
        <div className="lg:col-span-8 doppelrand-shell">
          <div className="doppelrand-core p-6 sm:p-8 flex flex-col justify-between h-full space-y-6">
            
            {/* Top Tag without pill */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.18em] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                <span className="w-1.5 h-1.5 rounded-sm bg-blue-600 dark:bg-blue-400 animate-pulse" />
                Semester 2026/2027 Ganjil
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Teknik Informatika Intl
              </span>
            </div>

            {/* Headline and Identity */}
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Halo, {user.full_name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-[55ch] leading-relaxed">
                Portal perizinan resmi kelas internasional. Ajukan izin sakit berlampiran surat dokter, dispensasi lomba, atau verifikasi kehadiran rekan sekelas.
              </p>
            </div>

            {/* Action Buttons (Non-pill rounded-xl) */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/leave/new"
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
              >
                <span>Ajukan Izin Baru</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              {isSupervisor && (
                <Link
                  href="/approval"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition active:scale-[0.98]"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Review Izin ({pendingCount})</span>
                </Link>
              )}

              <Link
                href="/admin/tokens"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-purple-700 dark:text-purple-400 border border-purple-500/30 text-xs font-semibold transition active:scale-[0.98]"
                title="Kelola Token Dosen"
              >
                <KeyRound className="w-4 h-4" />
                <span className="hidden sm:inline">Link Dosen</span>
              </Link>
            </div>

          </div>
        </div>

        {/* Right Hero Metric Card (col-span-4) */}
        <div className="lg:col-span-4 doppelrand-shell">
          <div className="doppelrand-core p-6 flex flex-col justify-between h-full space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
              <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Metrik Presensi Kelas
              </span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md font-medium">
                Live Sinkron
              </span>
            </div>

            {/* Quick Counters (Non-pill rounded-xl) */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="bg-slate-100 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono uppercase">Izin Pending</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{pendingCount}</span>
                <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 block">Menunggu validasi</span>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono uppercase">Izin Disetujui</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{approvedCount}</span>
                <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 block">Terverifikasi</span>
              </div>
            </div>

            {/* Schedule Highlight */}
            <div className="bg-slate-100 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-white/5 text-xs space-y-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block">Jadwal Kuliah Hari Ini:</span>
              <span className="text-slate-900 dark:text-white font-semibold block">{courses[0]?.code} - {courses[0]?.name}</span>
              <span className="text-slate-600 dark:text-slate-400 text-[11px] block">{courses[0]?.lecturer_name}</span>
            </div>

          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 2. RECENT LEAVE FEED & FILTER BAR */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        
        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          
          {/* Filter Tabs (Non-pill rounded-lg) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'all', label: 'Semua Izin' },
              { id: 'my', label: `Izin Saya (${myRequestsCount})` },
              { id: 'pending', label: 'Menunggu Review' },
              { id: 'approved', label: 'Disetujui' },
              { id: 'rejected', label: 'Ditolak' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap active:scale-[0.98] ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
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
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <button
              onClick={resetToInitial}
              title="Reset data demo ke awal"
              className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 transition shrink-0 active:scale-[0.95]"
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
          <div className="doppelrand-shell">
            <div className="doppelrand-core text-center py-16 px-4 space-y-3">
              <Sparkles className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tidak Ada Catatan Perizinan</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Belum ada data pengajuan perizinan yang sesuai dengan filter atau kata kunci pencarian Anda.
              </p>
              <Link
                href="/leave/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition mt-2 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> Ajukan Izin Sekarang
              </Link>
            </div>
          </div>
        )}

      </section>

    </div>
  );
}
