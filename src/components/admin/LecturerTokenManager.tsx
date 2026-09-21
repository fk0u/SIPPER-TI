'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react';

export const LecturerTokenManager: React.FC = () => {
  const { user } = useAuthStore();
  const { lecturerTokens, courses, generateLecturerToken, deleteLecturerToken } = useLeaveStore();

  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [tokenLabel, setTokenLabel] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const courseId = selectedCourseId === 'all' ? null : selectedCourseId;
    generateLecturerToken(courseId, tokenLabel, user.id);

    setTokenLabel('');
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 2500);
  };

  const copyTokenUrl = (token: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/lecturer/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="doppelrand-shell">
        <div className="doppelrand-core p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-purple-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-purple-600 dark:text-purple-400 font-semibold">
                Guest Access Management
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <KeyRound className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              Manajemen Link Akses Dosen
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              Buat tautan token publik khusus untuk Dosen Pengampu agar dapat melihat rekap presensi perizinan tanpa login akun.
            </p>
          </div>

          <span className="px-3 py-1 rounded-md text-xs font-mono font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30">
            Khusus KM & Sipen
          </span>
        </div>
      </div>

      {/* Generator Card */}
      <form onSubmit={handleCreateToken} className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Buat Tautan Dosen Baru
        </h2>

        {isSuccess && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4" /> Tautan akses dosen berhasil dibuat dan siap dibagikan!
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block">Pilih Cakupan Mata Kuliah:</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">Seluruh Mata Kuliah (Akses Koordinator/Kaprodi)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name} ({c.lecturer_name})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block">Label / Nama Tautan:</label>
            <input
              type="text"
              value={tokenLabel}
              onChange={(e) => setTokenLabel(e.target.value)}
              placeholder="Contoh: Link Dosen Pengampu Pak Hendra"
              required
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" /> Generate Tautan Publik
          </button>
        </div>
      </form>

      {/* Active Tokens List */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono px-1">
          Daftar Tautan Akses Aktif ({lecturerTokens.length})
        </h2>

        <div className="space-y-3">
          {lecturerTokens.map((token) => (
            <div
              key={token.id}
              className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{token.label}</h4>
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md">
                    {token.course ? token.course.code : 'SEMUA MATKUL'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {token.course ? token.course.name : 'Supervisi Koordinator Kelas Internasional'}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1">
                  <Clock className="w-3 h-3" />
                  <span>Token: {token.token}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-white/5">
                <button
                  onClick={() => copyTokenUrl(token.token, token.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 active:scale-[0.98] ${
                    copiedId === token.id
                      ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {copiedId === token.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin URL</span>
                    </>
                  )}
                </button>

                <a
                  href={`/lecturer/${token.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 transition flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Buka
                </a>

                <button
                  onClick={() => deleteLecturerToken(token.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                  title="Hapus token"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
