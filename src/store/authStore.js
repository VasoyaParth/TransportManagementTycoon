// Authentication store — cloud login/register + persistent auto-login.
// Kept separate from the game store so the auth gate can render before the
// (cloud-loaded) game state exists.
import { create } from 'zustand';
import { api, loadToken, setToken, getToken, setUnauthorizedHandler } from '../net/api';

export const useAuth = create((set, get) => ({
  status: 'checking', // checking | guest | authed
  user: null,
  error: null,
  busy: false,

  // Restore a saved session on launch (auto-login).
  async bootstrap() {
    // If any request gets a 401 (expired/invalid token), drop to the login screen.
    setUnauthorizedHandler(() => { setToken(null); set({ status: 'guest', user: null, error: 'Session expired — please log in again.' }); });
    try {
      const t = await loadToken();
      if (!t) { set({ status: 'guest' }); return; }
      const { user } = await api.me();
      set({ user, status: 'authed', error: null });
    } catch {
      await setToken(null);
      set({ status: 'guest', user: null });
    }
  },

  async register(email, password, name) {
    set({ busy: true, error: null });
    try {
      const { token, user } = await api.register(email.trim(), password, name?.trim());
      await setToken(token);
      set({ user, status: 'authed', busy: false });
      return { ok: true };
    } catch (e) {
      set({ busy: false, error: e.message });
      return { ok: false, err: e.message };
    }
  },

  async login(email, password) {
    set({ busy: true, error: null });
    try {
      const { token, user } = await api.login(email.trim(), password);
      await setToken(token);
      set({ user, status: 'authed', busy: false });
      return { ok: true };
    } catch (e) {
      set({ busy: false, error: e.message });
      return { ok: false, err: e.message };
    }
  },

  async logout() {
    await setToken(null);
    set({ user: null, status: 'guest', error: null });
  },

  isAuthed: () => get().status === 'authed' && !!getToken(),
}));
