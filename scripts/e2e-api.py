#!/usr/bin/env python3
"""Uji end-to-end lewat API terhadap server yang berjalan (registrasi → ACC → jadwal →
portal dosen → WhatsApp worker). Membuat akun uji NIM 9999…, lalu menghapusnya.

Pemakaian (di server):  sudo python3 scripts/e2e-api.py
Butuh: /project/supabase/.env (publishable key) dan akses docker compose untuk seed/cleanup.
"""
import base64, datetime, hashlib, hmac, io, json, secrets, struct, subprocess, sys, time, urllib.error, urllib.request, zipfile
from zoneinfo import ZoneInfo

APP = "https://app.85-211-245-134.sslip.io"
API = "https://api.85-211-245-134.sslip.io"
KEY = next(l.split("=", 1)[1].strip() for l in open("/project/supabase/.env") if l.startswith("SUPABASE_PUBLISHABLE_KEY="))
DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
passed = failed = 0
# Data uji unik per run; hanya data yang dibuat run ini yang dibersihkan (server produksi)
RUN = secrets.randbelow(10**8)
NIM_KM, NIM_ADMIN, NIM_MHS = (f"9999{RUN:08d}{i}" for i in (1, 2, 3))
CLASS_KM, CLASS_ADMIN = f"Kelas Uji {RUN} E2E", f"Kelas Admin {RUN} E2E"
LECTURER = f"Dr. Uji {RUN} E2E"
created_users: list[str] = []
uploaded_paths: list[str] = []


class FixtureError(Exception):
    """Data uji gagal dibuat: hentikan tanpa menyentuh data lain."""


def first(body):
    """Baris pertama respons PostgREST, atau {} bila respons bukan daftar (error / kosong)."""
    return body[0] if isinstance(body, list) and body else {}


def sql(q):
    out = subprocess.run(["docker", "compose", "exec", "-T", "db", "psql", "-U", "postgres", "-Atc", q],
                         cwd="/project/supabase", capture_output=True, text=True, stdin=subprocess.DEVNULL)
    if out.returncode:
        raise RuntimeError(out.stderr)
    return out.stdout.strip()


