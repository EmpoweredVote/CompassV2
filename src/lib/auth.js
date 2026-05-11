// In dev mode (vite dev server), use a relative /api path so requests are
// proxied through Vite to the production API — bypassing CORS. See
// vite.config.js for the proxy config and COMPASSV2-INTEGRATION.md for the
// rationale. In production builds (`vite build`), talk to the prod API
// directly via the absolute URL.
export const API_BASE = import.meta.env.DEV
  ? '/api'
  : 'https://accounts-api.empowered.vote/api';

export const TOKEN_KEY = 'ev_token';
export const AUTH_HUB_URL = 'https://accounts.empowered.vote';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function extractHashToken() {
  const hash = window.location.hash;
  if (!hash.includes('access_token=')) return null;
  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  if (!token) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  setToken(token);
  return token;
}

export function redirectToLogin(returnUrl = window.location.href) {
  const redirectParam = encodeURIComponent(returnUrl);
  window.location.href = `${AUTH_HUB_URL}/login?redirect=${redirectParam}`;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    redirectToLogin();
    return null;
  }

  return res;
}

// Like apiFetch but never redirects on 401 — use for public/optional-auth endpoints
// where unauthenticated access is valid. Still sends the token if one is present.
export async function publicFetch(path, options = {}) {
  const token = getToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
