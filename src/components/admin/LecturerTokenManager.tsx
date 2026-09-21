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
  Share2,
  MessageCircle,
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

  const shareViaWhatsApp = (token: string, label: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/lecturer/${token}`;
    const text = encodeURIComponent(
      `Halo Bapak/Ibu Dosen Pengampu,\n\nBerikut tautan rekapitulasi kehadiran dan perizinan mahasiswa Kelas Internasional Teknik Informatika UMKT (${label}):\n${fullUrl}\n\nTautan ini dapat diakses secara langsung tanpa login. Terima kasih.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="doppelrand-shell">
        <div className="doppelrand-core p-5 sm:p-7 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-purple-600 dark:text-purple-400 font-semibold">
                Guest Access Management
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400 shrink-0" />
              Manajemen Link Akses Dosen
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              Buat tautan token publik khusus untuk Dosen Pengampu agar dapat melihat rekap presensi perizinan secara instan tanpa perlu registrasi.
            </p>
          </div>

          <span className="px-3 py-1 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/25 shrink-0">
            Khusus KM & Sipen
          </span>
        </div>
      </div>

      {/* Generator Card */}
      <div className="doppelrand-shell">
        <form onSubmit={handleCreateToken} className="doppelrand-core p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200/80 dark:border-white/5 pb-3">
            <Plus className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Buat Tautan Dosen Baru
          </h2>

          {isSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" /> Tautan akses dosen berhasil dibuat dan siap dibagikan!
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block">
                Pilih Cakupan Mata Kuliah:
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Seluruh Mata Kuliah (Akses Koordinator/Kaprodi)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} ({c.lecturer_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block">
                Label / Nama Tautan:
              </label>
              <input
                type="text"
                value={tokenLabel}
                onChange={(e) => setTokenLabel(e.target.value)}
                placeholder="Contoh: Link Dosen Pengampu Pak Hendra"
                required
                className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-900/20 transition flex items-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4" /> Generate Tautan Publik
            </button>
          </div>
        </form>
      </div>

      {/* Active Tokens List */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono px-1">
          Daftar Tautan Akses Aktif ({lecturerTokens.length})
        </h2>

        <div className="space-y-3">
          {lecturerTokens.map((token) => (
            <div
              key={token.id}
              className="doppelrand-shell group hover:border-slate-300 dark:hover:border-white/20 transition-all"
            >
              <div className="doppelrand-core p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                      {token.label}
                    </h4>
                    <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-md shrink-0">
                      {token.course ? token.course.code : 'SEMUA MATKUL'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {token.course ? token.course.name : 'Supervisi Koordinator Kelas Internasional'}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                    <Clock className="w-3 h-3" />
                    <span>Token: {token.token}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-white/5">
                  <button
                    onClick={() => copyTokenUrl(token.token, token.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 active:scale-95 ${
                      copiedId === token.id
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300'
                    }`}
                  >
                    {copiedId === token.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin URL</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => shareViaWhatsApp(token.token, token.label)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 transition flex items-center gap-1.5 active:scale-95"
                    title="Kirim ke WhatsApp Dosen"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <a
                    href={`/lecturer/${token.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-500/25 transition flex items-center gap-1.5 active:scale-95"
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
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default LecturerTokenManager;
