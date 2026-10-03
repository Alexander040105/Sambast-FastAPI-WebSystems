import { useEffect, useState } from 'react';
import { getNotifications } from '../../api/notifications';

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatStatus(status) {
  if (!status) return 'Unknown';

  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function describeNotification(notification) {
  const fallbackTitle = notification.template
    ? formatStatus(notification.template)
    : 'Notification';

  let payload = notification.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return { title: fallbackTitle, lines: [payload], error: null, rawPayload: null };
    }
  }
  if (!payload || typeof payload !== 'object') {
    return { title: fallbackTitle, lines: [], error: null, rawPayload: null };
  }

  const {
    order_no: orderNo,
    status: orderStatus,
    note,
    message,
    error,
  } = payload;

  const lines = [];
  if (orderStatus) {
    lines.push(
      orderNo
        ? `Your order ${orderNo} is now ${formatStatus(orderStatus)}.`
        : `Order status: ${formatStatus(orderStatus)}.`
    );
  }
  if (message) lines.push(message);
  if (note) lines.push(`Note: ${note}`);

  return {
    title: orderNo ? `Order ${orderNo}` : fallbackTitle,
    lines,
    error: error || null,
    // Keep raw JSON only for payloads we couldn't turn into a message,
    // so unexpected shapes stay visible instead of disappearing.
    rawPayload:
      lines.length === 0 && !error && Object.keys(payload).length > 0
        ? payload
        : null,
  };
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        setLoading(true);
        setError('');

        const response = await getNotifications({
          page,
          pageSize,
        });

        if (cancelled) return;

        if (Array.isArray(response)) {
          setNotifications(response);
          setPagination(null);
        } else {
          setNotifications(response?.data || []);
          setPagination(response?.pagination || null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message ||
              'Unable to load notifications.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const currentPage = pagination?.page ?? page;
  const totalPages = pagination?.total_pages ?? 1;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Notifications
        </h1>

        <p className="mt-1 text-gray-600">
          View your delivery and order notifications.
        </p>
      </div>

      {loading && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-gray-600">
            Loading notifications...
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <p className="text-gray-500">
            No notifications found.
          </p>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const view = describeNotification(notification);

            return (
              <div
                key={notification.id}
                className="rounded-lg border bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {view.title}
                    </p>

                    <p className="mt-0.5 text-xs uppercase tracking-wide text-gray-400">
                      {formatStatus(notification.channel)}
                    </p>
                  </div>

                  <span className="text-sm text-gray-500">
                    {formatStatus(notification.status)}
                  </span>
                </div>

                {view.lines.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {view.lines.map((line, index) => (
                      <p
                        key={index}
                        className="text-sm text-gray-700"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}

                {view.error && (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {view.error}
                  </p>
                )}

                {view.rawPayload && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <pre className="whitespace-pre-wrap break-words text-xs text-gray-700">
                      {JSON.stringify(view.rawPayload, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-500">
                  <p>
                    Created:{' '}
                    {formatDate(notification.created_at)}
                  </p>

                  {notification.sent_at && (
                    <p>
                      Sent:{' '}
                      {formatDate(notification.sent_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() =>
              setPage((currentPageValue) =>
                Math.max(1, currentPageValue - 1)
              )
            }
            className="rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {currentPage}
            {totalPages > 1 ? ` of ${totalPages}` : ''}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() =>
              setPage((currentPageValue) =>
                currentPageValue + 1
              )
            }
            className="rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}