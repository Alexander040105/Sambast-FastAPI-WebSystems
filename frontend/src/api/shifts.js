import { api } from './client.js';
import { getFleetCollection } from './fleet.js';

export const fetchShifts = () => getFleetCollection('/shifts');
export const createShift = (payload) => api.post('/shifts', payload);
export const updateShift = (id, payload) => api.patch(`/shifts/${id}`, payload);
export const deleteShift = (id) => api.delete(`/shifts/${id}`);
