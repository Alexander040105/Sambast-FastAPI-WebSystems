import { api } from './client';

// -------------------------
// Products
// -------------------------

export async function getAdminProducts({
  page = 1,
  pageSize = 20,
  includeArchived = true,
  search = '',
  categoryId = '',
  sortBy = 'created_at',
  sortOrder = 'desc',
} = {}) {
  const params = new URLSearchParams();

  params.set('page', page);
  params.set('page_size', pageSize);
  params.set('include_archived', includeArchived);
  params.set('sort_by', sortBy);
  params.set('sort_order', sortOrder);

  if (search.trim()) {
    params.set('search', search.trim());
  }

  if (categoryId !== '' && categoryId !== null && categoryId !== undefined) {
    params.set('category_id', categoryId);
  }

  return api.get(`/products?${params.toString()}`);
}

export async function getAdminProduct(productId) {
  return api.get(`/products/${encodeURIComponent(productId)}`);
}

export async function createProduct(product) {
  return api.post('/products', product);
}

export async function updateProduct(productId, product) {
  return api.patch(`/products/${encodeURIComponent(productId)}`, product);
}

export async function deleteProduct(productId) {
  return api.delete(`/products/${encodeURIComponent(productId)}`);
}

// -------------------------
// Categories
// -------------------------

export async function getAdminCategories() {
  return api.get('/categories');
}

export async function getAdminCategory(categoryId) {
  return api.get(`/categories/${encodeURIComponent(categoryId)}`);
}

export async function createCategory(category) {
  return api.post('/categories', category);
}

export async function updateCategory(categoryId, category) {
  return api.patch(`/categories/${encodeURIComponent(categoryId)}`, category);
}

export async function deleteCategory(categoryId) {
  return api.delete(`/categories/${encodeURIComponent(categoryId)}`);
}

// -------------------------
// Orders
// -------------------------

export async function getAdminOrders({
  page = 1,
  pageSize = 20,
  status = '',
} = {}) {
  const params = new URLSearchParams();

  params.set('page', page);
  params.set('page_size', pageSize);

  if (status) {
    params.set('status', status);
  }

  return api.get(`/orders?${params.toString()}`);
}

export async function getAdminOrder(orderNo) {
  return api.get(`/orders/${encodeURIComponent(orderNo)}`);
}

export async function getAdminOrderStatus(orderNo) {
  return api.get(`/orders/${encodeURIComponent(orderNo)}/status`);
}