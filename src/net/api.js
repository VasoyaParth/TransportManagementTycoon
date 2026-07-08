// Cloud API client. Talks to the Truck Empire Node/MongoDB backend.
//
// BASE URL — the deployed cloud backend. This is the ONE place to change the
// server URL; everything in the app goes through it. For local dev against a
// server on your machine, use http://10.0.2.2:4000/api (Android emulator).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'https://truck-manager-backend.vercel.app/api';
const TOKEN_KEY = 'te-auth-token';

let _token = null;
let _onUnauthorized = null;

// Register a callback fired when the server rejects our token (401) — the auth
// store uses this to log the user out so they can sign back in.
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

export async function loadToken() {
  if (_token) return _token;
  _token = await AsyncStorage.getItem(TOKEN_KEY);
  return _token;
}
export async function setToken(t) {
  _token = t || null;
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}
export function getToken() { return _token; }

// Core request helper — attaches the bearer token, parses JSON, throws on error.
async function req(path, { method = 'GET', body, auth = true, timeout = 12000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && _token) headers.Authorization = `Bearer ${_token}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method, headers, signal: ctrl.signal,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    clearTimeout(t);
    throw new Error(e.name === 'AbortError' ? 'Server not reachable (timed out).' : 'Cannot reach server. Check your connection.');
  }
  clearTimeout(t);
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  if (!res.ok) {
    if (res.status === 401 && auth && _token && _onUnauthorized) { try { _onUnauthorized(); } catch {} }
    throw new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
  }
  return data;
}

// ---------- Auth ----------
export const api = {
  health: () => req('/health', { auth: false }),
  register: (email, password, name) => req('/auth/register', { method: 'POST', auth: false, body: { email, password, name } }),
  login: (email, password) => req('/auth/login', { method: 'POST', auth: false, body: { email, password } }),
  me: () => req('/auth/me'),

  // ---------- Cloud game state (multi-device sync) ----------
  getState: () => req('/state'),
  putState: (state, version) => req('/state', { method: 'PUT', body: { state, version } }),

  // ---------- Paginated config/assets (infinite scroll) ----------
  config: (collection, cursor = '', limit = 20) =>
    req(`/config/${collection}?cursor=${encodeURIComponent(cursor)}&limit=${limit}`, { auth: false }),
};
