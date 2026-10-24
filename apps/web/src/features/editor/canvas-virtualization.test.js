import { describe, expect, it } from 'vitest';
import { getVisibleCanvasNodeIds } from './canvas-virtualization.js';

describe('canvas widget virtualization', () => {
  it('keeps small dashboards fully mounted', () => {
    const nodes = [{ id: 'near', x: 0, y: 0 }, { id: 'far', x: 20_000, y: 20_000 }];

    expect(getVisibleCanvasNodeIds(nodes, { x: 0, y: 0, width: 400, height: 300 })).toEqual(
      new Set(['near', 'far']),
    );
  });

  it('renders widgets intersecting the overscanned viewport and retains selected offscreen widgets', () => {
    const nodes = Array.from({ length: 500 }, (_, index) => ({
      id: `node-${index}`,
      x: index * 1_600,
      y: 0,
    }));

    const visible = getVisibleCanvasNodeIds(
      nodes,
      { x: 0, y: 0, width: 800, height: 600 },
      ['node-499'],
    );

    expect(visible).toContain('node-0');
    expect(visible).toContain('node-499');
    expect(visible.size).toBe(2);
  });

  it('uses custom widget dimensions when calculating viewport intersections', () => {
    const nodes = Array.from({ length: 81 }, (_, index) => ({ id: `node-${index}`, x: 50_000, y: 50_000 }));
    nodes[0] = { id: 'wide-widget', x: 900, y: 20, customWidth: 1_000, customHeight: 320 };
    nodes[1] = { id: 'outside', x: 1_601, y: 20, customWidth: 280, customHeight: 180 };

    const visible = getVisibleCanvasNodeIds(nodes, { x: 0, y: 0, width: 400, height: 400 });

    expect(visible.has('wide-widget')).toBe(true);
    expect(visible.has('outside')).toBe(false);
  });
});
