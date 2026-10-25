import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';

export const useThemeStore = create()(
  persist((set) => ({ theme: 'dark', setTheme: (theme) => set({ theme }) }), {
    name: 'voxel-theme',
  }),
);

const readSystemTheme = () => (
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
);

export function useEffectiveTheme() {
  const theme = useThemeStore((state) => state.theme);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    updateSystemTheme(media);
    if (typeof media.addEventListener === 'function') media.addEventListener('change', updateSystemTheme);
    else media.addListener?.(updateSystemTheme);
    return () => {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', updateSystemTheme);
      else media.removeListener?.(updateSystemTheme);
    };
  }, []);

  return theme === 'system' ? systemTheme : theme;
}
