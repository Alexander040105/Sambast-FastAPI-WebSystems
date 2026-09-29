import { useEffect, useMemo, useState } from 'react';
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getAdminCategories,
  getAdminProducts,
  updateCategory,
  updateProduct,
} from '../../api/admin';

const EMPTY_PRODUCT = {
  category_id: '',
  name: '',
  description: '',
  base_price: '',
  unit: '',
  unit_options: [],
  discounts: [],
  weight_kg_per_unit: '',
  stock_quantity: '0',
  image_url: '',
  is_archived: false,
  purpose: '',
  target_species: '',
  tags: '',
};

const EMPTY_CATEGORY = {
  name: '',
  unit_options: [],
};

function parseNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function prepareProductPayload(form) {
  return {
    category_id:
      form.category_id === '' ? null : Number(form.category_id),
    name: form.name.trim(),
    description: form.description.trim() || null,
    base_price: parseNumber(form.base_price),
    unit: form.unit.trim() || null,
    unit_options: form.unit_options.length ? form.unit_options : null,
    discounts: form.discounts.length ? form.discounts : null,
    weight_kg_per_unit:
      form.weight_kg_per_unit === ''
        ? null
        : parseNumber(form.weight_kg_per_unit),
    stock_quantity: parseNumber(form.stock_quantity),
    image_url: form.image_url.trim() || null,
    is_archived: Boolean(form.is_archived),
    purpose: form.purpose.trim() || null,
    target_species: form.target_species.trim() || null,
    tags: form.tags.trim() || null,
  };
}

function ProductForm({ product, categories, onSave, onCancel, saving }) {
  const [form, setForm] = useState(EMPTY_PRODUCT);

  useEffect(() => {
    if (!product) {
      setForm(EMPTY_PRODUCT);
      return;
    }

    setForm({
      category_id: product.category_id ?? '',
      name: product.name ?? '',
      description: product.description ?? '',
      base_price: product.base_price ?? '',
      unit: product.unit ?? '',
      unit_options: product.unit_options ?? [],
      discounts: product.discounts ?? [],
      weight_kg_per_unit: product.weight_kg_per_unit ?? '',
      stock_quantity: product.stock_quantity ?? 0,
      image_url: product.image_url ?? '',
      is_archived: Boolean(product.is_archived),
      purpose: product.purpose ?? '',
      target_species: product.target_species ?? '',
      tags: product.tags ?? '',
    });
  }, [product]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function submit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    onSave(prepareProductPayload(form));
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-6"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-900">
            Basic Information
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Enter the main details for this catalog product.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Product Name
            </label>

            <input
              value={form.name}
              onChange={(event) =>
                updateField('name', event.target.value)
              }
              required
              placeholder="Enter product name"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Category
            </label>

            <select
              value={form.category_id}
              onChange={(event) =>
                updateField('category_id', event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            >
              <option value="">No category</option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Unit
            </label>

            <input
              value={form.unit}
              onChange={(event) =>
                updateField('unit', event.target.value)
              }
              placeholder="e.g. kg"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Description
            </label>

            <textarea
              value={form.description}
              onChange={(event) =>
                updateField('description', event.target.value)
              }
              rows={4}
              placeholder="Describe the product..."
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-900">
            Pricing & Inventory
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Configure pricing, stock, and product weight.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Base Price
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                ₱
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.base_price}
                onChange={(event) =>
                  updateField('base_price', event.target.value)
                }
                required
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Stock Quantity
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={form.stock_quantity}
              onChange={(event) =>
                updateField('stock_quantity', event.target.value)
              }
              placeholder="0"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Weight per Unit (kg)
            </label>

            <input
              type="number"
              min="0"
              step="0.001"
              value={form.weight_kg_per_unit}
              onChange={(event) =>
                updateField(
                  'weight_kg_per_unit',
                  event.target.value
                )
              }
              placeholder="0.000"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-900">
            Additional Details
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Optional information used to describe and organize the product.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Image URL
            </label>

            <input
              type="url"
              value={form.image_url}
              onChange={(event) =>
                updateField('image_url', event.target.value)
              }
              placeholder="https://example.com/product.jpg"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Purpose
            </label>

            <input
              value={form.purpose}
              onChange={(event) =>
                updateField('purpose', event.target.value)
              }
              placeholder="Product purpose"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Target Species
            </label>

            <input
              value={form.target_species}
              onChange={(event) =>
                updateField(
                  'target_species',
                  event.target.value
                )
              }
              placeholder="Target species"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Tags
            </label>

            <input
              value={form.tags}
              onChange={(event) =>
                updateField('tags', event.target.value)
              }
              placeholder="tag1, tag2"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.is_archived}
              onChange={(event) =>
                updateField(
                  'is_archived',
                  event.target.checked
                )
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-ruby-600 focus:ring-ruby-500"
            />

            <span>
              <span className="block text-sm font-semibold text-amber-900">
                Archive this product
              </span>

              <span className="mt-1 block text-xs text-amber-700">
                Archived products can remain in the catalog without being treated as active.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-ruby-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-ruby-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? 'Saving...'
            : product
              ? 'Update Product'
              : 'Create Product'}
        </button>
      </div>
    </form>
  );
}

