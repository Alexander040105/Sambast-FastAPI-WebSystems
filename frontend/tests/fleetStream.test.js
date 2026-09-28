import assert from 'node:assert/strict';
import test from 'node:test';
import { auth } from '../src/api/client.js';
import { connectFleetStream } from '../src/api/fleetStream.js';

const encoder = new TextEncoder();
const tick = () => new Promise((resolve) => setImmediate(resolve));
const status = (overrides = {}) => ({
  delivery_id: 12,
  order_no: 'ORD-0012',
  status: 'EN_ROUTE',
  lat: null,
  lng: null,
  ts: '2026-09-28T10:30:00.123456+00:00',
  ...overrides,
});
const frame = (event) => `event: status\ndata: ${JSON.stringify(event)}\n\n`;

function stream() {
  let controller;
  let cancellations = 0;
  const body = new ReadableStream({
    start(value) { controller = value; },
    cancel() { cancellations += 1; },
  });
  return {
    response: new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } }),
    send: (text) => controller.enqueue(encoder.encode(text)),
    sendBytes: (bytes) => controller.enqueue(bytes),
    close: () => controller.close(),
    get cancellations() { return cancellations; },
  };
}

function setup(t, fetchResponse) {
  const events = [];
  const connections = [];
  const calls = [];
  const timers = new Map();
  let timerId = 0;
  let token = 'first-token';
  let clearCount = 0;
  t.mock.method(auth, 'getToken', () => token);
  t.mock.method(auth, 'clearAuth', () => { clearCount += 1; token = null; });
  t.mock.method(globalThis, 'fetch', async (...args) => {
    calls.push(args);
    return fetchResponse(calls.length);
  });
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    timerId += 1;
    timers.set(timerId, { callback, delay });
    return timerId;
  });
  t.mock.method(globalThis, 'clearTimeout', (id) => timers.delete(id));
  const cleanups = [];
  const connect = () => {
    const cleanup = connectFleetStream({
      onStatus: (event) => events.push(event),
      onConnectionChange: (connection) => connections.push(connection),
    });
    cleanups.push(cleanup);
    return cleanup;
  };
  t.after(async () => {
    cleanups.forEach((cleanup) => cleanup());
    await tick();
  });
  return {
    events, connections, calls, timers, connect,
    setToken: (value) => { token = value; },
    get clearCount() { return clearCount; },
    async retry() {
      assert.equal(timers.size, 1, 'only one reconnect may be scheduled');
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
      await tick();
      return timer.delay;
    },
  };
}

test('uses Bearer authentication and delivers only documented status fields', async (t) => {
  const source = stream();
  const run = setup(t, () => source.response);
  run.connect();
  await tick();
  assert.equal(run.calls[0][0], '/api/v1/fleet/stream');
  assert.deepEqual(run.calls[0][1].headers, {
    Authorization: 'Bearer first-token', Accept: 'text/event-stream',
  });
  assert.deepEqual(run.connections.map(({ state }) => state), ['connecting', 'live']);
  source.send(frame(status({ note: 'extra backend field', driver_id: 99 })));
  await tick();
  assert.deepEqual(run.events, [status()]);
});

test('parses UTF-8 chunk boundaries, LF, CRLF, CR, and multiline data', async (t) => {
  const source = stream();
  const run = setup(t, () => source.response);
  run.connect();
  await tick();
  const first = status({ order_no: 'ORD-Peña' });
  const second = status({ status: 'ARRIVED', lat: 14.6, lng: 121 });
  const third = status({ status: 'DELIVERED' });
  const multiline = `event: status\r\ndata: {\r\ndata: ${JSON.stringify(second).slice(1, -1)}\r\ndata: }\r\n\r\n`;
  const bytes = encoder.encode(frame(first) + multiline + frame(third).replaceAll('\n', '\r'));
  for (const byte of bytes) source.sendBytes(Uint8Array.of(byte));
  await tick();
  assert.deepEqual(run.events, [first, second, third]);
});

test('ignores unrelated events, malformed JSON and invalid contract fields', async (t) => {
  const source = stream();
  const run = setup(t, () => source.response);
  run.connect();
  await tick();
  source.send(': keep-alive\n\nevent: connected\ndata: {"message":"Connected"}\n\n');
  source.send(`event: other\ndata: ${JSON.stringify(status())}\n\n`);
  source.send(`data: ${JSON.stringify(status())}\n\n`);
  source.send('event: status\ndata: {broken json\n\n');
  [null, [], 3, 'text', {}, status({ delivery_id: '12' }), status({ delivery_id: -1 }),
    status({ delivery_id: Number.MAX_SAFE_INTEGER + 1 }), status({ order_no: '  ' }),
    status({ status: 'unexpected' }), status({ status: 'en_route' }),
    status({ lat: 91 }), status({ lng: -181 }), status({ lat: '14.6' }),
    status({ lat: undefined }), status({ ts: 'not-a-date' }), status({ ts: '2026-09-28' }),
    status({ ts: undefined, at: '2026-09-28T10:30:00Z' }),
  ].forEach((event) => source.send(frame(event)));
  source.send(frame(status({ status: 'POD_CAPTURED' })));
  await tick();
  assert.deepEqual(run.events, [status({ status: 'POD_CAPTURED' })]);
});

