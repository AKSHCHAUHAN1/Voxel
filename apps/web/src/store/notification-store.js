import { create } from 'zustand';

/** Transient in-page feedback. Persistent inbox notifications are server-owned. */
try {
  globalThis.localStorage?.removeItem('voxel_notifications');
} catch (_error) {
  // Storage may be unavailable in a restricted browser context.
}

export const useNotificationStore = create((set) => ({
  toasts: [],

  add(text, type = 'info') {
    const toast = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      text,
      type,
    };
    set((state) => ({ toasts: [...state.toasts, { ...toast, duration: 4000 }] }));
  },

  removeToast(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },

  clearAll() {
    set({ toasts: [] });
  },
}));

export default useNotificationStore;
