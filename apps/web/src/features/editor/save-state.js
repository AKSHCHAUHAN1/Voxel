export function getSaveState({
  canEdit,
  autosaveEnabled,
  isPending,
  isError,
  error,
  draft,
  isReady = true,
}) {
  if (!canEdit) {
    return { label: 'View only', tone: 'neutral', retryable: false };
  }

  if (!isReady) {
    return { label: 'Syncing dashboard…', tone: 'pending', retryable: false };
  }

  if (isPending) {
    return { label: 'Saving changes…', tone: 'pending', retryable: false };
  }

  if (isError) {
    const conflict = error?.statusCode === 412;
    return {
      label: conflict ? 'Save conflict' : 'Save failed',
      detail: error?.message || 'Your latest changes could not be saved.',
      tone: 'error',
      retryable: true,
      conflict,
    };
  }

  if (draft) {
    return {
      label: autosaveEnabled ? 'Changes not saved yet' : 'Unsaved changes',
      tone: 'pending',
      retryable: false,
    };
  }

  return { label: 'All changes saved', tone: 'success', retryable: false };
}
