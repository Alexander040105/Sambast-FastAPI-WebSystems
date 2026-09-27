import { api } from './client';

export async function getOrders({
  page = 1,
  pageSize = 10,
} = {}) {
  const params = new URLSearchParams();

  params.set('page', page);
  params.set('page_size', pageSize);

  return api.get(`/orders?${params.toString()}`);
}

export async function getOrder(orderNo) {
  return api.get(`/orders/${encodeURIComponent(orderNo)}`);
}

export async function getOrderStatus(orderNo) {
  return api.get(
    `/orders/${encodeURIComponent(orderNo)}/status`
  );
}

export async function cancelOrder(orderNo, reason) {
  return api.post(
    `/orders/${encodeURIComponent(orderNo)}/cancel`,
    {
      reason,
    }
  );
}