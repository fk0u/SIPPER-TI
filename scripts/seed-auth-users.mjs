#!/usr/bin/env node
// Membuat akun login NIM (Supabase Auth) untuk daftar mahasiswa.
// Email sintetis: {nim}@local.sipper-ti, password awal = NIM (wajib diganti saat login pertama).
//
// Pemakaian:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-auth-users.mjs [roster.csv]
//
// Format CSV (dengan header): id,nim,full_name,role
//   - id opsional (kosongkan agar dibuat otomatis); isi untuk mencocokkan supabase/seed.sql
//   - role: mahasiswa | sipen | km
// Tanpa argumen, akun demo dari supabase/seed.sql yang dibuat.
//
// SUPABASE_SERVICE_ROLE_KEY bersifat rahasia: jangan pernah diberi prefix NEXT_PUBLIC_.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terlebih dahulu.');
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

function readRoster(path) {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const cols = header.split(',').map((c) => c.trim());
  return lines.filter(Boolean).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    return Object.fromEntries(cols.map((c, i) => [c, values[i] || undefined]));
  });
}

const roster = process.argv[2] ? readRoster(process.argv[2]) : DEMO_ROSTER;
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let created = 0;
let skipped = 0;
for (const { id, nim, full_name, role = 'mahasiswa' } of roster) {
  if (!nim || !full_name) {
    console.warn('Lewati baris tanpa nim/full_name:', { id, nim, full_name });
    continue;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    ...(id ? { id } : {}),
    email: `${nim}@local.sipper-ti`,
    password: nim,
    email_confirm: true,
    user_metadata: { nim, full_name },
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      skipped++;
      continue;
    }
    console.error(`Gagal membuat ${nim}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }

  if (role !== 'mahasiswa') {
    const { error: roleError } = await supabase.from('profiles').update({ role }).eq('id', data.user.id);
    if (roleError) console.error(`Gagal set role ${role} untuk ${nim}: ${roleError.message}`);
  }
  created++;
}

console.log(`Selesai: ${created} akun dibuat, ${skipped} sudah ada.`);
