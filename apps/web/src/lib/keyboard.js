import { useEffect, useRef } from 'react';

/**
 * Global keyboard shortcut registry for Voxel.
 *
 * Shortcuts are described as modifier+key combos, e.g. "meta+k", "meta+shift+z".
 * The registry resolves platform-specific modifiers automatically
 * (⌘ on macOS, Ctrl on Windows/Linux).
 */

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

/**
 * Normalise a KeyboardEvent into a canonical combo string.
 * Examples: "meta+k", "meta+shift+z", "delete", "escape"
 */
function comboFromEvent(e) {
  const parts = [];
  if (e.metaKey || e.ctrlKey) parts.push('meta');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');

  const key = e.key.toLowerCase();
  // Avoid duplicating modifier-only keys
  if (!['meta', 'control', 'shift', 'alt'].includes(key)) {
    parts.push(key);
  }
  return parts.join('+');
}

/**
 * Check if the event target is an editable element (inputs, textareas, contentEditable).
 * We skip most shortcuts when the user is typing in a form field.
 */
function isEditable(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * @typedef {Object} Shortcut
 * @property {string} combo - e.g. "meta+k"
 * @property {string} label - Human-readable label, e.g. "Open command palette"
 * @property {string} category - "Navigation" | "Editor" | "General"
 * @property {Function} handler - Callback to execute
 * @property {boolean} [allowInInput] - If true, fires even when focused on an input
 */

/** @type {Map<string, Shortcut>} */
const registry = new Map();

/**
 * Register a keyboard shortcut.
 * @param {Shortcut} shortcut
 * @returns {() => void} Unregister function
 */
export function registerShortcut(shortcut) {
  registry.set(shortcut.combo, shortcut);
  return () => registry.delete(shortcut.combo);
}

/**
 * Get all registered shortcuts (for display in command palette / help overlay).
 * @returns {Shortcut[]}
 */
export function getAllShortcuts() {
  return Array.from(registry.values());
}

/**
 * Format a combo string for display.
 * "meta+shift+z" → "⌘⇧Z" (Mac) or "Ctrl+Shift+Z" (Win)
 */
export function formatCombo(combo) {
  const symbols = isMac
    ? { meta: '⌘', shift: '⇧', alt: '⌥' }
    : { meta: 'Ctrl', shift: 'Shift', alt: 'Alt' };

  return combo
    .split('+')
    .map((part) => {
      if (symbols[part]) return symbols[part];
      if (part === 'backspace') return '⌫';
      if (part === 'delete') return 'Del';
      if (part === 'escape') return 'Esc';
      if (part === 'enter') return '↵';
      if (part === ' ') return 'Space';
      if (part === '/') return '/';
      return part.toUpperCase();
    })
    .join(isMac ? '' : '+');
}

/**
 * Global listener — call this once at app root.
 */
function handleGlobalKeyDown(e) {
  const combo = comboFromEvent(e);
  const shortcut = registry.get(combo);
  if (!shortcut) return;

  if (!shortcut.allowInInput && isEditable(e.target)) return;

  e.preventDefault();
  e.stopPropagation();
  shortcut.handler(e);
}

let listenerAttached = false;

export function attachGlobalShortcuts() {
  if (listenerAttached) return;
  document.addEventListener('keydown', handleGlobalKeyDown, true);
  listenerAttached = true;
}

export function detachGlobalShortcuts() {
  document.removeEventListener('keydown', handleGlobalKeyDown, true);
  listenerAttached = false;
}

/**
 * React hook — register a shortcut for the lifetime of a component.
 * @param {string} combo
 * @param {Function} handler
 * @param {Object} [opts]
 * @param {string} [opts.label]
 * @param {string} [opts.category]
 * @param {boolean} [opts.allowInInput]
 * @param {any[]} [deps] - dependency array for the handler
 */
export function useShortcut(combo, handler, opts = {}, deps = []) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unregister = registerShortcut({
      combo,
      label: opts.label || combo,
      category: opts.category || 'General',
      allowInInput: opts.allowInInput || false,
      handler: (e) => handlerRef.current(e),
    });
    return unregister;
  }, [combo, ...deps]);
}
