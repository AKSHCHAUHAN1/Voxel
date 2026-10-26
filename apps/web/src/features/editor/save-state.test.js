import { describe, expect, it } from 'vitest';
import { getSaveState } from './save-state.js';

describe('getSaveState', () => {
  it('reports view-only access without implying a save operation', () => {
    expect(getSaveState({ canEdit: false, draft: false })).toMatchObject({
      label: 'View only',
      tone: 'neutral',
      retryable: false,
    });
  });

  it('shows an active save before the dirty draft state', () => {
    expect(getSaveState({ canEdit: true, isPending: true, draft: true })).toMatchObject({
      label: 'Saving changes…',
      tone: 'pending',
    });
  });

  it('does not report a dashboard as saved before its realtime scene is ready', () => {
    expect(getSaveState({ canEdit: true, isReady: false, draft: false })).toMatchObject({
      label: 'Syncing dashboard…',
      tone: 'pending',
      retryable: false,
    });
  });

  it('distinguishes manual and automatic unsaved changes', () => {
    expect(getSaveState({ canEdit: true, autosaveEnabled: false, draft: true }).label).toBe(
      'Unsaved changes',
    );
    expect(getSaveState({ canEdit: true, autosaveEnabled: true, draft: true }).label).toBe(
      'Changes not saved yet',
    );
  });

  it('offers an explicit retry for failed and conflicting saves', () => {
    expect(
      getSaveState({
        canEdit: true,
        isError: true,
        error: { statusCode: 503, message: 'Database unavailable.' },
        draft: true,
      }),
    ).toMatchObject({ label: 'Save failed', detail: 'Database unavailable.', retryable: true });

    expect(
      getSaveState({
        canEdit: true,
        isError: true,
        error: { statusCode: 412 },
        draft: true,
      }),
    ).toMatchObject({ label: 'Save conflict', tone: 'error', retryable: true, conflict: true });
  });

  it('reports a clean editor as saved', () => {
    expect(getSaveState({ canEdit: true, draft: false })).toMatchObject({
      label: 'All changes saved',
      tone: 'success',
    });
  });
});
