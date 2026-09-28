import { describe, expect, it } from 'vitest';
import { renderTemplate } from './reminderTemplate';

describe('renderTemplate (subset Go text/template)', () => {
  const ctx = { NamaDosen: 'Pak Hendra', LinkGroup: '', NIM: '123', NamaMahasiswa: 'Budi' };

  it('mengganti variabel', () => {
    expect(renderTemplate('Yth. {{.NamaDosen}}', ctx)).toBe('Yth. Pak Hendra');
  });
  it('if/else/end termasuk bersarang', () => {
    const tpl = '{{if .LinkGroup}}ada{{else}}tidak{{end}} {{if .NamaMahasiswa}}KM {{.NamaMahasiswa}}{{if .NIM}} ({{.NIM}}){{end}}{{end}}';
    expect(renderTemplate(tpl, ctx)).toBe('tidak KM Budi (123)');
  });
  it('variabel tak dikenal ditandai seperti Go', () => {
    expect(renderTemplate('{{.Salah}}', ctx)).toBe('<no value>');
  });
  it('konstruksi di luar subset ditampilkan apa adanya', () => {
    expect(renderTemplate('{{upper .NamaDosen}}', ctx)).toBe('{{upper .NamaDosen}}');
  });
});
