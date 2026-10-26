import { describe, expect, it } from 'vitest';
import { scenesEqual } from './scene-comparison.js';

describe('scenesEqual', () => {
  it('ignores object key order while preserving array order', () => {
    expect(
      scenesEqual(
        { nodes: [{ id: 'one', x: 40 }], gridStyle: 'dots' },
        { gridStyle: 'dots', nodes: [{ x: 40, id: 'one' }] },
      ),
    ).toBe(true);
    expect(
      scenesEqual(
        { nodes: [{ id: 'one' }, { id: 'two' }] },
        { nodes: [{ id: 'two' }, { id: 'one' }] },
      ),
    ).toBe(false);
  });

  it('treats actual value changes as a dirty scene', () => {
    expect(scenesEqual({ nodes: [{ id: 'one', x: 40 }] }, { nodes: [{ id: 'one', x: 64 }] })).toBe(
      false,
    );
  });
});
