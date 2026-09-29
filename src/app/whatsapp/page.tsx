'use client';

import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Ban, BellRing, Copy, FlaskConical, History, Link2, LogOut, MessageSquareText, Power, RotateCcw, Save, Send, Settings2, Smartphone, Users,
} from 'lucide-react';
import { RequireRole, PageLoader } from '@/components/auth/RequireRole';
import { useAuthStore } from '@/store/useAuthStore';
import { useLeaveStore } from '@/store/useLeaveStore';
import { toast } from '@/store/useToastStore';
import * as repo from '@/lib/data/supabaseRepository';
import { TEMPLATE_VARIABLES, renderTemplate, validateTemplate } from '@/lib/reminderTemplate';
import { formatCountdown, nextReminder } from '@/lib/nextReminder';
import { Badge, Card, Empty, PageHeader, btnDanger, btnGhost, btnPrimary, errorText, inputCls, labelCls } from '@/components/ui/kit';
import type { Holiday, TemplateVersion, WaGroup, WaMessage, WaMessageStatus, WaSession, WaState, WaStats } from '@/types/database';

const STATE_UI: Record<WaState, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue' }> = {
  connected: { label: 'Terhubung', tone: 'emerald' },
  connecting: { label: 'Menghubungkan', tone: 'blue' },
  need_qr: { label: 'Menunggu scan', tone: 'amber' },
  disconnected: { label: 'Terputus', tone: 'slate' },
  logged_out: { label: 'Perangkat dikeluarkan', tone: 'rose' },
  error: { label: 'Error', tone: 'rose' },
};
const MSG_UI: Record<WaMessageStatus, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue' | 'purple' }> = {
  sent: { label: 'terkirim', tone: 'emerald' },
  pending: { label: 'antre', tone: 'amber' },
  sending: { label: 'mengirim', tone: 'blue' },
  failed: { label: 'gagal', tone: 'rose' },
  cancelled: { label: 'dibatalkan', tone: 'slate' },
  dry_run: { label: 'uji (tidak dikirim)', tone: 'purple' },
};
const WORKER_STALE_MS = 2 * 60_000;
const hhmm = (t: string) => t.slice(0, 5);

