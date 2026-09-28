package main

import (
	"context"
	"database/sql"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// classClient: satu perangkat WhatsApp tertaut per kelas.
type classClient struct {
	classID     string
	cli         *whatsmeow.Client
	pairing     atomic.Bool // QR / kode pairing sedang berjalan
	lastConnect time.Time   // hanya diakses dari loop Sync
}

// Jeda minimum antar percobaan Connect manual (whatsmeow juga menyambung ulang sendiri).
const reconnectEvery = 30 * time.Second

// Sessions menyamakan keadaan klien WhatsApp dengan tabel wa_sessions (ditulis web lewat RPC wa_request).
type Sessions struct {
	db        *sql.DB
	container *sqlstore.Container
	mu        sync.Mutex
	clients   map[string]*classClient
}

func NewSessions(db *sql.DB, container *sqlstore.Container) *Sessions {
	return &Sessions{db: db, container: container, clients: map[string]*classClient{}}
}

// Connected mengembalikan klien kelas yang siap mengirim.
func (s *Sessions) Connected(classID string) *whatsmeow.Client {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c := s.clients[classID]; c != nil && c.cli.IsConnected() && c.cli.IsLoggedIn() {
		return c.cli
	}
	return nil
}

func (s *Sessions) setState(classID string, cols string, args ...any) {
	q := "UPDATE wa_sessions SET " + cols + ", updated_at = now() WHERE class_id = $1"
	if _, err := s.db.Exec(q, append([]any{classID}, args...)...); err != nil {
		slog.Error("gagal menulis status sesi", "class", classID, "err", err)
	}
}

type sessionRow struct {
	classID, desired, state string
	deviceJID, pairPhone    sql.NullString
}

// Sync dipanggil berkala: heartbeat + terapkan keinginan pengguna.
func (s *Sessions) Sync(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, "UPDATE wa_sessions SET worker_seen_at = now()"); err != nil {
		return err
	}
	rows, err := s.db.QueryContext(ctx, "SELECT class_id, desired, state, device_jid, pair_phone FROM wa_sessions")
	if err != nil {
		return err
	}
	var list []sessionRow
	for rows.Next() {
		var r sessionRow
		if err := rows.Scan(&r.classID, &r.desired, &r.state, &r.deviceJID, &r.pairPhone); err != nil {
			rows.Close()
			return err
		}
		list = append(list, r)
	}
	rows.Close()

	for _, r := range list {
		switch r.desired {
		case "on":
			s.ensureOn(ctx, r)
		case "off":
			s.turnOff(r.classID)
		case "logout":
			s.logout(ctx, r)
		}
	}
	return nil
}

func (s *Sessions) ensureOn(ctx context.Context, r sessionRow) {
	s.mu.Lock()
	c := s.clients[r.classID]
	s.mu.Unlock()
	if c != nil && (c.cli.IsConnected() || c.pairing.Load() || time.Since(c.lastConnect) < reconnectEvery) {
		return // whatsmeow menyambung ulang sendiri saat terputus
	}

	if c == nil {
		device := s.container.NewDevice()
		if r.deviceJID.Valid {
			jid, err := types.ParseJID(r.deviceJID.String)
			if err == nil {
				if d, err := s.container.GetDevice(ctx, jid); err == nil && d != nil {
					device = d
				}
			}
		}
		c = &classClient{classID: r.classID, cli: whatsmeow.NewClient(device, nil)}
		c.cli.AddEventHandler(func(evt any) { s.handleEvent(c, evt) })
		s.mu.Lock()
		s.clients[r.classID] = c
		s.mu.Unlock()
	}

	c.lastConnect = time.Now()
	if c.cli.Store.ID != nil {
		s.setState(r.classID, "state = 'connecting', last_error = NULL")
		if err := c.cli.Connect(); err != nil {
			s.setState(r.classID, "state = 'error', last_error = $2", err.Error())
		}
		return
	}

	// Belum tertaut: alur QR (dan kode pairing bila nomor diisi)
	qrChan, err := c.cli.GetQRChannel(context.Background())
	if err != nil {
		s.setState(r.classID, "state = 'error', last_error = $2", err.Error())
		return
	}
	if err := c.cli.Connect(); err != nil {
		s.setState(r.classID, "state = 'error', last_error = $2", err.Error())
		return
	}
	c.pairing.Store(true)
	s.setState(r.classID, "state = 'connecting', last_error = NULL")
	go s.listenQR(c, qrChan, r.pairPhone.String)
}

