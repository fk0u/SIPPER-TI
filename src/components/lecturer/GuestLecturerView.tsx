'use client';

import React, { useState } from 'react';
import { useLeaveStore } from '@/store/useLeaveStore';
import { DocumentViewerModal } from '@/components/leave/DocumentViewerModal';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LeaveAttachment } from '@/types/database';
import {
  GraduationCap,
  Calendar,
  BookOpen,
  Printer,
  Search,
  CheckCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface GuestLecturerViewProps {
  tokenString: string;
}

export const GuestLecturerView: React.FC<GuestLecturerViewProps> = ({ tokenString }) => {
  const { lecturerTokens, requests, courses } = useLeaveStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [activeModalFiles, setActiveModalFiles] = useState<LeaveAttachment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');

  // Find token
  const tokenData = lecturerTokens.find((t) => t.token === tokenString);

  if (!tokenData) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="doppelrand-shell max-w-md w-full">
          <div className="doppelrand-core p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tautan Akses Dosen Tidak Valid</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Token akses publik ini tidak terdaftar di pangkalan data atau telah kedaluwarsa.
              Silakan hubungi Sipen mata kuliah atau KM Kelas Internasional untuk mendapatkan tautan baru.
            </p>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-white/5 text-[11px] font-mono text-slate-500">
              Token: {tokenString}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const assignedCourse = tokenData.course_id
    ? courses.find((c) => c.id === tokenData.course_id)
    : null;

  const courseRequests = requests.filter((r) => {
    if (assignedCourse && r.course_id !== assignedCourse.id) return false;
    return true;
  });

  const approvedLeaves = courseRequests.filter((r) => r.status === 'approved');
  const sickCount = approvedLeaves.filter((r) => r.leave_type === 'sakit').length;
  const eventCount = approvedLeaves.filter((r) => r.leave_type === 'acara' || r.leave_type === 'izin').length;
  const pendingCount = courseRequests.filter((r) => r.status === 'pending').length;

  const displayedLeaves = courseRequests.filter((r) => {
    if (selectedDate) {
      if (r.start_date > selectedDate || r.end_date < selectedDate) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.student.full_name.toLowerCase().includes(q) ||
        r.student.nim.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  const openViewer = (files: LeaveAttachment[], studentName: string) => {
    setActiveModalFiles(files);
    setModalTitle(`Bukti Surat Keterangan - ${studentName}`);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* Official Header for Lecturer */}
      <div className="doppelrand-shell print:border-none print:shadow-none print:p-0">
        <div className="doppelrand-core p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/15 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center print:hidden shadow-inner">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Akses Dosen Pengampu (Read-Only)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">TI-UMKT</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                  {assignedCourse ? `${assignedCourse.code} - ${assignedCourse.name}` : 'Rekap Presensi Seluruh Perkuliahan TI'}
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Dosen Pengampu: <strong className="text-slate-900 dark:text-slate-200 font-medium">{assignedCourse?.lecturer_name || 'Dosen Pengampu TI Intl'}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 print:hidden">
              <div className="scale-90 origin-right">
                <ThemeToggle />
              </div>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-2 active:scale-[0.98]"
              >
                <Printer className="w-4 h-4" /> Cetak Rekap
              </button>
            </div>
          </div>

          {/* Schedule metadata */}
          {assignedCourse && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-100 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase">Jadwal Kuliah</span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">{assignedCourse.day_of_week}</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase">Waktu Perkuliahan</span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">{assignedCourse.start_time} - {assignedCourse.end_time} WITA</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase">Ruang Kelas</span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">{assignedCourse.room}</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase">Semester Aktif</span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">{assignedCourse.semester}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards (Non-pill) */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-mono uppercase text-[10px]">Izin Sakit</span>
          <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">{sickCount}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-500 block mt-1">Disertai surat dokter</span>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-mono uppercase text-[10px]">Dispensasi Acara</span>
          <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono">{eventCount}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-500 block mt-1">Disetujui Sipen</span>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-mono uppercase text-[10px]">Dalam Review</span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">{pendingCount}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-500 block mt-1">Menunggu validasi</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 print:hidden shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama mahasiswa atau NIM..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
          />
          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Attendance & Leave Table */}
      <div className="doppelrand-shell print:bg-white print:text-black print:border-black">
        <div className="doppelrand-core overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 print:text-black">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Daftar Mahasiswa Berhalangan Hadir
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono print:text-gray-600">
              Total Tercatat: {displayedLeaves.length} Orang
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-slate-200 dark:border-white/5">
                <tr>
                  <th className="px-5 py-3.5">Mahasiswa</th>
                  <th className="px-5 py-3.5">Kategori</th>
                  <th className="px-5 py-3.5">Rentang Tanggal</th>
                  <th className="px-5 py-3.5">Alasan / Keterangan</th>
                  <th className="px-5 py-3.5">Status Verifikasi</th>
                  <th className="px-5 py-3.5 text-right print:hidden">Bukti Medis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-sans">
                {displayedLeaves.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                    <td className="px-5 py-4">
                      <span className="font-semibold text-slate-900 dark:text-white block">{req.student.full_name}</span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">NIM: {req.student.nim}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider font-mono ${
                        req.leave_type === 'sakit'
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                          : req.leave_type === 'acara'
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                      }`}>
                        {req.leave_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {req.start_date} {req.start_date !== req.end_date && `s/d ${req.end_date}`}
                    </td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-300 max-w-xs leading-relaxed">
                      {req.reason}
                      {req.created_by !== req.student_id && (
                        <span className="block text-[10px] text-purple-700 dark:text-purple-400 mt-0.5 font-mono">
                          (Proxy: diisikan {req.creator.full_name})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {req.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" /> Sah (Disetujui)
                        </span>
                      ) : req.status === 'pending' ? (
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Dalam Review Sipen</span>
                      ) : (
                        <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">Ditolak</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right print:hidden">
                      {req.file_urls && req.file_urls.length > 0 ? (
                        <button
                          onClick={() => openViewer(req.file_urls, req.student.full_name)}
                          className="px-3 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[11px] font-medium transition active:scale-[0.98]"
                        >
                          Buka Bukti ({req.file_urls.length})
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Lightbox Viewer */}
      <DocumentViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        attachments={activeModalFiles}
        title={modalTitle}
      />

    </div>
  );
};
