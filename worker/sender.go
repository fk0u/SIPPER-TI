package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

const (
	maxAttempts   = 3
	pendingExpiry = 12 * time.Hour // pengingat basi tidak dikirim lagi
	maxBodyRunes  = 4000           // sama dengan CHECK wa_messages.body
)

// Sender mengirim antrean wa_messages per kelas, satu pesan per kelas per giliran,
// dengan jeda acak antar pesan (anti-spam SiPenDosa).
type Sender struct {
	db       *sql.DB
	sessions *Sessions
	loc      *time.Location
	nextSend map[string]time.Time
}

func NewSender(db *sql.DB, sessions *Sessions, loc *time.Location) *Sender {
	return &Sender{db: db, sessions: sessions, loc: loc, nextSend: map[string]time.Time{}}
}

type queued struct {
	id          int64
	classID     string
	courseID    sql.NullString
	lectureDate sql.NullTime
	recipient   sql.NullString
	name        sql.NullString
	body        sql.NullString
	attempts    int
}

// Recover: pesan yang tertinggal "sending" saat worker mati dikembalikan ke antrean.
func (s *Sender) Recover(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, "UPDATE wa_messages SET status = 'pending' WHERE status = 'sending'")
	return err
}

func (s *Sender) Tick(ctx context.Context) {
	if _, err := s.db.ExecContext(ctx, `UPDATE wa_messages SET status = 'failed',
		last_error = 'Kedaluwarsa: WhatsApp kelas tidak terhubung saat jadwal kirim.'
		WHERE status = 'pending' AND created_at < now() - $1::interval`, fmt.Sprintf("%d seconds", int(pendingExpiry.Seconds()))); err != nil {
		slog.Error("gagal menandai pesan kedaluwarsa", "err", err)
	}

	rows, err := s.db.QueryContext(ctx, `SELECT DISTINCT m.class_id, k.reminder_dry_run FROM wa_messages m
		JOIN classes k ON k.id = m.class_id WHERE m.status = 'pending' AND m.send_after <= now()`)
	if err != nil {
		slog.Error("gagal membaca antrean", "err", err)
		return
	}
	type classQueue struct {
		id     string
		dryRun bool
	}
	var classes []classQueue
	for rows.Next() {
		var q classQueue
		if err := rows.Scan(&q.id, &q.dryRun); err != nil {
			slog.Error("gagal membaca antrean", "err", err)
			continue
		}
		classes = append(classes, q)
	}
	if err := rows.Err(); err != nil {
		slog.Error("antrean terbaca sebagian", "err", err)
	}
	rows.Close()

	for _, q := range classes {
		if time.Now().Before(s.nextSend[q.id]) {
			continue
		}
		cli := s.sessions.Connected(q.id)
		if cli == nil && !q.dryRun {
			continue // tunggu WhatsApp kelas terhubung
		}
		if s.sendOne(ctx, q.id, cli, q.dryRun) {
			s.nextSend[q.id] = time.Now().Add(time.Duration(5+rand.IntN(11)) * time.Second)
		}
	}
}

// sendOne mengklaim satu pesan (FOR UPDATE SKIP LOCKED) lalu mengirimnya. true bila ada pesan.
// Pengingat hanya dikirim di dalam jam operasional kelas; tanpa klien WA (mode dry run)
// hanya pengingat yang diproses. cli nil hanya terjadi saat dryRun.
func (s *Sender) sendOne(ctx context.Context, classID string, cli *whatsmeow.Client, dryRun bool) bool {
	var m queued
	err := s.db.QueryRowContext(ctx, `UPDATE wa_messages SET status = 'sending', attempts = attempts + 1
		WHERE id = (SELECT m.id FROM wa_messages m JOIN classes k ON k.id = m.class_id
		            WHERE m.class_id = $1 AND m.status = 'pending' AND m.send_after <= now()
		              AND (m.course_id IS NULL OR (now() AT TIME ZONE 'Asia/Makassar')::time
		                   BETWEEN k.send_window_start AND k.send_window_end)
		              AND ($2 OR m.course_id IS NOT NULL)
		            ORDER BY m.send_after, m.id FOR UPDATE OF m SKIP LOCKED LIMIT 1)
		RETURNING id, class_id, course_id, lecture_date, recipient, recipient_name, body, attempts`, classID, cli != nil).
		Scan(&m.id, &m.classID, &m.courseID, &m.lectureDate, &m.recipient, &m.name, &m.body, &m.attempts)
	if errors.Is(err, sql.ErrNoRows) {
		return false
	}
	if err != nil {
		slog.Error("gagal mengklaim pesan", "class", classID, "err", err)
		return false
	}

	if !m.body.Valid {
		if err := s.renderReminder(ctx, &m); err != nil {
			s.fail(ctx, m.id, err.Error(), true)
			return true
		}
	}

	// Batas kolom body (CHECK <= 4000): tolak sebelum terkirim, bukan gagal saat mencatat
	if len([]rune(m.body.String)) > maxBodyRunes {
		s.fail(ctx, m.id, fmt.Sprintf("Isi pesan terlalu panjang (%d karakter, maks %d). Persingkat template.",
			len([]rune(m.body.String)), maxBodyRunes), true)
		return true
	}

	// Mode uji: pengingat dirender & dicatat, tidak dikirim (pesan uji manual tetap dikirim)
	if dryRun && m.courseID.Valid {
		s.record(ctx, m, "dry_run")
		slog.Info("dry run: pengingat tidak dikirim", "id", m.id, "class", classID)
		return true
	}

	if err := sendWithPresence(ctx, cli, m.recipient.String, m.body.String); err != nil {
		slog.Warn("gagal mengirim", "id", m.id, "attempt", m.attempts, "err", err)
		s.fail(ctx, m.id, err.Error(), m.attempts >= maxAttempts)
		return true
	}
	s.record(ctx, m, "sent")
	slog.Info("pesan terkirim", "id", m.id, "class", classID, "to", m.recipient.String)
	return true
}

