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

// Silent access-token refresh (matches empowered-vote-app / validation-quests).
// The WorkOS refresh token lives in the httpOnly ev_wos_session cookie on
// .empowered.vote; GET /auth/session mints a fresh short-lived access token from
// it. Concurrent 401s share ONE refresh (single-flight) so we never replay the
// rotating refresh token more than WorkOS's grace window allows.
//   - resolves to a new access token on success (also stored)
//   - resolves to null when the session is TERMINALLY over (401 invalid_grant)
//   - REJECTS on a transient failure (503/5xx/network) so the caller keeps the
//     session instead of signing out (ev-accounts B5 — WorkOS session resilience)
let refreshPromise = null;

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/auth/session`, { credentials: 'include' })
    .then(async (res) => {
      if (res.status === 401) return null; // terminal — session ended
      if (!res.ok) throw new Error('refresh_unavailable'); // transient — keep session
      const data = await res.json();
      if (!data.access_token) throw new Error('refresh_unavailable');
      setToken(data.access_token);
      return data.access_token;
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
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
    // Access token expired — try a silent refresh before giving up. Only a
    // TERMINAL refresh (null) sends the user to the login hub; a transient
    // refresh failure (throw) leaves the session intact and this one call fails.
    let newToken;
    try {
      newToken = await refreshAccessToken();
    } catch {
      return null; // transient — do NOT clear the session or redirect
    }
    if (!newToken) {
      clearToken();
      redirectToLogin();
      return null;
    }
    // Retry once with the fresh token.
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newToken}`,
        ...options.headers,
      },
    });
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
