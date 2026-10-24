import { describe, expect, it } from 'vitest';
import { cloneCanvasClipboard, createCanvasClipboard } from './canvas-clipboard';

const nodes = [
  { id: 'one', type: 'metric', x: 40, y: 80 },
  { id: 'two', type: 'logic', x: 260, y: 80 },
  { id: 'three', type: 'note', x: 500, y: 80 },
];
const connections = [
  { fromId: 'one', toId: 'two', style: 'dashed' },
  { fromId: 'two', toId: 'three', style: 'solid' },
];

describe('canvas clipboard', () => {
  it('copies the selected widgets and connections between them', () => {
    expect(createCanvasClipboard(nodes, connections, ['one', 'two'])).toEqual({
      nodes: nodes.slice(0, 2),
      connections: connections.slice(0, 1),
    });
  });

  it('clones nodes with fresh IDs and remaps internal connections', () => {
    const clipboard = createCanvasClipboard(nodes, connections, ['one', 'two']);
    const clone = cloneCanvasClipboard(clipboard);

    expect(clone.nodes).toHaveLength(2);
    expect(clone.nodes.map((node) => node.id)).not.toEqual(['one', 'two']);
    expect(clone.nodes.map((node) => [node.x, node.y])).toEqual([[70, 110], [290, 110]]);
    expect(clone.connections).toEqual([
      { fromId: clone.nodes[0].id, toId: clone.nodes[1].id, style: 'dashed' },
    ]);
  });

  it('ignores malformed clipboard rows and external connections', () => {
    const clone = cloneCanvasClipboard({
      nodes: [null, { id: 'one', x: Number.NaN, y: 20 }],
      connections: [{ fromId: 'one', toId: 'missing' }],
    });

    expect(clone.nodes).toHaveLength(1);
    expect(clone.nodes[0]).toMatchObject({ x: 130, y: 50 });
    expect(clone.connections).toEqual([]);
  });
});
