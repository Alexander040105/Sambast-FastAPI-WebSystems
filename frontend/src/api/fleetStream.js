import { auth } from './client.js';

const DELIVERY_STATUSES = new Set([
  'PENDING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'POD_CAPTURED',
  'DELIVERED', 'FAILED', 'REATTEMPT', 'RETURNED',
]);
const MAX_EVENT_SIZE = 64 * 1024;

function parseStatus(data) {
  let event;
  try {
    event = JSON.parse(data);
  } catch {
    return null;
  }
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const { delivery_id, order_no, status, lat, lng, ts } = event;
  const validCoordinate = (value, limit) => value === null
    || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit);
  if (!Number.isSafeInteger(delivery_id) || delivery_id <= 0
    || typeof order_no !== 'string' || !order_no.trim()
    || !DELIVERY_STATUSES.has(status)
    || !validCoordinate(lat, 90) || !validCoordinate(lng, 180)
    || typeof ts !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(ts)
    || !Number.isFinite(Date.parse(ts))) return null;
  return { delivery_id, order_no, status, lat, lng, ts };
}

function createEventParser(onStatus) {
  let line = '';
  let lineLength = 0;
  let eventName = '';
  let data = [];
  let eventSize = 0;
  let oversized = false;
  let skipLineFeed = false;

  function finishLine() {
    if (lineLength === 0) {
      if (!oversized && eventName === 'status') {
        const event = parseStatus(data.join('\n'));
        if (event) onStatus(event);
      }
      eventName = '';
      data = [];
      eventSize = 0;
      oversized = false;
    } else if (!oversized && !line.startsWith(':')) {
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') eventName = value;
      if (field === 'data') data.push(value);
    }
    line = '';
    lineLength = 0;
  }

  return (text) => {
    for (const character of text) {
      if (skipLineFeed) {
        skipLineFeed = false;
        if (character === '\n') continue;
      }
      if (character === '\r' || character === '\n') {
        finishLine();
        skipLineFeed = character === '\r';
      } else {
        lineLength += 1;
        eventSize += 1;
        if (eventSize > MAX_EVENT_SIZE) {
          oversized = true;
          line = '';
          data = [];
        } else if (!oversized) {
          line += character;
        }
      }
    }
  };
}

export function connectFleetStream({ onStatus, onConnectionChange }) {
  let stopped = false;
  let controller;
  let reader;
  let retryTimer;
  let retryAttempt = 0;
  let hasAttempted = false;

  const report = (state, message) => {
    if (!stopped) onConnectionChange({ state, ...(message ? { message } : {}) });
  };

  async function connect() {
    let shouldRetry = true;
    let streamReader;
    controller = new AbortController();
    report(hasAttempted ? 'reconnecting' : 'connecting');
    hasAttempted = true;
    try {
      const token = auth.getToken();
      if (!token || !token.trim()) {
        shouldRetry = false;
        report('offline', 'Sign in to receive live delivery updates.');
        return;
      }
      const response = await fetch('/api/v1/fleet/stream', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
        cache: 'no-store',
      });
      if (stopped) {
        await response.body?.cancel();
        return;
      }
      if (response.status === 401 || response.status === 403) {
        shouldRetry = false;
        if (response.status === 401) auth.clearAuth();
        report('offline', response.status === 401
          ? 'Your session has expired. Sign in to receive live updates.'
          : 'Your account cannot access live delivery updates.');
        return;
      }
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500
          && response.status !== 408 && response.status !== 429) {
          shouldRetry = false;
          report('offline', 'Live delivery updates are unavailable.');
        }
        return;
      }
      if (response.headers.get('content-type')?.split(';')[0].trim() !== 'text/event-stream'
        || !response.body) {
        shouldRetry = false;
        report('offline', 'Live delivery updates are unavailable.');
        return;
      }
      report('live');
      const decoder = new TextDecoder();
      const parse = createEventParser((event) => {
        retryAttempt = 0;
        if (!stopped) onStatus(event);
      });
      streamReader = response.body.getReader();
      reader = streamReader;
      while (!stopped) {
        const { value, done } = await streamReader.read();
        if (stopped) break;
        if (done) {
          parse(decoder.decode());
          break;
        }
        parse(decoder.decode(value, { stream: true }));
      }
    } catch {
      // Network failures are retried without exposing server responses or tokens.
    } finally {
      if (streamReader) {
        try {
          await streamReader.cancel();
        } catch {
          // A disconnected stream may already be closed.
        }
        streamReader.releaseLock();
      }
      reader = undefined;
      controller.abort();
      if (!stopped && shouldRetry) {
        report('reconnecting', 'Connection interrupted. Reconnecting…');
        const delay = Math.min(1000 * (2 ** retryAttempt), 8000);
        retryAttempt = Math.min(retryAttempt + 1, 3);
        retryTimer = setTimeout(connect, delay);
      }
    }
  }

  void connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    controller?.abort();
    void reader?.cancel().catch(() => {});
  };
}
