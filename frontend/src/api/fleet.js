import { api } from './client.js';

export async function getFleetCollection(endpoint, filters = {}) {
  const records = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await api.get(endpoint, { ...filters, page, page_size: 100 });
    if (!Array.isArray(result?.data)) {
      throw new Error(`Unexpected response from ${endpoint}: expected a data array`);
    }
    records.push(...result.data);
    totalPages = result.pagination?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return records;
}
