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

  const response = await fetch(url, config);

  if (response.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401);
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = isJson
      ? data.error || { message: 'Request failed', code: 'REQUEST_FAILED' }
      : { message: data || 'Request failed', code: 'REQUEST_FAILED' };
    throw new ApiError(error.message, error.code, response.status, error.details);
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
  setToken: setAuthToken,
  getRefreshToken,
  setRefreshToken,
  clearAuth,
};

export { ApiError };