import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useCart } from '../../cart/CartContext';

function ProductDetail() {
  const { productId } = useParams();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadProduct() {
      setIsLoading(true);
      setError('');

      try {
        const data = await api.get(`/products/${productId}`);

        const productData = data?.data || data;

        setProduct(productData);

        const unitOptions = productData?.unit_options || [];

        if (unitOptions.length > 0) {
          setSelectedUnit(unitOptions[0]);
        } else if (productData?.unit) {
          setSelectedUnit({
            label: productData.unit,
            value: productData.unit,
          });
        } else {
          setSelectedUnit(null);
        }
      } catch (err) {
        setError(err.message || 'Unable to load product.');
      } finally {
        setIsLoading(false);
      }
    }

    loadProduct();
  }, [productId]);

  function handleQuantityChange(value) {
    const nextQuantity = Number(value);

    if (nextQuantity < 1) {
      setQuantity(1);
      return;
    }

    setQuantity(nextQuantity);
  }

  function handleAddToCart() {
    if (!product) {
      return;
    }

    addToCart(product, quantity, selectedUnit);

    setMessage('Product added to cart.');
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center">
        <p className="text-gray-600">
          Loading product...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">
            Unable to load product
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {error}
          </p>

          <Link
            to="/customer"
            className="mt-5 inline-block rounded-lg bg-ruby-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-ruby-700"
          >
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Product Not Found
        </h1>

        <Link
          to="/customer"
          className="mt-5 inline-block text-ruby-600 hover:text-ruby-700"
        >
          Back to Store
        </Link>
      </div>
    );
  }

  const basePrice = Number(product.base_price || 0);
  const unitOptions = product.unit_options || [];
  const selectedMultiplier =
    Number(selectedUnit?.multiplier ?? 1) || 1;
  const displayPrice = basePrice * selectedMultiplier;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        to="/customer"
        className="text-sm font-medium text-ruby-600 hover:text-ruby-700"
      >
        ← Back to Store
      </Link>

      <div className="mt-6 grid gap-8 rounded-xl bg-white p-6 shadow-sm md:grid-cols-2">
        <div className="flex min-h-80 items-center justify-center rounded-xl bg-gray-100">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full max-h-96 w-full rounded-xl object-cover"
            />
          ) : (
            <span className="text-gray-400">
              No image available
            </span>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {product.name}
          </h1>

          {product.description && (
            <p className="mt-4 leading-7 text-gray-600">
              {product.description}
            </p>
          )}

          <div className="mt-6">
            <p className="text-sm text-gray-500">
              Price
              {selectedUnit?.label
                ? ` per ${selectedUnit.label}`
                : ''}
            </p>

            <p className="text-3xl font-bold text-ruby-600">
              ₱{displayPrice.toFixed(2)}
            </p>

            {selectedMultiplier !== 1 && (
              <p className="mt-1 text-xs text-gray-400">
                ₱{basePrice.toFixed(2)} base ×{' '}
                {selectedMultiplier}
              </p>
            )}
          </div>

          {unitOptions.length > 0 && (
            <div className="mt-6">
              <label
                htmlFor="unit"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Unit
              </label>

              <select
                id="unit"
                value={selectedUnit?.value || ''}
                onChange={(event) => {
                  const unit = unitOptions.find(
                    (item) =>
                      item.value === event.target.value
                  );

                  setSelectedUnit(unit || null);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
              >
                {unitOptions.map((unit) => (
                  <option
                    key={unit.value}
                    value={unit.value}
                  >
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {product.unit && unitOptions.length === 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700">
                Unit
              </p>

              <p className="mt-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-700">
                {product.unit}
              </p>
            </div>
          )}

          <div className="mt-6">
            <label
              htmlFor="quantity"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Quantity
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  handleQuantityChange(quantity - 1)
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg hover:bg-gray-100"
              >
                −
              </button>

              <input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(event) =>
                  handleQuantityChange(event.target.value)
                }
                className="w-20 rounded-lg border border-gray-300 px-3 py-2.5 text-center outline-none focus:border-ruby-500 focus:ring-2 focus:ring-ruby-200"
              />

              <button
                type="button"
                onClick={() =>
                  handleQuantityChange(quantity + 1)
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-700">
                {message}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleAddToCart}
            className="mt-6 w-full rounded-lg bg-ruby-600 px-5 py-3 font-medium text-white hover:bg-ruby-700"
          >
            Add to Cart
          </button>

          <Link
            to="/customer/cart"
            className="mt-3 block w-full rounded-lg border border-gray-300 px-5 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
          >
            View Cart
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;