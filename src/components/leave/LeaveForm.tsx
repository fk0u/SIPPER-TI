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
              name: 'bukti_perizinan.jpg',
              url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
              type: 'image/jpeg',
              size: 1024000,
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
      }, 1200);
    }
  };

  return (
    <div className="doppelrand-shell max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="doppelrand-core p-6 sm:p-8 space-y-6">
        
        {/* Form Header */}
        <div className="border-b border-slate-200 dark:border-white/5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-sm bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400 font-semibold">
              Portal Pengajuan Presensi
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Formulir Izin Kuliah
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Lengkapi data perizinan presensi untuk disinkronkan ke Sipen dan Dosen Pengampu.
          </p>
        </div>

        {/* Success Banner */}
        {isSuccess && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-400 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>Pengajuan perizinan berhasil dikirim! Mengalihkan ke halaman beranda...</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-400 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Submission Mode (Self vs Proxy) */}
        {canUseProxy && (
          <div className="bg-slate-100 dark:bg-slate-950/70 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <label className="text-xs font-semibold text-slate-900 dark:text-white">Mode Pengajuan (Proxy)</label>
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
                className={`px-3 py-1 rounded-lg text-xs font-medium transition active:scale-[0.98] ${
                  isProxy
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800'
                }`}
              >
                {isProxy ? 'Aktif: Ajukan untuk Teman' : 'Pengajuan Mandiri'}
              </button>
            </div>

            {isProxy && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-white/5 animate-in fade-in">
                <label className="text-[11px] text-purple-700 dark:text-purple-300 font-medium block">
                  Pilih Rekan Mahasiswa yang Diizinkan:
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-purple-500/40 rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-400"
                >
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name} (NIM: {student.nim})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-purple-600 dark:text-purple-400/80 leading-relaxed">
                  Catatan: Data izin akan terhubung ke nama rekan tersebut, dengan catatan riwayat bahwa pengajuan diajukan oleh Anda ({user?.full_name}).
                </p>
              </div>
            )}
          </div>
        )}

        {/* 2. Course Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Mata Kuliah</label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name} ({c.day_of_week}, {c.start_time}-{c.end_time}) • {c.lecturer_name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Leave Type (Non-pill rounded-xl) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Kategori Perizinan</label>
          <div className="grid grid-cols-3 gap-2">
            {(['sakit', 'izin', 'acara'] as LeaveType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setLeaveType(type)}
                className={`py-2.5 px-3 rounded-xl text-xs font-medium capitalize transition active:scale-[0.98] text-center ${
                  leaveType === type
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-white/5'
                }`}
              >
                {type === 'sakit' ? '🏥 Sakit' : type === 'izin' ? '📄 Izin Pribadi' : '🏆 Tugas / Lomba'}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Multi-Day Date Range */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Rentang Tanggal Perizinan</label>
            {diffDays > 0 && (
              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 font-mono">
                Durasi: {diffDays} Hari
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Tanggal Mulai:</span>
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
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Tanggal Selesai:</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* 5. Reason Text */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Keterangan / Alasan Rinci</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            placeholder="Jelaskan diagnosis medis dari dokter atau rincian agenda dispensasi kampus..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 6. Multi-Format Upload Dropzone */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Lampiran Berkas (Foto Surat Dokter / Surat Tugas PDF)</span>
            <span className="text-[10px] text-slate-500 font-mono">Maks. 5MB</span>
          </label>

          <div className="relative border-2 border-dashed border-slate-300 dark:border-white/10 hover:border-blue-500/50 rounded-xl p-6 text-center bg-slate-50/50 dark:bg-slate-950/40 transition group cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              multiple
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium text-slate-900 dark:text-white">
                Pilih file foto atau seret berkas ke sini
              </p>
              <p className="text-[10px] text-slate-500 font-mono">Format didukung: JPG, PNG, WebP, dan PDF</p>
            </div>
          </div>

          {/* Uploaded files list */}
          {attachments.length > 0 && (
            <div className="space-y-2 pt-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-slate-800 dark:text-slate-200 truncate">{att.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isSuccess}
          className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <span>{isSubmitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Izin'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </form>
    </div>
  );
};
