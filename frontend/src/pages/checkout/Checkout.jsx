import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../cart/CartContext';
import { api } from '../../api/client';

function Checkout() {
  const navigate = useNavigate();

  const {
    items,
    totalItems,
    totalAmount,
    clearCart,
  } = useCart();

  const [form, setForm] = useState({
    line1: '',
    line2: '',
    city: '',
    province: '',
    postal_code: '',
    delivery_date: '',
    delivery_start_time: '',
    delivery_end_time: '',
  });

  const [quote, setQuote] = useState(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const subtotal = useMemo(() => {
    return items.reduce((total, item) => {
      const price = Number(
        item.product?.base_price ?? 0
      );

      return total + price * item.quantity;
    }, 0);
  }, [items]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setError('');
    setSuccess('');
    setQuote(null);
  }

  function buildOrderItems() {
    return items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      ...(item.unit?.value
        ? { unit: item.unit.value }
        : {}),
    }));
  }

  function buildAddress() {
    return {
      line1: form.line1.trim(),
      ...(form.line2.trim()
        ? { line2: form.line2.trim() }
        : {}),
      city: form.city.trim(),
      ...(form.province.trim()
        ? { province: form.province.trim() }
        : {}),
      ...(form.postal_code.trim()
        ? { postal_code: form.postal_code.trim() }
        : {}),
    };
  }

  function buildDeliveryWindow() {
    if (
      !form.delivery_date ||
      !form.delivery_start_time ||
      !form.delivery_end_time
    ) {
      return {};
    }

    return {
      delivery_window_start: `${form.delivery_date}T${form.delivery_start_time}:00`,
      delivery_window_end: `${form.delivery_date}T${form.delivery_end_time}:00`,
    };
  }

  async function handleGetQuote(event) {
    event.preventDefault();

    setError('');
    setSuccess('');
    setQuote(null);
    setIsQuoting(true);

    try {
      const payload = {
        items: buildOrderItems(),
        address: buildAddress(),
      };

      const data = await api.post('/orders/quote', payload);

      const quoteData = data?.data || data;

      setQuote(quoteData);
      setSuccess('Order quote calculated successfully.');
    } catch (err) {
      setError(
        err.message ||
          'Unable to calculate the order quote.'
      );
    } finally {
      setIsQuoting(false);
    }
  }

  async function handlePlaceOrder() {
    setError('');
    setSuccess('');
    setIsPlacingOrder(true);

    try {
      const idempotencyKey = crypto.randomUUID();

      const payload = {
        items: buildOrderItems(),
        address: buildAddress(),
        ...buildDeliveryWindow(),
        payment_method: 'cash',
      };

      const data = await api.post('/orders', payload, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });

      const order = data?.data || data;

      clearCart();

      setSuccess('Order placed successfully.');

      const orderNumber =
        order?.order_no ||
        order?.order_number ||
        order?.no;

      if (orderNumber) {
        navigate(`/customer/orders/${orderNumber}`);
      }
    } catch (err) {
      setError(
        err.message ||
          'Unable to place the order.'
      );
    } finally {
      setIsPlacingOrder(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Your Cart Is Empty
          </h1>

          <p className="mt-2 text-gray-600">
            Add products to your cart before checking out.
          </p>

          <Link
            to="/customer"
            className="mt-6 inline-block rounded-lg bg-ruby-600 px-5 py-2.5 font-medium text-white hover:bg-ruby-700"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const summary = quote?.summary || {};

  const deliveryFee = Number(
    summary.delivery_fee ?? 0
  );

  const quotedTotal = Number(
    summary.total ?? subtotal + deliveryFee
  );

  const discountTotal = Number(
    summary.discount_total ?? 0
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <Link
          to="/customer/cart"
          className="text-sm font-medium text-ruby-600 hover:text-ruby-700"
        >
          ← Back to Cart
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Checkout
        </h1>

        <p className="mt-2 text-gray-600">
          Enter your delivery information and review your order.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">
            {success}
          </p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <form
          onSubmit={handleGetQuote}
          className="space-y-6 lg:col-span-2"
        >
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Delivery Address
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="line1"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Address Line 1
                </label>

                <input
                  id="line1"
                  name="line1"
                  type="text"
                  value={form.line1}
                  onChange={handleChange}
                  required
                  placeholder="House number, street, barangay"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="line2"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Address Line 2
                </label>

                <input
                  id="line2"
                  name="line2"
                  type="text"
                  value={form.line2}
                  onChange={handleChange}
                  placeholder="Apartment, building, subdivision, etc. (optional)"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  City
                </label>

                <input
                  id="city"
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>

              <div>
                <label
                  htmlFor="province"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Province
                </label>

                <input
                  id="province"
                  name="province"
                  type="text"
                  value={form.province}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>

              <div>
                <label
                  htmlFor="postal_code"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Postal Code
                </label>

                <input
                  id="postal_code"
                  name="postal_code"
                  type="text"
                  value={form.postal_code}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Delivery Window
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="delivery_date"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Date
                </label>

                <input
                  id="delivery_date"
                  name="delivery_date"
                  type="date"
                  value={form.delivery_date}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>

              <div>
                <label
                  htmlFor="delivery_start_time"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Start Time
                </label>

                <input
                  id="delivery_start_time"
                  name="delivery_start_time"
                  type="time"
                  value={form.delivery_start_time}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>

              <div>
                <label
                  htmlFor="delivery_end_time"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  End Time
                </label>

                <input
                  id="delivery_end_time"
                  name="delivery_end_time"
                  type="time"
                  value={form.delivery_end_time}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Payment Method
            </h2>

            <div className="mt-4 rounded-lg border border-ruby-200 bg-ruby-50 p-4">
              <p className="font-medium text-ruby-900">
                Cash on Delivery
              </p>

              <p className="mt-1 text-sm text-ruby-700">
                Payment will be collected when your order is delivered.
              </p>
            </div>
          </section>

          <button
            type="submit"
            disabled={isQuoting}
            className="w-full rounded-lg bg-ruby-600 px-5 py-3 font-medium text-white hover:bg-ruby-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isQuoting
              ? 'Calculating Quote...'
              : 'Get Order Quote'}
          </button>
        </form>

        <aside className="h-fit rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Order Summary
          </h2>

          <div className="mt-5 space-y-4">
            {items.map((item) => {
              const price = Number(
                item.product?.base_price ?? 0
              );

              const unitLabel =
                item.unit?.label ||
                item.unit?.value ||
                '';

              return (
                <div
                  key={`${item.product.id}-${item.unit?.value ?? 'default'}`}
                  className="flex justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.product.name}
                    </p>

                    <p className="text-sm text-gray-500">
                      {item.quantity} × ₱{price.toFixed(2)}
                    </p>

                    {unitLabel && (
                      <p className="text-xs text-gray-500">
                        Unit: {unitLabel}
                      </p>
                    )}
                  </div>

                  <p className="font-medium text-gray-900">
                    ₱{(price * item.quantity).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t pt-5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Items
              </span>

              <span className="font-medium">
                {totalItems}
              </span>
            </div>

            <div className="mt-3 flex justify-between text-sm">
              <span className="text-gray-600">
                Estimated Subtotal
              </span>

              <span className="font-medium">
                ₱{subtotal.toFixed(2)}
              </span>
            </div>

            {quote && (
              <>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-gray-600">
                    Discount
                  </span>

                  <span className="font-medium">
                    ₱{discountTotal.toFixed(2)}
                  </span>
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-gray-600">
                    Delivery Fee
                  </span>

                  <span className="font-medium">
                    ₱{deliveryFee.toFixed(2)}
                  </span>
                </div>
              </>
            )}

            <div className="mt-5 flex justify-between border-t pt-5">
              <span className="text-lg font-semibold">
                {quote ? 'Total' : 'Estimated Total'}
              </span>

              <span className="text-2xl font-bold text-ruby-600">
                ₱{quotedTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {quote && (
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder}
              className="mt-6 w-full rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPlacingOrder
                ? 'Placing Order...'
                : 'Place Order'}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

export default Checkout;