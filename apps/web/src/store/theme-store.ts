import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}
export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ theme: 'dark', setTheme: (theme) => set({ theme }) }), {
    name: 'voxel-theme',
  }),
);
