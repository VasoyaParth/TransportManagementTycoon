// Cloud API client. Talks to the Truck Empire Node/MongoDB backend.
//
// BASE URL: on the Android emulator, the host machine's localhost is reachable
// at 10.0.2.2. On a physical device, replace this with your computer's LAN IP
// (e.g. http://192.168.1.20:4000/api) or your deployed server URL.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'http://10.0.2.2:4000/api';
const TOKEN_KEY = 'te-auth-token';

let _token = null;

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
  if (!res.ok) throw new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
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
