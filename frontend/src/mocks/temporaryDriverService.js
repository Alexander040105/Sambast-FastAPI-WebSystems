/*
 * TEMPORARY T5 DEVELOPMENT MOCK.
 * Replace this module with the real manifest/stop/POD API service when BE-B
 * ships the driver endpoints. No backend calls or database writes happen here.
 */

const failureReasons = [
  { value: 'recipient_unavailable', label: 'Recipient unavailable' },
  { value: 'business_closed', label: 'Business closed' },
  { value: 'address_not_found', label: 'Address not found' },
  { value: 'delivery_declined', label: 'Delivery declined' },
];

const stops = [
  { id: 1, sequence: 1, orderNo: 'ORD-9204', recipient: 'Broadway Clinic', address: '1404 SW Broadway, Portland, OR', window: '08:00 – 11:00', status: 'pending', weight: '1,240 kg' },
  { id: 2, sequence: 2, orderNo: 'ORD-9205', recipient: 'Lombard Distribution', address: '920 NE Lombard St, Portland, OR', window: '09:30 – 12:30', status: 'pending', weight: '850 kg' },
  { id: 3, sequence: 3, orderNo: 'ORD-9206', recipient: 'SE Division Wholesale', address: '3311 SE Division St, Portland, OR', window: '10:00 – 13:00', status: 'pending', weight: '2,100 kg' },
  { id: 4, sequence: 4, orderNo: 'ORD-9207', recipient: 'Multnomah Medical', address: '1205 NW 23rd Ave, Portland, OR', window: '11:00 – 14:00', status: 'delivered', weight: '420 kg', deliveredAt: '07:14' },
  { id: 5, sequence: 5, orderNo: 'ORD-9208', recipient: 'Northwest Health Supply', address: '405 NE Multnomah St, Portland, OR', window: '12:00 – 15:00', status: 'pending', weight: '1,600 kg' },
  { id: 6, sequence: 6, orderNo: 'ORD-9209', recipient: 'Riverfront Pharmacy', address: '801 Naito Pkwy, Portland, OR', window: '13:00 – 16:00', status: 'failed', weight: '680 kg', failureReason: 'recipient_unavailable' },
];

let routeStarted = false;

function currentStop() {
  return stops.find((stop) => ['en_route', 'arrived'].includes(stop.status)) || stops.find((stop) => stop.status === 'pending') || null;
}

function createManifest() {
  return {
    dateLabel: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()),
    shiftLabel: 'Shift Active',
    routeStarted,
    stops: stops.map((stop) => ({ ...stop })),
    failureReasons: failureReasons.map((reason) => ({ ...reason })),
  };
}

export async function getDriverManifest() {
  return createManifest();
}

export async function startRoute(stopId) {
  const stop = stops.find((item) => item.id === Number(stopId));
  const current = currentStop();
  if (!stop || !current || current.id !== stop.id || stop.status !== 'pending') throw new Error('Only the next pending stop can start the route.');
  routeStarted = true;
  stop.status = 'en_route';
  return createManifest();
}

export async function arriveAtStop(stopId) {
  const stop = stops.find((item) => item.id === Number(stopId));
  const current = currentStop();
  if (!routeStarted) throw new Error('Start the route before confirming arrival.');
  if (current && current.id !== Number(stopId)) throw new Error('Complete the earlier stop before moving to this one.');
  if (!stop || stop.status !== 'en_route') throw new Error('This stop cannot be marked arrived.');
  stop.status = 'arrived';
  return createManifest();
}

export async function completeStop(stopId, photoName, recipientName = '') {
  const stop = stops.find((item) => item.id === Number(stopId));
  const current = currentStop();
  if (current && current.id !== Number(stopId)) throw new Error('Complete the earlier stop before moving to this one.');
  if (!stop || stop.status !== 'arrived') throw new Error('Arrive at the stop before completing delivery.');
  if (!photoName) throw new Error('Select a proof-of-delivery photo first.');
  stop.status = 'delivered';
  stop.deliveredAt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date());
  stop.podPhotoName = photoName;
  stop.recipientName = recipientName.trim();
  return createManifest();
}

export async function failStop(stopId, reason, notes = '') {
  const stop = stops.find((item) => item.id === Number(stopId));
  const current = currentStop();
  if (current && current.id !== Number(stopId)) throw new Error('Complete the earlier stop before moving to this one.');
  if (!stop || stop.status !== 'arrived') throw new Error('Confirm arrival before reporting a failed delivery.');
  if (!failureReasons.some((item) => item.value === reason)) throw new Error('Select a failure reason.');
  stop.status = 'failed';
  stop.failureReason = reason;
  stop.failureNotes = notes.trim();
  return createManifest();
}
