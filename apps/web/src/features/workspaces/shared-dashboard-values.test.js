import { describe, expect, it } from 'vitest';
import { resolveSharedDashboardValues } from './shared-dashboard-values';

describe('shared dashboard values', () => {
  it('resolves connected aggregations and logic formulas for share viewers', () => {
    const nodes = [
      { id: 'north', type: 'metric', content: '12' },
      { id: 'south', type: 'metric', content: '24' },
      { id: 'total', type: 'display', valueSource: 'connections', aggregationOperator: 'sum' },
      { id: 'double', type: 'logic', logicA: 'north', logicB: '2', logicOp: '*' },
    ];
    const values = resolveSharedDashboardValues(nodes, [
      { fromId: 'north', toId: 'total' },
      { fromId: 'south', toId: 'total' },
    ]);

    expect(values.get('total')).toBe('36');
    expect(values.get('double')).toBe(24);
  });

  it('does not expose workspace file values or derived values in public shares', () => {
    const nodes = [
      { id: 'private', type: 'metric', valueSource: 'workspace-file', content: 'sample value' },
      { id: 'summary', type: 'metric', valueSource: 'connections', aggregationOperator: 'sum' },
      { id: 'formula', type: 'logic', logicA: 'private', logicB: '3', logicOp: '+' },
    ];
    const values = resolveSharedDashboardValues(nodes, [{ fromId: 'private', toId: 'summary' }]);

    expect(values.get('private')).toBeUndefined();
    expect(values.get('summary')).toBeUndefined();
    expect(values.get('formula')).toBeUndefined();
  });

  it('does not invoke or expose external REST values through a share link', () => {
    const nodes = [
      { id: 'external', type: 'metric', valueSource: 'rest-api', dataSourceUrl: 'https://api.example.com/private', content: 'saved sample' },
      { id: 'summary', type: 'display', valueSource: 'connections', aggregationOperator: 'sum' },
    ];
    const values = resolveSharedDashboardValues(nodes, [{ fromId: 'external', toId: 'summary' }]);

    expect(values.get('external')).toBeUndefined();
    expect(values.get('summary')).toBeUndefined();
  });

  it('stops recursive connection cycles from producing a misleading value', () => {
    const nodes = [
      { id: 'first', type: 'metric', valueSource: 'connections' },
      { id: 'second', type: 'metric', valueSource: 'connections' },
    ];
    const values = resolveSharedDashboardValues(nodes, [
      { fromId: 'first', toId: 'second' },
      { fromId: 'second', toId: 'first' },
    ]);

    expect(values.get('first')).toBeUndefined();
    expect(values.get('second')).toBeUndefined();
  });
});
