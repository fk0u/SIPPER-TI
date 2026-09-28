'use client';

import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Ban, Link2, LogOut, MessageSquareText, Power, Save, Send, Smartphone } from 'lucide-react';
import { RequireRole, PageLoader } from '@/components/auth/RequireRole';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { TEMPLATE_VARIABLES, renderTemplate } from '@/lib/reminderTemplate';
import { Badge, Card, Empty, PageHeader, btnDanger, btnGhost, btnPrimary, errorText, inputCls, labelCls } from '@/components/ui/kit';
import type { WaMessage, WaMessageStatus, WaSession, WaState } from '@/types/database';

const STATE_UI: Record<WaState, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue' }> = {
  connected: { label: 'Terhubung', tone: 'emerald' },
  connecting: { label: 'Menghubungkan', tone: 'blue' },
  need_qr: { label: 'Menunggu scan', tone: 'amber' },
  disconnected: { label: 'Terputus', tone: 'slate' },
  logged_out: { label: 'Perangkat dikeluarkan', tone: 'rose' },
  error: { label: 'Error', tone: 'rose' },
};
const MSG_TONE: Record<WaMessageStatus, 'emerald' | 'amber' | 'rose' | 'slate' | 'blue'> = {
  sent: 'emerald', pending: 'amber', sending: 'blue', failed: 'rose', cancelled: 'slate',
};
const WORKER_STALE_MS = 2 * 60_000;

