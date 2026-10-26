import { describe, expect, it } from 'vitest';
import {
  createAwarenessRateLimiter,
  presenceColor,
  sanitizeConnectionAwareness,
  sanitizePresenceState,
} from './presence.js';

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

  it('only accepts awareness IDs owned by the connection and its own removals', () => {
    const currentConnection = {};
    const otherConnection = {};
    const connections = [currentConnection, otherConnection];
    const ownedByConnection = new Map([
      [currentConnection, new Set([101])],
      [otherConnection, new Set([202])],
    ]);
    const states = new Map([
      [101, { cursor: { x: 10, y: 20 } }],
      [202, { cursor: { x: 30, y: 40 } }],
      [303, { cursor: { x: 50, y: 60 } }],
    ]);
    const removedClients = new Set([202, 303]);
    const awareness = { clientID: 404, getStates: () => new Map() };
    const clientClaims = new Map([
      [101, 'current-socket'],
      [202, 'other-socket'],
    ]);
    const input = {
      connection: currentConnection,
      socketId: 'current-socket',
      document: {
        getClients: (connection) => ownedByConnection.get(connection),
        getConnections: () => connections,
      },
      awareness,
      user: { id: 'member', displayName: 'Member' },
      clientClaims,
    };

    sanitizeConnectionAwareness({
      states,
      removedClients,
      ...input,
    });

    expect([...states.keys()]).toEqual([101]);
    expect(states.get(101)).toMatchObject({ user: { id: 'member' }, cursor: { x: 10, y: 20 } });
    expect([...removedClients]).toEqual([]);

    const ownRemoval = new Set([101, 202]);
    sanitizeConnectionAwareness({ states: new Map(), removedClients: ownRemoval, ...input });
    expect([...ownRemoval]).toEqual([101]);
    expect(clientClaims.has(101)).toBe(false);
  });

  it('allows one new client ID per connection and rate-limits presence state updates', () => {
    const connection = {};
    const socketId = 'member-socket';
    const ownedClientIds = new Set();
    const clientClaims = new Map();
    const states = new Map([
      [501, { cursor: { x: 1, y: 2 } }],
      [502, { cursor: { x: 3, y: 4 } }],
    ]);
    const awareness = { clientID: 503, getStates: () => new Map() };
    const document = {
      getClients: () => ownedClientIds,
      getConnections: () => [connection],
    };

    sanitizeConnectionAwareness({
      states,
      removedClients: new Set(),
      connection,
      socketId,
      document,
      awareness,
      user: { id: 'member', displayName: 'Member' },
      clientClaims,
    });
    expect(states.size).toBe(1);
    ownedClientIds.add(501);

    const nextStates = new Map([
      [501, { cursor: { x: 5, y: 6 } }],
      [504, { cursor: { x: 7, y: 8 } }],
    ]);
    sanitizeConnectionAwareness({
      states: nextStates,
      removedClients: new Set(),
      connection,
      socketId,
      document,
      awareness,
      user: { id: 'member', displayName: 'Member' },
      clientClaims,
    });
    expect([...nextStates.keys()]).toEqual([501]);

    const limiter = createAwarenessRateLimiter(50);
    expect(limiter(connection, new Map([[501, {}]]), 100)).toBe(false);
    const burst = new Map([[501, { cursor: { x: 9, y: 9 } }]]);
    expect(limiter(connection, burst, 120)).toBe(true);
    expect(burst.size).toBe(0);
    expect(limiter(connection, new Map([[501, {}]]), 150)).toBe(false);
  });
});
