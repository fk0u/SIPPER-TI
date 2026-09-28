#!/usr/bin/env python3
"""Uji end-to-end lewat API terhadap server yang berjalan (registrasi → ACC → jadwal →
portal dosen → WhatsApp worker). Membuat akun uji NIM 9999…, lalu menghapusnya.

Pemakaian (di server):  sudo python3 scripts/e2e-api.py
Butuh: /project/supabase/.env (publishable key) dan akses docker compose untuk seed/cleanup.
"""
import base64, hashlib, hmac, json, secrets, struct, subprocess, sys, time, urllib.error, urllib.request

APP = "https://app.85-211-245-134.sslip.io"
API = "https://api.85-211-245-134.sslip.io"
KEY = next(l.split("=", 1)[1].strip() for l in open("/project/supabase/.env") if l.startswith("SUPABASE_PUBLISHABLE_KEY="))
DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
passed = failed = 0


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
    return st, body, pw


def login(nim, pw):
    st, body = http("POST", f"{API}/auth/v1/token?grant_type=password", {"email": f"{nim}@umkt.ac.id", "password": pw})
    return body.get("access_token") if st == 200 else None


def rpc(fn, args, token):
    return http("POST", f"{API}/rest/v1/rpc/{fn}", args, token)


def main():
    # 1. Pengaju kelas baru → pending
    st, body, pw_a = signup("9999000000001", {"full_name": "E2E KM", "self_registered": True, "new_class_name": "Kelas Uji E2E"})
    check("daftar + ajukan kelas", st == 200 and body.get("access_token"), body)
    st, body, pw_admin = signup("9999000000002", {"full_name": "E2E Admin", "self_registered": True, "new_class_name": "Kelas Admin E2E"})
    # Bootstrap superadmin (seperti admin pertama platform): lewat SQL
    sql("UPDATE classes SET status='active' WHERE name='Kelas Admin E2E';"
        "UPDATE profiles SET is_admin=true, status='active', role='km' WHERE nim='9999000000002';")
    t_admin = login("9999000000002", pw_admin)
    t_a = login("9999000000001", pw_a)
    st, prof = rpc("get_my_profile", {}, t_a)
    check("pengaju masih pending", st == 200 and prof[0]["status"] == "pending", prof)
    st, rows = http("GET", f"{API}/rest/v1/courses?select=id", token=t_a)
    check("pending belum bisa melihat matkul", st == 200 and rows == [], rows)

    # 2. Admin menyetujui kelas
    st, pend = rpc("list_pending_classes", {}, t_admin)
    cls = next((c for c in pend if c["name"] == "Kelas Uji E2E"), None) if st == 200 else None
    check("admin melihat pengajuan", cls is not None, pend)
    st, _ = rpc("approve_class", {"p_class": cls["id"]}, t_admin)
    check("admin ACC kelas", st in (200, 204))
    st, prof = rpc("get_my_profile", {}, t_a)
    check("pengaju kini KM aktif", prof[0]["status"] == "active" and prof[0]["role"] == "km", prof)
    st, _ = rpc("approve_class", {"p_class": cls["id"]}, t_a)
    check("KM biasa tidak bisa ACC kelas", st >= 400)

    # 3. Mahasiswa daftar ke kelas itu → KM ACC
    st, body, pw_b = signup("9999000000003", {"full_name": "E2E Mahasiswa", "self_registered": True, "class_id": cls["id"]})
    check("mahasiswa daftar ke kelas", st == 200)
    t_b = login("9999000000003", pw_b)
    st, rows = http("GET", f"{API}/rest/v1/profiles?select=id,full_name,status&status=eq.pending", token=t_a)
    b_id = next((r["id"] for r in rows if r["full_name"] == "E2E Mahasiswa"), None) if st == 200 else None
    check("KM melihat pendaftar pending", b_id is not None, rows)
    st, _ = rpc("approve_member", {"p_user": b_id}, t_a)
    check("KM ACC pendaftar", st in (200, 204))

    # 3b. Migrasi KM: superadmin menunjuk KM baru, lalu mengembalikannya
    st, _ = rpc("set_member_role", {"p_user": b_id, "p_role": "km"}, t_admin)
    st2, prof = rpc("get_my_profile", {}, t_a)
    check("superadmin memindahkan KM (KM lama jadi Sipen)", st in (200, 204) and prof[0]["role"] == "sipen", prof)
    st, _ = rpc("set_member_role", {"p_user": b_id, "p_role": "mahasiswa"}, t_a)
    check("Sipen tidak bisa mengubah peran", st >= 400)
    st, _ = rpc("set_member_role", {"p_user": prof[0]["id"], "p_role": "km"}, t_b)
    st2, prof = rpc("get_my_profile", {}, t_a)
    check("KM baru menyerahkan kembali jabatan KM", st in (200, 204) and prof[0]["role"] == "km", prof)
    st, me = rpc("get_my_profile", {}, t_admin)
    check("superadmin tetap superadmin", me[0]["is_admin"] is True, me)
    st, _ = rpc("set_member_role", {"p_user": b_id, "p_role": "mahasiswa"}, t_admin)
    st2, prof_b = rpc("get_my_profile", {}, t_b)
    check("KM lama (Sipen) dikembalikan jadi mahasiswa", st in (200, 204) and prof_b[0]["role"] == "mahasiswa", prof_b)

    # 4. Pengaturan SiPenDosa: jam operasional sepanjang hari + mode uji (dry run), template berversi
    st, _ = rpc("update_reminder_settings", {"p_window_start": "00:00", "p_window_end": "23:59", "p_dry_run": True}, t_a)
    check("KM atur jam operasional + mode uji", st in (200, 204))
    st, _ = rpc("set_reminder_template", {"p_template": "Yth. {{.NamaDosen}}, pengingat {{.Matkul}} ({{.Kode}}) {{.Hari}} {{.JamMulai}} - kelas {{.Kelas}}."}, t_a)
    st2, versions = http("GET", f"{API}/rest/v1/reminder_template_versions?select=id", token=t_a)
    check("versi template lama tersimpan", st in (200, 204) and len(versions) == 1, versions)

    # 4b. Dosen + jadwal hari ini dengan pengingat H-0 jam 00:00 (langsung jatuh tempo)
    st, lec_id = rpc("save_lecturer", {"p_id": None, "p_name": "Dr. Uji E2E", "p_phone": "0899-9999-0001", "p_email": None}, t_a)
    check("KM menambah dosen", st == 200 and isinstance(lec_id, str), lec_id)
    today = DAYS[time.localtime().tm_wday]
    st, course = http("POST", f"{API}/rest/v1/courses", {
        "class_id": cls["id"], "code": "E2E-1", "name": "Uji Pengingat", "day_of_week": today,
        "start_time": "23:00", "end_time": "23:50", "room": "Lab E2E", "lecturer_id": lec_id,
        "reminder_enabled": True, "reminder_mode": "H-0", "reminder_time": "00:00"}, t_a)
    check("KM menambah matkul + pengingat", st == 201, course)
    st, rows = http("GET", f"{API}/rest/v1/courses?select=id,lecturer:lecturers(full_name)", token=t_b)
    check("mahasiswa melihat jadwal kelasnya", st == 200 and len(rows) == 1 and rows[0]["lecturer"]["full_name"] == "Dr. Uji E2E", rows)

    # 5. Portal dosen + kalender
    st, lecs = rpc("get_class_lecturers", {}, t_a)
    token = next(l["access_token"] for l in lecs if l["id"] == lec_id)
    st, new_token = rpc("regenerate_lecturer_token", {"p_id": lec_id}, t_a)
    check("KM membuat link dosen baru", st == 200 and isinstance(new_token, str) and len(new_token) == 48 and new_token != token, new_token)
    st, html = http("GET", f"{APP}/dosen/{token}", raw=True)
    check("link dosen lama tidak berlaku", st == 200 and "Tidak Valid" in html, st)
    token = new_token
    st, html = http("GET", f"{APP}/dosen/{token}", raw=True)
    check("portal dosen terbuka tanpa login", st == 200 and "Dr. Uji E2E" in html and "Uji Pengingat" in html, st)
    st, ics = http("GET", f"{APP}/dosen/{token}/calendar.ics", raw=True)
    check("kalender .ics valid", st == 200 and "BEGIN:VEVENT" in ics and "RRULE:FREQ=WEEKLY" in ics, st)
    st, _ = http("GET", f"{APP}/dosen/{'0' * 48}", raw=True)
    check("portal token salah tetap 200 dengan pesan", st == 200)

    # 6. Penjadwal worker → mode uji: dirender dengan template kelas, dicatat tanpa dikirim (maks ~90 dtk)
    row = ""
    for _ in range(18):
        row = sql(f"SELECT status || '|' || COALESCE(body, '') FROM wa_messages WHERE course_id = '{course[0]['id']}'")
        if row.startswith("dry_run"):
            break
        time.sleep(5)
    check("worker merender pengingat (mode uji, tidak dikirim)", row.startswith("dry_run|Yth. Dr. Uji E2E, pengingat Uji Pengingat (E2E-1)"), row or "(tidak ada)")
    st, stats = rpc("wa_stats", {}, t_a)
    check("statistik mencatat mode uji", st == 200 and stats.get("dry_run_total") == 1, stats)
    msg_id = sql(f"SELECT id FROM wa_messages WHERE course_id = '{course[0]['id']}'")
    st, _ = rpc("retry_wa_message", {"p_id": int(msg_id)}, t_a) if msg_id else (0, None)
    check("kirim ulang pesan uji", st in (200, 204))
    st, _ = rpc("wa_stats", {}, t_b)
    check("mahasiswa tidak bisa membaca statistik WA", st >= 400)

    # 6b. Papan jadwal publik kelas
    st, board_token = rpc("set_class_board", {"p_action": "on"}, t_a)
    check("KM mengaktifkan papan jadwal", st == 200 and isinstance(board_token, str) and len(board_token) == 48, board_token)
    st, html = http("GET", f"{APP}/kelas/{board_token}", raw=True)
    check("papan jadwal publik terbuka tanpa login", st == 200 and "Uji Pengingat" in html and "Kelas Uji E2E" in html, st)
    st, ics = http("GET", f"{APP}/kelas/{board_token}/calendar.ics", raw=True)
    check("kalender papan jadwal valid", st == 200 and "X-WR-CALNAME:Jadwal Kuliah Kelas Uji E2E" in ics, st)
    rpc("set_class_board", {"p_action": "off"}, t_a)
    st, _ = http("GET", f"{APP}/kelas/{board_token}/calendar.ics", raw=True)
    check("papan jadwal nonaktif tidak bisa dibuka", st == 404, st)

    # 7. WhatsApp: minta QR → worker menulis QR dari server WhatsApp
    st, _ = rpc("wa_request", {"p_action": "on"}, t_a)
    state = ""
    for _ in range(12):
        st, s = http("GET", f"{API}/rest/v1/wa_sessions?select=state,qr_code,worker_seen_at", token=t_a)
        state = s[0]["state"] if s else ""
        if state == "need_qr" and s[0]["qr_code"]:
            break
        time.sleep(3)
    check("worker menampilkan QR WhatsApp", state == "need_qr", s)
    rpc("wa_request", {"p_action": "off"}, t_a)
    time.sleep(5)
    st, s = http("GET", f"{API}/rest/v1/wa_sessions?select=state", token=t_a)
    check("putuskan WhatsApp", s and s[0]["state"] == "disconnected", s)
    st, s = http("GET", f"{API}/rest/v1/wa_sessions?select=state", token=t_b)
    check("mahasiswa tidak melihat sesi WA", s == [], s)

    # 7b. 2FA (TOTP): daftar faktor → sesi password saja (aal1) kehilangan hak → verifikasi kode (aal2)
    st, factor = http("POST", f"{API}/auth/v1/factors", {"factor_type": "totp", "friendly_name": "E2E"}, t_a)
    fid, secret = factor.get("id"), (factor.get("totp") or {}).get("secret")
    st, ch = http("POST", f"{API}/auth/v1/factors/{fid}/challenge", {}, t_a)
    st, v = http("POST", f"{API}/auth/v1/factors/{fid}/verify", {"challenge_id": ch.get("id"), "code": totp(secret)}, t_a)
    check("KM mengaktifkan 2FA", st == 200 and v.get("access_token"), v)
    t_aal1 = login("9999000000001", pw_a)
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
    sql("DELETE FROM wa_sessions WHERE class_id IN (SELECT id FROM classes WHERE name LIKE '%E2E');"
        "DELETE FROM lecturers WHERE full_name = 'Dr. Uji E2E';"
        "DELETE FROM auth.users WHERE email LIKE '9999%@umkt.ac.id';"
        "DELETE FROM classes WHERE name LIKE '%E2E';")
    print(f"== {passed} lulus, {failed} gagal (data uji dibersihkan)")
    sys.exit(1 if failed else 0)