// record mencatat hasil akhir pesan. Pesan "sent" sudah sampai ke WhatsApp, jadi kegagalan
// mencatat TIDAK boleh mengembalikannya ke antrean (akan terkirim ganda): coba ulang, lalu
// tandai gagal dengan keterangan agar tidak tertinggal di "sending".
func (s *Sender) record(ctx context.Context, m queued, status string) {
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		if _, err = s.db.ExecContext(ctx, `UPDATE wa_messages SET status = $5, sent_at = now(), last_error = NULL,
			recipient = $2, recipient_name = $3, body = $4 WHERE id = $1`, m.id, m.recipient, m.name, m.body, status); err == nil {
			return
		}
		time.Sleep(time.Duration(attempt+1) * time.Second)
	}
	slog.Error("gagal mencatat hasil pesan", "id", m.id, "status", status, "err", err)
	_, _ = s.db.ExecContext(ctx, `UPDATE wa_messages SET status = 'failed',
		last_error = 'Sudah diproses tetapi gagal dicatat; periksa WhatsApp sebelum mengirim ulang.' WHERE id = $1`, m.id)
}

func (s *Sender) fail(ctx context.Context, id int64, reason string, final bool) {
	var err error
	if final {
		_, err = s.db.ExecContext(ctx, "UPDATE wa_messages SET status = 'failed', last_error = $2 WHERE id = $1", id, reason)
	} else {
		// Backoff eksponensial: 1, 2, 4 menit
		_, err = s.db.ExecContext(ctx, `UPDATE wa_messages SET status = 'pending', last_error = $2,
			send_after = now() + make_interval(mins => power(2, attempts - 1)::int) WHERE id = $1`, id, reason)
	}
	if err != nil {
		slog.Error("gagal menandai error pesan", "id", id, "err", err)
	}
}

// renderReminder mengisi tujuan & isi pesan pengingat dari data terbaru mata kuliah.
func (s *Sender) renderReminder(ctx context.Context, m *queued) error {
	var (
		tpl, className, code, name             string
		day, start, end, room, link, target    sql.NullString
		lecturer, lecturerPhone, kmName, kmNIM sql.NullString
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT k.reminder_template, k.name, c.code, c.name, c.day_of_week,
		       to_char(c.start_time, 'HH24:MI'), to_char(c.end_time, 'HH24:MI'), c.room, c.link_group, c.reminder_target,
		       COALESCE(l.full_name, c.lecturer_name), l.phone,
		       km.full_name, km.nim
		FROM courses c
		JOIN classes k ON k.id = c.class_id
		LEFT JOIN lecturers l ON l.id = c.lecturer_id
		LEFT JOIN LATERAL (SELECT full_name, nim FROM profiles
		                   WHERE class_id = c.class_id AND role = 'km' AND status = 'active' LIMIT 1) km ON true
		WHERE c.id = $1`, m.courseID.String).
		Scan(&tpl, &className, &code, &name, &day, &start, &end, &room, &link, &target, &lecturer, &lecturerPhone, &kmName, &kmNIM)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("mata kuliah sudah dihapus")
	}
	if err != nil {
		return err
	}

	recipient, recipientName := target.String, "Tujuan khusus"
	if recipient == "" {
		recipient, recipientName = lecturerPhone.String, lecturer.String
	}
	if recipient == "" {
		return errors.New("mata kuliah belum punya dosen dengan nomor WhatsApp atau tujuan pengingat")
	}

	date := m.lectureDate.Time
	dosen := lecturer.String
	if dosen == "" {
		dosen = "Bapak/Ibu Dosen Pengampu"
	}
	body, err := renderTemplate(tpl, TemplateContext{
		NamaDosen: dosen, Matkul: name, Kode: code,
		Hari: indonesianDays[date.Weekday()], HariDalamBahasa: indonesianDays[date.Weekday()],
		Tanggal: formatIndonesianDate(date), JamMulai: start.String, JamSelesai: end.String,
		Lokasi: room.String, LinkGroup: link.String, Kelas: className,
		NamaMahasiswa: kmName.String, NIM: kmNIM.String,
		WaktuSekarang: time.Now().In(s.loc).Format("15:04 WITA"),
	})
	if err != nil {
		return err
	}
	m.recipient = sql.NullString{String: recipient, Valid: true}
	m.name = sql.NullString{String: recipientName, Valid: true}
	m.body = sql.NullString{String: body, Valid: true}
	return nil
}

// sendWithPresence: online → "sedang mengetik" 1,5–2,5 dtk → kirim (perilaku SiPenDosa).
func sendWithPresence(ctx context.Context, cli *whatsmeow.Client, to, body string) error {
	jid, err := formatJID(to)
	if err != nil {
		return err
	}
	_ = cli.SendPresence(ctx, types.PresenceAvailable)
	_ = cli.SendChatPresence(ctx, jid, types.ChatPresenceComposing, types.ChatPresenceMediaText)
	select {
	case <-time.After(time.Duration(1500+rand.IntN(1000)) * time.Millisecond):
	case <-ctx.Done():
		return ctx.Err()
	}
	_, err = cli.SendMessage(ctx, jid, &waE2E.Message{Conversation: proto.String(body)})
	_ = cli.SendChatPresence(ctx, jid, types.ChatPresencePaused, types.ChatPresenceMediaText)
	return err
}
