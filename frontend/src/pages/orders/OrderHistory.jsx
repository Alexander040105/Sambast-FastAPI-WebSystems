import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../../api/orders';

function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadOrders() {
      setIsLoading(true);
      setError('');

      try {
        const data = await getOrders({
          page,
          pageSize,
        });

        const orderData = data?.data || data;

        if (Array.isArray(orderData)) {
          setOrders(orderData);
        } else {
          setOrders([]);
        }

        setPagination(data?.pagination || null);
      } catch (err) {
        setOrders([]);
        setError(
          err.message || 'Unable to load your orders.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadOrders();
  }, [page]);

  function handlePreviousPage() {
    if (page > 1) {
      setPage((currentPage) => currentPage - 1);
    }
  }

  function handleNextPage() {
    if (!pagination) {
      return;
    }

    const totalPages =
      pagination.total_pages ??
      pagination.pages ??
      null;

    if (totalPages && page >= totalPages) {
      return;
    }

    if (
      pagination.has_next === false ||
      pagination.has_next_page === false
    ) {
      return;
    }

    setPage((currentPage) => currentPage + 1);
  }

  function formatDate(value) {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  function formatMoney(value) {
    return `₱${Number(value ?? 0).toFixed(2)}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          My Orders
        </h1>

        <p className="mt-2 text-gray-600">
          View your previous and current orders.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-gray-600">
            Loading your orders...
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            No Orders Yet
          </h2>

          <p className="mt-2 text-gray-600">
            You haven't placed any orders yet.
          </p>

          <Link
            to="/customer"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <article
                key={order.id || order.order_no}
                className="rounded-xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      Order Number
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-gray-900">
                      {order.order_no}
                    </h2>

                    <p className="mt-2 text-sm text-gray-500">
                      Placed:{' '}
                      {formatDate(order.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                      {order.status || 'UNKNOWN'}
                    </span>

                    <p className="text-xl font-bold text-gray-900">
                      {formatMoney(order.total_price)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-gray-500">
                      Subtotal
                    </p>

                    <p className="mt-1 font-medium text-gray-900">
                      {formatMoney(order.subtotal)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Delivery Fee
                    </p>

                    <p className="mt-1 font-medium text-gray-900">
                      {formatMoney(order.delivery_fee)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Items
                    </p>

                    <p className="mt-1 font-medium text-gray-900">
                      {order.items?.length ?? 0}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <Link
                    to={`/customer/orders/${encodeURIComponent(
                      order.order_no
                    )}`}
                    className="block rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    View Order
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={handlePreviousPage}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Previous
            </button>

            <span className="text-sm font-medium text-gray-600">
              Page {page}
            </span>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={
                pagination?.has_next === false ||
                pagination?.has_next_page === false
              }
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default OrderHistory;