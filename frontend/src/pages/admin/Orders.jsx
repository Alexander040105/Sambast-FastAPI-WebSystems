import { useEffect, useState } from 'react';
import {
  getAdminOrder,
  getAdminOrderStatus,
  getAdminOrders,
} from '../../api/admin';

const ORDER_STATUSES = [
  '',
  'PENDING',
  'CONFIRMED',
  'READY_FOR_DISPATCH',
  'ASSIGNED',
  'CANCELLED',
  'DELIVERED',
  'COMPLETED',
];

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatStatus(status) {
  if (!status) return 'UNKNOWN';

  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ status }) {
  const statusStyles = {
    PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    CONFIRMED: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    READY_FOR_DISPATCH:
      'bg-violet-50 text-violet-700 ring-violet-600/20',
    ASSIGNED: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
    DELIVERED:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    COMPLETED:
      'bg-green-50 text-green-700 ring-green-600/20',
    CANCELLED:
      'bg-red-50 text-red-700 ring-red-600/20',
  };

  const style =
    statusStyles[status] ||
    'bg-slate-100 text-slate-600 ring-slate-500/20';

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${style}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value ?? '—'}
      </p>
    </div>
  );
}

function OrderDetails({ orderNo, onClose }) {
  const [order, setOrder] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        setLoading(true);
        setError('');

        const [orderResponse, statusResponse] =
          await Promise.all([
            getAdminOrder(orderNo),
            getAdminOrderStatus(orderNo),
          ]);

        if (cancelled) return;

        setOrder(orderResponse);
        setStatusData(statusResponse);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [orderNo]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />

        <p className="text-sm font-medium text-slate-600">
          Loading order details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-start gap-3">
          <span className="text-lg">⚠️</span>

          <div>
            <p className="font-semibold">
              Unable to load order
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        >
          ← Back to Orders
        </button>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Details heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onClose}
            className="mb-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            ← Back to Orders
          </button>

          <p className="text-sm font-semibold text-indigo-600">
            Order Management
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {order.order_no}
            </h1>

            <StatusBadge status={order.status} />
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Created {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {/* Overview */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg">
              📋
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Order Overview
              </h2>

              <p className="text-sm text-slate-500">
                Basic information about this order.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem
            label="Order Number"
            value={order.order_no}
          />

          <InfoItem
            label="Customer ID"
            value={order.customer_id}
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </p>

            <div className="mt-2">
              <StatusBadge status={order.status} />
            </div>
          </div>

          <InfoItem
            label="Created"
            value={formatDate(order.created_at)}
          />
        </div>
      </section>

      {/* Order items */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg">
              🛒
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Order Items
              </h2>

              <p className="text-sm text-slate-500">
                Products included in this order.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {order.items?.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Product ID
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Unit
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Quantity
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Price at Time
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((item) => (
                      <tr
                        key={item.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 font-semibold text-slate-800">
                          {item.product_id ?? '—'}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {item.selected_unit ?? '—'}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {item.quantity}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-slate-800">
                          ₱{formatMoney(item.price_at_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                No order items found.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Delivery */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg">
              🚚
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Delivery Information
              </h2>

              <p className="text-sm text-slate-500">
                Delivery details associated with this order.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem
            label="Delivery Location ID"
            value={order.delivery_location_id}
          />

          <InfoItem
            label="Delivery Window Start"
            value={formatDate(
              order.delivery_window_start
            )}
          />

          <InfoItem
            label="Delivery Window End"
            value={formatDate(
              order.delivery_window_end
            )}
          />

          <InfoItem
            label="Delivery ID"
            value={statusData?.delivery_id}
          />

          <InfoItem
            label="Delivery Status"
            value={
              statusData?.delivery_status
                ? formatStatus(
                    statusData.delivery_status
                  )
                : '—'
            }
          />
        </div>
      </section>

      {/* Price summary */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg">
              💰
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Price Summary
              </h2>

              <p className="text-sm text-slate-500">
                Order pricing breakdown.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="ml-auto max-w-md space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>

              <span className="font-medium text-slate-800">
                ₱{formatMoney(order.subtotal)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Discount</span>

              <span className="font-medium text-emerald-600">
                -₱{formatMoney(order.discount_total)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Delivery Fee</span>

              <span className="font-medium text-slate-800">
                ₱{formatMoney(order.delivery_fee)}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-base font-bold text-slate-900">
                Total
              </span>

              <span className="text-2xl font-bold text-indigo-600">
                ₱{formatMoney(order.total_price)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Cancellation */}
      {order.cancellation_reason && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>

            <div>
              <h2 className="font-bold text-red-800">
                Cancellation Reason
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                {order.cancellation_reason}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Status history */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-lg">
              🕒
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Status History
              </h2>

              <p className="text-sm text-slate-500">
                Timeline of status changes for this order.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!statusData?.history?.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                No status history available.
              </p>
            </div>
          ) : (
            <div className="relative space-y-4">
              {statusData.history.map((event, index) => (
                <div
                  key={`${event.created_at}-${index}`}
                  className="relative rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <StatusBadge status={event.status} />

                    <span className="text-xs font-medium text-slate-400">
                      {formatDate(event.created_at)}
                    </span>
                  </div>

                  {event.note && (
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {event.note}
                    </p>
                  )}

                  {(event.lat !== null ||
                    event.lng !== null) && (
                    <div className="mt-3 rounded-lg bg-white px-3 py-2">
                      <p className="text-xs text-slate-500">
                        Location:{' '}
                        <span className="font-medium text-slate-700">
                          {event.lat ?? '—'}
                        </span>
                        {', '}
                        <span className="font-medium text-slate-700">
                          {event.lng ?? '—'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedOrderNo, setSelectedOrderNo] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadOrders() {
    try {
      setLoading(true);
      setError('');

      const response = await getAdminOrders({
        page,
        pageSize: 20,
        status: statusFilter,
      });

      setOrders(response?.data || []);
      setPagination(response?.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [page, statusFilter]);

  if (selectedOrderNo) {
    return (
      <OrderDetails
        orderNo={selectedOrderNo}
        onClose={() => setSelectedOrderNo(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <p className="text-sm font-semibold text-indigo-600">
          Order Management
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Orders
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          View customer orders and monitor their current delivery status.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="text-base">⚠️</span>

          <div>
            <p className="font-semibold">
              Something went wrong
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg">
                🛒
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Customer Orders
                </h2>

                <p className="text-sm text-slate-500">
                  {pagination
                    ? `${pagination.total_items} total orders`
                    : 'Manage incoming orders'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Filter
              </label>

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              >
                {ORDER_STATUSES.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status
                      ? formatStatus(status)
                      : 'All statuses'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />

              <p className="text-sm font-medium text-slate-600">
                Loading orders...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                🛒
              </div>

              <h3 className="mt-4 text-base font-bold text-slate-800">
                No orders found
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                There are no orders matching the selected filter.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Order
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Customer
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Subtotal
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Delivery
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Total
                      </th>

                      <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Created
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {orders.map((order) => (
                      <tr
                        key={order.order_no}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedOrderNo(
                                order.order_no
                              )
                            }
                            className="text-left"
                          >
                            <p className="font-bold text-indigo-600 hover:text-indigo-700">
                              {order.order_no}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              View details
                            </p>
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-medium text-slate-700">
                            #{order.customer_id}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge status={order.status} />
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          ₱{formatMoney(order.subtotal)}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          ₱{formatMoney(order.delivery_fee)}
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-900">
                          ₱{formatMoney(order.total_price)}
                        </td>

                        <td className="px-5 py-4 text-slate-500">
                          {formatDate(order.created_at)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedOrderNo(
                                order.order_no
                              )
                            }
                            className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                          >
                            View Order
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination &&
            pagination.total_pages > 1 && (
              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Page{' '}
                  <span className="font-semibold text-slate-800">
                    {pagination.page}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-slate-800">
                    {pagination.total_pages}
                  </span>
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage(
                        (current) => current - 1
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      page >= pagination.total_pages
                    }
                    onClick={() =>
                      setPage(
                        (current) => current + 1
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
        </div>
      </section>
    </div>
  );
}