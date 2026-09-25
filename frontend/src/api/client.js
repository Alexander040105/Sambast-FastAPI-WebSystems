const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getAuthToken() {
  return localStorage.getItem('access_token');
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
  }
}

function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

function setRefreshToken(token) {
  if (token) {
    localStorage.setItem('refresh_token', token);
  } else {
    localStorage.removeItem('refresh_token');
  }
}

function clearAuth() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

function getAuthRole() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)).role || null;
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    throw new ApiError(error.message || 'Unable to connect to the server', 'NETWORK_ERROR', 0);
  }

  if (response.status === 401) {
    clearAuth();
    throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401);
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = response.status === 204 ? null : (isJson ? await response.json() : await response.text());

  if (!response.ok) {
    const detail = isJson ? data.detail : null;
    const validationMessage = Array.isArray(detail)
      ? detail.map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : '';
        return field ? `${field}: ${item.msg}` : item.msg;
      }).join('; ')
      : null;
    const message = validationMessage
      || (typeof detail === 'string' ? detail : null)
      || data?.error?.message
      || data?.message
      || (typeof data === 'string' ? data : null)
      || 'Request failed';
    const code = data?.error?.code || data?.code || 'REQUEST_FAILED';
    throw new ApiError(message, code, response.status, detail || data?.error?.details);
  }

  return data;
}

export const api = {
  get: (endpoint, params) => {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;
    return request(url, { method: 'GET' });
  },

  post: (endpoint, body) =>
    request(endpoint, { method: 'POST', body }),

  patch: (endpoint, body) =>
    request(endpoint, { method: 'PATCH', body }),

  put: (endpoint, body) =>
    request(endpoint, { method: 'PUT', body }),

  delete: (endpoint) =>
    request(endpoint, { method: 'DELETE' }),
};

export const auth = {
  getToken: getAuthToken,
  getRole: getAuthRole,
  setToken: setAuthToken,
  getRefreshToken,
  setRefreshToken,
  clearAuth,
};

export { ApiError };
