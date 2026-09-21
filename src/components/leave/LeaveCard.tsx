'use client';

import React, { useState } from 'react';
import { LeaveRequestWithRelations } from '@/types/database';
import { StatusBadge } from './StatusBadge';
import { DocumentViewerModal } from './DocumentViewerModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import {
  Calendar,
  Clock,
  BookOpen,
  User,
  Users,
  Paperclip,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building,
} from 'lucide-react';

interface LeaveCardProps {
  request: LeaveRequestWithRelations;
}

export const LeaveCard: React.FC<LeaveCardProps> = ({ request }) => {
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
    await approveLeave(request.id, user);
    setIsProcessing(false);
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectReason.trim()) return;
    setIsProcessing(true);
    await rejectLeave(request.id, rejectReason, user);
    setIsProcessing(false);
    setIsRejectModalOpen(false);
    setRejectReason('');
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

  return (
    <>
      <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 hover:border-slate-700/80 transition shadow-lg space-y-4">
        
        {/* Top Header: Student info & Status badge */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
              {request.student.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-white text-sm">{request.student.full_name}</h4>
                {isProxy && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium" title={`Diajukan oleh: ${request.creator.full_name} (${request.creator.role.toUpperCase()})`}>
                    <Users className="w-3 h-3" /> Proxy
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">NIM: {request.student.nim}</p>
            </div>
          </div>

          <StatusBadge status={request.status} />
        </div>

        {/* Course & Schedule Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <BookOpen className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-400 block text-[11px]">Mata Kuliah</span>
              <span className="text-white font-medium">{request.course.code} - {request.course.name}</span>
              <span className="text-slate-500 block text-[10px] mt-0.5">Dosen: {request.course.lecturer_name}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-400 block text-[11px]">Rentang Waktu Izin</span>
              <span className="text-white font-medium">
                {formatDisplayDate(request.start_date)}
                {request.start_date !== request.end_date && ` s/d ${formatDisplayDate(request.end_date)}`}
              </span>
              <span className="text-emerald-400/90 block text-[10px] font-semibold mt-0.5">
                Total: {diffDays} Hari Perkuliahan
              </span>
            </div>
          </div>
        </div>

        {/* Reason & Type */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] uppercase tracking-wider ${
              request.leave_type === 'sakit'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : request.leave_type === 'acara'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
            }`}>
              {request.leave_type}
            </span>
            <span className="text-slate-400 text-[11px]">Keterangan:</span>
          </div>
          <p className="text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50 leading-relaxed text-xs">
            &ldquo;{request.reason}&rdquo;
          </p>
        </div>

        {/* Proxy Note (if filed on behalf) */}
        {isProxy && (
          <div className="flex items-center gap-1.5 text-[11px] text-purple-300/80 bg-purple-950/20 px-3 py-1.5 rounded-lg border border-purple-900/30">
            <User className="w-3.5 h-3.5 text-purple-400" />
            <span>Diajukan atas nama mahasiswa oleh: <strong className="text-purple-200">{request.creator.full_name} ({request.creator.role.toUpperCase()})</strong></span>
          </div>
        )}

        {/* Rejection notice (if rejected) */}
        {request.status === 'rejected' && request.rejection_reason && (
          <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/20 p-3 rounded-xl border border-rose-900/40">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-rose-200 font-semibold mb-0.5">Catatan Penolakan:</strong>
              <p className="text-rose-300/90">{request.rejection_reason}</p>
            </div>
          </div>
        )}

        {/* Verification info (if approved) */}
        {request.status === 'approved' && request.verifier && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80 bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-900/30">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Disetujui oleh: <strong className="text-emerald-300">{request.verifier.full_name} ({request.verifier.role.toUpperCase()})</strong></span>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {request.file_urls && request.file_urls.length > 0 ? (
            <button
              onClick={() => setIsViewerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 transition"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Lihat Bukti Berkas ({request.file_urls.length})</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500 italic">Tidak ada lampiran berkas</span>
          )}

          {canApprove && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRejectModalOpen(true)}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition disabled:opacity-50 flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" /> Tolak
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Setujui
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Lightbox Document Viewer */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        attachments={request.file_urls}
        title={`Bukti Perizinan - ${request.student.full_name}`}
      />

      {/* Reject Reason Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Tolak Pengajuan Izin</h3>
                <p className="text-xs text-slate-400">Berikan catatan alasan yang jelas untuk mahasiswa.</p>
              </div>
            </div>

            <form onSubmit={handleReject} className="space-y-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Lampiran foto surat dokter buram / tanggal tidak sesuai jadwal ujian..."
                required
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !rejectReason.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition disabled:opacity-50"
                >
                  {isProcessing ? 'Memproses...' : 'Konfirmasi Penolakan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
