import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set) => ({
      autosaveEnabled: true,
      autosaveInterval: 'realtime', // 'realtime' | '5s' | '30s' | 'off'
      setAutosaveEnabled: (enabled) => set({ autosaveEnabled: enabled }),
      setAutosaveInterval: (interval) =>
        set({
          autosaveInterval: interval,
          autosaveEnabled: interval !== 'off',
        }),
      toggleAutosave: () => set((state) => ({ autosaveEnabled: !state.autosaveEnabled })),
    }),
    {
      name: 'voxel-settings-storage',
    }
  )
);
