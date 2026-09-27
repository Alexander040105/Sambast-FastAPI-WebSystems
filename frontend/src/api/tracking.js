import { api } from './client';

export async function getTracking(orderNo) {
  return api.get(`/track/${encodeURIComponent(orderNo)}`);
}

export function getTrackingStreamUrl(orderNo) {
  return `/api/v1/track/${encodeURIComponent(orderNo)}/stream`;
}