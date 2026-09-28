import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';

// Run with node tests/feb-regression.mjs. PUPPETEER_MODULE and BROWSER_PATH
// can point to existing installations; this script installs nothing.
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(frontend, '..');
const npmCache = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const candidates = [process.env.PUPPETEER_MODULE, join(frontend, 'node_modules', 'puppeteer-core')];
if (npmCache && existsSync(npmCache)) {
  for (const folder of readdirSync(npmCache)) candidates.push(join(npmCache, folder, 'node_modules', 'puppeteer-core'));
}
const puppeteerPath = candidates.find((value) => value && existsSync(join(value, 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')));
assert.ok(puppeteerPath, 'Set PUPPETEER_MODULE to an installed puppeteer-core directory.');
const { default: puppeteer } = await import(pathToFileURL(join(puppeteerPath, 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')));
const executablePath = [process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((value) => value && existsSync(value));
assert.ok(executablePath, 'Set BROWSER_PATH to an installed Chrome or Edge executable.');

const servers = [];
let browser;
const errors = [];
const baselineFiles = new Map();
const baselinePlugin = {
  name: 'regression-head-source',
  enforce: 'pre',
  load(id) {
    const clean = id.split('?')[0].replaceAll('\\', '/');
    const prefix = `${frontend.replaceAll('\\', '/')}/src/`;
    if (!clean.startsWith(prefix) || !/\.(jsx?|css)$/.test(clean)) return null;
    const relative = `frontend/src/${clean.slice(prefix.length)}`;
    if (!baselineFiles.has(relative)) baselineFiles.set(relative, execFileSync('git', ['show', `HEAD:${relative}`], { cwd: repository, encoding: 'utf8' }));
    return baselineFiles.get(relative);
  },
};

function installFixtures() {
  const realFetch = window.fetch.bind(window);
  const token = `test.${btoa(JSON.stringify({ role: 'admin' }))}.test`;
  localStorage.setItem('access_token', token);
  const day = '2026-09-28T00:00:00Z';
  const drivers = Array.from({ length: 23 }, (_, index) => ({ id: index + 1, user_id: index + 101, license_no: `LICENSE-${index + 1}`, status: index === 1 ? 'off_duty' : 'active', created_at: day }));
  const vehicles = [{ id: 1, plate_no: 'ABC-1234', type: 'van', max_weight_kg: 1500, max_volume_m3: 12, is_active: true, created_at: day }];
  const shifts = [{ id: 1, driver_id: 1, vehicle_id: 1, starts_at: day, ends_at: '2026-09-28T08:00:00Z', status: 'scheduled', created_at: day }];
  const orders = [{ id: 11, order_no: 'ORD-11', status: 'READY_FOR_DISPATCH', total_weight_kg: 12, delivery_location: { line1: 'Main Street', city: 'Manila' }, delivery_window_start: day, delivery_window_end: '2026-09-28T08:00:00Z' }];
  const stop = (id, status) => ({ id, delivery_id: id + 40, sequence: id, sequence_no: id, recipient: `Recipient ${id}`, destination: `Destination ${id}`, address: `Address ${id}`, order_no: `ORD-${id}`, status, window: '8 AM–12 PM', delivery_window: '8 AM–12 PM', weight: '12 kg' });
  const manifest = { date_label: 'Monday, September 28', shift_label: '8 AM–5 PM', route_started: false, failure_reasons: [{ value: 'customer_unavailable', label: 'Customer unavailable' }, { value: 'wrong_address', label: 'Wrong address' }], stops: [stop(1, 'pending'), stop(2, 'pending'), stop(3, 'pending')] };
  const route = { id: '1', name: 'Route 1', status: 'active', assigned_driver: 'Driver One', estimated_remaining_min: 85, stops: [stop(1, 'completed'), stop(2, 'pending'), stop(3, 'pending')] };
  const streams = new Set();
  const state = window.__fixture = { requests: [], streams, opened: 0, closed: 0, failStream: false, streamStatus: 200, restFailure: false, empty: false };
  const response = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  state.send = (text) => { for (const stream of streams) stream.controller.enqueue(new TextEncoder().encode(text)); };
  state.disconnect = () => { for (const stream of [...streams]) stream.close(); };
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    if (!url.pathname.startsWith('/api/v1/')) return realFetch(input, options);
    const path = url.pathname.slice('/api/v1'.length);
    const method = options.method || 'GET';
    const body = options.body instanceof FormData
      ? Object.fromEntries([...options.body.entries()].map(([key, value]) => [key, value instanceof File ? { name: value.name, type: value.type } : value]))
      : options.body ? JSON.parse(options.body) : null;
    state.requests.push({ path, search: url.search, method, body, authorization: new Headers(options.headers).get('Authorization') });
    if (path === '/fleet/stream') {
      state.opened += 1;
      if (state.failStream) throw new TypeError('Fixture network failure');
      if (state.streamStatus !== 200) return response({ detail: 'Denied' }, state.streamStatus);
      let record;
      const stream = new ReadableStream({
        start(controller) {
          record = { controller, close() { if (streams.delete(record)) { state.closed += 1; controller.close(); } } };
          streams.add(record);
          if (options.signal?.aborted) record.close();
          else options.signal?.addEventListener('abort', () => record.close(), { once: true });
          if (streams.has(record)) controller.enqueue(new TextEncoder().encode('event: connected\ndata: {}\n\n'));
        },
        cancel() { if (streams.delete(record)) state.closed += 1; },
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
    }
    if (state.restFailure) return response({ detail: 'Fixture service unavailable' }, 503);
    const collection = { drivers, vehicles, shifts }[path.split('/')[1]];
    if (collection) {
      const id = Number(path.split('/')[2]);
      if (method === 'GET') return response({ data: state.empty ? [] : collection, pagination: { total_pages: 1 } });
      if (method === 'POST') { const item = { id: 99, created_at: day, ...body }; collection.push(item); return response(item); }
      if (method === 'PATCH') { Object.assign(collection.find((item) => item.id === id), body); return response(collection.find((item) => item.id === id)); }
      if (method === 'DELETE') { collection.splice(collection.findIndex((item) => item.id === id), 1); return response(null, 204); }
    }
    if (path === '/dispatch/queue') return response({ data: state.empty ? [] : orders });
    if (path === '/dispatch/auto-assign') return response({ driver_id: 1, vehicle_id: 1, reason: 'Available with sufficient capacity.' });
    if (path === '/dispatch/orders/11/assign') { orders.splice(0); return response({ status: 'success', delivery_id: 41 }); }
    if (path === '/routes') return response(state.empty ? [] : [{ id: '1', label: 'Route 1' }]);
    if (path === '/routes/1') {
      if (method === 'PATCH') route.stops = body.stops.map((item) => ({ ...route.stops.find((entry) => entry.id === item.id), sequence_no: item.sequence_no }));
      return response(route);
    }
    if (path === '/routes/1/optimize') return response({ status: 'success' });
    if (path === '/me/route') return response({ ...manifest, stops: state.empty ? [] : manifest.stops });
    if (path.startsWith('/stops/')) {
      const [, , id, action] = path.split('/');
      const target = manifest.stops.find((item) => item.id === Number(id));
      if (action === 'start') { manifest.route_started = true; target.status = 'en_route'; }
      if (action === 'arrive') target.status = 'arrived';
      if (action === 'complete') { target.status = 'delivered'; target.delivered_at = '10:00 AM'; }
      if (action === 'fail') { target.status = 'failed'; target.failure_reason = body.reason; target.failure_notes = body.notes; }
      return response(manifest);
    }
    if (/\/deliveries\/\d+\/pod/.test(path)) return response({ status: 'success' });
    const analytics = { period: { label: 'Sep 22–28' }, updated_at: day };
    if (path === '/analytics/driver-performance') return response({ ...analytics, summary: { on_time_percent: 95, deliveries_per_day: 12, failure_rate: 5 }, series: [{ day: 'Mon', on_time_percent: 95, deliveries: 12, failure_rate: 5 }] });
    if (path === '/analytics/delivery-costs') return response({ ...analytics, summary: { average_cost_per_stop: 10 }, series: [{ day: 'Mon', cost_per_stop: 10 }] });
    if (path === '/analytics/failed-deliveries') return response({ ...analytics, summary: { failed_count: 1, failure_rate: 5, change_from_previous_week: -1 }, reasons: [{ reason: 'Customer unavailable', count: 1 }], daily: [{ day: 'Mon', count: 1 }] });
    throw new Error(`Unhandled fixture request: ${method} ${path}`);
  };
}

async function pageAt(base, route, width = 1440) {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewport({ width, height: 1000 });
  await page.evaluateOnNewDocument(installFixtures);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle0' });
  return page;
}

async function clickText(page, text, selector = 'button') {
  await page.waitForFunction((wanted, query) => [...document.querySelectorAll(query)].some((item) => item.textContent.trim() === wanted && !item.disabled), {}, text, selector);
  await page.evaluate((wanted, query) => [...document.querySelectorAll(query)].find((item) => item.textContent.trim() === wanted && !item.disabled).click(), text, selector);
}

async function fill(page, selector, value) {
  await page.waitForSelector(selector);
  await page.$eval(selector, (input, next) => {
    const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function waitText(page, text) {
  await page.waitForFunction((wanted) => document.body.innerText.includes(wanted), {}, text);
}

async function trace(page) {
  return page.evaluate(() => window.__fixture.requests.filter((item) => item.method !== 'GET').map(({ path, method, body }) => ({ path, method, body })));
}

async function workflows(base) {
  const traces = {};
  const page = await pageAt(base, '/dispatcher/fleet/drivers');
  await waitText(page, 'Driver #1');
  await clickText(page, 'Next');
  await waitText(page, 'Driver #23');
  await fill(page, 'input[type="search"]', 'LICENSE-2');
  await waitText(page, 'Driver #2');
  await page.select('.fleet-filter select', 'off_duty');
  assert.equal(await page.$$eval('.drivers-table tbody tr', (rows) => rows.length), 1);
  await fill(page, 'input[type="search"]', '');
  await page.select('.fleet-filter select', 'all');
  await page.click('.fleet-table-toolbar .btn-primary');
 await clickText(page, 'Create');
assert.equal(
  await page.$eval('#driver-user-id', (input) => input.checkValidity()),
  false
);
await fill(page, '#driver-user-id', '555');
await fill(page, '#driver-license', ' TEST-555 ');
await clickText(page, 'Create');
await page.waitForSelector('[role="dialog"]', { hidden: true });

await page.click('[aria-label="Edit driver 1"]');
await fill(page, '#driver-license', 'UPDATED');
await clickText(page, 'Update');
await waitText(page, 'UPDATED');

await page.click('[aria-label="Delete driver 1"]');
await clickText(page, 'Delete');
await page.waitForSelector('[role="dialog"]', { hidden: true });

traces.drivers = await trace(page);
await page.close();

  for (const kind of ['vehicles', 'shifts']) {
    const current = await pageAt(base, `/dispatcher/fleet/${kind}`);
    await current.waitForSelector('.fleet-table-toolbar .btn-primary');
    await current.click('.fleet-table-toolbar .btn-primary');
    if (kind === 'vehicles') {
      await fill(current, '#plate_no', 'NEW-9999');
      await fill(current, '#max_weight_kg', '500');
      await fill(current, '#max_volume_m3', '5');
    } else {
      await current.select('#driver_id', '1');
      await current.select('#vehicle_id', '1');
      await fill(current, '#starts_at', '2026-09-28T08:00');
      await fill(current, '#ends_at', '2026-09-28T17:00');
    }
    await clickText(current, 'Create');
    await current.waitForSelector('[role="dialog"]', { hidden: true });
    await current.click(kind === 'vehicles' ? '[aria-label="Edit ABC-1234"]' : '[aria-label="Edit shift 1"]');
    if (kind === 'vehicles') await fill(current, '#plate_no', 'EDT-1111');    else await current.select('#status', 'active');
    await clickText(current, 'Update');
    await current.waitForSelector('[role="dialog"]', { hidden: true });
    await current.click(kind === 'vehicles' ? '[aria-label="Delete EDT-1111"]' : '[aria-label="Delete shift 1"]');
    await clickText(current, 'Delete');
    await current.waitForSelector('[role="dialog"]', { hidden: true });
    traces[kind] = await trace(current);
    await current.close();
  }

  const queue = await pageAt(base, '/dispatcher/queue');
  await queue.click('.dispatch-order-card');
  await clickText(queue, 'Get recommendation');
  await waitText(queue, 'Available with sufficient capacity.');
  await queue.select('#dispatch-driver', '2');
  await clickText(queue, 'Assign to Driver');
  await waitText(queue, 'Delivery #41 was created.');
  await waitText(queue, 'No orders waiting for dispatch.');
  traces.queue = await trace(queue);
  await queue.close();

  const route = await pageAt(base, '/dispatcher/routes/1');
  await route.waitForSelector('.route-drag-handle');
  assert.equal(await route.$$eval('.route-drag-handle', (items) => items.length), 2);
  await route.focus('.route-drag-handle');
  await route.keyboard.press('ArrowDown');
  await clickText(route, 'Save Stop Order');
  await waitText(route, 'Stop order saved.');
  traces.route = await trace(route);
  await route.close();

  const driver = await pageAt(base, '/driver', 390);
  await clickText(driver, 'Start Route to Stop 1');
  await clickText(driver, 'Confirm Arrival');
  await clickText(driver, 'Complete Delivery');
  assert.equal(await driver.$eval('.driver-complete-screen > button', (button) => button.disabled), true);
  await driver.$eval('input[aria-label="Choose proof photo from gallery"]', (input) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'proof.png', { type: 'image/png' }));
    input.files = data.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await fill(driver, '#recipient-name', 'Recipient One');
  await clickText(driver, 'Complete Delivery');
  await clickText(driver, 'Open Stop 2');
  await clickText(driver, 'Confirm Arrival');
  await clickText(driver, 'Unable to Deliver / Issue');
  assert.equal(await driver.$eval('.driver-fail-screen > button', (button) => button.disabled), true);
  await driver.click('input[value="customer_unavailable"]');
  await fill(driver, '#failure-notes', 'No response at door');
  await clickText(driver, 'Confirm Delivery Failure');
  await clickText(driver, 'Open Stop 3');
  traces.driver = await trace(driver);
  await driver.close();

  const ops = await pageAt(base, '/ops');
  await ops.waitForSelector('.ops-analytics-grid');
  assert.equal(await ops.$$eval('.recharts-wrapper', (items) => items.length), 3);
  await ops.select('#ops-date-range', 'previous_week');
  await ops.waitForFunction(() => window.__fixture.requests.filter((item) => item.search.includes('previous_week')).length === 3);
  traces.ops = await ops.evaluate(() => window.__fixture.requests.filter((item) => item.path.startsWith('/analytics/')).map(({ path, search }) => ({ path, search })));
  await ops.close();
  return traces;
}

async function snapshot(page, selector) {
  return page.$eval(selector, (root) => [...root.querySelectorAll('*')].filter((element) => !element.closest('svg')).map((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName, class: element.className,
      text: element.children.length ? '' : element.textContent,
      geometry: [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 10) / 10),
      style: [style.color, style.backgroundColor, style.fontFamily, style.fontSize, style.fontWeight, style.padding, style.margin, style.display],
    };
  }));
}

try {
  for (const [index, plugins] of [[0, [baselinePlugin]], [1, []]]) {
    const server = await createServer({ root: frontend, plugins, logLevel: 'error', server: { host: '127.0.0.1', port: 5188 + index, strictPort: true, open: false } });
    await server.listen();
    servers.push(server);
  }
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--disable-gpu'] });
  const baseline = 'http://127.0.0.1:5188';
  const current = 'http://127.0.0.1:5189';
  const cases = [
    ['/dispatcher/fleet/drivers', '.fleet-records'], ['/dispatcher/fleet/vehicles', '.fleet-records'], ['/dispatcher/fleet/shifts', '.fleet-records'],
    ['/dispatcher/queue', '.dispatch-page'], ['/dispatcher/routes', '.route-detail-page'], ['/dispatcher/routes/1', '.route-detail-page'],
    ['/driver', '.driver-workflow'], ['/driver/route', '.driver-workflow'], ['/driver/stops/1', '.driver-workflow'],
    ['/driver/stops/1/complete', '.driver-workflow'], ['/driver/stops/1/fail', '.driver-workflow'], ['/ops', '.ops-overview-page'],
  ];
  for (const width of [1440, 390]) {
    for (const [path, selector] of cases) {
      const before = await pageAt(baseline, path, width);
      const after = await pageAt(current, path, width);
      await before.waitForSelector(selector);
      await after.waitForSelector(selector);
      if (path === '/ops') await new Promise((resolveWait) => setTimeout(resolveWait, 1800));
      assert.deepEqual(await snapshot(after, selector), await snapshot(before, selector), `${path} at ${width}px changed`);
      console.log(`PASS baseline UI ${width}px ${path}`);
      await before.close();
      await after.close();
    }
  }
  const expected = await workflows(baseline);
  const actual = await workflows(current);
  assert.deepEqual(actual, expected, 'T3–T7 workflow request payloads changed');
  console.log('PASS T3–T7 CRUD, queue, driver POD/failure, route reorder, analytics workflow traces match HEAD');
  assert.deepEqual(errors, [], 'Browser page errors');
  console.log('PASS no uncaught browser errors');
} finally {
  await browser?.close();
  await Promise.all(servers.map((server) => server.close()));
}