func (s *Sessions) listenQR(c *classClient, qrChan <-chan whatsmeow.QRChannelItem, pairPhone string) {
	defer c.pairing.Store(false)
	codeRequested := false
	for item := range qrChan {
		switch item.Event {
		case "code":
			s.setState(c.classID, "state = 'need_qr', qr_code = $2", item.Code)
			if pairPhone != "" && !codeRequested {
				codeRequested = true
				code, err := c.cli.PairPhone(context.Background(), pairPhone, true, whatsmeow.PairClientChrome, "Chrome (Linux)")
				if err != nil {
					s.setState(c.classID, "last_error = $2", "Gagal meminta kode pairing: "+err.Error())
				} else {
					s.setState(c.classID, "pair_code = $2", code)
				}
			}
		case "success":
			s.setState(c.classID, "qr_code = NULL, pair_code = NULL")
		case "timeout":
			// Tidak di-scan: berhenti mencoba sampai pengguna menekan "Sambungkan" lagi
			c.cli.Disconnect()
			s.setState(c.classID, "state = 'disconnected', desired = 'off', qr_code = NULL, pair_code = NULL, last_error = $2",
				"QR kedaluwarsa, tekan Sambungkan untuk mencoba lagi.")
		default:
			if item.Error != nil {
				s.setState(c.classID, "state = 'error', last_error = $2", item.Error.Error())
			}
		}
	}
}

func (s *Sessions) handleEvent(c *classClient, evt any) {
	switch e := evt.(type) {
	case *events.PairSuccess:
		s.setState(c.classID, "device_jid = $2, qr_code = NULL, pair_code = NULL", e.ID.String())
	case *events.Connected:
		s.setState(c.classID, "state = 'connected', device_jid = $2, push_name = $3, qr_code = NULL, pair_code = NULL, last_error = NULL",
			c.cli.Store.ID.String(), c.cli.Store.PushName)
		slog.Info("WhatsApp terhubung", "class", c.classID, "jid", c.cli.Store.ID.String())
		go s.syncGroups(context.Background(), c.classID, c.cli)
	case *events.Disconnected:
		s.setState(c.classID, "state = 'disconnected'")
	case *events.LoggedOut:
		// Dikeluarkan dari HP: whatsmeow sudah menghapus perangkat dari store
		s.setState(c.classID, "state = 'logged_out', desired = 'off', device_jid = NULL, qr_code = NULL, pair_code = NULL")
		s.drop(c.classID)
	}
}

func (s *Sessions) drop(classID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.clients, classID)
}

func (s *Sessions) turnOff(classID string) {
	s.mu.Lock()
	c := s.clients[classID]
	delete(s.clients, classID)
	s.mu.Unlock()
	if c != nil {
		c.cli.Disconnect()
		s.setState(classID, "state = 'disconnected', qr_code = NULL, pair_code = NULL")
	}
}

func (s *Sessions) logout(ctx context.Context, r sessionRow) {
	s.mu.Lock()
	c := s.clients[r.classID]
	delete(s.clients, r.classID)
	s.mu.Unlock()
	if c != nil && c.cli.Store.ID != nil {
		if err := c.cli.Logout(ctx); err != nil {
			slog.Warn("logout gagal, hapus perangkat lokal", "class", r.classID, "err", err)
			_ = c.cli.Store.Delete(ctx)
		}
		c.cli.Disconnect()
	} else if r.deviceJID.Valid {
		if jid, err := types.ParseJID(r.deviceJID.String); err == nil {
			if d, err := s.container.GetDevice(ctx, jid); err == nil && d != nil {
				_ = d.Delete(ctx)
			}
		}
	}
	s.setState(r.classID, "state = 'logged_out', desired = 'off', device_jid = NULL, push_name = NULL, qr_code = NULL, pair_code = NULL")
}

func (s *Sessions) CloseAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.clients {
		c.cli.Disconnect()
	}
}

// syncGroups menyimpan grup yang diikuti nomor kelas ke wa_groups (pemilih tujuan pengingat).
func (s *Sessions) syncGroups(ctx context.Context, classID string, cli *whatsmeow.Client) {
	groups, err := cli.GetJoinedGroups(ctx)
	if err != nil {
		slog.Warn("gagal mengambil grup WhatsApp", "class", classID, "err", err)
		return
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, "DELETE FROM wa_groups WHERE class_id = $1", classID); err != nil {
		return
	}
	for _, g := range groups {
		if g == nil {
			continue
		}
		name := g.GroupName.Name
		if name == "" {
			name = g.JID.User
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO wa_groups (class_id, jid, name, participants)
			VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, classID, g.JID.String(), name, len(g.Participants)); err != nil {
			slog.Warn("gagal menyimpan grup", "class", classID, "err", err)
			return
		}
	}
	if err := tx.Commit(); err == nil {
		slog.Info("grup WhatsApp disinkron", "class", classID, "jumlah", len(groups))
	}
}

func (s *Sessions) SyncAllGroups(ctx context.Context) {
	s.mu.Lock()
	var list []*classClient
	for _, c := range s.clients {
		list = append(list, c)
	}
	s.mu.Unlock()
	for _, c := range list {
		if c.cli.IsConnected() && c.cli.IsLoggedIn() {
			s.syncGroups(ctx, c.classID, c.cli)
		}
	}
}
