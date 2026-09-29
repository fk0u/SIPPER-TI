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

// classClient: satu perangkat WhatsApp tertaut per kelas, melayani satu permintaan
// (wa_sessions.requested_at) dari web.
type classClient struct {
	classID     string
	cli         *whatsmeow.Client
	requestedAt time.Time          // permintaan wa_request yang sedang dilayani
	pairing     atomic.Bool        // QR / kode pairing sedang berjalan
	cancelQR    context.CancelFunc // menghentikan listener QR saat klien dibongkar
	lastConnect time.Time          // hanya diakses dari loop Sync
}

// Jeda minimum antar percobaan Connect manual (whatsmeow juga menyambung ulang sendiri).
const reconnectEvery = 30 * time.Second

// Sessions menyamakan klien WhatsApp dengan tabel wa_sessions. Kolom `desired` &
// `requested_at` hanya ditulis web (RPC wa_request); worker menulis status.
type Sessions struct {
	db        *sql.DB
	container *sqlstore.Container
	mu        sync.Mutex
	clients   map[string]*classClient
	// QR kedaluwarsa / perangkat dikeluarkan untuk permintaan ini: tunggu pengguna menekan "Sambungkan" lagi
	expired map[string]time.Time
	// Sinkron grup yang sedang berjalan per kelas (cegah tumpang tindih saat reconnect beruntun)
	syncing sync.Map
}

// Batas waktu satu sinkron grup WhatsApp.
const groupSyncTimeout = 30 * time.Second

func NewSessions(db *sql.DB, container *sqlstore.Container) *Sessions {
	return &Sessions{db: db, container: container, clients: map[string]*classClient{}, expired: map[string]time.Time{}}
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

func (s *Sessions) isCurrent(c *classClient) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.clients[c.classID] == c
}

func (s *Sessions) setState(classID string, cols string, args ...any) {
	q := "UPDATE wa_sessions SET " + cols + ", updated_at = now() WHERE class_id = $1"
	if _, err := s.db.Exec(q, append([]any{classID}, args...)...); err != nil {
		slog.Error("gagal menulis status sesi", "class", classID, "err", err)
	}
}

// setStateFor menulis status hanya bila c masih klien aktif kelasnya, sehingga event
// terlambat dari klien yang sudah dibongkar tidak menimpa status klien baru.
func (s *Sessions) setStateFor(c *classClient, cols string, args ...any) {
	if s.isCurrent(c) {
		s.setState(c.classID, cols, args...)
	}
}

type sessionRow struct {
	classID, desired, state string
	deviceJID, pairPhone    sql.NullString
	qrCode                  sql.NullString
	requestedAt             time.Time
}

