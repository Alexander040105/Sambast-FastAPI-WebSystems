import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cancelOrder, getOrder, getOrderStatus } from '../../api/orders';

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

export default function OrderDetail() {
  const { orderNo } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      try {
        setLoading(true);
        setError('');

        const [orderData, statusData] = await Promise.all([
          getOrder(orderNo),
          getOrderStatus(orderNo),
        ]);

        if (!cancelled) {
          setOrder(orderData);
          setStatus(statusData);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.message || 'Unable to load order details.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderNo]);

  async function handleCancel(event) {
    event.preventDefault();

    if (!cancelReason.trim()) {
      setError('Please enter a cancellation reason.');
      return;
    }

    try {
      setCancelling(true);
      setError('');

      const updatedOrder = await cancelOrder(
        orderNo,
        cancelReason.trim()
      );

      setOrder((currentOrder) => ({
        ...currentOrder,
        ...(updatedOrder || {}),
        status: updatedOrder?.status || 'CANCELLED',
        cancellation_reason:
          updatedOrder?.cancellation_reason || cancelReason.trim(),
      }));

      setStatus((currentStatus) => ({
        ...currentStatus,
        status: updatedOrder?.status || 'CANCELLED',
        cancellation_reason:
          updatedOrder?.cancellation_reason || cancelReason.trim(),
      }));

      setCancelReason('');
    } catch (requestError) {
      setError(
        requestError.message || 'Unable to cancel the order.'
      );
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-gray-600">
          Loading order details...
        </p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h1 className="text-lg font-semibold text-red-700">
            Unable to load order
          </h1>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        </div>

        <Link
          to="/customer/orders"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          ← Back to My Orders
        </Link>
      </div>
    );
  }

  const currentStatus = status?.status || order?.status;

  const canCancel =
    currentStatus !== 'CANCELLED' &&
    currentStatus !== 'DELIVERED' &&
    currentStatus !== 'COMPLETED';

  const history = status?.history || [];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <Link
          to="/customer/orders"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to My Orders
        </Link>

        <h1 className="mt-3 text-2xl font-bold">
          Order Details
        </h1>

        <p className="mt-1 text-gray-600">
          Order #{order?.order_no || orderNo}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            {error}
          </p>
        </div>
      )}

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              Order Status
            </p>

            <p className="mt-1 text-xl font-bold">
              {formatStatus(currentStatus)}
            </p>
          </div>

          <Link
            to={`/customer/orders/${encodeURIComponent(
              orderNo
            )}/track`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-center font-medium text-white hover:bg-blue-700"
          >
            Track Order
          </Link>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          Created: {formatDate(order?.created_at)}
        </p>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Order Items
        </h2>

        <div className="mt-4 space-y-4">
          {(order?.items || []).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between border-b pb-4 last:border-b-0 last:pb-0"
            >
              <div>
                <p className="font-medium">
                  Product #{item.product_id}
                </p>

                <p className="text-sm text-gray-500">
                  Quantity: {item.quantity}
                </p>

                {item.selected_unit && (
                  <p className="text-sm text-gray-500">
                    Unit: {item.selected_unit}
                  </p>
                )}
              </div>

              <p className="font-medium">
                ₱{Number(item.price_at_time || 0).toFixed(2)}
              </p>
            </div>
          ))}

          {(!order?.items || order.items.length === 0) && (
            <p className="text-gray-500">
              No order items found.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Order Summary
        </h2>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>
              ₱{Number(order?.subtotal || 0).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Discount</span>
            <span>
              ₱{Number(order?.discount_total || 0).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Delivery Fee</span>
            <span>
              ₱{Number(order?.delivery_fee || 0).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Total</span>
            <span>
              ₱{Number(order?.total_price || 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {(order?.delivery_window_start ||
        order?.delivery_window_end) && (
        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Delivery Window
          </h2>

          <div className="mt-3 space-y-1 text-sm text-gray-600">
            {order?.delivery_window_start && (
              <p>
                Start: {formatDate(order.delivery_window_start)}
              </p>
            )}

            {order?.delivery_window_end && (
              <p>
                End: {formatDate(order.delivery_window_end)}
              </p>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Status History
          </h2>

          <div className="mt-4 space-y-4">
            {history.map((event, index) => (
              <div
                key={`${event.created_at}-${index}`}
                className="border-l-2 border-gray-300 pl-4"
              >
                <p className="font-medium">
                  {formatStatus(event.status)}
                </p>

                <p className="text-sm text-gray-500">
                  {formatDate(event.created_at)}
                </p>

                {event.note && (
                  <p className="mt-1 text-sm text-gray-600">
                    {event.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {order?.cancellation_reason && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-700">
            Cancellation Reason
          </h2>

          <p className="mt-2 text-sm text-red-600">
            {order.cancellation_reason}
          </p>
        </div>
      )}

      {canCancel && (
        <div className="mt-6 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-700">
            Cancel Order
          </h2>

          <form
            onSubmit={handleCancel}
            className="mt-4 space-y-4"
          >
            <div>
              <label
                htmlFor="cancelReason"
                className="mb-1 block text-sm font-medium"
              >
                Reason
              </label>

              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(event) =>
                  setCancelReason(event.target.value)
                }
                rows={3}
                className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-red-300"
                placeholder="Enter your cancellation reason"
              />
            </div>

            <button
              type="submit"
              disabled={cancelling}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling
                ? 'Cancelling...'
                : 'Confirm Cancel'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}