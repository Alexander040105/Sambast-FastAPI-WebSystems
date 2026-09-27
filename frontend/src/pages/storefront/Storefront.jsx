import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCategories, getProducts } from '../../api/products';

function Storefront() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [pagination, setPagination] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories();

        const categoryData = data?.data || data;

        setCategories(
          Array.isArray(categoryData)
            ? categoryData
            : []
        );
      } catch {
        setCategories([]);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      setIsLoading(true);
      setError('');

      try {
        const data = await getProducts({
          page,
          pageSize,
          search,
          category,
        });

        const productData = data?.data || data;

        if (Array.isArray(productData)) {
          setProducts(productData);
          setPagination(data?.pagination || null);
        } else {
          setProducts([]);
          setPagination(data?.pagination || null);
        }
      } catch (err) {
        setProducts([]);
        setError(
          err.message || 'Unable to load products.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadProducts();
  }, [page, search, category]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
  }

  function handleCategoryChange(event) {
    setCategory(event.target.value);
    setPage(1);
  }

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Sambast Store
        </h1>

        <p className="mt-2 text-gray-600">
          Browse products and add them to your cart.
        </p>
      </div>

      <div className="mb-8 rounded-xl bg-white p-5 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-4 md:flex-row"
        >
          <div className="flex-1">
            <label
              htmlFor="search"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Search Products
            </label>

            <input
              id="search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div className="md:w-64">
            <label
              htmlFor="category"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Category
            </label>

            <select
              id="category"
              value={category}
              onChange={handleCategoryChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">
                All Categories
              </option>

              {categories.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 md:w-auto"
            >
              Search
            </button>
          </div>
        </form>
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
            Loading products...
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            No Products Found
          </h2>

          <p className="mt-2 text-gray-600">
            Try changing your search or category filter.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const basePrice = Number(
                product.base_price ?? 0
              );

              const unitOptions =
                product.unit_options || [];

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex h-52 items-center justify-center bg-gray-100">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm text-gray-400">
                        No image
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {product.name}
                    </h2>

                    {product.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-4">
                      <p className="text-sm text-gray-500">
                        Base Price
                      </p>

                      <p className="text-xl font-bold text-indigo-600">
                        ₱{basePrice.toFixed(2)}
                      </p>
                    </div>

                    {product.unit && (
                      <p className="mt-2 text-sm text-gray-500">
                        Unit: {product.unit}
                      </p>
                    )}

                    {unitOptions.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        {unitOptions.length} unit option
                        {unitOptions.length !== 1
                          ? 's'
                          : ''}{' '}
                        available
                      </p>
                    )}

                    <Link
                      to={`/customer/products/${product.id}`}
                      className="mt-5 block rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      View Product
                    </Link>
                  </div>
                </article>
              );
            })}
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

export default Storefront;