import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set) => ({
      autosaveEnabled: true,
      autosaveInterval: 'realtime', // 'realtime' | '5s' | '30s' | 'off'
      accentColor: 'violet',
      defaultGridStyle: 'dots',
      snapToGrid: true,
      reducedMotion: false,
      avatarColor: 'bg-violet-600',
      setAvatarColor: (color) => set({ avatarColor: color }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setDefaultGridStyle: (defaultGridStyle) => set({ defaultGridStyle }),
      setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
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
