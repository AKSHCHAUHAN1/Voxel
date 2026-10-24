import { describe, expect, it } from 'vitest';
import {
  getTimerDisplaySeconds,
  pauseTimerNode,
  resetTimerNode,
  startTimerNode,
} from './timer-state.js';

describe('persisted canvas timer state', () => {
  it('continues a countdown from its timestamp after the widget remounts', () => {
    const running = startTimerNode({ duration: 300, timerMode: 'countdown', timerState: 'idle' }, 10_000);
    const node = { duration: 300, timerMode: 'countdown', ...running };

    expect(getTimerDisplaySeconds(node, 25_500)).toBe(285);
    expect(getTimerDisplaySeconds(node, 310_000)).toBe(0);
  });

  it('stores the remaining countdown on pause and resumes from that value', () => {
    const running = startTimerNode({ duration: 300, timerMode: 'countdown', timerState: 'idle' }, 10_000);
    const paused = pauseTimerNode({ duration: 300, timerMode: 'countdown', ...running }, 61_000);
    const resumed = startTimerNode({ duration: 300, timerMode: 'countdown', ...paused }, 70_000);

    expect(paused.timerRemainingSeconds).toBe(249);
    expect(resumed.timerEndsAt).toBe(319_000);
    expect(getTimerDisplaySeconds({ duration: 300, timerMode: 'countdown', ...resumed }, 71_000)).toBe(248);
  });

  it('persists elapsed stopwatch time across pause and resume', () => {
    const running = startTimerNode({ timerMode: 'stopwatch', timerState: 'idle' }, 10_000);
    const paused = pauseTimerNode({ timerMode: 'stopwatch', ...running }, 46_000);
    const resumed = startTimerNode({ timerMode: 'stopwatch', ...paused }, 50_000);

    expect(paused.timerElapsedSeconds).toBe(36);
    expect(getTimerDisplaySeconds({ timerMode: 'stopwatch', ...resumed }, 55_000)).toBe(41);
  });

  it('resets to the configured duration', () => {
    expect(resetTimerNode({ duration: 90 })).toMatchObject({
      timerState: 'idle',
      timerDurationSnapshot: 90,
      timerRemainingSeconds: 90,
      timerElapsedSeconds: 0,
      timerStartedAt: null,
      timerEndsAt: null,
    });
  });
});
