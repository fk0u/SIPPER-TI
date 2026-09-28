#!/usr/bin/env node
// Membuat akun login NIM (Supabase Auth) untuk daftar mahasiswa.
// Email kampus: {nim}@umkt.ac.id (akun yang sama dengan Google SSO), password awal = NIM
// (wajib diganti saat login pertama).
//
// Pemakaian:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... CLASS_ID=<uuid kelas> node scripts/seed-auth-users.mjs [roster.csv]
//
// Akun langsung aktif (tanpa ACC) di kelas CLASS_ID. Tanpa roster: akun demo di kelas demo supabase/seed.sql.
//
// Format CSV (dengan header): id,nim,full_name,role
//   - id opsional (kosongkan agar dibuat otomatis); isi untuk mencocokkan supabase/seed.sql
//   - role: mahasiswa | sipen | km
// Tanpa argumen, akun demo dari supabase/seed.sql yang dibuat.
//
// SUPABASE_SECRET_KEY (atau SUPABASE_SERVICE_ROLE_KEY lama) bersifat rahasia: jangan pernah diberi prefix NEXT_PUBLIC_.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY terlebih dahulu.');
  process.exit(1);
}

const DEMO_CLASS_ID = '0d000000-0000-0000-0000-00000000000d';
const classId = process.env.CLASS_ID ?? (process.argv[2] ? '' : DEMO_CLASS_ID);
if (!/^[0-9a-f-]{36}$/i.test(classId)) {
  console.error('Set CLASS_ID (uuid kelas tujuan) untuk roster ini.');
  process.exit(1);
}

const DEMO_ROSTER = [
  ['a0000000-0000-0000-0000-000000000001', '2311102441101', 'Rian Pratama', 'mahasiswa'],
  ['a0000000-0000-0000-0000-000000000002', '2311102441102', 'Sarah Amalia', 'sipen'],
  ['a0000000-0000-0000-0000-000000000003', '2311102441103', 'Budi Santoso', 'km'],
  ['a0000000-0000-0000-0000-000000000004', '2311102441104', 'Dinda Safitri', 'mahasiswa'],
  ['a0000000-0000-0000-0000-000000000005', '2311102441105', 'Kevin Angela Wijaya', 'sipen'],
  ['a0000000-0000-0000-0000-000000000006', '2311102441106', 'Nadia Putri Lestari', 'mahasiswa'],
  ['a0000000-0000-0000-0000-000000000007', '2311102441107', 'Farhan Ali Syahputra', 'mahasiswa'],
  ['a0000000-0000-0000-0000-000000000008', '2311102441108', 'Aisha Az-Zahra', 'mahasiswa'],
  ['a0000000-0000-0000-0000-000000000009', '2311102441109', 'Michael Tanujaya', 'mahasiswa'],
  ['a0000000-0000-0000-0000-000000000010', '2311102441110', 'Zahra Salsabila', 'mahasiswa'],
].map(([id, nim, full_name, role]) => ({ id, nim, full_name, role }));

const ROLES = new Set(['mahasiswa', 'sipen', 'km']);

// CSV sederhana: tanpa tanda kutip / koma di dalam nilai. Baris yang tidak sesuai ditolak,
// bukan diparse diam-diam dengan kolom bergeser.
function readRoster(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const cols = header.split(',').map((c) => c.trim());
  return lines.filter(Boolean).map((line, i) => {
    const values = line.split(',').map((v) => v.trim());
    if (line.includes('"') || values.length !== cols.length) {
      throw new Error(`Baris ${i + 2} tidak valid (gunakan ${cols.length} kolom tanpa tanda kutip/koma di dalam nilai): ${line}`);
    }
    return Object.fromEntries(cols.map((c, j) => [c, values[j] || undefined]));
  });
}

const roster = process.argv[2] ? readRoster(process.argv[2]) : DEMO_ROSTER;

// Tolak NIM / id ganda sebelum menyentuh database.
for (const key of ['nim', 'id']) {
  const seen = new Set();
  for (const row of roster) {
    const value = row[key];
    if (!value) continue;
    if (seen.has(value)) {
      console.error(`Roster tidak valid: ${key} ganda "${value}".`);
      process.exit(1);
    }
    seen.add(value);
  }
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let created = 0;
let existing = 0;
let failed = 0;
for (const { id, nim, full_name, role = 'mahasiswa' } of roster) {
  if (!nim || !full_name || !/^[0-9]{8,20}$/.test(nim) || !ROLES.has(role)) {
    console.error('Baris tidak valid (nim numerik, full_name, role mahasiswa|sipen|km):', { id, nim, full_name, role });
    failed++;
    continue;
  }
  const { error } = await supabase.auth.admin.createUser({
    ...(id ? { id } : {}),
    email: `${nim}@umkt.ac.id`,
    password: nim,
    email_confirm: true,
    // app_metadata hanya bisa diisi service role: akun langsung aktif (lihat handle_new_user)
    app_metadata: { preapproved: true },
    user_metadata: { full_name, class_id: classId },
  });

  if (error && !/already|registered|exists/i.test(error.message)) {
    console.error(`Gagal membuat ${nim}: ${error.message}`);
    failed++;
    continue;
  }
  if (error) {
    // Akun sudah ada: pastikan id-nya sama dengan roster bila roster menetapkan id.
    if (id) {
      const { data: existingUser } = await supabase.auth.admin.getUserById(id);
      if (existingUser?.user?.email !== `${nim}@umkt.ac.id`) {
        console.error(`NIM ${nim} sudah terdaftar dengan id berbeda dari roster (${id}).`);
        failed++;
        continue;
      }
    }
    existing++;
  } else {
    created++;
  }

  // Selalu sinkronkan role dari roster — juga untuk akun yang sudah ada (roster berubah / percobaan sebelumnya gagal).
  const { data: updated, error: roleError } = await supabase
    .from('profiles')
    .update({ role, full_name, class_id: classId, status: 'active' })
    .eq('nim', nim)
    .select('id');
  if (roleError || !updated?.length) {
    console.error(`Gagal set role ${role} untuk ${nim}: ${roleError?.message ?? 'profil tidak ditemukan'}`);
    failed++;
  }
}

console.log(`Selesai: ${created} akun dibuat, ${existing} sudah ada, ${failed} gagal.`);
if (failed > 0) process.exitCode = 1;
