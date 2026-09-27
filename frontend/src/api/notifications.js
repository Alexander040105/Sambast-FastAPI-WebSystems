import { api } from './client';

export async function getNotifications({ page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams();

  params.set('page', page);
  params.set('page_size', pageSize);

  return api.get(`/notifications?${params.toString()}`);
}

export async function sendTestNotification(recipientEmail, message = '') {
  return api.post('/notifications/test', {
    recipient_email: recipientEmail,
    ...(message.trim() ? { message: message.trim() } : {}),
  });
}