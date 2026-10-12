import { describe, expect, it } from 'vitest';
import {
  canvasPointToScreen,
  getCanvasViewport,
  pointerToCanvasPoint,
  scrollOffsetForCanvasPoint,
} from './canvas-geometry.js';

describe('canvas coordinate transforms', () => {
  it('maps a pointer to canvas space and back at the same zoom and scroll', () => {
    const bounds = { left: 300, top: 100 };
    const point = pointerToCanvasPoint(420, 230, bounds, 1700, 920, 0.5);

    expect(canvasPointToScreen(point, bounds, 1700, 920, 0.5)).toEqual({ x: 420, y: 230 });
  });

  it('describes the visible canvas area in scene coordinates', () => {
    expect(getCanvasViewport(1248, 1298, 800, 600, 2)).toEqual({
      x: -24,
      y: 1,
      width: 400,
      height: 300,
    });
  });

  it('centers the requested scene point in the scroll viewport', () => {
    expect(scrollOffsetForCanvasPoint({ x: 100, y: 50 }, 800, 600, 2)).toEqual({
      left: 1096,
      top: 1096,
    });
  });
});
