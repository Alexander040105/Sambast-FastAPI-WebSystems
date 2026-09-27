import { Link } from 'react-router-dom';
import { useCart } from '../../cart/CartContext';

function Cart() {
  const {
    items,
    totalItems,
    totalAmount,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Your Cart
          </h1>

          <p className="mt-2 text-gray-600">
            Your cart is currently empty.
          </p>

          <Link
            to="/customer"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Your Cart
          </h1>

          <p className="mt-2 text-gray-600">
            {totalItems} item{totalItems !== 1 ? 's' : ''} in your cart.
          </p>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Clear Cart
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const price = Number(
            item.product?.base_price ?? 0
          );

          const unitValue = item.unit?.value ?? null;
          const unitLabel = item.unit?.label ?? null;

          const itemTotal = price * item.quantity;

          return (
            <article
              key={`${item.product.id}-${unitValue ?? 'default'}`}
              className="rounded-xl bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  {item.product.image_url ? (
                    <img
                      src={item.product.image_url}
                      alt={item.product.name}
                      className="h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">
                      No image
                    </span>
                  )}
                </div>

                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {item.product.name}
                  </h2>

                  {unitLabel && (
                    <p className="mt-1 text-sm text-gray-500">
                      Unit: {unitLabel}
                    </p>
                  )}

                  <p className="mt-2 font-medium text-indigo-600">
                    ₱{price.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(
                        item.product.id,
                        item.quantity - 1,
                        unitValue
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-lg hover:bg-gray-100"
                  >
                    −
                  </button>

                  <span className="min-w-8 text-center font-medium">
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(
                        item.product.id,
                        item.quantity + 1,
                        unitValue
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-lg hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>

                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    ₱{itemTotal.toFixed(2)}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      removeFromCart(
                        item.product.id,
                        unitValue
                      )
                    }
                    className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium text-gray-700">
            Estimated Subtotal
          </span>

          <span className="text-2xl font-bold text-gray-900">
            ₱{totalAmount.toFixed(2)}
          </span>
        </div>

        <p className="mt-2 text-sm text-gray-500">
          Final pricing, discounts, and delivery fees are calculated by
          the server during checkout.
        </p>

        <Link
          to="/customer/checkout"
          className="mt-5 block w-full rounded-lg bg-indigo-600 px-5 py-3 text-center font-medium text-white hover:bg-indigo-700"
        >
          Proceed to Checkout
        </Link>

        <Link
          to="/customer"
          className="mt-3 block text-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default Cart;