// Sync dipanggil berkala: heartbeat + terapkan keinginan pengguna.
func (s *Sessions) Sync(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, "UPDATE wa_sessions SET worker_seen_at = now()"); err != nil {
		return err
	}
	rows, err := s.db.QueryContext(ctx,
		"SELECT class_id, desired, state, device_jid, pair_phone, qr_code, requested_at FROM wa_sessions")
	if err != nil {
		return err
	}
	var list []sessionRow
	for rows.Next() {
		var r sessionRow
		if err := rows.Scan(&r.classID, &r.desired, &r.state, &r.deviceJID, &r.pairPhone, &r.qrCode, &r.requestedAt); err != nil {
			rows.Close()
			return err
		}
		list = append(list, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	for _, r := range list {
		switch r.desired {
		case "on":
			s.ensureOn(ctx, r)
		case "off":
			s.turnOff(r)
		case "logout":
			s.logout(ctx, r)
		}
	}
	return nil
}

// teardown memutus & melepas klien kelas (bila ada) tanpa menulis status.
func (s *Sessions) teardown(classID string) *classClient {
	s.mu.Lock()
	c := s.clients[classID]
	delete(s.clients, classID)
	s.mu.Unlock()
	if c != nil {
		if c.cancelQR != nil {
			c.cancelQR()
		}
		c.cli.Disconnect()
	}
	return c
}

// teardownIfCurrent membongkar c hanya bila c masih klien aktif kelasnya.
func (s *Sessions) teardownIfCurrent(c *classClient) {
	s.mu.Lock()
	current := s.clients[c.classID] == c
	if current {
		delete(s.clients, c.classID)
	}
	s.mu.Unlock()
	if current {
		if c.cancelQR != nil {
			c.cancelQR()
		}
		c.cli.Disconnect()
	}
}

func (s *Sessions) ensureOn(ctx context.Context, r sessionRow) {
	s.mu.Lock()
	c := s.clients[r.classID]
	s.mu.Unlock()

	// Permintaan baru saat pairing berjalan (mis. nomor pairing ditambahkan): mulai ulang
	if c != nil && c.pairing.Load() && r.requestedAt.After(c.requestedAt) {
		s.teardown(r.classID)
		c = nil
	}
	if c != nil && (c.cli.IsConnected() || c.pairing.Load() || time.Since(c.lastConnect) < reconnectEvery) {
		return // whatsmeow menyambung ulang sendiri saat terputus
	}

	if c == nil {
		device := s.container.NewDevice()
		if r.deviceJID.Valid {
			if jid, err := types.ParseJID(r.deviceJID.String); err == nil {
				if d, err := s.container.GetDevice(ctx, jid); err == nil && d != nil {
					device = d
				}
			}
		}
		// Belum tertaut & QR untuk permintaan ini sudah kedaluwarsa: tunggu permintaan baru
		if device.ID == nil {
			s.mu.Lock()
			exp, ok := s.expired[r.classID]
			s.mu.Unlock()
			if ok && !r.requestedAt.After(exp) {
				return
			}
		}
		c = &classClient{classID: r.classID, cli: whatsmeow.NewClient(device, nil), requestedAt: r.requestedAt}
		cc := c
		c.cli.AddEventHandler(func(evt any) { s.handleEvent(cc, evt) })
		s.mu.Lock()
		s.clients[r.classID] = c
		delete(s.expired, r.classID)
		s.mu.Unlock()
	}

	c.lastConnect = time.Now()
	if c.cli.Store.ID != nil {
		s.setStateFor(c, "state = 'connecting', last_error = NULL")
		if err := c.cli.Connect(); err != nil {
			s.setStateFor(c, "state = 'error', last_error = $2", err.Error())
		}
		return
	}

	// Belum tertaut: alur QR (dan kode pairing bila nomor diisi)
	qrCtx, cancel := context.WithCancel(context.Background())
	qrChan, err := c.cli.GetQRChannel(qrCtx)
	if err != nil {
		cancel()
		s.setStateFor(c, "state = 'error', last_error = $2", err.Error())
		return
	}
	if err := c.cli.Connect(); err != nil {
		cancel()
		s.setStateFor(c, "state = 'error', last_error = $2", err.Error())
		return
	}
	c.cancelQR = cancel
	c.pairing.Store(true)
	s.setStateFor(c, "state = 'connecting', last_error = NULL")
	go s.listenQR(c, qrChan, r.pairPhone.String)
}

func (s *Sessions) listenQR(c *classClient, qrChan <-chan whatsmeow.QRChannelItem, pairPhone string) {
	defer c.pairing.Store(false)
	codeRequested := false
	for item := range qrChan {
		if !s.isCurrent(c) {
			return // klien sudah dibongkar: jangan menulis status lama
		}
		switch item.Event {
		case "code":
			s.setStateFor(c, "state = 'need_qr', qr_code = $2", item.Code)
			if pairPhone != "" && !codeRequested {
				codeRequested = true
				code, err := c.cli.PairPhone(context.Background(), pairPhone, true, whatsmeow.PairClientChrome, "Chrome (Linux)")
				if err != nil {
					s.setStateFor(c, "last_error = $2", "Gagal meminta kode pairing: "+err.Error())
				} else {
					s.setStateFor(c, "pair_code = $2", code)
				}
			}
		case "success":
			s.setStateFor(c, "qr_code = NULL, pair_code = NULL")
		case "timeout":
			// Tidak di-scan: berhenti sampai pengguna menekan "Sambungkan" lagi. Keinginan
			// pengguna (`desired`) tidak diubah; kedaluwarsa dilaporkan lewat state/last_error.
			s.setStateFor(c, "state = 'disconnected', qr_code = NULL, pair_code = NULL, last_error = $2",
				"QR kedaluwarsa, tekan Sambungkan untuk mencoba lagi.")
			s.mu.Lock()
			s.expired[c.classID] = c.requestedAt
			s.mu.Unlock()
			s.teardownIfCurrent(c)
			return
		default:
			if item.Error != nil {
				s.setStateFor(c, "state = 'error', last_error = $2", item.Error.Error())
			}
		}
	}
}

func (s *Sessions) handleEvent(c *classClient, evt any) {
	switch e := evt.(type) {
	case *events.PairSuccess:
		s.setStateFor(c, "device_jid = $2, qr_code = NULL, pair_code = NULL", e.ID.String())
	case *events.Connected:
		s.setStateFor(c, "state = 'connected', device_jid = $2, push_name = $3, qr_code = NULL, pair_code = NULL, last_error = NULL",
			c.cli.Store.ID.String(), c.cli.Store.PushName)
		slog.Info("WhatsApp terhubung", "class", c.classID, "jid", c.cli.Store.ID.String())
		go s.syncGroups(c.classID, c.cli)
	case *events.Disconnected:
		s.setStateFor(c, "state = 'disconnected'")
	case *events.LoggedOut:
		// Dikeluarkan dari HP: whatsmeow sudah menghapus perangkat dari store. Jangan tautkan ulang
		// otomatis (QR / kode pairing ke nomor lama): tunggu pengguna menekan "Sambungkan" lagi.
		s.setStateFor(c, "state = 'logged_out', device_jid = NULL, qr_code = NULL, pair_code = NULL, last_error = $2",
			"Perangkat dikeluarkan dari HP. Tekan Sambungkan untuk menautkan lagi.")
		s.mu.Lock()
		s.expired[c.classID] = c.requestedAt
		s.mu.Unlock()
		go s.teardownIfCurrent(c) // jangan Disconnect dari dalam handler event whatsmeow
	}
}

// turnOff: putuskan (sesi tetap tersimpan). Status basi (mis. setelah worker restart
// tanpa klien di memori) tetap dirapikan.
func (s *Sessions) turnOff(r sessionRow) {
	c := s.teardown(r.classID)
	if c != nil || (r.state != "disconnected" && r.state != "logged_out") || r.qrCode.Valid {
		s.setState(r.classID, "state = 'disconnected', qr_code = NULL, pair_code = NULL")
	}
}

func (s *Sessions) logout(ctx context.Context, r sessionRow) {
	s.mu.Lock()
	c := s.clients[r.classID]
	s.mu.Unlock()
	if c != nil && c.cli.Store.ID != nil {
		if err := c.cli.Logout(ctx); err != nil {
			slog.Warn("logout gagal, hapus perangkat lokal", "class", r.classID, "err", err)
			_ = c.cli.Store.Delete(ctx)
		}
	} else if r.deviceJID.Valid {
		if jid, err := types.ParseJID(r.deviceJID.String); err == nil {
			if d, err := s.container.GetDevice(ctx, jid); err == nil && d != nil {
				_ = d.Delete(ctx)
			}
		}
	}
	s.teardown(r.classID)
	if r.state != "logged_out" || r.deviceJID.Valid || r.qrCode.Valid {
		s.setState(r.classID, "state = 'logged_out', device_jid = NULL, push_name = NULL, qr_code = NULL, pair_code = NULL")
	}
}

// syncGroups menyimpan grup yang diikuti nomor kelas ke wa_groups (pemilih tujuan pengingat).
// Paling banyak satu sinkron per kelas sekaligus, dengan batas waktu.
func (s *Sessions) syncGroups(classID string, cli *whatsmeow.Client) {
	if _, running := s.syncing.LoadOrStore(classID, true); running {
		return
	}
	defer s.syncing.Delete(classID)
	ctx, cancel := context.WithTimeout(context.Background(), groupSyncTimeout)
	defer cancel()

	groups, err := cli.GetJoinedGroups(ctx)
	if err != nil {
		slog.Warn("gagal mengambil grup WhatsApp", "class", classID, "err", err)
		return
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		slog.Error("gagal memulai transaksi sinkron grup", "class", classID, "err", err)
		return
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, "DELETE FROM wa_groups WHERE class_id = $1", classID); err != nil {
		slog.Error("gagal menghapus grup lama", "class", classID, "err", err)
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
	if err := tx.Commit(); err != nil {
		slog.Error("gagal menyimpan sinkron grup", "class", classID, "err", err)
		return
	}
	slog.Info("grup WhatsApp disinkron", "class", classID, "jumlah", len(groups))
}

// SyncAllGroups memulai sinkron grup semua kelas terhubung di latar belakang (tidak menahan loop utama).
func (s *Sessions) SyncAllGroups() {
	s.mu.Lock()
	var list []*classClient
	for _, c := range s.clients {
		list = append(list, c)
	}
	s.mu.Unlock()
	for _, c := range list {
		if c.cli.IsConnected() && c.cli.IsLoggedIn() {
			go s.syncGroups(c.classID, c.cli)
		}
	}
}

func (s *Sessions) CloseAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.clients {
		if c.cancelQR != nil {
			c.cancelQR()
		}
		c.cli.Disconnect()
	}
}