function WhatsAppCenter() {
  const { klass, refresh } = useAuthStore();
  const courses = useLeaveStore((s) => s.courses);
  const [session, setSession] = useState<WaSession | null | undefined>(undefined);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [stats, setStats] = useState<WaStats | null>(null);
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [qr, setQr] = useState<{ code: string; image: string } | null>(null);
  const [workerAlive, setWorkerAlive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pairPhone, setPairPhone] = useState('');
  const [template, setTemplate] = useState(klass?.reminder_template ?? '');
  const [settings, setSettings] = useState({
    start: hhmm(klass?.send_window_start ?? '08:00'),
    end: hhmm(klass?.send_window_end ?? '16:00'),
    dryRun: klass?.reminder_dry_run ?? false,
  });
  const [test, setTest] = useState({ to: '', body: 'Tes pesan dari SIPPER-TI.' });
  const [busy, setBusy] = useState(false);

  const poll = useCallback(
    () =>
      Promise.all([
        repo.fetchWaSession(),
        repo.fetchWaMessages(),
        // Statistik opsional: kegagalannya tidak boleh menahan status sesi
        repo.waStats().catch(() => null),
      ]).then(
        ([s, m, st]) => {
          setSession(s);
          setMessages(m);
          setStats(st);
          setNow(Date.now());
          setWorkerAlive(Boolean(s?.worker_seen_at && Date.now() - new Date(s.worker_seen_at).getTime() < WORKER_STALE_MS));
        },
        (err) => console.error('[whatsapp] gagal memuat status:', err)
      ),
    []
  );
  const loadExtras = useCallback(
    () =>
      Promise.all([repo.fetchWaGroups(), repo.fetchTemplateVersions(), repo.fetchHolidays()]).then(
        ([g, v, h]) => {
          setGroups(g);
          setVersions(v);
          setHolidays(h);
        },
        (err) => console.error('[whatsapp] gagal memuat data:', err)
      ),
    []
  );

  const connecting = Boolean(session && session.desired === 'on' && session.state !== 'connected');
  useEffect(() => {
    poll();
    const id = setInterval(poll, connecting ? 3000 : 15000);
    return () => clearInterval(id);
  }, [poll, connecting]);
  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

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
      await Promise.all([poll(), loadExtras()]);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const state: WaState = session?.state ?? 'disconnected';
  const templateDirty = template !== klass.reminder_template;
  const templateError = validateTemplate(template);
  const settingsDirty =
    settings.start !== hhmm(klass.send_window_start) || settings.end !== hhmm(klass.send_window_end) || settings.dryRun !== klass.reminder_dry_run;
  const upcoming = nextReminder(courses, holidays, { start: klass.send_window_start, end: klass.send_window_end }, new Date(now));
  const successRate = stats && stats.sent_total + stats.failed_total > 0
    ? Math.round((100 * stats.sent_total) / (stats.sent_total + stats.failed_total))
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <PageHeader
        icon={MessageSquareText}
        eyebrow={klass.name}
        title="WhatsApp Kelas"
        description="Pusat pengingat dosen (SiPenDosa): tautkan nomor WhatsApp kelas, atur jam operasional & template, pantau antrean. Pesan dikirim dengan jeda acak & simulasi mengetik."
        actions={klass.reminder_dry_run ? <Badge tone="purple"><FlaskConical className="w-3 h-3" /> Mode uji aktif</Badge> : undefined}
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          ['Terkirim hari ini', stats?.sent_today],
          ['Total terkirim', stats?.sent_total],
          ['Antrean', stats?.pending],
          ['Gagal', stats?.failed_total],
          ['Tingkat sukses', successRate === null ? '–' : `${successRate}%`],
        ].map(([label, value]) => (
          <Card key={label as string} className="!p-4">
            <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 block">{label}</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value ?? '–'}</span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Smartphone className="w-4 h-4" /> Nomor WhatsApp Kelas</h2>
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
          ) : session?.last_error ? (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">{session.last_error}</p>
          ) : null}

          {state !== 'connected' && (
            <div className="space-y-2">
              <button disabled={busy} onClick={() => act(() => repo.waRequest('on'), 'Meminta QR code...')} className={`${btnPrimary} w-full`}>
                <Power className="w-3.5 h-3.5" /> Sambungkan (scan QR)
              </button>
              <div className="flex gap-2">
                <input aria-label="Nomor WhatsApp untuk kode pairing" className={`${inputCls} font-mono`} inputMode="tel" placeholder="atau kode via nomor: 08..." value={pairPhone} onChange={(e) => setPairPhone(e.target.value)} />
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
            <input aria-label="Nomor atau grup tujuan pesan uji" className={`${inputCls} font-mono`} list="wa-groups-test" placeholder="Nomor 08... atau pilih grup" value={test.to} onChange={(e) => setTest({ ...test, to: e.target.value })} required />
            <datalist id="wa-groups-test">
              {groups.map((g) => <option key={g.jid} value={g.jid} label={`👥 ${g.name}`} />)}
            </datalist>
            <textarea aria-label="Isi pesan uji" className={inputCls} rows={2} value={test.body} onChange={(e) => setTest({ ...test, body: e.target.value })} required />
            <button disabled={busy} className={`${btnGhost} w-full`}><Send className="w-3.5 h-3.5" /> Kirim uji</button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><BellRing className="w-4 h-4 text-amber-500" /> Pengingat Berikutnya</h2>
            {upcoming ? (
              <>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{formatCountdown(upcoming.fireAt.getTime() - now)}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <strong>{upcoming.course.code}</strong> {upcoming.course.name} → {upcoming.course.lecturer?.full_name ?? upcoming.course.reminder_target ?? 'dosen'}
                  <br />
                  Dikirim {upcoming.fireAt.toLocaleString('id-ID', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }) + ' WITA'} untuk kuliah {upcoming.lectureDate}
                  {klass.reminder_dry_run && ' · mode uji: hanya dicatat'}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">Belum ada pengingat aktif. Aktifkan di menu Jadwal (pilih dosen atau tujuan, jam kirim di dalam jam operasional).</p>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Settings2 className="w-4 h-4" /> Pengaturan Pengiriman</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Jam operasional mulai</span>
                <input type="time" className={inputCls} value={settings.start} onChange={(e) => setSettings({ ...settings, start: e.target.value })} />
              </label>
              <label className="block">
                <span className={labelCls}>Sampai</span>
                <input type="time" className={inputCls} value={settings.end} onChange={(e) => setSettings({ ...settings, end: e.target.value })} />
              </label>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" className="accent-purple-600 mt-0.5" checked={settings.dryRun} onChange={(e) => setSettings({ ...settings, dryRun: e.target.checked })} />
              <span><strong>Mode uji (dry run)</strong> — pengingat otomatis dirender & dicatat di riwayat tanpa dikirim ke dosen. Cocok untuk mengecek template & jadwal.</span>
            </label>
            <button disabled={busy || !settingsDirty} onClick={() => act(async () => { await repo.updateReminderSettings(settings.start, settings.end, settings.dryRun); await refresh(); }, 'Pengaturan disimpan.')} className={btnPrimary}>
              <Save className="w-3.5 h-3.5" /> Simpan
            </button>
          </Card>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Template Pengingat</h2>
          <button disabled={busy || !templateDirty || Boolean(templateError)} onClick={() => act(async () => { await repo.setReminderTemplate(template); await refresh(); }, 'Template disimpan (versi lama masuk riwayat).')} className={btnPrimary}>
            <Save className="w-3.5 h-3.5" /> Simpan
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Isi template</span>
            <textarea className={`${inputCls} font-mono leading-relaxed`} rows={16} value={template} onChange={(e) => setTemplate(e.target.value)} />
          </label>
          <div>
            <span className={labelCls}>Pratinjau (data contoh)</span>
            <div className="whitespace-pre-wrap text-xs leading-relaxed rounded-xl p-3 bg-emerald-500/[0.07] border border-emerald-500/20 text-slate-800 dark:text-slate-200 min-h-[16rem]">
              {templateError ? (
                <span role="alert" className="text-rose-600 dark:text-rose-400">
                  Template tidak valid: {templateError} Worker tidak akan bisa mengirim pengingat dengan template ini.
                </span>
              ) : (
                renderTemplate(template)
              )}
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

        {versions.length > 0 && (
          <details className="pt-2 border-t border-slate-200/80 dark:border-white/5">
            <summary className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Riwayat versi ({versions.length})</summary>
            <ul className="mt-2 space-y-2">
              {versions.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-slate-500">{new Date(v.created_at).toLocaleString('id-ID')}</p>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate">{v.content.replace(/\s+/g, ' ').slice(0, 120)}</p>
                  </div>
                  <button onClick={() => { setTemplate(v.content); toast.info('Versi dimuat ke editor. Tekan Simpan untuk memakainya.'); }} className={`${btnGhost} !px-2 !py-1 shrink-0`}>
                    <RotateCcw className="w-3 h-3" /> Pulihkan
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {groups.length > 0 && (
        <Card className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4" /> Grup WhatsApp ({groups.length})</h2>
          <p className="text-[11px] text-slate-500">Grup yang diikuti nomor kelas. Pilih grup sebagai tujuan pengingat di form mata kuliah (menu Jadwal).</p>
          <ul className="grid sm:grid-cols-2 gap-2">
            {groups.map((g) => (
              <li key={g.jid} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
                <span className="text-xs text-slate-900 dark:text-white truncate">{g.name} <span className="text-slate-400">· {g.participants}</span></span>
                <button onClick={() => navigator.clipboard.writeText(g.jid).then(() => toast.success('ID grup disalin.'), () => toast.error('Gagal menyalin ID grup.'))} className={`${btnGhost} !px-2 !py-1`} aria-label={`Salin ID ${g.name}`}>
                  <Copy className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Riwayat & Antrean</h2>
        {messages.length === 0 ? (
          <Empty>Belum ada pesan. Aktifkan pengingat di menu Jadwal atau kirim pesan uji.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/5">
            {messages.map((m) => (
              <li key={m.id} className="py-2.5">
                <details>
                  <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer list-none">
                    <span className="font-mono text-[11px] text-slate-500 w-28 shrink-0">
                      {new Date(m.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    <span className="text-xs text-slate-900 dark:text-white flex-1 min-w-[10rem]">
                      {m.course ? `${m.course.code} · ${m.course.name}` : 'Pesan uji'}
                      <span className="block text-[10px] text-slate-500">
                        {m.recipient_name ?? '—'}{m.recipient ? ` · ${m.recipient}` : ''}{m.lecture_date ? ` · kuliah ${m.lecture_date}` : ''}
                      </span>
                    </span>
                    <Badge tone={MSG_UI[m.status].tone}>{MSG_UI[m.status].label}</Badge>
                    {m.status === 'pending' && (
                      <button onClick={(e) => { e.preventDefault(); void act(() => repo.cancelWaMessage(m.id), 'Pesan dibatalkan.'); }} className={`${btnGhost} !px-2 !py-1`} title="Batalkan">
                        <Ban className="w-3 h-3" />
                      </button>
                    )}
                    {(m.status === 'failed' || m.status === 'cancelled' || m.status === 'dry_run') && (
                      <button onClick={(e) => { e.preventDefault(); void act(() => repo.retryWaMessage(m.id), 'Pesan masuk antrean lagi.'); }} className={`${btnGhost} !px-2 !py-1`} title="Kirim ulang">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </summary>
                  {m.last_error && <p className="text-[11px] text-rose-500 mt-2">{m.last_error}</p>}
                  {m.body && (
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed rounded-xl p-3 bg-emerald-500/[0.07] border border-emerald-500/20 text-slate-800 dark:text-slate-200">{m.body}</pre>
                  )}
                </details>
              </li>
            ))}
          </ul>
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
