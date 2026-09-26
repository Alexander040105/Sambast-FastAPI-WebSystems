const API_BASE_URL = '/api/v1';

function getAccessToken() {
  return localStorage.getItem('access_token');
}

function saveAccessToken(token) {
  if (token) {
    localStorage.setItem('access_token', token);
  }
}

function clearAuth() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
  } = options;

  const token = getAccessToken();

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuth();
    }

    const errorMessage =
      data?.error?.message ||
      data?.message ||
      'An unexpected error occurred.';

    const error = new Error(errorMessage);

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export const api = {
  get(path) {
    return request(path);
  },

  post(path, body, options = {}) {
    return request(path, {
      method: 'POST',
      body,
      headers: options.headers || {},
    });
  },

  patch(path, body) {
    return request(path, {
      method: 'PATCH',
      body,
    });
  },

  delete(path) {
    return request(path, {
      method: 'DELETE',
    });
  },
};

export {
  getAccessToken,
  saveAccessToken,
  clearAuth,
};