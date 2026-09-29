package main

import (
	"os"
	"regexp"
	"strings"
	"testing"
	"time"
)

func TestFormatJID(t *testing.T) {
	cases := map[string]string{
		"081234567890":            "6281234567890@s.whatsapp.net",
		"+62 812-3456-7890":       "6281234567890@s.whatsapp.net",
		"81234567890":             "6281234567890@s.whatsapp.net",
		"120363023456789012@g.us": "120363023456789012@g.us",
	}
	for in, want := range cases {
		got, err := formatJID(in)
		if err != nil || got.String() != want {
			t.Errorf("formatJID(%q) = %v, %v; want %s", in, got, err, want)
		}
	}
	if _, err := formatJID("123"); err == nil {
		t.Error("nomor pendek harus ditolak")
	}
}

// defaultTemplate membaca template bawaan kolom classes.reminder_template dari migrasi,
// sehingga perubahan template bawaan yang tidak bisa dirender worker ikut tertangkap.
func defaultTemplate(t *testing.T) string {
	t.Helper()
	src, err := os.ReadFile("../supabase/migrations/20260928_multi_class_platform.sql")
	if err != nil {
		t.Fatal(err)
	}
	m := regexp.MustCompile(`(?s)\$tpl\$(.*?)\$tpl\$`).FindSubmatch(src)
	if m == nil {
		t.Fatal("template bawaan tidak ditemukan di migrasi")
	}
	return string(m[1])
}

func TestRenderTemplate(t *testing.T) {
	out, err := renderTemplate(defaultTemplate(t), TemplateContext{
		NamaDosen: "Dr. Hendra", Matkul: "Cloud", Hari: "Senin", Tanggal: formatIndonesianDate(time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)),
		JamMulai: "08:00", JamSelesai: "09:40", Lokasi: "Lab 3", Kelas: "TI Intl", NamaMahasiswa: "Budi", NIM: "123",
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Yth. Bapak/Ibu Dr. Hendra", "kelas TI Intl", "Senin, 5 Oktober 2026", "Ketua Kelas: Budi (123)"} {
		if !strings.Contains(out, want) {
			t.Errorf("hasil tidak memuat %q:\n%s", want, out)
		}
	}
	if strings.Contains(out, "Tautan Kelas") {
		t.Error("blok LinkGroup kosong harus hilang")
	}
	if _, err := renderTemplate("{{.Salah", TemplateContext{}); err == nil {
		t.Error("template rusak harus error")
	}
}
