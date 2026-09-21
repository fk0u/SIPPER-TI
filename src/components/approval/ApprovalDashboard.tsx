'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { toast } from '@/store/useToastStore';
import { LeaveCard } from '@/components/leave/LeaveCard';
import { LeaveStatus } from '@/types/database';
import { CountUp } from '@/components/reactbits/CountUp';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  BookOpen,
  Inbox,
  ShieldCheck,
  Filter,
  X,
  CheckSquare,
  Square,
  AlertCircle,
  Check,
  Trash2,
} from 'lucide-react';

export const ApprovalDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { requests, courses, batchApproveLeaves, batchRejectLeaves } = useLeaveStore();

  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('pending');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const canManage = Boolean(user && (user.role === 'km' || user.role === 'sipen'));

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

  const pendingInView = filteredRequests.filter((r) => r.status === 'pending');
  const allPendingSelected =
    pendingInView.length > 0 && pendingInView.every((r) => selectedIds.includes(r.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pendingInView.some((r) => r.id === id)));
    } else {
      const newIds = new Set([...selectedIds, ...pendingInView.map((r) => r.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleBulkApprove = async () => {
    if (!user || selectedIds.length === 0) return;
    setIsProcessingBulk(true);
    const countToApprove = selectedIds.length;
    const res = await batchApproveLeaves(selectedIds, user);
    setIsProcessingBulk(false);
    setSelectedIds([]);
    if (res.success) {
      toast.success(`${res.count} pengajuan izin berhasil disetujui sekaligus!`);
    } else {
      toast.error('Gagal memproses persetujuan massal.');
    }
  };

  const handleBulkReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || selectedIds.length === 0 || !bulkRejectReason.trim()) return;
    setIsProcessingBulk(true);
    const res = await batchRejectLeaves(selectedIds, bulkRejectReason, user);
    setIsProcessingBulk(false);
    setIsBulkRejectModalOpen(false);
    setBulkRejectReason('');
    setSelectedIds([]);
    if (res.success) {
      toast.info(`${res.count} pengajuan izin berhasil ditolak.`);
    } else {
      toast.error('Gagal memproses penolakan massal.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header Bento Banner */}
      <div className="doppelrand-shell">
        <div className="doppelrand-core p-5 sm:p-7 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 font-semibold">
                Verifikasi Presensi & Surat
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400 shrink-0" />
              Terminal Approval Perizinan
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              Tinjau surat sakit, dispensasi tugas lomba, dan validasi absensi kelas TI Internasional secara instan.
            </p>
          </div>

          <span className="px-3 py-1 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25 shrink-0">
            Akses: {user?.role.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Stats Bento Grid with Responsive Breakpoints */}
      <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all active:scale-95 ${
            statusFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-500/40 shadow-sm ring-1 ring-amber-500/25'
              : 'bg-white/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Menunggu</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
            <CountUp to={pendingCount} duration={0.8} />
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1 block font-mono uppercase">
            Perlu Tindakan
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('approved')}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all active:scale-95 ${
            statusFilter === 'approved'
              ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/25'
              : 'bg-white/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Disetujui</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
            <CountUp to={approvedCount} duration={0.8} />
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 block font-mono uppercase">
            Tervalidasi
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all active:scale-95 ${
            statusFilter === 'rejected'
              ? 'bg-rose-500/10 border-rose-500/40 shadow-sm ring-1 ring-rose-500/25'
              : 'bg-white/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ditolak</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
            <CountUp to={rejectedCount} duration={0.8} />
          </div>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-1 block font-mono uppercase">
            Tidak Sah / Buram
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/90 dark:bg-[#0b0f19]/80 border border-slate-200/80 dark:border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row gap-3 shadow-sm backdrop-blur-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama mahasiswa, NIM, atau matkul..."
            className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl pl-10 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">Semua Mata Kuliah</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/5'
            }`}
          >
            Semua
          </button>
        </div>
      </div>

      {/* Select All Bar (Visible when supervisor and pending items exist) */}
      {canManage && pendingInView.length > 0 && (
        <div className="flex items-center justify-between px-2 py-1 text-xs">
          <button
            type="button"
            onClick={handleSelectAllPending}
            className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition active:scale-95"
          >
            {allPendingSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {allPendingSelected
                ? 'Batalkan Pilih Semua'
                : `Pilih Semua Menunggu (${pendingInView.length})`}
            </span>
          </button>

          {selectedIds.length > 0 && (
            <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
              {selectedIds.length} terpilih
            </span>
          )}
        </div>
      )}

      {/* List of Requests */}
      {filteredRequests.length > 0 ? (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <LeaveCard
              key={req.id}
              request={req}
              selectable={canManage && req.status === 'pending'}
              isSelected={selectedIds.includes(req.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="doppelrand-shell">
          <div className="doppelrand-core text-center py-16 px-4 space-y-3">
            <Inbox className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Tidak Ada Pengajuan yang Perlu Diproses
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {statusFilter === 'pending'
                ? 'Seluruh perizinan yang masuk telah selesai diverifikasi. Tidak ada antrean pending!'
                : 'Tidak ditemukan data perizinan dengan kriteria filter yang dipilih.'}
            </p>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 pointer-events-none animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="liquid-glass rounded-2xl shadow-2xl p-3 sm:p-4 border border-blue-500/30 flex items-center justify-between gap-3 pointer-events-auto backdrop-blur-xl bg-slate-900/90 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                {selectedIds.length}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">
                  {selectedIds.length} Perizinan Dipilih
                </p>
                <p className="text-[10px] text-slate-300 font-mono hidden sm:block">
                  Tindakan massal verifikator
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setIsBulkRejectModalOpen(true)}
                disabled={isProcessingBulk}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Tolak</span>
              </button>
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={isProcessingBulk}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50 transition disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Setujui ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Rejection Modal */}
      {isBulkRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="doppelrand-shell max-w-md w-full">
            <div className="doppelrand-core p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    Tolak Massal ({selectedIds.length} Pengajuan)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Alasan ini akan dicantumkan pada seluruh pengajuan terpilih:
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-medium">
                  Preset Cepat:
                </span>
                <div className="space-y-1">
                  {[
                    'Foto surat dokter tidak terbaca atau buram, mohon unggah ulang.',
                    'Rentang tanggal izin tidak sesuai dengan jadwal sesi perkuliahan.',
                    'Surat dispensasi belum bertanda tangan / berkop resmi.',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBulkRejectReason(preset)}
                      className="w-full text-left text-[11px] p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 transition active:scale-98"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleBulkReject} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Alasan Penolakan:
                  </label>
                  <textarea
                    value={bulkRejectReason}
                    onChange={(e) => setBulkRejectReason(e.target.value)}
                    placeholder="Ketikkan alasan penolakan massal..."
                    required
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsBulkRejectModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingBulk || !bulkRejectReason.trim()}
                    className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition disabled:opacity-50 active:scale-95 shadow-md shadow-rose-900/20"
                  >
                    {isProcessingBulk ? 'Memproses...' : `Tolak ${selectedIds.length} Izin`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ApprovalDashboard;
