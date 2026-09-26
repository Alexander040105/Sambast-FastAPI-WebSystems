import { api } from './client.js';
import { auth } from './client.js';

const mapManifest = (data) => ({
  ...data,
  dateLabel: data.date_label,
  shiftLabel: data.shift_label,
  routeStarted: data.route_started,
  failureReasons: data.failure_reasons,
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
});

export const getDriverManifest = async () => mapManifest(await api.get('/me/route'));
export const startRoute = async (stopId) => mapManifest(await api.post(`/stops/${stopId}/start`));
export const arriveAtStop = async (stopId) => mapManifest(await api.post(`/stops/${stopId}/arrive`));
export const failStop = async (stopId, reason, notes) => mapManifest(await api.post(`/stops/${stopId}/fail`, { reason, notes }));

export const completeStop = async (stopId, photoFile, recipientName) => {
    // For POD, we need multipart/form-data
    const token = auth.getToken();
    const formData = new FormData();
    formData.append('photo', photoFile);
    if (recipientName) formData.append('recipient_name', recipientName);

    const res = await fetch(`/api/v1/deliveries/${stopId}/pod`, {
        method: 'POST',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
    });

    if (!res.ok) {
        throw new Error("Failed to upload POD");
    }

    // Now call complete
    return mapManifest(await api.post(`/stops/${stopId}/complete`));
};