test('discards oversized and unfinished frames and recovers at the next frame', async (t) => {
  const source = stream();
  const run = setup(t, () => source.response);
  run.connect();
  await tick();
  source.send(frame(status({ order_no: 'x'.repeat(70_000) })));
  source.send(`event: status\n${'data: x\n'.repeat(15_000)}\n`);
  source.send(frame(status()));
  source.send(frame(status({ status: 'ARRIVED' })).trimEnd());
  source.close();
  await tick();
  assert.deepEqual(run.events, [status()]);
  assert.equal(run.connections.at(-1).state, 'reconnecting');
});

test('reconnects after EOF with the latest token and cleans up the retry timer', async (t) => {
  const first = stream();
  const second = stream();
  const run = setup(t, (attempt) => attempt === 1 ? first.response : second.response);
  const cleanup = run.connect();
  await tick();
  first.close();
  await tick();
  run.setToken('refreshed-token');
  assert.equal(await run.retry(), 1000);
  assert.equal(run.calls[1][1].headers.Authorization, 'Bearer refreshed-token');
  assert.equal(run.calls[0][1].signal.aborted, true);
  second.send(frame(status()));
  await tick();
  assert.deepEqual(run.events, [status()]);
  second.close();
  await tick();
  cleanup();
  assert.equal(run.timers.size, 0);
  assert.equal(run.calls.length, 2);
});

test('backs off transient network and server failures without duplicate streams', async (t) => {
  const source = stream();
  const run = setup(t, (attempt) => {
    if (attempt === 1) throw new Error('network disconnected');
    return attempt < 6 ? new Response('', { status: 503 }) : source.response;
  });
  run.connect();
  await tick();
  const delays = [];
  for (let index = 0; index < 5; index += 1) delays.push(await run.retry());
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 8000]);
  assert.equal(run.calls.length, 6);
  assert.equal(run.connections.at(-1).state, 'live');
  assert.equal(run.connections.filter(({ state }) => state === 'connecting').length, 1);
  assert.equal(run.timers.size, 0);
});

for (const responseStatus of [401, 403]) {
  test(`${responseStatus} stops reconnecting and uses the existing session policy`, async (t) => {
    const run = setup(t, () => new Response('', { status: responseStatus }));
    run.connect();
    await tick();
    assert.equal(run.connections.at(-1).state, 'offline');
    assert.equal(run.clearCount, responseStatus === 401 ? 1 : 0);
    assert.equal(run.timers.size, 0);
    assert.equal(run.calls.length, 1);
  });
}

test('does not send an anonymous request when the access token is missing', async (t) => {
  const run = setup(t, () => { throw new Error('must not fetch'); });
  run.setToken(null);
  run.connect();
  await tick();
  assert.equal(run.calls.length, 0);
  assert.equal(run.connections.at(-1).state, 'offline');
  assert.equal(run.timers.size, 0);
});

test('unmount aborts reading and returning opens only one new connection', async (t) => {
  const first = stream();
  const second = stream();
  const run = setup(t, (attempt) => attempt === 1 ? first.response : second.response);
  const firstCleanup = run.connect();
  await tick();
  firstCleanup();
  firstCleanup();
  await tick();
  assert.equal(first.cancellations, 1);
  assert.equal(run.calls[0][1].signal.aborted, true);
  assert.equal(run.timers.size, 0);
  const secondCleanup = run.connect();
  await tick();
  second.send(frame(status()));
  await tick();
  assert.equal(run.calls.length, 2);
  assert.deepEqual(run.events, [status()]);
  secondCleanup();
  await tick();
  assert.equal(second.cancellations, 1);
  assert.equal(run.timers.size, 0);
});

test('cleanup while fetch is pending ignores the late response and cancels its body', async (t) => {
  const source = stream();
  let respond;
  const run = setup(t, () => new Promise((resolve) => { respond = resolve; }));
  const cleanup = run.connect();
  cleanup();
  const statesBeforeResponse = run.connections.length;
  respond(source.response);
  await tick();
  assert.equal(source.cancellations, 1);
  assert.equal(run.calls[0][1].signal.aborted, true);
  assert.equal(run.connections.length, statesBeforeResponse);
  assert.equal(run.events.length, 0);
  assert.equal(run.timers.size, 0);
});

test('reports an unavailable stream without looping on permanent errors', async (t) => {
  const run = setup(t, () => new Response('<html>Not a stream</html>', {
    headers: { 'Content-Type': 'text/html' },
  }));
  run.connect();
  await tick();
  assert.equal(run.connections.at(-1).state, 'offline');
  assert.equal(run.timers.size, 0);
});
