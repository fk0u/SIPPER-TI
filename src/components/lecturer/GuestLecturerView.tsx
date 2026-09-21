'use client';

import React, { useState } from 'react';
import { useLeaveStore } from '@/store/useLeaveStore';
import { DocumentViewerModal } from '@/components/leave/DocumentViewerModal';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { CountUp } from '@/components/reactbits/CountUp';
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
  Eye,
  X,
  Building2,
  Clock,
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
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Tautan Akses Dosen Tidak Valid
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Token akses publik ini tidak terdaftar di sistem atau telah kedaluwarsa.
              Silakan hubungi Sipen mata kuliah atau KM Kelas Internasional untuk mendapatkan tautan baru.
            </p>
            <div className="p-3 bg-slate-100 dark:bg-black/30 rounded-xl border border-slate-200 dark:border-white/5 text-[11px] font-mono text-slate-500">
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
    setModalTitle(`Bukti Surat Keterangan — ${studentName}`);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* Official Header for Lecturer */}
      <div className="doppelrand-shell print:border-none print:shadow-none print:p-0">
        <div className="doppelrand-core p-5 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 dark:border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center print:hidden shadow-inner">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Akses Dosen Pengampu (Read-Only)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">TI-UMKT</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                  {assignedCourse ? `${assignedCourse.code} — ${assignedCourse.name}` : 'Rekap Presensi Seluruh Perkuliahan TI'}
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Dosen Pengampu: <strong className="text-slate-900 dark:text-slate-200 font-medium">{assignedCourse?.lecturer_name || 'Dosen Pengampu TI Intl'}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 print:hidden">
              <ThemeToggle />
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-900/20 transition flex items-center gap-2 active:scale-95"
              >
                <Printer className="w-4 h-4" /> Cetak Rekap
              </button>
            </div>
          </div>

          {/* Schedule metadata */}
          {assignedCourse && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-100/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/80 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase font-semibold">Jadwal Kuliah</span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">{assignedCourse.day_of_week}</span>
              </div>
              <div className="bg-slate-100/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/80 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase font-semibold">Waktu Sesi</span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">{assignedCourse.start_time} - {assignedCourse.end_time} WITA</span>
              </div>
              <div className="bg-slate-100/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/80 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase font-semibold">Ruang Kelas</span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">{assignedCourse.room}</span>
              </div>
              <div className="bg-slate-100/70 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-200/80 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-mono uppercase font-semibold">Semester Aktif</span>
                <span className="text-slate-900 dark:text-white font-medium text-xs mt-0.5 block">{assignedCourse.semester}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards with CountUp */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white/90 dark:bg-[#0b0f19]/80 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-mono uppercase text-[10px] font-semibold">
            Izin Sakit
          </span>
          <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            <CountUp to={sickCount} duration={0.8} />
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">Disertai surat dokter</span>
        </div>

        <div className="bg-white/90 dark:bg-[#0b0f19]/80 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-mono uppercase text-[10px] font-semibold">
            Dispensasi Acara
          </span>
          <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400">
            <CountUp to={eventCount} duration={0.8} />
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">Disetujui Sipen / KM</span>
        </div>

        <div className="bg-white/90 dark:bg-[#0b0f19]/80 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-mono uppercase text-[10px] font-semibold">
            Dalam Review
          </span>
          <span className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            <CountUp to={pendingCount} duration={0.8} />
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">Menunggu validasi</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/90 dark:bg-[#0b0f19]/80 border border-slate-200/80 dark:border-white/10 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row gap-3 print:hidden shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama mahasiswa atau NIM..."
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
          <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
          />
          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="px-2.5 py-2 rounded-xl text-xs bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 transition"
              title="Hapus filter tanggal"
            >
              Semua Tanggal
            </button>
          )}
        </div>
      </div>

      {/* Attendance Table */}
      <div className="doppelrand-shell print:border-none print:shadow-none print:p-0">
        <div className="doppelrand-core overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/5 text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Mahasiswa</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Tanggal Izin</th>
                  <th className="py-3.5 px-4">Alasan</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center print:hidden">Berkas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
                {displayedLeaves.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition"
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        {req.student.full_name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {req.student.nim}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-semibold text-[9px] uppercase font-mono tracking-wider ${
                          req.leave_type === 'sakit'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25'
                            : req.leave_type === 'acara'
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/25'
                            : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25'
                        }`}
                      >
                        {req.leave_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {req.start_date}
                      {req.start_date !== req.end_date && ` s/d ${req.end_date}`}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-slate-600 dark:text-slate-300">
                      <span className="line-clamp-2 italic">&ldquo;{req.reason}&rdquo;</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                            : req.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                        }`}
                      >
                        {req.status === 'approved'
                          ? 'Disetujui'
                          : req.status === 'rejected'
                          ? 'Ditolak'
                          : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center print:hidden">
                      {req.file_urls && req.file_urls.length > 0 ? (
                        <button
                          onClick={() => openViewer(req.file_urls, req.student.full_name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800/40 text-[11px] font-medium transition active:scale-95"
                          title="Lihat Surat Keterangan"
                        >
                          <Eye className="w-3 h-3" /> Lihat ({req.file_urls.length})
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

          {displayedLeaves.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs">
              Tidak ada data perizinan mahasiswa untuk filter tanggal atau pencarian ini.
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        attachments={activeModalFiles}
        title={modalTitle}
      />

    </div>
  );
};

export default GuestLecturerView;
