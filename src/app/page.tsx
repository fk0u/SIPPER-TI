'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { LeaveCard } from '@/components/leave/LeaveCard';
import { LeaveStatus } from '@/types/database';
import { ShinyText } from '@/components/reactbits/ShinyText';
import { CountUp } from '@/components/reactbits/CountUp';
import { SpotlightCard } from '@/components/reactbits/SpotlightCard';
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
  Calendar,
  X,
  Clock,
  CheckCircle2,
  FileText,
  UserCheck,
} from 'lucide-react';

export default function HomePage() {
  const { user, isAuthenticated } = useAuthStore();
  const { requests, courses, resetToInitial } = useLeaveStore();

  const [activeTab, setActiveTab] = useState<'all' | 'my' | LeaveStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[75dvh] flex flex-col items-center justify-center text-center p-4 sm:p-6 space-y-6">
        <SpotlightCard className="max-w-md w-full" spotlightColor="rgba(37, 99, 235, 0.16)">
          <div className="p-6 sm:p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-inner">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                <ShinyText text="SIPPER-TI Portal" />
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika Universitas Muhammadiyah Kalimantan Timur.
              </p>
            </div>
            <Link
              href="/login"
              className="group inline-flex items-center justify-center gap-3 w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              <span>Masuk ke Akun Kampus</span>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </SpotlightCard>
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
    <div className="space-y-6 sm:space-y-8">
      
      {/* ========================================================================= */}
      {/* 1. ASYMMETRICAL BENTO 2.0 (Double-Bezel Hardware Command Center)          */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        
        {/* Left Bento: Command Center Mahasiswa (col-span-8) */}
        <div className="lg:col-span-8 doppelrand-shell">
          <div className="doppelrand-core p-5 sm:p-7 flex flex-col justify-between h-full space-y-6">
            
            {/* Header Eyebrow & Semester Tag */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.16em] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                Semester Ganjil 2026/2027
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Teknik Informatika UMKT
              </span>
            </div>

            {/* Greeting & Headline */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                Halo, <ShinyText text={user.full_name} speed={5} />
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-[55ch] leading-relaxed">
                Portal perizinan resmi kelas internasional. Ajukan izin sakit berlampiran surat dokter, dispensasi lomba, atau validasi presensi rekan kelas.
              </p>
            </div>

            {/* Quick Actions (Nested Button-in-Button Architecture) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href="/leave/new"
                className="group inline-flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-95 w-full sm:w-auto"
              >
                <span>Ajukan Izin Baru</span>
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>

              {isSupervisor && (
                <Link
                  href="/approval"
                  className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-xs font-semibold transition active:scale-95 flex-1 sm:flex-initial"
                >
                  <CheckSquare className="w-4 h-4 shrink-0" />
                  <span>Review Izin ({pendingCount})</span>
                </Link>
              )}

              <Link
                href="/admin/tokens"
                className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-purple-700 dark:text-purple-400 border border-purple-500/25 text-xs font-semibold transition active:scale-95 flex-1 sm:flex-initial"
                title="Kelola Link Akses Dosen"
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Link Dosen</span>
              </Link>
            </div>

          </div>
        </div>

        {/* Right Bento: Live Presence Cockpit (col-span-4) */}
        <div className="lg:col-span-4">
          <SpotlightCard
            className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-4"
            spotlightColor="rgba(37, 99, 235, 0.16)"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/5 pb-3">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Metrik Presensi Kelas
              </span>
              <span className="text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="bg-slate-100/80 dark:bg-black/30 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono uppercase font-semibold">
                  Izin Menunggu
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  <CountUp to={pendingCount} duration={0.8} />
                </span>
                <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block">
                  Perlu review
                </span>
              </div>

              <div className="bg-slate-100/80 dark:bg-black/30 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono uppercase font-semibold">
                  Disetujui
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  <CountUp to={approvedCount} duration={0.8} />
                </span>
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block">
                  Terverifikasi
                </span>
              </div>
            </div>

            {/* Schedule Highlight */}
            <div className="bg-slate-100/80 dark:bg-black/30 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono font-semibold">
                <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Jadwal Kuliah Hari Ini:</span>
              </div>
              <span className="text-slate-900 dark:text-white font-semibold block truncate">
                {courses[0]?.code} — {courses[0]?.name}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                {courses[0]?.lecturer_name}
              </span>
            </div>
          </SpotlightCard>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 2. FEED & FILTER SECTION                                                 */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        
        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          
          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'all', label: 'Semua Izin' },
              { id: 'my', label: `Izin Saya (${myRequestsCount})` },
              { id: 'pending', label: `Menunggu (${pendingCount})` },
              { id: 'approved', label: 'Disetujui' },
              { id: 'rejected', label: 'Ditolak' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap active:scale-95 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
                    : 'bg-white/80 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/90 dark:border-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box & Reset demo button */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIM, atau matkul..."
                className="w-full bg-white/90 dark:bg-white/[0.04] border border-slate-200/90 dark:border-white/5 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={resetToInitial}
              title="Reset data demo ke kondisi awal"
              className="p-2 bg-white/90 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200/90 dark:border-white/5 transition shrink-0 active:scale-95"
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
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Tidak Ada Catatan Perizinan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Belum ada data pengajuan perizinan yang sesuai dengan filter atau kata kunci pencarian Anda.
              </p>
              <Link
                href="/leave/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition mt-2 active:scale-95"
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
