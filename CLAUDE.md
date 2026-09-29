@AGENTS.md

# SIPPER-TI — panduan untuk Claude

Platform multi-kelas UMKT: perizinan (SIPPER-TI) + jadwal & pengingat dosen via WhatsApp (SiPenDosa).
Bahasa percakapan & UI: **Bahasa Indonesia**. Konteks lengkap: `.agents/context-project.md`,
preferensi: `.agents/user-preferences.md`, kesalahan yang pernah terjadi: `.agents/mistake-registry.md`.

## Arsitektur singkat
- **Web**: Next.js 16 (`src/`, `src/proxy.ts` = middleware). Baca `node_modules/next/dist/docs/` sebelum memakai API Next.
- **Data/Auth**: Supabase self-hosted. **RLS & RPC di `supabase/migrations/` adalah sumber kebenaran hak akses**;
  `src/lib/permissions.ts` & `src/lib/routes.ts` hanya cermin UX.
- **Worker WhatsApp**: Go + whatsmeow (`worker/`), membaca/menulis `wa_sessions`, `wa_messages`, `wa_groups`.
  Web tidak pernah memanggil worker langsung — keduanya lewat Postgres.
- Tidak ada mode demo: aplikasi selalu butuh Supabase.

## Aturan wajib
- Perubahan skema/hak akses → **migrasi baru** (jangan edit migrasi yang sudah diterapkan) + tes di
  `supabase/tests/rls_test.sql` (tambah kasus negatif untuk setiap policy/RPC baru).
- Setiap helper hak akses (`my_class_id`, `is_admin`, `is_staff_of`, `is_km_of`, `is_sipen_of`) sudah mensyaratkan
  `mfa_satisfied()`. Policy dengan cabang "milik sendiri" (`auth.uid() = …`) juga harus `AND mfa_satisfied()`.
- RPC yang memakai pgcrypto (`gen_random_bytes`) wajib `SET search_path = public, extensions`
  (di Supabase pgcrypto ada di skema `extensions`; tes RLS di PostgreSQL biasa tidak menangkapnya).
- Tanggal/hari kampus selalu **WITA** secara eksplisit (`dayNameWITA`, `todayWITA`, ics.ts, nextReminder.ts),
  jangan bergantung zona waktu server/perangkat.
- Template pengingat: sintaks Go `text/template`. Validasi ada di tiga tempat yang harus selaras:
  `src/lib/reminderTemplate.ts`, `assert_valid_template()` (SQL), dan `worker/template.go`.
- Izin: satu pengajuan wizard = satu baris `leave_requests` per matkul (sama `batch_id`), agar tiap Sipen
  memverifikasi matkulnya sendiri. Hitung hari kuliah di `src/lib/leavePlan.ts`; server memvalidasi jadwal
  (`validate_leave_schedule`) — izin per jam (`start_time/end_time`) hanya untuk izin satu hari.
- KM mengelola semua matkul kelas; Sipen hanya matkul di `course_sipen` miliknya (matkul buatannya otomatis miliknya).
- Service key (`SUPABASE_SECRET_KEY`, env server tanpa `NEXT_PUBLIC_`) hanya dipakai route handler
  (`src/lib/supabase/admin.ts`) **setelah** otorisasi di database: reset sandi (`authorize_password_reset`),
  lampiran & export portal dosen (`lecturer_attachment`, hanya `service_role`).
- Komponen klien: jangan panggil `setState` sinkron di effect (lint React Compiler) — ambil data lalu set di `.then`.
- Jangan commit/push tanpa izin pengguna. Pesan commit gaya conventional (`feat(app): …`, `fix(db): …`).

## Verifikasi sebelum commit
```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:rls      # bila menyentuh SQL (butuh PGHOST/PGUSER PostgreSQL biasa)
npm run test:worker   # bila menyentuh worker/ (go vet + go test -race)
npm run test:e2e-api  # di server produksi, terhadap Supabase & worker sungguhan (data uji dibersihkan)
```

## Produksi (VPS Azure `kvm`, 85.211.245.134, zona WITA)
- App: `/project/sipper-ti` → PM2 `sipper` (cluster 4, `/project/ecosystem.config.js`) — https://app.85-211-245-134.sslip.io
- Supabase: `/project/supabase` (docker compose, port hanya 127.0.0.1). Superuser DB:
  `docker compose exec -T db psql -U supabase_admin -d postgres` (role `postgres` bukan superuser). `docker compose exec` menelan
  stdin heredoc — pakai `</dev/null` bila tidak memberi input.
- Worker: `/opt/sipper-worker/sipper-worker`, systemd `sipper-worker`, env `/etc/sipper-worker.env`
  (role DB `sipper_worker`, BYPASSRLS, skema `whatsmeow`; tabel baru yang dibaca/ditulis worker butuh GRANT).
- Menerapkan migrasi: `docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < file.sql`.
- App env server: `/project/sipper-ti/.env.local` (URL + publishable key + `SUPABASE_SECRET_KEY`, chmod 600).
- Backup: systemd timer `supabase-backup` (02:30 WITA) → `/project/ops/backup-supabase.sh` → `/var/backups/supabase`
  (pg_dump + arsip storage, retensi 14 hari). Uji pulih: `sudo /project/ops/restore-test.sh`. Jalankan backup
  manual sebelum menerapkan migrasi.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
