import { create } from 'zustand';

/**
 * Persisted notification manager for Voxel.
 * Handles read/unread states, mock-live additions, and toast triggers.
 */

const DEFAULT_NOTIFICATIONS = [
  { id: '1', text: 'System update completed successfully.', time: '2m ago', read: false, type: 'info' },
  { id: '2', text: 'New login from unknown device. Please review.', time: '1h ago', read: false, type: 'warning' },
  { id: '3', text: 'Monthly expense report is ready to download.', time: '3h ago', read: true, type: 'success' },
];

export const useNotificationStore = create((set, _get) => {
  // Load initial notifications
  let initialList = DEFAULT_NOTIFICATIONS;
  try {
    const saved = localStorage.getItem('voxel_notifications');
    if (saved) initialList = JSON.parse(saved);
  } catch (_e) {
    // ignore
  }

  const save = (list) => {
    localStorage.setItem('voxel_notifications', JSON.stringify(list));
  };

  return {
    notifications: initialList,
    toasts: [],

    add(text, type = 'info') {
      const newNotif = {
        id: Math.random().toString(),
        text,
        time: 'Just now',
        read: false,
        type,
      };
      set((state) => {
        const nextNotifs = [newNotif, ...state.notifications];
        save(nextNotifs);

        // Add to active toast list
        const nextToasts = [...state.toasts, { ...newNotif, duration: 4000 }];
        return { notifications: nextNotifs, toasts: nextToasts };
      });
    },

    removeToast(id) {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },

    dismiss(id) {
      set((state) => {
        const nextNotifs = state.notifications.filter((n) => n.id !== id);
        save(nextNotifs);
        return { notifications: nextNotifs };
      });
    },

    markAllAsRead() {
      set((state) => {
        const nextNotifs = state.notifications.map((n) => ({ ...n, read: true }));
        save(nextNotifs);
        return { notifications: nextNotifs };
      });
    },

    clearAll() {
      set(() => {
        save([]);
        return { notifications: [] };
      });
    },
  };
});
export default useNotificationStore;
