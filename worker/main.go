// sipper-worker: mesin WhatsApp platform SIPPER-TI (turunan SiPenDosa).
//   - Sesi WhatsApp per kelas (wa_sessions)
//   - Penjadwal pengingat H-1 / H-0 (courses.reminder_*), melewati hari libur
//   - Pengirim antrean wa_messages dengan jeda acak & simulasi mengetik
//
// Konfigurasi (env): DATABASE_URL (wajib; role dengan BYPASSRLS & search_path whatsmeow,public)
package main

import (
	"context"
	"database/sql"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"google.golang.org/protobuf/proto"
)

// Penjadwal: satu pernyataan atomik, hanya di dalam jam operasional kelas (SiPenDosa).
// last_reminded_on mencegah kirim ganda (juga saat worker restart); hari libur tetap
// ditandai agar tidak dicoba lagi hari itu.
const scheduleSQL = `
WITH now_wita AS (
    SELECT (now() AT TIME ZONE 'Asia/Makassar')::date AS today,
           (now() AT TIME ZONE 'Asia/Makassar')::time AS now_time
), due AS (
    SELECT c.id, c.class_id,
           CASE WHEN c.reminder_mode = 'H-1' THEN n.today + 1 ELSE n.today END AS lecture_date
    FROM courses c
    JOIN classes k ON k.id = c.class_id AND k.status = 'active'
    CROSS JOIN now_wita n
    WHERE c.reminder_enabled
      AND c.reminder_time <= n.now_time
      AND n.now_time BETWEEN k.send_window_start AND k.send_window_end
      AND (c.last_reminded_on IS NULL OR c.last_reminded_on < n.today)
      AND day_index(c.day_of_week) =
          extract(dow FROM CASE WHEN c.reminder_mode = 'H-1' THEN n.today + 1 ELSE n.today END)::int
), marked AS (
    UPDATE courses c SET last_reminded_on = (SELECT today FROM now_wita)
    FROM due WHERE c.id = due.id
    RETURNING c.id
)
INSERT INTO wa_messages (class_id, course_id, lecture_date)
SELECT d.class_id, d.id, d.lecture_date
FROM due d
WHERE d.id IN (SELECT id FROM marked)
  AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = d.lecture_date)`

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		slog.Error("DATABASE_URL wajib diisi")
		os.Exit(1)
	}
	loc, err := time.LoadLocation("Asia/Makassar")
	if err != nil {
		loc = time.FixedZone("WITA", 8*3600)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		slog.Error("gagal membuka database", "err", err)
		os.Exit(1)
	}
	db.SetMaxOpenConns(10)
	defer db.Close()
	if err := db.PingContext(ctx); err != nil {
		slog.Error("database tidak terjangkau", "err", err)
		os.Exit(1)
	}

	// Identitas perangkat tertaut yang terlihat di HP (WhatsApp → Perangkat tertaut)
	store.DeviceProps.Os = proto.String("SIPPER-TI")
	container := sqlstore.NewWithDB(db, "pgx", nil)
	if err := container.Upgrade(ctx); err != nil {
		slog.Error("gagal menyiapkan tabel whatsmeow", "err", err)
		os.Exit(1)
	}

	sessions := NewSessions(db, container)
	sender := NewSender(db, sessions, loc)
	if err := sender.Recover(ctx); err != nil {
		slog.Error("gagal memulihkan antrean", "err", err)
	}
	slog.Info("sipper-worker berjalan")

	sessionTick := time.NewTicker(3 * time.Second)
	sendTick := time.NewTicker(2 * time.Second)
	scheduleTick := time.NewTicker(time.Minute)
	groupTick := time.NewTicker(30 * time.Minute)
	defer groupTick.Stop()
	defer sessionTick.Stop()
	defer sendTick.Stop()
	defer scheduleTick.Stop()

	schedule := func() {
		res, err := db.ExecContext(ctx, scheduleSQL)
		if err != nil {
			slog.Error("penjadwal gagal", "err", err)
			return
		}
		if n, _ := res.RowsAffected(); n > 0 {
			slog.Info("pengingat diantrekan", "jumlah", n)
		}
	}
	schedule()

	for {
		select {
		case <-ctx.Done():
			slog.Info("berhenti...")
			sessions.CloseAll()
			return
		case <-sessionTick.C:
			if err := sessions.Sync(ctx); err != nil {
				slog.Error("sinkron sesi gagal", "err", err)
			}
		case <-sendTick.C:
			sender.Tick(ctx)
		case <-scheduleTick.C:
			schedule()
		case <-groupTick.C:
			sessions.SyncAllGroups(ctx)
		}
	}
}
