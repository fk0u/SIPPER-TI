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
  Sparkles,
  Info,
} from 'lucide-react';

export const LeaveForm: React.FC = () => {
  const router = useRouter();
  const { user, profiles } = useAuthStore();
  const { courses, submitLeave } = useLeaveStore();

  // Form states
  const [isProxy, setIsProxy] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(user?.id || '');
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [leaveType, setLeaveType] = useState<LeaveType>('sakit');
  
  // Default to today's date format YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Filter students for proxy selection
  const canUseProxy = user?.role === 'km' || user?.role === 'sipen';
  const availableStudents = profiles.filter((p) => p.id !== user?.id);

  // Compute number of days
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const diffDays =
    endD >= startD
      ? Math.ceil(Math.abs(endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 0;

  // File upload simulation (supports image & PDF with local data URL preview)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    const newAttachments: LeaveAttachment[] = [];

    Array.from(files).forEach((file) => {
      // 5MB limit
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

    // Validation
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

    // Use default fallback attachment if none provided for testing
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
    <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-w-2xl mx-auto">
      
      {/* Form Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
          <Calendar className="w-5 h-5 text-blue-400" /> Formulir Pengajuan Izin Kuliah
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Lengkapi data perizinan presensi untuk disinkronkan ke Sipen dan Dosen Pengampu.
        </p>
      </div>

      {/* Success Banner */}
      {isSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Pengajuan perizinan berhasil dikirim! Mengalihkan ke halaman beranda...</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-400 text-xs animate-in shake">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Submission Mode (Self vs Proxy) */}
      {canUseProxy && (
        <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <label className="text-xs font-semibold text-white">Mode Pengajuan Izin (Proxy)</label>
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
              className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                isProxy
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/30'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {isProxy ? 'Aktif: Ajukan untuk Teman' : 'Pengajuan Mandiri'}
            </button>
          </div>

          {isProxy && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800 animate-in fade-in">
              <label className="text-[11px] text-purple-300 font-medium block">
                Pilih Mahasiswa yang Diizinkan:
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
              >
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name} (NIM: {student.nim})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-purple-400/80">
                Fitur Proxy: Catatan sistem akan mencatat bahwa pengajuan ini dibuat oleh Anda ({user?.full_name}) atas nama rekan tersebut.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. Course Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300 block">Mata Kuliah</label>
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} - {c.name} ({c.day_of_week}, {c.start_time}-{c.end_time}) • {c.lecturer_name}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Leave Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300 block">Kategori Perizinan</label>
        <div className="grid grid-cols-3 gap-2">
          {(['sakit', 'izin', 'acara'] as LeaveType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setLeaveType(type)}
              className={`py-2.5 px-3 rounded-xl text-xs font-medium capitalize transition border text-center ${
                leaveType === type
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {type === 'sakit' ? '🏥 Sakit' : type === 'izin' ? '📄 Izin Penting' : '🏆 Tugas / Acara'}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Multi-Day Date Range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">Rentang Tanggal Perizinan</label>
          {diffDays > 0 && (
            <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
              Durasi: {diffDays} Hari
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">Tanggal Mulai:</span>
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] text-slate-400">Tanggal Selesai:</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 5. Reason Text */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300 block">Alasan / Keterangan Rinci</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          placeholder="Jelaskan kondisi medis atau rincian agenda tugas kampus..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* 6. Multi-Format Upload Dropzone */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>Lampiran Bukti (Foto Surat Dokter / Dispensasi PDF)</span>
          <span className="text-[10px] text-slate-500 font-normal">Maks. 5MB</span>
        </label>

        <div className="relative border-2 border-dashed border-slate-800 hover:border-blue-500/60 rounded-2xl p-6 text-center bg-slate-950/40 transition group cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            multiple
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-blue-600/10 text-blue-400 rounded-xl group-hover:scale-110 transition">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-white">
              Pilih file foto atau seret berkas ke sini
            </p>
            <p className="text-[11px] text-slate-500">Mendukung format JPG, PNG, WebP, dan PDF</p>
          </div>
        </div>

        {/* Uploaded files list */}
        {attachments.length > 0 && (
          <div className="space-y-2 pt-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-slate-200 truncate">{att.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="p-1 text-slate-400 hover:text-rose-400 rounded-lg transition"
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
        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-900/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Mengirim Pengajuan...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Kirim Pengajuan Izin
          </>
        )}
      </button>

    </form>
  );
};
