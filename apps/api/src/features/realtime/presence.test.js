import { describe, expect, it } from 'vitest';
import { presenceColor, sanitizePresenceState } from './presence.js';

describe('realtime presence', () => {
  it('replaces client identity and discards unrecognized state', () => {
    const result = sanitizePresenceState(
      {
        user: { id: 'admin-id', name: 'Administrator', color: 'url(https://attacker.test)' },
        cursor: { x: 42, y: 84 },
        selectedNodeId: 'node-1',
        typing: true,
        accessToken: 'secret',
      },
      { id: 'member-id', displayName: '  Morgan Lee  ', avatarUrl: '/api/avatar/member-id' },
    );

    expect(result).toEqual({
      user: {
        id: 'member-id',
        name: 'Morgan Lee',
        avatarUrl: '/api/avatar/member-id',
        color: presenceColor('member-id'),
      },
      cursor: { x: 42, y: 84 },
      viewport: null,
      selectedNodeId: 'node-1',
      typing: true,
    });
    expect(result).not.toHaveProperty('accessToken');
  });

  it('clamps coordinates and rejects malformed viewport data', () => {
    expect(
      sanitizePresenceState(
        {
          cursor: { x: 999999, y: -999999 },
          viewport: { x: 999999, y: -999999, width: 0, height: 50000 },
          selectedNodeId: 'x'.repeat(161),
          typing: 'true',
        },
        { id: 'member-id', displayName: '', avatarUrl: null },
      ),
    ).toMatchObject({
      cursor: { x: 200000, y: -200000 },
      viewport: { x: 200000, y: -200000, width: 1, height: 30000 },
      selectedNodeId: null,
      typing: false,
      user: { name: 'Voxel member', color: presenceColor('member-id') },
    });

    expect(
      sanitizePresenceState(
        { cursor: { x: Number.NaN, y: 0 }, viewport: { x: 0, y: 0, width: Infinity, height: 10 } },
        { id: 'member-id' },
      ),
    ).toMatchObject({ cursor: null, viewport: null });
  });
});