function CategoryManager({ categories, onRefresh }) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function addCategory(event) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      await createCategory({
        name: name.trim(),
        unit_options: null,
      });

      setName('');
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(categoryId) {
    if (!editingName.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      await updateCategory(categoryId, {
        name: editingName.trim(),
      });

      setEditingId(null);
      setEditingName('');
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(categoryId) {
    const confirmed = window.confirm(
      'Delete this category? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await deleteCategory(categoryId);
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ruby-50 text-lg">
            🗂️
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Categories
            </h2>

            <p className="text-sm text-slate-500">
              Organize products into manageable groups.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={addCategory}
          className="mb-6 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New category name"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
          />

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-ruby-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ruby-700 disabled:opacity-50"
          >
            {saving ? 'Adding...' : '+ Add Category'}
          </button>
        </form>

        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                No categories found.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Add your first category above.
              </p>
            </div>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                {editingId === category.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(event) =>
                        setEditingName(event.target.value)
                      }
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveCategory(category.id)}
                        disabled={saving}
                        className="rounded-lg bg-ruby-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ruby-700 disabled:opacity-50"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-ruby-600 shadow-sm">
                        {category.name.charAt(0).toUpperCase()}
                      </div>

                      <span className="font-semibold text-slate-800">
                        {category.name}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(category.id);
                          setEditingName(category.name);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeCategory(category.id)
                        }
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [includeArchived, setIncludeArchived] = useState(true);

  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categoryMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.id,
        category.name,
      ])
    );
  }, [categories]);

  async function loadCategories() {
    const response = await getAdminCategories();
    setCategories(response?.data || []);
  }

  async function loadProducts(overrides = {}) {
    try {
      setLoading(true);
      setError('');

      const response = await getAdminProducts({
        page: overrides.page ?? page,
        pageSize: 20,
        includeArchived:
          overrides.includeArchived ?? includeArchived,
        search: overrides.search ?? search,
        categoryId:
          overrides.categoryId ?? categoryId,
        sortBy: overrides.sortBy ?? sortBy,
        sortOrder:
          overrides.sortOrder ?? sortOrder,
      });

      setProducts(response?.data || []);
      setPagination(response?.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories().catch((err) => {
      setError(err.message);
    });
  }, []);

  useEffect(() => {
    loadProducts();
  }, [
    page,
    includeArchived,
    categoryId,
    sortBy,
    sortOrder,
  ]);

  async function handleSearch(event) {
    event.preventDefault();

    setPage(1);

    await loadProducts({
      page: 1,
      search,
    });
  }

  async function handleProductSave(payload) {
    try {
      setSaving(true);
      setError('');

      if (editingProduct) {
        await updateProduct(
          editingProduct.id,
          payload
        );
      } else {
        await createProduct(payload);
      }

      setEditingProduct(null);
      setShowProductForm(false);

      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(productId) {
    const confirmed = window.confirm(
      'Delete this product? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await deleteProduct(productId);
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshCategories() {
    await loadCategories();
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ruby-600">
            Product Management
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Catalog
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage products, categories, pricing, inventory, and catalog visibility.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingProduct(null);
            setShowProductForm(true);
          }}
          className="inline-flex items-center justify-center rounded-xl bg-ruby-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-ruby-700"
        >
          + Add Product
        </button>
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

      <CategoryManager
        categories={categories}
        onRefresh={refreshCategories}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ruby-50 text-lg">
                  📦
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Products
                  </h2>

                  <p className="text-sm text-slate-500">
                    Manage your delivery catalog.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              {pagination?.total ?? products.length} products
            </div>
          </div>
        </div>

        {showProductForm && (
          <div className="border-b border-slate-200 bg-slate-50 p-6">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-slate-900">
                {editingProduct
                  ? 'Edit Product'
                  : 'Create Product'}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {editingProduct
                  ? 'Update the selected catalog product.'
                  : 'Add a new product to the catalog.'}
              </p>
            </div>

            <ProductForm
              product={editingProduct}
              categories={categories}
              onSave={handleProductSave}
              onCancel={() => {
                setEditingProduct(null);
                setShowProductForm(false);
              }}
              saving={saving}
            />
          </div>
        )}

        <div className="p-6">
          {/* Filters */}
          <form
            onSubmit={handleSearch}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search
                </label>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search by product name..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </label>

                <select
                  value={categoryId}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
                >
                  <option value="">
                    All categories
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sort By
                </label>

                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-ruby-500 focus:ring-4 focus:ring-ruby-100"
                >
                  <option value="created_at">
                    Created Date
                  </option>
                  <option value="name">Name</option>
                  <option value="base_price">
                    Price
                  </option>
                  <option value="stock_quantity">
                    Stock
                  </option>
                </select>
              </div>

              <div className="flex items-end lg:col-span-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => {
                    setIncludeArchived(
                      event.target.checked
                    );
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-ruby-600 focus:ring-ruby-500"
                />

                Include archived products
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Order
                </span>

                <select
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-ruby-500"
                >
                  <option value="desc">
                    Descending
                  </option>
                  <option value="asc">
                    Ascending
                  </option>
                </select>
              </div>
            </div>
          </form>

          {/* Products */}
          <div className="mt-6">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-ruby-600" />

                <p className="text-sm font-medium text-slate-600">
                  Loading products...
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                  📦
                </div>

                <h3 className="mt-4 text-base font-bold text-slate-800">
                  No products found
                </h3>

                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  Try changing your search or filters, or add a new product.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left">
                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Product
                        </th>

                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Category
                        </th>

                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Price
                        </th>

                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Stock
                        </th>

                        <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Status
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {products.map((product) => (
                        <tr
                          key={product.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ruby-50 font-bold text-ruby-600">
                                {product.name
                                  ?.charAt(0)
                                  .toUpperCase() || 'P'}
                              </div>

                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800">
                                  {product.name}
                                </p>

                                {product.unit && (
                                  <p className="mt-0.5 text-xs text-slate-400">
                                    per {product.unit}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {categoryMap.get(
                              product.category_id
                            ) || '—'}
                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-800">
                            ₱
                            {Number(
                              product.base_price || 0
                            ).toFixed(2)}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`font-semibold ${
                                Number(
                                  product.stock_quantity || 0
                                ) === 0
                                  ? 'text-red-600'
                                  : 'text-slate-700'
                              }`}
                            >
                              {product.stock_quantity}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                product.is_archived
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {product.is_archived
                                ? 'Archived'
                                : 'Active'}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProduct(
                                    product
                                  );
                                  setShowProductForm(true);
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteProduct(
                                    product.id
                                  )
                                }
                                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

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