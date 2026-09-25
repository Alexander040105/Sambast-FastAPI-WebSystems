import { api } from './client.js';

export const fetchDispatchQueue = () => api.get('/dispatch/queue');

export const getDispatchRecommendation = (orderId) => api.post('/dispatch/auto-assign', {
  order_id: Number(orderId),
});

export const assignOrderToDriver = (orderId, payload) => api.post(
  `/dispatch/orders/${encodeURIComponent(orderId)}/assign`,
  payload,
);