def http(method, url, body=None, token=None, raw=False):
    headers = {"apikey": KEY, "Content-Type": "application/json", "Prefer": "return=representation"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read().decode()
            return r.status, (data if raw else (json.loads(data) if data else None))
    except urllib.error.HTTPError as e:
        data = e.read().decode()
        try:
            return e.code, json.loads(data)
        except ValueError:
            return e.code, data


def totp(secret):
    """Kode TOTP RFC 6238 (30 dtk, 6 digit) seperti aplikasi authenticator."""
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", int(time.time()) // 30), hashlib.sha1).digest()
    o = digest[-1] & 0x0F
    return f"{(struct.unpack('>I', digest[o:o + 4])[0] & 0x7FFFFFFF) % 1000000:06d}"


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def signup(nim, data):
    pw = secrets.token_urlsafe(16)
    st, body = http("POST", f"{API}/auth/v1/signup", {"email": f"{nim}@umkt.ac.id", "password": pw, "data": data})
    user_id = ((body or {}).get("user") or {}).get("id") if isinstance(body, dict) else None
    if st != 200 or not user_id:
        raise FixtureError(f"gagal membuat akun uji {nim}: {body}")
    created_users.append(user_id)
    return st, body, pw, user_id


def auth_session(nim, pw):
    """Sesi Supabase (respons token lengkap) untuk akun uji; None bila gagal."""
    st, body = http("POST", f"{API}/auth/v1/token?grant_type=password", {"email": f"{nim}@umkt.ac.id", "password": pw})
    return body if st == 200 else None


def login(nim, pw):
    return (auth_session(nim, pw) or {}).get("access_token")


def rpc(fn, args, token):
    return http("POST", f"{API}/rest/v1/rpc/{fn}", args, token)


def fetch(url, data=None, headers=None, method=None):
    """Request mentah (bytes) — mengikuti redirect. Kembalikan (status, headers, body)."""
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()


def session_cookie(session):
    """Cookie sesi @supabase/ssr (sb-<ref>-auth-token, base64url, dipecah per 3180 karakter)."""
    name = f"sb-{API.split('//')[1].split('.')[0]}-auth-token"
    value = "base64-" + base64.urlsafe_b64encode(json.dumps(session).encode()).decode().rstrip("=")
    chunks = [value[i:i + 3180] for i in range(0, len(value), 3180)]
    if len(chunks) == 1:
        return f"{name}={value}"
    return "; ".join(f"{name}.{i}={c}" for i, c in enumerate(chunks))


def main():
    # 1. Pengaju kelas baru → pending
    st, body, pw_a, id_a = signup(NIM_KM, {"full_name": "E2E KM", "self_registered": True, "new_class_name": CLASS_KM})
    check("daftar + ajukan kelas", st == 200 and body.get("access_token"), body)
    st, body, pw_admin, id_admin = signup(NIM_ADMIN, {"full_name": "E2E Admin", "self_registered": True, "new_class_name": CLASS_ADMIN})
    # Bootstrap superadmin (seperti admin pertama platform): lewat SQL
    # Bootstrap superadmin (seperti admin pertama platform): lewat SQL, hanya akun yang baru dibuat run ini
    sql(f"UPDATE classes SET status='active' WHERE created_by = '{id_admin}';"
        f"UPDATE profiles SET is_admin=true, status='active', role='km' WHERE id = '{id_admin}';")
    t_admin = login(NIM_ADMIN, pw_admin)
    t_a = login(NIM_KM, pw_a)
    st, prof = rpc("get_my_profile", {}, t_a)
    check("pengaju masih pending", st == 200 and first(prof).get("status") == "pending", prof)
    st, rows = http("GET", f"{API}/rest/v1/courses?select=id", token=t_a)
    check("pending belum bisa melihat matkul", st == 200 and rows == [], rows)

    # 2. Admin menyetujui kelas
    st, pend = rpc("list_pending_classes", {}, t_admin)
    cls = next((c for c in pend if c["name"] == CLASS_KM), None) if st == 200 else None
    check("admin melihat pengajuan", cls is not None, pend)
    st, _ = rpc("approve_class", {"p_class": cls["id"]}, t_admin)
    check("admin ACC kelas", st in (200, 204))
    st, prof = rpc("get_my_profile", {}, t_a)
    check("pengaju kini KM aktif", first(prof).get("status") == "active" and first(prof).get("role") == "km", prof)
    st, _ = rpc("approve_class", {"p_class": cls["id"]}, t_a)
    check("KM biasa tidak bisa ACC kelas", st >= 400)

    # 3. Mahasiswa daftar ke kelas itu → KM ACC
    st, body, pw_b, id_b = signup(NIM_MHS, {"full_name": "E2E Mahasiswa", "self_registered": True, "class_id": cls["id"]})
    check("mahasiswa daftar ke kelas", st == 200)
    t_b = login(NIM_MHS, pw_b)
    st, rows = http("GET", f"{API}/rest/v1/profiles?select=id,full_name,status&status=eq.pending", token=t_a)
    b_id = next((r["id"] for r in rows if r["full_name"] == "E2E Mahasiswa"), None) if st == 200 else None
    check("KM melihat pendaftar pending", b_id is not None, rows)
    st, _ = rpc("approve_member", {"p_user": b_id}, t_a)
    check("KM ACC pendaftar", st in (200, 204))

    # 3b. Migrasi KM: superadmin menunjuk KM baru, lalu mengembalikannya
    st, _ = rpc("set_member_role", {"p_user": b_id, "p_role": "km"}, t_admin)
    st2, prof = rpc("get_my_profile", {}, t_a)
    check("superadmin memindahkan KM (KM lama jadi Sipen)", st in (200, 204) and first(prof).get("role") == "sipen", prof)
    st, _ = rpc("set_member_role", {"p_user": b_id, "p_role": "mahasiswa"}, t_a)
    check("Sipen tidak bisa mengubah peran", st >= 400)
    st, _ = rpc("set_member_role", {"p_user": first(prof).get("id"), "p_role": "km"}, t_b)
    st2, prof = rpc("get_my_profile", {}, t_a)
    check("KM baru menyerahkan kembali jabatan KM", st in (200, 204) and first(prof).get("role") == "km", prof)
    st, me = rpc("get_my_profile", {}, t_admin)
    check("superadmin tetap superadmin", first(me).get("is_admin") is True, me)
    st, _ = rpc("set_member_role", {"p_user": b_id, "p_role": "mahasiswa"}, t_admin)
    st2, prof_b = rpc("get_my_profile", {}, t_b)
    check("KM lama (Sipen) dikembalikan jadi mahasiswa", st in (200, 204) and first(prof_b).get("role") == "mahasiswa", prof_b)

    # 4. Pengaturan SiPenDosa: jam operasional sepanjang hari + mode uji (dry run), template berversi
    st, _ = rpc("update_reminder_settings", {"p_window_start": "00:00", "p_window_end": "23:59:59", "p_dry_run": True}, t_a)
    check("KM atur jam operasional + mode uji", st in (200, 204))
    st, _ = rpc("set_reminder_template", {"p_template": "Yth. {{.NamaDosen}}, pengingat {{.Matkul}} ({{.Kode}}) {{.Hari}} {{.JamMulai}} - kelas {{.Kelas}}."}, t_a)
    st2, versions = http("GET", f"{API}/rest/v1/reminder_template_versions?select=id", token=t_a)
    check("versi template lama tersimpan", st in (200, 204) and len(versions) == 1, versions)

    # 4b. Dosen + jadwal hari ini dengan pengingat H-0 jam 00:00 (langsung jatuh tempo)
    st, lec_id = rpc("save_lecturer", {"p_id": None, "p_name": LECTURER, "p_phone": f"0899{RUN:08d}", "p_email": None}, t_a)
    check("KM menambah dosen", st == 200 and isinstance(lec_id, str), lec_id)
    today = DAYS[datetime.datetime.now(ZoneInfo("Asia/Makassar")).weekday()]
    st, course = http("POST", f"{API}/rest/v1/courses", {
        "class_id": cls["id"], "code": "E2E-1", "name": "Uji Pengingat", "day_of_week": today,
        "start_time": "23:00", "end_time": "23:50", "room": "Lab E2E", "lecturer_id": lec_id,
        "reminder_enabled": True, "reminder_mode": "H-0", "reminder_time": "00:00"}, t_a)
    check("KM menambah matkul + pengingat", st == 201, course)
    st, rows = http("GET", f"{API}/rest/v1/courses?select=id,lecturer:lecturers(full_name)", token=t_b)
    check("mahasiswa melihat jadwal kelasnya", st == 200 and len(rows) == 1 and (first(rows).get("lecturer") or {}).get("full_name") == LECTURER, rows)

    # 5. Portal dosen + kalender
    st, lecs = rpc("get_class_lecturers", {}, t_a)
    token = next(l["access_token"] for l in lecs if l["id"] == lec_id)
    st, new_token = rpc("regenerate_lecturer_token", {"p_id": lec_id}, t_a)
    check("KM membuat link dosen baru", st == 200 and isinstance(new_token, str) and len(new_token) == 48 and new_token != token, new_token)
    st, html = http("GET", f"{APP}/dosen/{token}", raw=True)
    check("link dosen lama tidak berlaku", st == 200 and "Tidak Valid" in html, st)
    token = new_token
    st, html = http("GET", f"{APP}/dosen/{token}", raw=True)
    check("portal dosen terbuka tanpa login", st == 200 and LECTURER in html and "Uji Pengingat" in html, st)
    st, ics = http("GET", f"{APP}/dosen/{token}/calendar.ics", raw=True)
    check("kalender .ics valid", st == 200 and "BEGIN:VEVENT" in ics and "RRULE:FREQ=WEEKLY" in ics, st)
    st, _ = http("GET", f"{APP}/dosen/{'0' * 48}", raw=True)
    check("portal token salah tetap 200 dengan pesan", st == 200)

    # 5b. Izin per jam (batch) + lampiran → portal dosen detail, lampiran, export Excel/ZIP
    today_iso = datetime.datetime.now(ZoneInfo("Asia/Makassar")).date().isoformat()
    course_id = first(course).get("id")
    pdf = b"%PDF-1.4\n% E2E lampiran\n"
    path = f"{id_b}/{RUN}-surat.pdf"
    st, _, _ = fetch(f"{API}/storage/v1/object/permit-proofs/{path}", pdf, method="POST",
                     headers={"apikey": KEY, "Authorization": f"Bearer {t_b}", "Content-Type": "application/pdf"})
    uploaded_paths.append(path)
    check("mahasiswa mengunggah lampiran", st == 200, st)
    leave = {"student_id": id_b, "course_id": course_id, "leave_type": "sakit", "start_date": today_iso,
             "end_date": today_iso, "reason": f"Alasan E2E {RUN}", "created_by": id_b, "batch_id": None,
             "file_urls": [{"name": "surat.pdf", "path": path, "type": "application/pdf", "size": len(pdf)}]}
    st, body = http("POST", f"{API}/rest/v1/leave_requests", [{**leave, "start_time": "10:00", "end_time": "11:00"}], t_b)
    check("izin per jam di luar jam kuliah ditolak", st >= 400 and "beririsan" in json.dumps(body), body)
    st, rows = http("POST", f"{API}/rest/v1/leave_requests", [{**leave, "start_time": "23:10", "end_time": "23:30"}], t_b)
    leave_id = first(rows).get("id")
    check("izin per jam (23:10–23:30) tersimpan", st == 201 and first(rows).get("start_time") == "23:10:00", rows)
    st, _ = http("PATCH", f"{API}/rest/v1/leave_requests?id=eq.{leave_id}", {"status": "approved", "verified_by": id_a}, t_a)
    check("KM menyetujui izin", st in (200, 204))
    st, html = http("GET", f"{APP}/dosen/{token}", raw=True)
    check("portal dosen menampilkan alasan izin", st == 200 and f"Alasan E2E {RUN}" in html, st)
    st, hdr, data = fetch(f"{APP}/dosen/{token}/lampiran/{leave_id}/0")
    check("dosen membuka lampiran lewat portal", st == 200 and data == pdf, st)
    st, _, _ = fetch(f"{APP}/dosen/{'0' * 48}/lampiran/{leave_id}/0")
    check("lampiran dengan token salah ditolak", st == 404, st)
    st, hdr, data = fetch(f"{APP}/dosen/{token}/export?format=xlsx")
    check("export Excel", st == 200 and "spreadsheet" in hdr.get("Content-Type", "") and data[:2] == b"PK", st)
    st, hdr, data = fetch(f"{APP}/dosen/{token}/export")
    names = zipfile.ZipFile(io.BytesIO(data)).namelist() if st == 200 else []
    check("export ZIP berisi Excel + lampiran",
          any(n.endswith(".xlsx") for n in names) and any(n.startswith("lampiran/") and n.endswith("surat.pdf") for n in names), names)

    # 5c. Reset kata sandi ke NIM (route server, sesi cookie KM)
    km_session = auth_session(NIM_KM, pw_a)
    reset = lambda sess, uid: fetch(f"{APP}/api/members/reset-password", json.dumps({"userId": uid}).encode(), method="POST",
                                    headers={"Content-Type": "application/json", "Cookie": session_cookie(sess)})
    b_session = auth_session(NIM_MHS, pw_b)
    st, _, _ = reset(b_session, id_a)
    check("mahasiswa tidak bisa mereset sandi KM", st == 403, st)
    st, _, body = reset(km_session, id_b)
    check("KM mereset sandi anggota", st == 200, body[:200])
    check("login dengan NIM sebagai sandi", login(NIM_MHS, NIM_MHS) is not None)
    check("anggota wajib ganti sandi", sql(f"SELECT is_password_changed FROM profiles WHERE id = '{id_b}'") == "f")
    pw_b = NIM_MHS
    t_b = login(NIM_MHS, pw_b)

    # 6. Penjadwal worker → mode uji: dirender dengan template kelas, dicatat tanpa dikirim (maks ~90 dtk)
    row = ""
    for _ in range(18):
        row = sql(f"SELECT status || '|' || COALESCE(body, '') FROM wa_messages WHERE course_id = '{first(course).get('id')}'")
        if row.startswith("dry_run"):
            break
        time.sleep(5)
    check("worker merender pengingat (mode uji, tidak dikirim)", row.startswith(f"dry_run|Yth. {LECTURER}, pengingat Uji Pengingat (E2E-1)"), row or "(tidak ada)")
    st, stats = rpc("wa_stats", {}, t_a)
    check("statistik mencatat mode uji", st == 200 and stats.get("dry_run_total") == 1, stats)
    msg_id = sql(f"SELECT id FROM wa_messages WHERE course_id = '{first(course).get('id')}'")
    st, _ = rpc("retry_wa_message", {"p_id": int(msg_id)}, t_a) if msg_id else (0, None)
    check("kirim ulang pesan uji", st in (200, 204))
    st, _ = rpc("wa_stats", {}, t_b)
    check("mahasiswa tidak bisa membaca statistik WA", st >= 400)

    # 6b. Papan jadwal publik kelas
    st, board_token = rpc("set_class_board", {"p_action": "on"}, t_a)
    check("KM mengaktifkan papan jadwal", st == 200 and isinstance(board_token, str) and len(board_token) == 48, board_token)
    st, html = http("GET", f"{APP}/kelas/{board_token}", raw=True)
    check("papan jadwal publik terbuka tanpa login", st == 200 and "Uji Pengingat" in html and CLASS_KM in html, st)
    st, ics = http("GET", f"{APP}/kelas/{board_token}/calendar.ics", raw=True)
    check("kalender papan jadwal valid", st == 200 and f"X-WR-CALNAME:Jadwal Kuliah {CLASS_KM}" in ics, st)
    rpc("set_class_board", {"p_action": "off"}, t_a)
    st, _ = http("GET", f"{APP}/kelas/{board_token}/calendar.ics", raw=True)
    check("papan jadwal nonaktif tidak bisa dibuka", st == 404, st)

    # 7. WhatsApp: minta QR → worker menulis QR dari server WhatsApp
    st, _ = rpc("wa_request", {"p_action": "on"}, t_a)
    state = ""
    for _ in range(12):
        st, s = http("GET", f"{API}/rest/v1/wa_sessions?select=state,qr_code,worker_seen_at", token=t_a)
        state = first(s).get("state", "")
        if state == "need_qr" and first(s).get("qr_code"):
            break
        time.sleep(3)
    check("worker menampilkan QR WhatsApp (isi QR dari server WhatsApp)", state == "need_qr" and len(first(s).get("qr_code") or "") > 20, s)
    rpc("wa_request", {"p_action": "off"}, t_a)
    time.sleep(5)
    st, s = http("GET", f"{API}/rest/v1/wa_sessions?select=state", token=t_a)
    check("putuskan WhatsApp", first(s).get("state") == "disconnected", s)
    st, s = http("GET", f"{API}/rest/v1/wa_sessions?select=state", token=t_b)
    check("mahasiswa tidak melihat sesi WA", s == [], s)

    # 7b. 2FA (TOTP): daftar faktor → sesi password saja (aal1) kehilangan hak → verifikasi kode (aal2)
    st, factor = http("POST", f"{API}/auth/v1/factors", {"factor_type": "totp", "friendly_name": "E2E"}, t_a)
    fid, secret = factor.get("id"), (factor.get("totp") or {}).get("secret")
    st, ch = http("POST", f"{API}/auth/v1/factors/{fid}/challenge", {}, t_a)
    st, v = http("POST", f"{API}/auth/v1/factors/{fid}/verify", {"challenge_id": ch.get("id"), "code": totp(secret)}, t_a)
    check("KM mengaktifkan 2FA", st == 200 and v.get("access_token"), v)
    t_aal1 = login(NIM_KM, pw_a)
    st, rows = http("GET", f"{API}/rest/v1/courses?select=id", token=t_aal1)
    check("2FA: login password saja tidak melihat data kelas", st == 200 and rows == [], rows)
    st, _ = rpc("wa_stats", {}, t_aal1)
    check("2FA: login password saja kehilangan hak KM", st >= 400)
    st, ch = http("POST", f"{API}/auth/v1/factors/{fid}/challenge", {}, t_aal1)
    st, v = http("POST", f"{API}/auth/v1/factors/{fid}/verify", {"challenge_id": ch.get("id"), "code": totp(secret)}, t_aal1)
    st, rows = http("GET", f"{API}/rest/v1/courses?select=id", token=v.get("access_token"))
    check("2FA: setelah kode benar hak kembali", st == 200 and len(rows) == 1, rows)

    # 8. Halaman aplikasi
    for path, want in [("/login", 200), ("/register", 200)]:
        st, _ = http("GET", f"{APP}{path}", raw=True)
        check(f"GET {path}", st == want, st)
    req = urllib.request.Request(f"{APP}/jadwal", method="GET")
    opener = urllib.request.build_opener(type("NoRedirect", (urllib.request.HTTPRedirectHandler,), {"redirect_request": lambda *a, **k: None}))
    try:
        opener.open(req, timeout=20)
        st = 200
    except urllib.error.HTTPError as e:
        st, loc = e.code, e.headers.get("Location", "")
    check("rute terlindungi dialihkan ke login", st in (302, 307) and "/login" in loc, st)


try:
    main()
except Exception:  # error skrip = gagal, jangan tertelan oleh sys.exit di finally
    import traceback
    traceback.print_exc()
    failed += 1
finally:
    # Hanya data run ini: akun (profil/izin ikut terhapus), kelas milik akun itu (matkul, sesi WA,
    # antrean ikut terhapus), dosen buatan run ini. Tiap perintah terpisah agar ringkasan tetap tercetak.
    ids = ",".join(f"'{u}'" for u in created_users)
    cleanup = [f"DELETE FROM lecturers WHERE full_name = '{LECTURER}'"]
    if ids:
        cleanup += [f"DELETE FROM classes WHERE created_by IN ({ids})", f"DELETE FROM auth.users WHERE id IN ({ids})"]
    for stmt in cleanup:
        try:
            sql(stmt)
        except Exception as e:  # noqa: BLE001
            print(f"PERINGATAN pembersihan gagal: {stmt}: {e}")
    if uploaded_paths:  # berkas storage tidak ikut terhapus bersama akun
        svc = next(l.split("=", 1)[1].strip() for l in open("/project/supabase/.env") if l.startswith("SERVICE_ROLE_KEY="))
        st, _, _ = fetch(f"{API}/storage/v1/object/permit-proofs", json.dumps({"prefixes": uploaded_paths}).encode(), method="DELETE",
                         headers={"apikey": svc, "Authorization": f"Bearer {svc}", "Content-Type": "application/json"})
        if st != 200:
            print(f"PERINGATAN lampiran uji tidak terhapus ({st})")
    print(f"== {passed} lulus, {failed} gagal (data uji run {RUN} dibersihkan)")
    sys.exit(1 if failed else 0)
