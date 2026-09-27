// E2E mode demo (tanpa env Supabase). Jalankan server dulu:
//   npm run build && PORT=3100 npm run start &
//   E2E_BASE_URL=http://localhost:3100 npm run test:e2e
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100';
const results = [];
const check = (name, ok, extra='') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
);
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

// 1. Unauthenticated -> landing, protected page redirects to login
await page.goto(BASE + '/');
await page.waitForSelector('text=Masuk ke Akun Kampus');
check('landing shows login CTA for guests', true);
await page.goto(BASE + '/approval');
await page.waitForURL(/\/login\?next=%2Fapproval/);
check('unauth /approval -> /login?next', true);

// 2. NIM login with default password -> forced password change
await page.fill('input[placeholder^="Contoh"]', '2311102441101');
await page.fill('input[type=password]', 'password123');
await page.click('button:has-text("Masuk dengan NIM")');
await page.waitForSelector('text=NIM atau kata sandi tidak cocok');
check('backdoor password123 rejected', true);
await page.fill('input[type=password]', '2311102441101');
await page.click('button:has-text("Masuk dengan NIM")');
await page.waitForURL(/\/settings\/password/);
check('default NIM password forces /settings/password', true);
await page.goto(BASE + '/');
await page.waitForURL(/\/settings\/password/);
check('cannot escape forced password page', true);
await page.fill('#new-password', 'rahasia-baru-1');
await page.fill('#confirm-password', 'rahasia-baru-1');
await page.click('button:has-text("Simpan Kata Sandi")');
await page.waitForURL(BASE + '/');
await page.waitForSelector('text=Halo');
check('password changed -> home', true);

// 3. Student visibility & nav
const body = await page.textContent('main');
check('student does not see other students leave (Dinda)', !body.includes('Dinda Safitri'));
check('student sees own leave (Rian)', body.includes('Rian Pratama'));
const desktopNav = await page.locator('header nav').textContent();
check('student nav hides Approval/Link Dosen', !desktopNav.includes('Approval') && !desktopNav.includes('Link Dosen'), desktopNav);
await page.goto(BASE + '/admin/tokens');
await page.waitForSelector('text=Akses Ditolak');
check('student blocked from /admin/tokens', true);

// 4. Leave form: sakit without file blocked, izin without file ok, no fake attachment
await page.goto(BASE + '/leave/new');
await page.waitForSelector('text=Ajukan Perizinan Kuliah');
const startVal = await page.inputValue('input[type=date] >> nth=0');
const now = new Date(); const pad=n=>String(n).padStart(2,'0');
const localToday = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
check('default date = local today', startVal === localToday, `${startVal} vs ${localToday}`);
await page.fill('textarea', 'Uji otomatis izin pribadi');
await page.click('button:has-text("Kirim Pengajuan Izin")');
await page.waitForSelector('text=wajib melampirkan');
check('sakit without attachment rejected', true);
await page.click('button:has-text("Izin Pribadi")');
await page.setInputFiles('input[type=file]', [{ name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('x') }, { name: 'besar.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(6*1024*1024) }]);
const errText = await page.locator('ul').first().textContent();
check('file errors collected (type + size)', errText.includes('virus.exe') && errText.includes('besar.pdf'));
await page.click('button:has-text("Kirim Pengajuan Izin")');
await page.waitForURL(BASE + '/', { timeout: 5000 });
await page.waitForSelector('text=Uji otomatis izin pribadi');
const persisted = await page.evaluate(() => localStorage.getItem('sipper-ti-leave-store'));
check('no fake picsum attachment', !persisted.includes('picsum'));

// 5. Switch to Sipen Sarah via logout + quick demo
await page.click('header button[aria-label="Menu akun pengguna"]');
await page.click('text=Keluar (Logout)');
await page.waitForURL(/\/login/);
await page.click('button:has-text("Sarah Amalia")');
await page.waitForURL(BASE + '/');
await page.goto(BASE + '/approval');
await page.waitForSelector('text=Terminal Approval');
const appr = await page.textContent('main');
check('sipen sees Cloud course request (Rian)', appr.includes('Rian Pratama'));
check('sipen does not see ML course request (Farhan)', !appr.includes('Farhan'));
// Rian's izin (course default = first course = Cloud) is pending; approve buttons exist
const approveBtns = await page.locator('button:has-text("Setujui")').count();
check('sipen has approve buttons', approveBtns > 0, String(approveBtns));

// 6. KM Budi creates token; open in new context (other browser) -> demo message
await page.click('header button[aria-label="Menu akun pengguna"]');
await page.click('text=Keluar (Logout)');
await page.waitForURL(/\/login/);
await page.click('button:has-text("Budi Santoso")');
await page.waitForURL(BASE + '/');
await page.goto(BASE + '/admin/tokens');
await page.fill('input[placeholder^="Contoh: Link Dosen"]', 'Uji Token');
await page.click('button:has-text("Generate Tautan Publik")');
await page.waitForSelector('text=Uji Token');
const store = JSON.parse(await page.evaluate(() => localStorage.getItem('sipper-ti-leave-store')));
const tok = store.state.lecturerTokens.find(t => t.label === 'Uji Token').token;
check('token is 48 hex chars (crypto)', /^[0-9a-f]{48}$/.test(tok), tok);
await page.goto(BASE + '/lecturer/' + tok);
await page.waitForSelector('text=Rekap Presensi Seluruh Perkuliahan TI');
const lec = await page.textContent('main');
check('lecturer view hides reasons', !lec.includes('Demam tinggi') && !lec.includes('Rawat inap'));
check('lecturer view shows approved only (no Rian pending)', !lec.includes('Rian Pratama'));
// expired token
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('sipper-ti-leave-store')); s.state.lecturerTokens[0].expires_at = '2000-01-01T00:00:00Z'; localStorage.setItem('sipper-ti-leave-store', JSON.stringify(s)); });
await page.goto(BASE + '/lecturer/' + tok);
await page.waitForSelector('text=Kedaluwarsa');
check('expired token rejected', true);

// 7. theme persists without flash
await page.evaluate(() => localStorage.setItem('sipper-ti-theme-store', JSON.stringify({state:{theme:'light'},version:0})));
await page.goto(BASE + '/login');
const cls = await page.evaluate(() => document.documentElement.className);
check('light theme applied from storage', cls.includes('light') && !/\bdark\b/.test(cls), cls);

const relevantErrors = errors.filter(e => !e.includes('favicon'));
check('no page/console errors', relevantErrors.length === 0, relevantErrors.slice(0,3).join(' | '));
await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL'));
console.log(`== ${results.length - failed.length} lulus, ${failed.length} gagal`);
if (failed.length > 0) process.exit(1);
