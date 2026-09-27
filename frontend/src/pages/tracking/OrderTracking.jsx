import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTracking, getTrackingStreamUrl } from '../../api/tracking';

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatStatus(status) {
  if (!status) return 'UNKNOWN';

  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function OrderTracking() {
  const { orderNo } = useParams();

  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadTracking() {
      try {
        setLoading(true);
        setError('');

        const data = await getTracking(orderNo);

        if (!cancelled) {
          setTracking(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message || 'Unable to load tracking information.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTracking();

    return () => {
      cancelled = true;
    };
  }, [orderNo]);

  useEffect(() => {
    if (!orderNo) return;

    const streamUrl = getTrackingStreamUrl(orderNo);

    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        setTracking((currentTracking) => {
          if (!currentTracking) {
            return data;
          }

          return {
            ...currentTracking,
            ...data,
            history: data.history ?? currentTracking.history ?? [],
          };
        });
      } catch {
        // Ignore malformed SSE messages.
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [orderNo]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-gray-600">Loading tracking information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h1 className="text-lg font-semibold text-red-700">
            Unable to load tracking
          </h1>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        </div>

        <Link
          to={`/customer/orders/${encodeURIComponent(orderNo)}`}
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to Order Details
        </Link>
      </div>
    );
  }

  const history = tracking?.history ?? [];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <Link
          to={`/customer/orders/${encodeURIComponent(orderNo)}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Order Details
        </Link>

        <h1 className="mt-3 text-2xl font-bold">
          Track Order
        </h1>

        <p className="mt-1 text-gray-600">
          Order #{tracking?.order_no ?? orderNo}
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Current Status
        </h2>

        <div className="mt-4 rounded-lg bg-gray-50 p-4">
          <p className="text-2xl font-bold">
            {formatStatus(tracking?.status)}
          </p>

          {tracking?.delivery_status && (
            <p className="mt-2 text-gray-600">
              Delivery Status:{' '}
              <span className="font-medium">
                {formatStatus(tracking.delivery_status)}
              </span>
            </p>
          )}
        </div>

        {tracking?.cancellation_reason && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">
              Cancellation Reason
            </p>

            <p className="mt-1 text-sm text-red-600">
              {tracking.cancellation_reason}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Status History
        </h2>

        {history.length === 0 ? (
          <p className="mt-4 text-gray-500">
            No tracking history is available yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {history.map((event, index) => (
              <div
                key={`${event.created_at}-${index}`}
                className="border-l-2 border-gray-300 pl-4"
              >
                <p className="font-semibold">
                  {formatStatus(event.status)}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {formatDate(event.created_at)}
                </p>

                {event.note && (
                  <p className="mt-2 text-sm text-gray-700">
                    {event.note}
                  </p>
                )}

                {(event.lat !== null && event.lat !== undefined) ||
                (event.lng !== null && event.lng !== undefined) ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Location: {event.lat ?? '—'}, {event.lng ?? '—'}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}