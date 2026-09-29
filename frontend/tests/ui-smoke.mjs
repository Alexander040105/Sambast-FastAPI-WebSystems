import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Real-browser smoke test: production build (vite preview) + live API.
// Run with: node tests/ui-smoke.mjs  (needs backend on :8000, preview on :4173)
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puppeteerPath = join(frontend, 'node_modules', 'puppeteer-core');
const { default: puppeteer } = await import(pathToFileURL(join(puppeteerPath, 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')));
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(executablePath, 'No Chrome/Edge found');

const UI = process.env.UI_URL || 'http://127.0.0.1:4173';
const results = [];
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--disable-gpu'] });

async function check(name, fn) {
  // Fresh incognito context per check — auth state must not leak between tests.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  try {
    await fn(page);
    results.push([true, name]);
    console.log(`  [OK ] ${name}`);
  } catch (err) {
    results.push([false, name]);
    console.log(`  [FAIL] ${name}: ${err.message}`);
  }
  const realErrors = consoleErrors.filter((e) => !e.includes('net::ERR') && !e.includes('favicon'));
  if (realErrors.length) console.log(`        console errors: ${realErrors.slice(0, 3).join(' | ')}`);
  await context.close();
}

async function uiLogin(page, email, password) {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.type('#email', email);
  await page.type('#password', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }),
    page.click('button[type="submit"]'),
  ]);
}

console.log('=== UI SMOKE (real browser, live API) ===');

await check('login page renders email+password form', async (page) => {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle0', timeout: 20000 });
  assert.ok(await page.$('#email'), 'email input missing');
  assert.ok(await page.$('#password'), 'password input missing');
  const headings = await page.$$eval('h1, h2', (els) => els.map((e) => e.textContent));
  assert.ok(headings.some((h) => /sambast/i.test(h)), 'brand heading missing');
});

for (const [role, email, landing] of [
  ['admin', 'admin@sambast.com', '/admin/catalog'],
  ['dispatcher', 'dispatcher@sambast.com', '/dispatcher'],
  ['ops', 'ops@sambast.com', '/ops'],
  ['driver', 'driver1@sambast.com', '/driver'],
  ['customer', 'customer@sambast.com', '/customer'],
]) {
  await check(`login ${role} -> ${landing}`, async (page) => {
    await uiLogin(page, email, 'testpass123');
    assert.ok(page.url().startsWith(UI + landing), `landed on ${page.url()}`);
    await page.waitForSelector('body', { timeout: 5000 });
  });
}

await check('bad login shows inline error, stays on /login', async (page) => {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle0' });
  await page.type('#email', 'admin@sambast.com');
  await page.type('#password', 'wrongpass99');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.innerText.match(/invalid|unable|incorrect|unauthoriz/i), { timeout: 15000 });
  assert.ok(page.url().includes('/login'), 'should stay on login');
});

await check('register page renders all fields', async (page) => {
  await page.goto(`${UI}/register`, { waitUntil: 'networkidle0' });
  for (const id of ['#full_name', '#email', '#contact_no', '#password', '#password_confirm']) {
    assert.ok(await page.$(id), `${id} missing`);
  }
});

await check('register -> auto-login -> /customer', async (page) => {
  const stamp = Date.now();
  await page.goto(`${UI}/register`, { waitUntil: 'networkidle0' });
  await page.type('#full_name', 'UI Smoke Tester');
  await page.type('#email', `ui.smoke.${stamp}@test.dev`);
  await page.type('#contact_no', `0917${String(stamp).slice(-7)}`);
  await page.type('#password', 'uitestpass123');
  await page.type('#password_confirm', 'uitestpass123');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  assert.ok(page.url().startsWith(`${UI}/customer`), `landed on ${page.url()}`);
});

await check('storefront renders product catalog', async (page) => {
  await uiLogin(page, 'customer@sambast.com', 'testpass123');
  await page.waitForSelector('body', { timeout: 8000 });
  const text = await page.evaluate(() => document.body.innerText);
  assert.ok(text.length > 100, 'storefront body empty');
});

await check('unauthenticated /dispatcher redirects to /login', async (page) => {
  await page.goto(`${UI}/dispatcher/fleet`, { waitUntil: 'networkidle0' });
  assert.ok(page.url().includes('/login'), `no redirect, at ${page.url()}`);
});

await check('dispatcher queue page renders table', async (page) => {
  await uiLogin(page, 'dispatcher@sambast.com', 'testpass123');
  await page.goto(`${UI}/dispatcher/queue`, { waitUntil: 'networkidle0', timeout: 25000 });
  await page.waitForSelector('.dispatch-page, table, main', { timeout: 15000 });
});

await check('ops dashboard renders', async (page) => {
  await uiLogin(page, 'ops@sambast.com', 'testpass123');
  await page.waitForSelector('.ops-overview-page, main', { timeout: 15000 });
});

await check('driver manifest renders', async (page) => {
  await uiLogin(page, 'driver1@sambast.com', 'testpass123');
  await page.waitForSelector('.driver-workflow, main', { timeout: 15000 });
});

await browser.close();
const fails = results.filter((r) => !r[0]);
console.log('========================================');
console.log(`RESULTS: ${results.length - fails.length}/${results.length} passed`);
for (const [, name] of fails) console.log(`  FAIL ${name}`);
process.exit(fails.length ? 1 : 0);
