import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { fetchLecturerPortal } from '@/lib/publicPortal';
import { createAdminClient } from '@/lib/supabase/admin';
import { ATTACHMENT_BUCKET } from '@/lib/supabase/config';
import { sanitizeFileName } from '@/lib/attachments';
import { LEAVE_TYPE_META } from '@/lib/leaveTypes';
import { filterPortalLeaves, leaveMeetings, leaveTimeLabel, parseFilterQuery } from '@/lib/lecturerPortal';
import { todayWITA } from '@/lib/date';

// ponytail: semua lampiran dimuat ke memori; cukup untuk rekap 180 hari (maks. 5MB/berkas).
// Bila ZIP membesar, ganti ke streaming (archiver) atau batasi per mata kuliah.
const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/**
 * Export rekap izin portal dosen.
 *   ?format=xlsx → hanya Excel (lampiran = tautan ke portal)
 *   default      → ZIP berisi Excel + folder lampiran/ (tautan relatif di Excel)
 * Filter sama dengan tampilan: course, from, to, q, type.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(request.url);
  const portal = await fetchLecturerPortal(token);
  if (portal.status !== 'ok') {
    return new Response('Portal tidak ditemukan.', { status: portal.status === 'not_found' ? 404 : 503 });
  }
  const zipMode = url.searchParams.get('format') !== 'xlsx';
  const leaves = filterPortalLeaves(portal.leaves, parseFilterQuery(url.searchParams));
  const courseById = new Map(portal.courses.map((c) => [c.id, c]));
  const holidays = portal.holidays.map((h) => h.date);
  const origin = process.env.APP_ORIGIN || url.origin;

  const zip = zipMode ? new JSZip() : null;
  const admin = zipMode ? createAdminClient() : null;
  const zipped = new Map<string, string>(); // path storage → nama di ZIP (lampiran batch dipakai bersama)
  let zipBytes = 0;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIPPER-TI';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Rekap Izin', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'NIM', key: 'nim', width: 16 },
    { header: 'Nama', key: 'name', width: 28 },
    { header: 'Kelas', key: 'klass', width: 14 },
    { header: 'Kode MK', key: 'code', width: 10 },
    { header: 'Mata Kuliah', key: 'course', width: 28 },
    { header: 'Jenis', key: 'type', width: 14 },
    { header: 'Mulai', key: 'start', width: 12 },
    { header: 'Selesai', key: 'end', width: 12 },
    { header: 'Waktu', key: 'time', width: 13 },
    { header: 'Pertemuan', key: 'meetings', width: 10 },
    { header: 'Alasan', key: 'reason', width: 45 },
    { header: 'Diverifikasi oleh', key: 'verifier', width: 22 },
    { header: 'Diverifikasi pada', key: 'verified', width: 18 },
    { header: 'Lampiran', key: 'files', width: 40 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

  for (const [n, l] of leaves.entries()) {
    const c = courseById.get(l.course_id);
    const row = sheet.addRow({
      no: n + 1,
      nim: l.student_nim,
      name: l.student_name,
      klass: c?.class_name ?? '',
      code: c?.code ?? '',
      course: c?.name ?? '',
      type: LEAVE_TYPE_META[l.leave_type]?.label ?? l.leave_type,
      start: l.start_date,
      end: l.end_date,
      time: leaveTimeLabel(l),
      meetings: leaveMeetings(l, c, holidays),
      reason: l.reason,
      verifier: l.verifier_name ?? '',
      verified: l.verified_at ? new Date(l.verified_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }) : '',
      files: '',
    });
    row.getCell('reason').alignment = { wrapText: true, vertical: 'top' };

    const links: { text: string; target: string }[] = [];
    for (const [i, f] of l.files.entries()) {
      const portalLink = `${origin}/dosen/${token}/lampiran/${l.id}/${i}`;
      if (!zip || !admin) {
        links.push({ text: f.name, target: portalLink });
        continue;
      }
      const { data: meta } = await admin.rpc('lecturer_attachment', { p_token: token, p_leave: l.id, p_index: i });
      const path = meta?.path as string | undefined;
      if (!path) continue;
      let entry = zipped.get(path);
      if (!entry && zipBytes + (f.size ?? 0) <= MAX_ZIP_BYTES) {
        const { data: blob } = await admin.storage.from(ATTACHMENT_BUCKET).download(path);
        if (blob) {
          // Seluruh nama disanitasi (kode MK / NIM bisa berisi "/" → cegah zip-slip)
          entry = `lampiran/${sanitizeFileName(`${l.student_nim}_${c?.code ?? 'MK'}_${zipped.size + 1}_${f.name}`)}`;
          zip.file(entry, await blob.arrayBuffer());
          zipBytes += blob.size;
          zipped.set(path, entry);
        }
      }
      // Tidak masuk ZIP (gagal unduh / melebihi batas) → tautan portal
      links.push(entry ? { text: f.name, target: entry } : { text: `${f.name} (online)`, target: portalLink });
    }
    const cell = row.getCell('files');
    if (links.length === 1) {
      cell.value = { text: links[0].text, hyperlink: links[0].target };
      cell.font = { color: { argb: 'FF2563EB' }, underline: true };
    } else if (links.length > 1) {
      // Satu sel hanya bisa satu hyperlink: daftar nama, tautan per berkas di kolom berikutnya
      cell.value = links.map((x) => x.text).join('\n');
      cell.alignment = { wrapText: true, vertical: 'top' };
      links.forEach((x, k) => {
        const extra = row.getCell(16 + k);
        extra.value = { text: `Lampiran ${k + 1}`, hyperlink: x.target };
        extra.font = { color: { argb: 'FF2563EB' }, underline: true };
      });
    }
  }
  sheet.autoFilter = { from: 'A1', to: 'O1' };

  // Ringkasan per mahasiswa × mata kuliah
  const summary = wb.addWorksheet('Ringkasan', { views: [{ state: 'frozen', ySplit: 1 }] });
  summary.columns = [
    { header: 'NIM', key: 'nim', width: 16 },
    { header: 'Nama', key: 'name', width: 28 },
    { header: 'Kelas', key: 'klass', width: 14 },
    { header: 'Mata Kuliah', key: 'course', width: 32 },
    { header: 'Jumlah Izin', key: 'count', width: 12 },
    { header: 'Pertemuan Izin', key: 'meetings', width: 15 },
    { header: 'Sakit', key: 'sakit', width: 8 },
    { header: 'Izin Pribadi', key: 'izin_biasa', width: 12 },
    { header: 'Keluar Kampus', key: 'keluar_kampus', width: 14 },
    { header: 'Acara Kampus', key: 'acara_kampus', width: 13 },
  ];
  summary.getRow(1).font = { bold: true };
  const agg = new Map<string, Record<string, string | number>>();
  for (const l of leaves) {
    const c = courseById.get(l.course_id);
    const key = `${l.student_nim}|${l.course_id}`;
    const r = agg.get(key) ?? {
      nim: l.student_nim, name: l.student_name, klass: c?.class_name ?? '',
      course: c ? `${c.code} — ${c.name}` : '', count: 0, meetings: 0,
      sakit: 0, izin_biasa: 0, keluar_kampus: 0, acara_kampus: 0,
    };
    r.count = Number(r.count) + 1;
    r.meetings = Number(r.meetings) + leaveMeetings(l, c, holidays);
    r[l.leave_type] = Number(r[l.leave_type] ?? 0) + 1;
    agg.set(key, r);
  }
  [...agg.values()]
    .sort((a, b) => String(a.course).localeCompare(String(b.course)) || String(a.name).localeCompare(String(b.name)))
    .forEach((r) => summary.addRow(r));

  const info = wb.addWorksheet('Info');
  info.addRows([
    ['Dosen', portal.lecturer.full_name],
    ['Diekspor', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' }) + ' WITA'],
    ['Cakupan', 'Izin disetujui Sipen/KM, 180 hari terakhir'],
    ['Jumlah baris', leaves.length],
    ['Catatan', zip ? 'Buka tautan lampiran setelah ZIP diekstrak (folder lampiran/).' : 'Tautan lampiran membuka portal dosen.'],
  ]);
  info.getColumn(1).font = { bold: true };
  info.getColumn(1).width = 16;
  info.getColumn(2).width = 60;

  const xlsx = await wb.xlsx.writeBuffer();
  const base = `rekap-izin-${todayWITA()}`;
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (!zip) {
    return new Response(xlsx, {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${base}.xlsx"`,
      },
    });
  }
  zip.file(`${base}.xlsx`, xlsx);
  const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return new Response(out, {
    headers: {
      ...headers,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${base}.zip"`,
    },
  });
}
