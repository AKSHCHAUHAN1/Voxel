import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachGlobalShortcuts, detachGlobalShortcuts } from './keyboard.js';

let documentKeydownHandler;

afterEach(() => {
  detachGlobalShortcuts();
  vi.unstubAllGlobals();
  documentKeydownHandler = undefined;
});

describe('global keyboard shortcuts', () => {
  it('ignores keydown events without a string key', () => {
    vi.stubGlobal('document', {
      addEventListener: vi.fn((_type, handler) => {
        documentKeydownHandler = handler;
      }),
      removeEventListener: vi.fn(),
    });
    attachGlobalShortcuts();

    const event = {
      key: undefined,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      target: null,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    expect(() => documentKeydownHandler(event)).not.toThrow();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});
