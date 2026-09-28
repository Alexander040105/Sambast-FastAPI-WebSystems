import { useEffect, useState } from 'react';
import { connectFleetStream } from '../../api/fleetStream.js';
import '../../css/fleet-live.css';

const STATUS_LABELS = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  EN_ROUTE: 'En route',
  ARRIVED: 'Arrived',
  POD_CAPTURED: 'Proof of delivery captured',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  REATTEMPT: 'Reattempt',
  RETURNED: 'Returned',
};

const CONNECTION_LABELS = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

const MAX_UPDATES = 20;

const eventTime = new Intl.DateTimeFormat('en-PH', {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// Keep only the newest event per delivery, newest first, capped at MAX_UPDATES.
function mergeUpdate(updates, event) {
  const previous = updates.find((item) => item.delivery_id === event.delivery_id);
  if (previous && Date.parse(previous.ts) > Date.parse(event.ts)) return updates;
  if (previous?.ts === event.ts && previous.status === event.status && previous.order_no === event.order_no) return updates;
  return [event, ...updates.filter((item) => item.delivery_id !== event.delivery_id)]
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .slice(0, MAX_UPDATES);
}

export function FleetDeliveryUpdates() {
  const [connection, setConnection] = useState({ state: 'connecting' });
  const [updates, setUpdates] = useState([]);
  const [hasConnectionGap, setHasConnectionGap] = useState(false);

  useEffect(() => connectFleetStream({
    onConnectionChange: (next) => {
      setConnection(next);
      if (next.state === 'reconnecting' || next.state === 'offline') setHasConnectionGap(true);
    },
    onStatus: (event) => {
      setUpdates((current) => mergeUpdate(current, event));
    },
  }), []);

  return (
    <section className="fleet-live-updates" aria-labelledby="fleet-live-title">
      <div className="fleet-live-heading">
        <h2 id="fleet-live-title">Delivery updates</h2>
        <span className={`fleet-live-connection fleet-live-connection-${connection.state}`} role="status">
          {CONNECTION_LABELS[connection.state]}
        </span>
      </div>
      <p className="fleet-live-description">
        Latest events for up to {MAX_UPDATES} deliveries received while Fleet is open.
        {hasConnectionGap && ' Updates during disconnection may be missing.'}
      </p>
      {connection.message && <p className="fleet-live-message" role="status">{connection.message}</p>}
      {updates.length === 0 ? (
        <p className="fleet-live-empty">No delivery updates received yet.</p>
      ) : (
        <div className="fleet-live-table-wrap">
          <table className="fleet-live-table" aria-label="Recent delivery updates">
            <thead><tr><th scope="col">Order / Delivery</th><th scope="col">Latest update</th><th scope="col">Event time</th></tr></thead>
            <tbody aria-live="polite">
              {updates.map((event) => (
                <tr key={event.delivery_id}>
                  <td><strong>{event.order_no}</strong><span className="fleet-live-delivery-id">Delivery #{event.delivery_id}</span></td>
                  <td><span className="fleet-live-status">{STATUS_LABELS[event.status]}</span></td>
                  <td><time dateTime={event.ts}>{eventTime.format(new Date(event.ts))}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
