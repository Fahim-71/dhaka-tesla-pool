// Small wrapper around fetch for talking to the API.
// - adds the JSON headers and the Bearer token
// - turns error responses into an ApiError with the API's code + message
// - tells the UI when a request is slow (free-tier hosting sleeps when idle and
//   can take a while to wake up), so we can show a friendly banner

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'dtp.token';
const SLOW_AFTER_MS = 4000;

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked (private mode): the session just won't survive a reload.
  }
}

let pendingSlow = 0;
function slowChanged(delta) {
  pendingSlow += delta;
  window.dispatchEvent(new CustomEvent('api:slow', { detail: pendingSlow > 0 }));
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const token = getToken();
  let isSlow = false;
  const slowTimer = setTimeout(() => {
    isSlow = true;
    slowChanged(1);
  }, SLOW_AFTER_MS);

  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(slowTimer);
    if (isSlow) slowChanged(-1);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = data?.error ?? {};
    if (response.status === 401 && token) {
      // Token expired or invalid: let the AuthContext sign the user out.
      window.dispatchEvent(new Event('api:unauthorized'));
    }
    throw new ApiError(
      response.status,
      error.code ?? 'UNKNOWN_ERROR',
      error.message ?? 'Something went wrong. Please try again.',
      error.details,
    );
  }
  return data;
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
};
