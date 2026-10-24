export const timerDurationSeconds = (node) => Math.max(1, Math.floor(Number(node.duration) || 300));

export function getTimerDisplaySeconds(node, now = Date.now()) {
  const isCountdown = node.timerMode !== 'stopwatch';
  if (!isCountdown) {
    const elapsed = Math.max(0, Number(node.timerElapsedSeconds) || 0);
    const startedAt = Number.isFinite(node.timerStartedAt) ? node.timerStartedAt : null;
    return elapsed + (node.timerState === 'running' && startedAt
      ? Math.max(0, Math.floor((now - startedAt) / 1_000))
      : 0);
  }

  const duration = timerDurationSeconds(node);
  const hasCurrentCountdown = node.timerDurationSnapshot === duration;
  const remaining = hasCurrentCountdown && Number.isFinite(node.timerRemainingSeconds)
    ? Math.max(0, node.timerRemainingSeconds)
    : duration;
  const endAt = Number.isFinite(node.timerEndsAt) ? node.timerEndsAt : null;
  if (node.timerState === 'running' && endAt) return Math.max(0, Math.ceil((endAt - now) / 1_000));
  return remaining;
}

export function startTimerNode(node, now = Date.now()) {
  if (node.timerMode === 'stopwatch') {
    return {
      timerState: 'running',
      timerElapsedSeconds: getTimerDisplaySeconds(node, now),
      timerStartedAt: now,
      timerEndsAt: null,
    };
  }

  const duration = timerDurationSeconds(node);
  const current = getTimerDisplaySeconds(node, now);
  const remaining = current > 0 ? current : duration;
  return {
    timerState: 'running',
    timerDurationSnapshot: duration,
    timerRemainingSeconds: remaining,
    timerStartedAt: now,
    timerEndsAt: now + remaining * 1_000,
  };
}

export function pauseTimerNode(node, now = Date.now()) {
  if (node.timerMode === 'stopwatch') {
    return {
      timerState: 'paused',
      timerElapsedSeconds: getTimerDisplaySeconds(node, now),
      timerStartedAt: null,
    };
  }
  return {
    timerState: 'paused',
    timerRemainingSeconds: getTimerDisplaySeconds(node, now),
    timerDurationSnapshot: timerDurationSeconds(node),
    timerStartedAt: null,
    timerEndsAt: null,
  };
}

export function resetTimerNode(node) {
  const duration = timerDurationSeconds(node);
  return {
    timerState: 'idle',
    timerDurationSnapshot: duration,
    timerRemainingSeconds: duration,
    timerElapsedSeconds: 0,
    timerStartedAt: null,
    timerEndsAt: null,
  };
}
