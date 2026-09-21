'use client';

import React, { useState } from 'react';
import { LeaveRequestWithRelations } from '@/types/database';
import { StatusBadge } from './StatusBadge';
import { DocumentViewerModal } from './DocumentViewerModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { toast } from '@/store/useToastStore';
import {
  Calendar,
  BookOpen,
  User,
  Users,
  Paperclip,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';

interface LeaveCardProps {
  request: LeaveRequestWithRelations;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const LeaveCard: React.FC<LeaveCardProps> = ({
  request,
  selectable = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const { user } = useAuthStore();
  const { approveLeave, rejectLeave } = useLeaveStore();

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isProxy = request.created_by !== request.student_id;
  const canApprove =
    user &&
    request.status === 'pending' &&
    (user.role === 'km' || user.role === 'sipen');

  // Calculate day count
  const startDate = new Date(request.start_date);
  const endDate = new Date(request.end_date);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const handleApprove = async () => {
    if (!user) return;
    setIsProcessing(true);
    const res = await approveLeave(request.id, user);
    setIsProcessing(false);
    if (res.success) {
      toast.success(`Pengajuan izin ${request.student.full_name} berhasil disetujui!`);
    } else {
      toast.error(res.error || 'Gagal menyetujui pengajuan izin.');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectReason.trim()) return;
    setIsProcessing(true);
    const res = await rejectLeave(request.id, rejectReason, user);
    setIsProcessing(false);
    setIsRejectModalOpen(false);
    setRejectReason('');
    if (res.success) {
      toast.info(`Pengajuan izin ${request.student.full_name} telah ditolak.`);
    } else {
      toast.error(res.error || 'Gagal menolak pengajuan izin.');
    }
  };

  const formatDisplayDate = (dString: string) => {
    try {
      const d = new Date(dString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dString;
    }
  };

  const rejectionPresets = [
    'Foto surat dokter tidak terbaca atau buram, mohon unggah ulang.',
    'Rentang tanggal izin tidak sesuai dengan jadwal sesi perkuliahan.',
    'Surat dispensasi belum bertanda tangan / berkop resmi.',
  ];

  return (
    <>
      <div
        className={`doppelrand-shell group hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 ${
          isSelected ? 'ring-2 ring-blue-500/60 border-blue-500/50' : ''
        }`}
      >
        <div className="doppelrand-core p-4 sm:p-6 space-y-4">
          
          {/* Top Header: Student info & Status badge */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 dark:border-white/5 pb-3.5">
            <div className="flex items-center gap-3 min-w-0">
              {selectable && (
                <button
                  type="button"
                  onClick={() => onToggleSelect && onToggleSelect(request.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-black/40 border-slate-300 dark:border-white/20 hover:border-blue-500'
                  }`}
                  aria-label="Pilih perizinan ini"
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>
              )}

              <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center font-bold text-sm font-mono shadow-inner shrink-0">
                {request.student.full_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight truncate max-w-[200px] xs:max-w-xs sm:max-w-none">
                    {request.student.full_name}
                  </h4>
                  {isProxy && (
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25 px-1.5 py-0.5 rounded-md shrink-0"
                      title={`Diajukan atas nama mahasiswa oleh: ${request.creator.full_name}`}
                    >
                      <Users className="w-3 h-3" /> Proxy ({request.creator.role.toUpperCase()})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  NIM: {request.student.nim}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <StatusBadge status={request.status} />
            </div>
          </div>

          {/* Course & Schedule Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2.5 bg-slate-100/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-mono tracking-wider font-semibold">
                  Mata Kuliah
                </span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block truncate">
                  {request.course.code} — {request.course.name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px] mt-0.5 truncate">
                  Dosen: {request.course.lecturer_name}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-slate-100/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-mono tracking-wider font-semibold">
                  Rentang Perizinan
                </span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">
                  {formatDisplayDate(request.start_date)}
                  {request.start_date !== request.end_date && ` s/d ${formatDisplayDate(request.end_date)}`}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 block text-[11px] font-semibold font-mono mt-0.5">
                  Total: {diffDays} Hari Perkuliahan
                </span>
              </div>
            </div>
          </div>

          {/* Reason & Type */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md font-semibold text-[9px] uppercase tracking-wider font-mono ${
                  request.leave_type === 'sakit'
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25'
                    : request.leave_type === 'acara'
                    ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/25'
                    : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25'
                }`}
              >
                {request.leave_type}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-mono">
                Alasan / Keterangan:
              </span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 bg-slate-50/90 dark:bg-black/30 p-3 rounded-xl border border-slate-200/80 dark:border-white/5 leading-relaxed text-xs italic">
              &ldquo;{request.reason}&rdquo;
            </p>
          </div>

          {/* Rejection Notice */}
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200 dark:border-rose-900/30">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-rose-900 dark:text-rose-200 font-semibold mb-0.5">
                  Catatan Penolakan:
                </strong>
                <p className="text-rose-800 dark:text-rose-300/90">{request.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Verification info */}
          {request.status === 'approved' && request.verifier && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/20 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Disetujui oleh:{' '}
                <strong className="text-emerald-900 dark:text-emerald-300 font-medium">
                  {request.verifier.full_name} ({request.verifier.role.toUpperCase()})
                </strong>
              </span>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-white/5">
            {request.file_urls && request.file_urls.length > 0 ? (
              <button
                onClick={() => setIsViewerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 transition active:scale-95"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Lihat Bukti Berkas ({request.file_urls.length})</span>
                <Eye className="w-3 h-3 text-blue-500 ml-0.5" />
              </button>
            ) : (
              <span className="text-xs text-slate-400 italic">Tidak ada lampiran berkas</span>
            )}

            {canApprove && (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setIsRejectModalOpen(true)}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <XCircle className="w-3.5 h-3.5" /> Tolak
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/20 transition disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Setujui
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Lightbox Document Viewer */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        attachments={request.file_urls}
        title={`Bukti Perizinan — ${request.student.full_name}`}
      />

      {/* Rejection Modal with Preset Reasons */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="doppelrand-shell max-w-md w-full">
            <div className="doppelrand-core p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    Tolak Pengajuan Izin
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih preset atau tulis catatan alasan untuk mahasiswa:
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-medium">
                  Preset Cepat:
                </span>
                <div className="space-y-1">
                  {rejectionPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className="w-full text-left text-[11px] p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 transition active:scale-98"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleReject} className="space-y-4">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Alasan Penolakan:
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ketikkan alasan penolakan..."
                    required
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !rejectReason.trim()}
                    className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition disabled:opacity-50 active:scale-95 shadow-md shadow-rose-900/20"
                  >
                    {isProcessing ? 'Memproses...' : 'Konfirmasi Penolakan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
