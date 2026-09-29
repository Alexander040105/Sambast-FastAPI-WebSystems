import { api } from './client.js';
import { getFleetCollection } from './fleet.js';

export const fetchDrivers = () => getFleetCollection('/drivers');
export const fetchDriver = (id) => api.get(`/drivers/${id}`);
export const createDriver = (payload) => api.post('/drivers', payload);
export const updateDriver = (id, payload) => api.patch(`/drivers/${id}`, payload);
export const deleteDriver = (id) => api.delete(`/drivers/${id}`);
