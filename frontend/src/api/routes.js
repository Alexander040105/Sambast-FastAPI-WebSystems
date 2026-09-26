import { api } from './client.js';

export const getAvailableRoutes = () => api.get('/routes');
export const getRouteDetail = async (routeId) => {
  const data = await api.get(`/routes/${routeId}`);
  return {
    ...data,
    assignedDriver: data.assigned_driver,
    estimatedRemainingMin: data.estimated_remaining_min,
    stops: data.stops.map(s => ({
      ...s,
      deliveryWindow: s.delivery_window,
      orderNo: s.order_no,
      failureReason: s.failure_reason,
      failureNotes: s.failure_notes,
      podPhotoName: s.pod_photo_name,
      recipientName: s.recipient_name,
      deliveredAt: s.delivered_at
    }))
  };
};
export const optimizeRoute = (routeId) => api.post(`/routes/${routeId}/optimize`);
export const saveStopOrder = async (routeId, stops) => {
  const payload = stops.map((id, index) => ({ id: Number(id), sequence_no: index + 1 }));
  await api.patch(`/routes/${routeId}`, { stops: payload });
  return getRouteDetail(routeId);
};
export const createRoute = (driverId) => api.post('/routes', { driver_id: Number(driverId) });
