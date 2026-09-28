'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, GraduationCap, MessageCircle, Pencil, Plus, QrCode, RefreshCw, Save, X } from 'lucide-react';
import { RequireRole, PageLoader } from '@/components/auth/RequireRole';
import { QRCodeModal } from '@/components/admin/QRCodeModal';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { Badge, Card, Empty, PageHeader, btnGhost, btnPrimary, errorText, inputCls, labelCls } from '@/components/ui/kit';
import type { Lecturer } from '@/types/database';

const portalUrl = (token: string) => `${window.location.origin}/dosen/${token}`;

function LecturerManager() {
  const klass = useAuthStore((s) => s.klass);
  const [lecturers, setLecturers] = useState<Lecturer[] | null>(null);
  const [form, setForm] = useState<{ id: string | null; name: string; phone: string; email: string } | null>(null);
  const [qr, setQr] = useState<Lecturer | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      repo.getClassLecturers().then(setLecturers, (err) => {
        toast.error(errorText(err, 'Gagal memuat daftar dosen.'));
        setLecturers([]);
      }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!lecturers) return <PageLoader label="Memuat dosen..." />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      await repo.saveLecturer(form.id, form.name, form.phone, form.email);
      toast.success(form.id ? 'Data dosen diperbarui.' : 'Dosen ditambahkan (dosen dengan nomor sama dipakai bersama antarkelas).');
      setForm(null);
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (l: Lecturer) => {
    try {
      await navigator.clipboard.writeText(portalUrl(l.access_token));
      setCopiedId(l.id);
      toast.success('Link dosen disalin.');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Gagal menyalin. Buka link lalu salin dari address bar.');
    }
  };

  const sendWhatsApp = (l: Lecturer) => {
    const text = encodeURIComponent(
      `Assalamu'alaikum Bapak/Ibu ${l.full_name},\n\nBerikut tautan pribadi untuk melihat jadwal mengajar Bapak/Ibu di semua kelas beserta rekap izin mahasiswa (tanpa login):\n${portalUrl(l.access_token)}\n\nJadwal juga bisa ditambahkan ke kalender HP dari halaman tersebut. Terima kasih.`
    );
    window.open(`https://api.whatsapp.com/send?phone=${l.phone}&text=${text}`, '_blank');
  };

  const regenerate = async (l: Lecturer) => {
    if (!window.confirm(`Buat link baru untuk ${l.full_name}? Link lama langsung tidak berlaku untuk semua kelas.`)) return;
    try {
      await repo.regenerateLecturerToken(l.id);
      await load();
      toast.success('Link baru dibuat. Kirim ulang ke dosen.');
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <PageHeader
        icon={GraduationCap}
        eyebrow={klass?.name ?? 'Kelas'}
        title="Dosen & Link Pribadi"
        description="Setiap dosen punya satu link tanpa login berisi jadwal mengajarnya di semua kelas, rekap izin mahasiswa, dan kalender untuk HP. Dosen dikenali dari nomor WhatsApp, jadi dosen yang sama tidak dobel antarkelas."
        actions={!form ? <button onClick={() => setForm({ id: null, name: '', phone: '', email: '' })} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Dosen</button> : undefined}
      />

      {form && (
        <Card>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-6 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{form.id ? 'Ubah Dosen' : 'Tambah Dosen'}</h2>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400" aria-label="Tutup"><X className="w-4 h-4" /></button>
            </div>
            <label className="sm:col-span-3 block">
              <span className={labelCls}>Nama & gelar</span>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={3} />
            </label>
            <label className="sm:col-span-3 block">
              <span className={labelCls}>No. WhatsApp</span>
              <input className={`${inputCls} font-mono`} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="0812..." />
            </label>
            <label className="sm:col-span-4 block">
              <span className={labelCls}>Email (opsional)</span>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <div className="sm:col-span-2 flex items-end">
              <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}><Save className="w-3.5 h-3.5" /> Simpan</button>
            </div>
          </form>
        </Card>
      )}

      <Card className="space-y-3">
        {lecturers.length === 0 ? (
          <Empty>Belum ada dosen. Tambahkan di sini atau saat mengisi jadwal.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/5">
            {lecturers.map((l) => (
              <li key={l.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    {l.full_name} <Badge tone={l.course_count > 0 ? 'blue' : 'slate'}>{l.course_count} matkul</Badge>
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">+{l.phone}{l.email ? ` · ${l.email}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => copy(l)} className={btnGhost} title="Salin link">
                    {copiedId === l.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={`/dosen/${l.access_token}`} target="_blank" rel="noreferrer" className={btnGhost} title="Buka portal dosen"><ExternalLink className="w-3.5 h-3.5" /></a>
                  <button onClick={() => setQr(l)} className={btnGhost} title="QR Code"><QrCode className="w-3.5 h-3.5" /></button>
                  <button onClick={() => sendWhatsApp(l)} className={btnGhost} title="Kirim ke WhatsApp dosen"><MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> Kirim</button>
                  <button onClick={() => regenerate(l)} className={btnGhost} title="Buat link baru (link lama mati)"><RefreshCw className="w-3.5 h-3.5" /></button>
                  {l.can_edit && (
                    <button onClick={() => setForm({ id: l.id, name: l.full_name, phone: l.phone, email: l.email ?? '' })} className={btnGhost} title="Ubah data dosen"><Pencil className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <QRCodeModal
        isOpen={Boolean(qr)}
        onClose={() => setQr(null)}
        url={qr ? portalUrl(qr.access_token) : ''}
        title={qr ? `Portal ${qr.full_name}` : ''}
      />
    </div>
  );
}

export default function LecturerAdminPage() {
  return (
    <div className="py-4 sm:py-6">
      <RequireRole roles={['km', 'sipen']}>
        <LecturerManager />
      </RequireRole>
    </div>
  );
}
