import { api } from './client';

export async function getProducts({
  page = 1,
  pageSize = 12,
  search = '',
  category = '',
} = {}) {
  const params = new URLSearchParams();

  params.set('page', page);
  params.set('page_size', pageSize);

  if (search.trim()) {
    params.set('search', search.trim());
  }

  if (category) {
    params.set('category_id', category);
  }

  return api.get(`/products?${params.toString()}`);
}

export async function getCategories() {
  return api.get('/categories');
}