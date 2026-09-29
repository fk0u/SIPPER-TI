import { describe, expect, it } from 'vitest';
import { renderTemplate, validateTemplate } from './reminderTemplate';

describe('renderTemplate (subset Go text/template)', () => {
  const ctx = { NamaDosen: 'Pak Hendra', LinkGroup: '', Lokasi: 'Lab 3', NIM: '123', NamaMahasiswa: 'Budi' };

  it('mengganti variabel', () => {
    expect(renderTemplate('Yth. {{.NamaDosen}}', ctx)).toBe('Yth. Pak Hendra');
  });
  it('if / else if / else / end termasuk bersarang', () => {
    const tpl = '{{if .LinkGroup}}grup{{else if .Lokasi}}di {{.Lokasi}}{{else}}-{{end}} {{if .NamaMahasiswa}}KM {{.NamaMahasiswa}}{{if .NIM}} ({{.NIM}}){{end}}{{end}}';
    expect(renderTemplate(tpl, ctx)).toBe('di Lab 3 KM Budi (123)');
  });
  it('penanda trim {{- dan -}} memangkas spasi seperti Go', () => {
    expect(renderTemplate('A  \n  {{- .NIM -}}  \n  B', ctx)).toBe('A123B');
  });
  it('fungsi Go ditampilkan apa adanya', () => {
    expect(renderTemplate('{{upper .NamaDosen}}', ctx)).toBe('{{upper .NamaDosen}}');
  });
});

describe('validateTemplate (sama dengan penolakan worker & database)', () => {
  it('template valid', () => {
    expect(validateTemplate('Yth. Dr. Budi, M.T. {{if .LinkGroup}}{{.LinkGroup}}{{end}}')).toBeNull();
  });
  it('if tanpa end, end tanpa if, else tanpa if', () => {
    expect(validateTemplate('{{if .LinkGroup}}x')).toMatch(/ditutup/);
    expect(validateTemplate('x{{end}}')).toMatch(/tanpa/);
    expect(validateTemplate('{{else}}')).toMatch(/tanpa/);
  });
  it('variabel tak dikenal & kurung tidak seimbang', () => {
    expect(validateTemplate('{{.Salah}}')).toMatch(/tidak dikenal/);
    expect(validateTemplate('{{upper .Salah}}')).toMatch(/tidak dikenal/);
    expect(validateTemplate('{{.NamaDosen')).toMatch(/tidak sama/);
  });
  it('template rusak tidak dirender', () => {
    expect(renderTemplate('{{if .NIM}}x')).toBe('');
  });
});
