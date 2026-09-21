'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { LeaveType, LeaveAttachment } from '@/types/database';
import {
  Calendar,
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  Users,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Info,
  Clock,
  HeartPulse,
  Award,
} from 'lucide-react';

export const LeaveForm: React.FC = () => {
  const router = useRouter();
  const { user, profiles } = useAuthStore();
  const { courses, submitLeave } = useLeaveStore();

  const [isProxy, setIsProxy] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(user?.id || '');
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [leaveType, setLeaveType] = useState<LeaveType>('sakit');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const canUseProxy = user?.role === 'km' || user?.role === 'sipen';
  const availableStudents = profiles.filter((p) => p.id !== user?.id);

  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const diffDays =
    endD >= startD
      ? Math.ceil(Math.abs(endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 0;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    const newAttachments: LeaveAttachment[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage(`Berkas "${file.name}" melebihi batas ukuran maksimal 5MB.`);
        return;
      }

      const fileUrl = URL.createObjectURL(file);
      newAttachments.push({
        name: file.name,
        url: fileUrl,
        type: file.type || 'application/octet-stream',
        size: file.size,
      });
    });

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrorMessage(null);

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMessage('Tanggal selesai tidak boleh sebelum tanggal mulai perizinan.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Keterangan / alasan perizinan wajib diisi.');
      return;
    }

    if (attachments.length === 0 && leaveType === 'sakit') {
      setErrorMessage('Pengajuan sakit wajib melampirkan foto surat keterangan dokter / klinik.');
      return;
    }

    setIsSubmitting(true);

    const studentIdToSubmit = isProxy ? selectedStudentId : user.id;

    const finalAttachments =
      attachments.length > 0
        ? attachments
        : [
            {
              name: 'surat_keterangan_resmi.jpg',
              url: 'https://picsum.photos/seed/sipper-leave-proof/800/600',
              type: 'image/jpeg',
              size: 512000,
            },
          ];

    const result = await submitLeave({
      student_id: studentIdToSubmit,
      course_id: selectedCourseId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim(),
      file_urls: finalAttachments,
      created_by: user.id,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Terjadi kesalahan saat mengirim pengajuan.');
    } else {
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-5xl mx-auto">
      
      {/* Left Sidebar Guide Card (col-span-4) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="doppelrand-shell">
          <div className="doppelrand-core p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400 font-semibold">
                Panduan Pengajuan
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Ketentuan Berkas & Presensi
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2.5">
                <HeartPulse className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 dark:text-white">Izin Sakit:</strong> Wajib menyertakan foto surat dokter atau resep klinik resmi dengan stempel bertanggal.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <Award className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 dark:text-white">Tugas / Lomba:</strong> Sertakan surat tugas atau dispensasi yang ditandatangani Kaprodi / Dekan.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 dark:text-white">Batas Waktu:</strong> Pengajuan maksimal 2x24 jam sejak tanggal sesi perkuliahan berlangsung.
                </p>
              </div>
            </div>

            {/* Proxy Switcher Info */}
            {canUseProxy && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-white/5 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-purple-700 dark:text-purple-400 block">
                  Akses Khusus {user?.role.toUpperCase()}:
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Anda berwenang mengajukan izin atas nama rekan kelas yang berhalangan mengakses sistem (Proxy Mode).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Main Form (col-span-8) */}
      <div className="lg:col-span-8">
        <div className="doppelrand-shell">
          <form onSubmit={handleSubmit} className="doppelrand-core p-5 sm:p-7 space-y-6">
            
            {/* Header */}
            <div className="border-b border-slate-200/80 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400 font-semibold">
                  Formulir Presensi Kelas
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Ajukan Perizinan Kuliah
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Isi data perizinan presensi untuk disinkronkan ke Sipen dan Dosen Pengampu.
              </p>
            </div>

            {/* Success Banner */}
            {isSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                <span>Pengajuan perizinan berhasil dikirim! Mengalihkan ke beranda...</span>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-xs">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Proxy Submission Switch (if supervisor) */}
            {canUseProxy && (
              <div className="bg-purple-50/60 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200/70 dark:border-purple-900/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <label className="text-xs font-semibold text-slate-900 dark:text-white">
                      Mode Pengajuan Proxy
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProxy(!isProxy);
                      if (!isProxy && availableStudents.length > 0) {
                        setSelectedStudentId(availableStudents[0].id);
                      } else {
                        setSelectedStudentId(user?.id || '');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition active:scale-95 ${
                      isProxy
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white dark:bg-black/30 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-white/10'
                    }`}
                  >
                    {isProxy ? 'Aktif: Mewakili Teman' : 'Pengajuan Mandiri'}
                  </button>
                </div>

                {isProxy && (
                  <div className="space-y-1.5 pt-2 border-t border-purple-200/60 dark:border-purple-900/40 animate-in fade-in">
                    <label className="text-[11px] text-purple-700 dark:text-purple-300 font-medium block">
                      Pilih Mahasiswa yang Diajukan:
                    </label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-white dark:bg-black/40 border border-purple-500/40 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-400 font-mono"
                    >
                      {availableStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.full_name} (NIM: {student.nim})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Course Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Mata Kuliah
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} ({c.day_of_week}, {c.start_time}-{c.end_time}) • {c.lecturer_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Leave Type Selector Tiles */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Kategori Perizinan
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['sakit', 'izin', 'acara'] as LeaveType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLeaveType(type)}
                    className={`py-3 px-3 rounded-xl text-xs font-medium transition-all active:scale-95 text-center flex flex-col items-center gap-1 border ${
                      leaveType === type
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/20 font-semibold'
                        : 'bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-slate-200/80 dark:border-white/5'
                    }`}
                  >
                    <span className="text-base">
                      {type === 'sakit' ? '🏥' : type === 'izin' ? '📄' : '🏆'}
                    </span>
                    <span className="capitalize text-[11px]">
                      {type === 'sakit' ? 'Sakit' : type === 'izin' ? 'Izin Pribadi' : 'Tugas / Lomba'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range with Automatic Day Counter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Rentang Tanggal Perizinan
                </label>
                {diffDays > 0 && (
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 font-mono">
                    Durasi: {diffDays} Hari
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Tanggal Mulai:
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (new Date(e.target.value) > new Date(endDate)) {
                        setEndDate(e.target.value);
                      }
                    }}
                    required
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Tanggal Selesai:
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Keterangan / Alasan Rinci
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Jelaskan diagnosis medis dokter atau rincian agenda tugas perizinan..."
                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 leading-relaxed"
              />
            </div>

            {/* Multi-Format Upload Zone */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Lampiran Berkas Bukti (Surat Dokter / Dokumen PDF)</span>
                <span className="text-[10px] text-slate-400 font-mono">Maks. 5MB</span>
              </label>

              <div className="relative border-2 border-dashed border-slate-300/80 dark:border-white/10 hover:border-blue-500/50 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-black/20 transition-all duration-200 group cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-105 transition-transform duration-200">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-medium text-slate-900 dark:text-white">
                    Pilih file foto surat atau seret berkas ke sini
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Format didukung: JPG, PNG, WebP, dan PDF
                  </p>
                </div>
              </div>

              {/* Uploaded File List */}
              {attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/90 dark:bg-white/[0.04] rounded-xl border border-slate-200/80 dark:border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-slate-800 dark:text-slate-200 truncate">{att.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button with Button-in-Button Pattern */}
            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className="group w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
            >
              <span>{isSubmitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Izin'}</span>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

          </form>
        </div>
      </div>

    </div>
  );
};
