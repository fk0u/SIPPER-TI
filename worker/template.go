package main

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"
	"text/template"
	"time"

	"go.mau.fi/whatsmeow/types"
)

var indonesianDays = []string{"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"}
var indonesianMonths = []string{"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
	"Juli", "Agustus", "September", "Oktober", "November", "Desember"}

// Variabel template (kompatibel SiPenDosa + Kode & Kelas). Daftar yang sama ada di
// src/lib/reminderTemplate.ts untuk pratinjau web.
type TemplateContext struct {
	NamaDosen, Matkul, Kode, Hari, Tanggal, JamMulai, JamSelesai string
	Lokasi, LinkGroup, Kelas, NamaMahasiswa, NIM                 string
	HariDalamBahasa, WaktuSekarang                               string // alias lama SiPenDosa
}

var templateFuncs = template.FuncMap{
	"upper": strings.ToUpper,
	"lower": strings.ToLower,
	"trim":  strings.TrimSpace,
	"default": func(def, val string) string {
		if strings.TrimSpace(val) == "" {
			return def
		}
		return val
	},
}

func renderTemplate(tpl string, ctx TemplateContext) (string, error) {
	t, err := template.New("pengingat").Funcs(templateFuncs).Parse(tpl)
	if err != nil {
		return "", fmt.Errorf("template tidak valid: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, ctx); err != nil {
		return "", fmt.Errorf("gagal merender template: %w", err)
	}
	return strings.TrimSpace(buf.String()), nil
}

// formatIndonesianDate: "5 Oktober 2026"
func formatIndonesianDate(t time.Time) string {
	return fmt.Sprintf("%d %s %d", t.Day(), indonesianMonths[t.Month()], t.Year())
}

var nonDigit = regexp.MustCompile(`\D`)

// formatJID menormalkan nomor Indonesia (08…, +62…, 8…) atau JID grup menjadi JID WhatsApp.
func formatJID(target string) (types.JID, error) {
	target = strings.TrimSpace(target)
	if strings.Contains(target, "@") {
		return types.ParseJID(target)
	}
	d := nonDigit.ReplaceAllString(target, "")
	switch {
	case strings.HasPrefix(d, "0"):
		d = "62" + d[1:]
	case strings.HasPrefix(d, "8"):
		d = "62" + d
	}
	if len(d) < 10 || len(d) > 15 {
		return types.EmptyJID, fmt.Errorf("nomor WhatsApp tidak valid: %q", target)
	}
	return types.NewJID(d, types.DefaultUserServer), nil
}
