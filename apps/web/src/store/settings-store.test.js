import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from './settings-store';

describe('SettingsStore Autosave Configuration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    useSettingsStore.setState({
      autosaveEnabled: true,
      autosaveInterval: 'realtime',
    });
  });

  it('toggles autosave state correctly', () => {
    expect(useSettingsStore.getState().autosaveEnabled).toBe(true);

    useSettingsStore.getState().setAutosaveEnabled(false);
    expect(useSettingsStore.getState().autosaveEnabled).toBe(false);

    useSettingsStore.getState().toggleAutosave();
    expect(useSettingsStore.getState().autosaveEnabled).toBe(true);
  });

  it('updates autosave interval and disables autosave when set to off', () => {
    useSettingsStore.getState().setAutosaveInterval('5s');
    expect(useSettingsStore.getState().autosaveInterval).toBe('5s');
    expect(useSettingsStore.getState().autosaveEnabled).toBe(true);

    useSettingsStore.getState().setAutosaveInterval('off');
    expect(useSettingsStore.getState().autosaveInterval).toBe('off');
    expect(useSettingsStore.getState().autosaveEnabled).toBe(false);
  });
});
