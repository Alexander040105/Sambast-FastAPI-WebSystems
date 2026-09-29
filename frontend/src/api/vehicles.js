import { api } from './client.js';
import { getFleetCollection } from './fleet.js';

export const fetchVehicles = () => getFleetCollection('/vehicles');
export const fetchVehicle = (id) => api.get(`/vehicles/${id}`);
export const createVehicle = (payload) => api.post('/vehicles', payload);
export const updateVehicle = (id, payload) => api.patch(`/vehicles/${id}`, payload);
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}`);
