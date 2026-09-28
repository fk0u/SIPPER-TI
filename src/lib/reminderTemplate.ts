// Pratinjau template pengingat di browser. Worker Go merender dengan text/template asli;
// subset yang didukung di sini: {{.Var}} dan {{if .Var}}…{{else}}…{{end}} (boleh bersarang).

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
] as const;

export type TemplateContext = Record<(typeof TEMPLATE_VARIABLES)[number][0], string>;

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
};

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'var'; name: string }
  | { kind: 'if'; name: string; then: Node[]; else: Node[] };

const TOKEN = /\{\{-?\s*(.*?)\s*-?\}\}/g;

function parse(tpl: string): Node[] {
  const root: Node[] = [];
  // Tumpukan blok if yang sedang terbuka; `target` = cabang yang sedang diisi
  const stack: { node: Extract<Node, { kind: 'if' }>; target: Node[] }[] = [];
  const out = () => (stack.length ? stack[stack.length - 1].target : root);
  let last = 0;
  for (const m of tpl.matchAll(TOKEN)) {
    if (m.index! > last) out().push({ kind: 'text', value: tpl.slice(last, m.index) });
    last = m.index! + m[0].length;
    const expr = m[1];
    let g: RegExpMatchArray | null;
    if ((g = expr.match(/^if\s+\.(\w+)$/))) {
      const node: Extract<Node, { kind: 'if' }> = { kind: 'if', name: g[1], then: [], else: [] };
      out().push(node);
      stack.push({ node, target: node.then });
    } else if (expr === 'else' && stack.length) {
      stack[stack.length - 1].target = stack[stack.length - 1].node.else;
    } else if (expr === 'end' && stack.length) {
      stack.pop();
    } else if ((g = expr.match(/^\.(\w+)$/))) {
      out().push({ kind: 'var', name: g[1] });
    } else {
      out().push({ kind: 'text', value: m[0] }); // konstruksi lain: tampilkan apa adanya
    }
  }
  if (last < tpl.length) out().push({ kind: 'text', value: tpl.slice(last) });
  return root;
}

function render(nodes: Node[], ctx: Record<string, string>): string {
  return nodes
    .map((n) => {
      if (n.kind === 'text') return n.value;
      if (n.kind === 'var') return ctx[n.name] ?? `<no value>`;
      return render(ctx[n.name] ? n.then : n.else, ctx);
    })
    .join('');
}

export function renderTemplate(tpl: string, ctx: Record<string, string> = SAMPLE_CONTEXT): string {
  return render(parse(tpl), ctx);
}
