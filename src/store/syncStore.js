// Tracks cloud backup status so the UI can show what's synced and when.
import { create } from 'zustand';

export const useSync = create((set, get) => ({
  status: 'idle',     // idle | syncing | saved | error
  lastSyncedAt: null,  // ms timestamp of the last successful backup
  error: null,
  _flush: null,        // registered by App to trigger an immediate save

  registerFlush(fn) { set({ _flush: fn }); },
  markSyncing() { set({ status: 'syncing' }); },
  markSaved(ts) { set({ status: 'saved', lastSyncedAt: ts, error: null }); },
  markError(msg) { set({ status: 'error', error: msg || 'Sync failed' }); },
  flush() { const f = get()._flush; if (f) f(); },
}));
