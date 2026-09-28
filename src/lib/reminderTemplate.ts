// Pratinjau & validasi template pengingat di browser. Worker Go merender dengan text/template asli;
// subset yang didukung di sini: {{.Var}}, {{if .Var}}…{{else if .Var}}…{{else}}…{{end}} (bersarang)
// dan penanda trim {{- / -}}. Aturan validasinya sama dengan assert_valid_template() di database.

export const TEMPLATE_VARIABLES = [
  ['NamaDosen', 'Nama dosen pengampu'],
  ['Matkul', 'Nama mata kuliah'],
  ['Kode', 'Kode mata kuliah'],
  ['Hari', 'Hari kuliah'],
  ['Tanggal', 'Tanggal kuliah, mis. 5 Oktober 2026'],
  ['JamMulai', 'Jam mulai'],
  ['JamSelesai', 'Jam selesai'],
  ['Lokasi', 'Ruang'],
  ['LinkGroup', 'Tautan grup / kelas online'],
  ['Kelas', 'Nama kelas'],
  ['NamaMahasiswa', 'Nama KM kelas'],
  ['NIM', 'NIM KM kelas'],
  ['HariDalamBahasa', 'Alias SiPenDosa untuk Hari'],
  ['WaktuSekarang', 'Jam saat pesan dibuat, mis. 08:00 WITA'],
] as const;

export type TemplateContext = Record<(typeof TEMPLATE_VARIABLES)[number][0], string>;
const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map(([name]) => name));

export const SAMPLE_CONTEXT: TemplateContext = {
  NamaDosen: 'Dr. Hendra Gunawan, M.T.',
  Matkul: 'Cloud Computing',
  Kode: 'TI-401',
  Hari: 'Senin',
  Tanggal: '5 Oktober 2026',
  JamMulai: '08:00',
  JamSelesai: '09:40',
  Lokasi: 'Lab Komputer 3',
  LinkGroup: 'https://chat.whatsapp.com/contoh',
  Kelas: 'TI Internasional 2026',
  NamaMahasiswa: 'Budi Santoso',
  NIM: '2611102441003',
  HariDalamBahasa: 'Senin',
  WaktuSekarang: '08:00 WITA',
};

type IfNode = { kind: 'if'; branches: { cond: string | null; body: Node[] }[] };
type Node = { kind: 'text'; value: string } | { kind: 'var'; name: string } | IfNode;

// Go: "{{- " memangkas spasi sebelum aksi, " -}}" memangkas spasi sesudahnya
const TOKEN = /\{\{(-\s)?\s*([\s\S]*?)\s*(\s-)?\}\}/g;

function parse(tpl: string): { nodes: Node[]; error: string | null } {
  const root: Node[] = [];
  const stack: IfNode[] = [];
  const out = () => (stack.length ? stack[stack.length - 1].branches.at(-1)!.body : root);
  const fail = (error: string) => ({ nodes: root, error });

  if ((tpl.match(/\{\{/g) ?? []).length !== (tpl.match(/\}\}/g) ?? []).length) {
    return fail('Jumlah {{ dan }} tidak sama.');
  }

  let last = 0;
  let trimNext = false;
  const pushText = (text: string, trimEnd: boolean) => {
    if (trimNext) text = text.replace(/^\s+/, '');
    if (trimEnd) text = text.replace(/\s+$/, '');
    if (text) out().push({ kind: 'text', value: text });
  };

  for (const m of tpl.matchAll(TOKEN)) {
    pushText(tpl.slice(last, m.index), Boolean(m[1]));
    last = m.index! + m[0].length;
    trimNext = Boolean(m[3]);
    const expr = m[2];

    for (const [, field] of expr.matchAll(/\.([A-Za-z_]\w*)/g)) {
      if (!KNOWN.has(field)) return fail(`Variabel .${field} tidak dikenal.`);
    }

    let g: RegExpMatchArray | null;
    if ((g = expr.match(/^if\s+\.(\w+)$/))) {
      const node: IfNode = { kind: 'if', branches: [{ cond: g[1], body: [] }] };
      out().push(node);
      stack.push(node);
    } else if ((g = expr.match(/^else\s+if\s+\.(\w+)$/)) || expr === 'else') {
      if (!stack.length) return fail(`{{${expr}}} tanpa {{if}}.`);
      stack[stack.length - 1].branches.push({ cond: g ? g[1] : null, body: [] });
    } else if (expr === 'end') {
      if (!stack.length) return fail('{{end}} tanpa {{if}}.');
      stack.pop();
    } else if ((g = expr.match(/^\.(\w+)$/))) {
      out().push({ kind: 'var', name: g[1] });
    } else {
      out().push({ kind: 'text', value: m[0] }); // fungsi Go (upper, default, …): tampilkan apa adanya
    }
  }
  pushText(tpl.slice(last), false);
  if (stack.length) return fail('Setiap {{if}} harus ditutup {{end}}.');
  return { nodes: root, error: null };
}

function render(nodes: Node[], ctx: Record<string, string>): string {
  return nodes
    .map((n) => {
      if (n.kind === 'text') return n.value;
      if (n.kind === 'var') return ctx[n.name] ?? '';
      const branch = n.branches.find((b) => b.cond === null || Boolean(ctx[b.cond]));
      return branch ? render(branch.body, ctx) : '';
    })
    .join('');
}

/** Pesan error bila template akan ditolak worker / database, selain itu null. */
export function validateTemplate(tpl: string): string | null {
  return parse(tpl).error;
}

export function renderTemplate(tpl: string, ctx: Record<string, string> = SAMPLE_CONTEXT): string {
  const { nodes, error } = parse(tpl);
  return error ? '' : render(nodes, ctx);
}
