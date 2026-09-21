'use client';

import React, { useState } from 'react';
import { useLeaveStore } from '@/store/useLeaveStore';
import { DocumentViewerModal } from '@/components/leave/DocumentViewerModal';
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
  Users,
  Building,
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
        <div className="max-w-md w-full bg-slate-900 border border-rose-900/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">Tautan Akses Dosen Tidak Valid</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Token akses publik ini tidak terdaftar di pangkalan data atau telah kedaluwarsa.
            Silakan hubungi Sipen mata kuliah atau KM Kelas Internasional untuk mendapatkan tautan baru.
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-500">
            Token: {tokenString}
          </div>
        </div>
      </div>
    );
  }

  const assignedCourse = tokenData.course_id
    ? courses.find((c) => c.id === tokenData.course_id)
    : null;

  // Filter requests relevant to this course
  const courseRequests = requests.filter((r) => {
    if (assignedCourse && r.course_id !== assignedCourse.id) return false;
    return true;
  });

  // Calculate statistics
  const approvedLeaves = courseRequests.filter((r) => r.status === 'approved');
  const sickCount = approvedLeaves.filter((r) => r.leave_type === 'sakit').length;
  const eventCount = approvedLeaves.filter((r) => r.leave_type === 'acara' || r.leave_type === 'izin').length;
  const pendingCount = courseRequests.filter((r) => r.status === 'pending').length;

  // Search & Date filter
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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl print:hidden">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Portal Akses Dosen (Read-Only)
                </span>
                <span className="text-xs text-slate-400 font-mono">TI-UMKT</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {assignedCourse ? `${assignedCourse.code} - ${assignedCourse.name}` : 'Rekap Presensi Seluruh Perkuliahan TI'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Dosen Pengampu: <strong className="text-slate-200">{assignedCourse?.lecturer_name || 'Dosen Pengampu TI Intl'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-900/30 transition flex items-center gap-2 print:hidden"
          >
            <Printer className="w-4 h-4" /> Cetak / Unduh Rekap Presensi
          </button>
        </div>

        {/* Schedule metadata pills */}
        {assignedCourse && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Jadwal Hari</span>
              <span className="text-white font-medium">{assignedCourse.day_of_week}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Jam Perkuliahan</span>
              <span className="text-white font-medium">{assignedCourse.start_time} - {assignedCourse.end_time} WITA</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Ruang Kuliah</span>
              <span className="text-white font-medium">{assignedCourse.room}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Semester Aktif</span>
              <span className="text-white font-medium">{assignedCourse.semester}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 print:hidden">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 block mb-1">Izin Sakit Terverifikasi</span>
          <span className="text-2xl font-bold text-rose-400 font-mono">{sickCount}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Disertai surat dokter</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 block mb-1">Izin Acara / Dispensasi</span>
          <span className="text-2xl font-bold text-purple-400 font-mono">{eventCount}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Disetujui Sipen</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-xs text-slate-400 block mb-1">Dalam Proses Review</span>
          <span className="text-2xl font-bold text-amber-400 font-mono">{pendingCount}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Menunggu validasi berkas</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 print:hidden">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama mahasiswa atau NIM..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Attendance & Leave Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl print:bg-white print:text-black print:border-black">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 print:text-black">
            <FileText className="w-4 h-4 text-blue-400" />
            Daftar Mahasiswa Berhalangan Hadir
          </h3>
          <span className="text-xs text-slate-400 print:text-gray-600">
            Total Tercatat: {displayedLeaves.length} Orang
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Mahasiswa</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Rentang Tanggal</th>
                <th className="px-4 py-3">Alasan / Keterangan</th>
                <th className="px-4 py-3">Status Verifikasi</th>
                <th className="px-4 py-3 text-right print:hidden">Bukti Medis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {displayedLeaves.map((req) => (
                <tr key={req.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3.5">
                    <span className="font-semibold text-white block">{req.student.full_name}</span>
                    <span className="text-[11px] font-mono text-slate-400">NIM: {req.student.nim}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      req.leave_type === 'sakit'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : req.leave_type === 'acara'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                    }`}>
                      {req.leave_type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-300">
                    {req.start_date} {req.start_date !== req.end_date && `s/d ${req.end_date}`}
                  </td>
                  <td className="px-4 py-3.5 text-slate-300 max-w-xs leading-relaxed">
                    {req.reason}
                    {req.created_by !== req.student_id && (
                      <span className="block text-[10px] text-purple-400 mt-0.5 font-sans">
                        (Proxy: diisikan {req.creator.full_name})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {req.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Sah (Disetujui)
                      </span>
                    ) : req.status === 'pending' ? (
                      <span className="text-[11px] text-amber-400 font-medium">Dalam Review Sipen</span>
                    ) : (
                      <span className="text-[11px] text-rose-400 font-medium">Ditolak</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right print:hidden">
                    {req.file_urls && req.file_urls.length > 0 ? (
                      <button
                        onClick={() => openViewer(req.file_urls, req.student.full_name)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px] font-medium transition"
                      >
                        Buka Bukti ({req.file_urls.length})
                      </button>
                    ) : (
                      <span className="text-slate-600 italic text-[11px]">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