function WhatsAppCenter() {
  const { klass, refresh } = useAuthStore();
  const [session, setSession] = useState<WaSession | null | undefined>(undefined);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [qr, setQr] = useState<{ code: string; image: string } | null>(null);
  const [workerAlive, setWorkerAlive] = useState(false);
  const [pairPhone, setPairPhone] = useState('');
  const [template, setTemplate] = useState(klass?.reminder_template ?? '');
  const [test, setTest] = useState({ to: '', body: 'Tes pesan dari SIPPER-TI.' });
  const [busy, setBusy] = useState(false);

  const poll = useCallback(
    () =>
      Promise.all([repo.fetchWaSession(), repo.fetchWaMessages()]).then(
        ([s, m]) => {
          setSession(s);
          setMessages(m);
          setWorkerAlive(Boolean(s?.worker_seen_at && Date.now() - new Date(s.worker_seen_at).getTime() < WORKER_STALE_MS));
        },
        (err) => console.error('[whatsapp] gagal memuat status:', err)
      ),
    []
  );

  const connecting = Boolean(session && session.desired === 'on' && session.state !== 'connected');
  useEffect(() => {
    poll();
    const id = setInterval(poll, connecting ? 3000 : 15000);
    return () => clearInterval(id);
  }, [poll, connecting]);

  const qrCode = session?.state === 'need_qr' ? session.qr_code : null;
  useEffect(() => {
    if (qrCode) {
      QRCode.toDataURL(qrCode, { width: 280, margin: 1 }).then((image) => setQr({ code: qrCode, image }), () => setQr(null));
    }
  }, [qrCode]);
  const qrImage = qr && qr.code === qrCode ? qr.image : '';

  if (session === undefined || !klass) return <PageLoader label="Memuat status WhatsApp..." />;

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await poll();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const state: WaState = session?.state ?? 'disconnected';
  const templateDirty = template !== klass.reminder_template;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <PageHeader
        icon={MessageSquareText}
        eyebrow={klass.name}
        title="WhatsApp Kelas"
        description="Hubungkan nomor WhatsApp kelas (milik Sipen/KM) untuk mengirim pengingat kuliah otomatis ke dosen, seperti SiPenDosa. Pesan dikirim dengan jeda acak & simulasi mengetik agar aman dari spam-filter."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Smartphone className="w-4 h-4" /> Status</h2>
            <Badge tone={STATE_UI[state].tone}>{STATE_UI[state].label}</Badge>
          </div>

          {session && !workerAlive && session.desired !== 'off' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5">
              Layanan pengirim (worker) belum merespons. Status akan diperbarui begitu worker aktif.
            </p>
          )}

          {state === 'connected' ? (
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p>Nomor: <span className="font-mono text-slate-900 dark:text-white">+{session?.device_jid?.split(/[:@]/)[0]}</span></p>
              {session?.push_name && <p>Nama: {session.push_name}</p>}
            </div>
          ) : qrImage ? (
            <div className="text-center space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImage} alt="QR login WhatsApp" className="mx-auto rounded-xl bg-white p-2 w-56 h-56" />
              <p className="text-[11px] text-slate-500">WhatsApp → Perangkat tertaut → Tautkan perangkat → scan QR ini.</p>
            </div>
          ) : session?.pair_code ? (
            <div className="text-center space-y-1">
              <p className="text-[11px] text-slate-500">Masukkan kode ini di WhatsApp → Perangkat tertaut → Tautkan dengan nomor telepon:</p>
              <p className="text-2xl font-mono font-bold tracking-[0.3em] text-slate-900 dark:text-white">{session.pair_code}</p>
            </div>
          ) : state === 'error' && session?.last_error ? (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">{session.last_error}</p>
          ) : null}

          {state !== 'connected' && (
            <div className="space-y-2">
              <button disabled={busy} onClick={() => act(() => repo.waRequest('on'), 'Meminta QR code...')} className={`${btnPrimary} w-full`}>
                <Power className="w-3.5 h-3.5" /> Sambungkan (scan QR)
              </button>
              <div className="flex gap-2">
                <input className={`${inputCls} font-mono`} inputMode="tel" placeholder="atau kode via nomor: 08..." value={pairPhone} onChange={(e) => setPairPhone(e.target.value)} />
                <button disabled={busy || pairPhone.trim().length < 9} onClick={() => act(() => repo.waRequest('on', pairPhone), 'Meminta kode pairing...')} className={btnGhost}>
                  <Link2 className="w-3.5 h-3.5" /> Kode
                </button>
              </div>
            </div>
          )}
          {session && session.desired !== 'off' && (
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => act(() => repo.waRequest('off'), 'Koneksi diputus (sesi tetap tersimpan).')} className={`${btnGhost} flex-1`}>
                <Power className="w-3.5 h-3.5" /> Putuskan
              </button>
              <button disabled={busy} onClick={() => window.confirm('Keluarkan perangkat? Harus scan QR ulang untuk menyambung lagi.') && act(() => repo.waRequest('logout'), 'Perangkat dikeluarkan.')} className={btnDanger}>
                <LogOut className="w-3.5 h-3.5" /> Keluarkan
              </button>
            </div>
          )}

          <form
            className="pt-3 border-t border-slate-200/80 dark:border-white/5 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act(() => repo.queueTestMessage(test.to, test.body), 'Pesan uji masuk antrean.');
            }}
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Kirim pesan uji</p>
            <input className={`${inputCls} font-mono`} inputMode="tel" placeholder="Nomor tujuan 08..." value={test.to} onChange={(e) => setTest({ ...test, to: e.target.value })} required />
            <textarea className={inputCls} rows={2} value={test.body} onChange={(e) => setTest({ ...test, body: e.target.value })} required />
            <button disabled={busy} className={`${btnGhost} w-full`}><Send className="w-3.5 h-3.5" /> Kirim uji</button>
          </form>
        </Card>

        <Card className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Template Pengingat</h2>
            <button disabled={busy || !templateDirty} onClick={() => act(async () => { await repo.setReminderTemplate(template); await refresh(); }, 'Template disimpan.')} className={btnPrimary}>
              <Save className="w-3.5 h-3.5" /> Simpan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Isi template</label>
              <textarea className={`${inputCls} font-mono leading-relaxed`} rows={16} value={template} onChange={(e) => setTemplate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Pratinjau (data contoh)</label>
              <div className="whitespace-pre-wrap text-xs leading-relaxed rounded-xl p-3 bg-emerald-500/[0.07] border border-emerald-500/20 text-slate-800 dark:text-slate-200 min-h-[16rem]">
                {renderTemplate(template)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map(([name, desc]) => (
              <button key={name} type="button" title={desc} onClick={() => setTemplate((t) => `${t}{{.${name}}}`)}
                className="text-[10px] font-mono px-2 py-1 rounded-md border border-slate-300/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-blue-500/50">
                {`{{.${name}}}`}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">Blok opsional: <code className="font-mono">{'{{if .LinkGroup}}…{{end}}'}</code> hanya tampil bila datanya ada.</p>
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Riwayat & Antrean</h2>
        {messages.length === 0 ? (
          <Empty>Belum ada pesan. Aktifkan pengingat di menu Jadwal atau kirim pesan uji.</Empty>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2 py-2">Dibuat</th><th className="px-2 py-2">Mata kuliah</th><th className="px-2 py-2">Tujuan</th>
                  <th className="px-2 py-2">Status</th><th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-white/5">
                {messages.map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="px-2 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-2 py-2 text-slate-900 dark:text-white">
                      {m.course ? `${m.course.code} · ${m.course.name}` : 'Pesan uji'}
                      {m.lecture_date && <span className="block text-[10px] text-slate-500">kuliah {m.lecture_date}</span>}
                    </td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-400">
                      {m.recipient_name ?? '—'}
                      {m.recipient && <span className="block font-mono text-[10px]">{m.recipient}</span>}
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={MSG_TONE[m.status]}>{m.status}</Badge>
                      {m.last_error && <span className="block text-[10px] text-rose-500 mt-1 max-w-[16rem]">{m.last_error}</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {m.status === 'pending' && (
                        <button onClick={() => act(() => repo.cancelWaMessage(m.id), 'Pesan dibatalkan.')} className={`${btnGhost} !px-2 !py-1`} title="Batalkan">
                          <Ban className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function WhatsAppPage() {
  return (
    <div className="py-4 sm:py-6">
      <RequireRole roles={['km', 'sipen']}>
        <WhatsAppCenter />
      </RequireRole>
    </div>
  );
}
