import { create } from 'zustand';

/**
 * Undo/Redo history store for the canvas editor.
 *
 * Maintains a stack of scene snapshots. Supports:
 * - push(scene)   — record a new state (clears redo stack)
 * - undo()        — revert to previous state
 * - redo()        — re-apply a reverted state
 * - clear()       — reset history
 *
 * The store holds a maximum of 50 history entries.
 */

const MAX_HISTORY = 50;

export const useHistoryStore = create((set, get) => ({
  past: [],
  future: [],

  /**
   * Push a new scene snapshot.
   * @param {object} scene - The current scene state to record
   */
  push(scene) {
    set((state) => {
      const past = [...state.past, JSON.parse(JSON.stringify(scene))];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, future: [] };
    });
  },

  /**
   * Undo — pop the last state from past, push current to future.
   * @param {object} currentScene - The current live scene
   * @returns {object|null} The scene to restore, or null if nothing to undo
   */
  undo(currentScene) {
    const { past } = get();
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [JSON.parse(JSON.stringify(currentScene)), ...state.future],
    }));
    return previous;
  },

  /**
   * Redo — pop the first state from future, push current to past.
   * @param {object} currentScene - The current live scene
   * @returns {object|null} The scene to restore, or null if nothing to redo
   */
  redo(currentScene) {
    const { future } = get();
    if (future.length === 0) return null;

    const next = future[0];
    set((state) => ({
      past: [...state.past, JSON.parse(JSON.stringify(currentScene))],
      future: state.future.slice(1),
    }));
    return next;
  },

  /** Whether undo is available */
  get canUndo() {
    return get().past.length > 0;
  },

  /** Whether redo is available */
  get canRedo() {
    return get().future.length > 0;
  },

  /** Clear all history */
  clear() {
    set({ past: [], future: [] });
  },
}));
