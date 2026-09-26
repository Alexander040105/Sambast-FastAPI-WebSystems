/*
 * TEMPORARY T6 DEVELOPMENT MOCK.
 * Replace getRouteDetail/saveStopOrder with the real route APIs when BE-B
 * ships them. No backend requests or database writes happen here.
 */

const routes = new Map([
  ['RTE-3174', {
  id: 'RTE-3174',
  status: 'active',
  assignedDriver: 'Avery Santos',
  vehicle: 'Unit 218',
  estimatedRemainingMin: 205,
  stops: [
    { id: 'stop-611', sequence: 1, destination: 'Westside Medical Supply', address: '7420 SW Beaverton Hillsdale Hwy, Portland, OR', deliveryWindow: '07:30–09:00', status: 'completed' },
    { id: 'stop-612', sequence: 2, destination: 'Riverside Health Depot', address: '1836 SE Water Ave, Portland, OR', deliveryWindow: '09:00–10:30', status: 'en_route' },
    { id: 'stop-613', sequence: 3, destination: 'Northgate Clinic', address: '510 NE 102nd Ave, Portland, OR', deliveryWindow: '10:30–12:00', status: 'pending' },
    { id: 'stop-614', sequence: 4, destination: 'Cedar Grove Pharmacy', address: '2640 N Lombard St, Portland, OR', deliveryWindow: '12:00–13:30', status: 'pending' },
    { id: 'stop-615', sequence: 5, destination: 'Eastbank Care Center', address: '920 SE Hawthorne Blvd, Portland, OR', deliveryWindow: '14:00–15:30', status: 'pending' },
  ],
  }],
  ['RTE-3182', {
    id: 'RTE-3182',
    status: 'planned',
    assignedDriver: 'Jordan Lee',
    vehicle: 'Unit 305',
    estimatedRemainingMin: 168,
    stops: [
      { id: 'stop-821', sequence: 1, destination: 'Central Medical Depot', address: '1600 NE Sandy Blvd, Portland, OR', deliveryWindow: '08:00–09:30', status: 'pending' },
      { id: 'stop-822', sequence: 2, destination: 'Lakeside Care Center', address: '4400 N Williams Ave, Portland, OR', deliveryWindow: '09:30–11:00', status: 'pending' },
      { id: 'stop-823', sequence: 3, destination: 'Oak Street Pharmacy', address: '725 SE Oak St, Portland, OR', deliveryWindow: '11:00–12:30', status: 'pending' },
    ],
  }],
]);

export async function getAvailableRoutes() {
  return [...routes.values()].map(({ id, status }) => ({ id, status }));
}

function cloneRoute(route) {
  return { ...route, stops: route.stops.map((stop) => ({ ...stop })) };
}

function applyStopOrder(route, orderedStopIds) {
  const currentIds = route.stops.map((stop) => stop.id);
  const requestedIds = orderedStopIds.map(String);
  if (requestedIds.length !== currentIds.length || new Set(requestedIds).size !== currentIds.length || currentIds.some((id) => !requestedIds.includes(id))) {
    throw new Error('The saved order must contain every route stop exactly once.');
  }

  route.stops.forEach((stop, index) => {
    if (stop.status !== 'pending' && requestedIds[index] !== stop.id) {
      throw new Error('Completed, active, and failed stops cannot be moved.');
    }
  });

  const stopsById = new Map(route.stops.map((stop) => [stop.id, stop]));
  route.stops = requestedIds.map((id, index) => ({ ...stopsById.get(id), sequence: index + 1 }));
}

function restoreSavedOrder(route) {
  if (typeof window === 'undefined') return;
  try {
    const savedIds = JSON.parse(window.localStorage.getItem(`temporary-route-order:${route.id}`) || 'null');
    if (Array.isArray(savedIds)) applyStopOrder(route, savedIds);
  } catch {
    // Ignore invalid or unavailable browser storage and retain the fixture order.
  }
}

export async function getRouteDetail(routeId) {
  const route = routes.get(String(routeId));
  if (!route) {
    const error = new Error(`Route ${routeId} was not found.`);
    error.status = 404;
    throw error;
  }
  restoreSavedOrder(route);
  return cloneRoute(route);
}

export async function saveStopOrder(routeId, orderedStopIds) {
  const route = routes.get(String(routeId));
  if (!route) {
    const error = new Error(`Route ${routeId} was not found.`);
    error.status = 404;
    throw error;
  }

  const requestedIds = orderedStopIds.map(String);
  applyStopOrder(route, requestedIds);
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(`temporary-route-order:${route.id}`, JSON.stringify(requestedIds)); }
    catch { /* Keep the in-memory temporary save when browser storage is unavailable. */ }
  }
  return cloneRoute(route);
}
