const presenceColors = ['#6d28d9', '#1d4ed8', '#0f766e', '#b45309', '#be123c', '#475569'];

export function presenceColor(userId) {
  const hash = Array.from(userId || '').reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
  return presenceColors[hash % presenceColors.length];
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function sanitizePresenceState(state, user) {
  const cursor = state.cursor;
  const viewport = state.viewport;
  const validCursor = cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y);
  const validViewport =
    viewport &&
    Number.isFinite(viewport.x) &&
    Number.isFinite(viewport.y) &&
    Number.isFinite(viewport.width) &&
    Number.isFinite(viewport.height);

  return {
    user: {
      id: user.id,
      name:
        typeof user.displayName === 'string' && user.displayName.trim()
          ? user.displayName.trim().slice(0, 100)
          : 'Voxel member',
      avatarUrl:
        typeof user.avatarUrl === 'string' && user.avatarUrl.length <= 2048
          ? user.avatarUrl
          : null,
      color: presenceColor(user.id),
    },
    cursor: validCursor
      ? { x: clamp(cursor.x, -200000, 200000), y: clamp(cursor.y, -200000, 200000) }
      : null,
    viewport: validViewport
      ? {
          x: clamp(viewport.x, -200000, 200000),
          y: clamp(viewport.y, -200000, 200000),
          width: clamp(viewport.width, 1, 30000),
          height: clamp(viewport.height, 1, 30000),
        }
      : null,
    selectedNodeId:
      typeof state.selectedNodeId === 'string' && state.selectedNodeId.length <= 160
        ? state.selectedNodeId
        : null,
    typing: state.typing === true,
  };
}

export function sanitizeConnectionAwareness({
  states,
  removedClients,
  connection,
  socketId,
  document,
  awareness,
  user,
  clientClaims = new Map(),
}) {
  const ownedClientIds = document.getClients(connection);
  const owners = new Map();
  for (const candidate of document.getConnections()) {
    if (candidate === connection) continue;
    for (const clientId of document.getClients(candidate)) owners.set(clientId, candidate);
  }

  let acceptedNewClient = false;
  const connectionAlreadyClaimed = Array.from(clientClaims.values()).includes(socketId);
  const canClaimClientId = ownedClientIds.size === 0 && !connectionAlreadyClaimed;
  for (const [clientId, state] of states) {
    const owner = owners.get(clientId);
    const claimOwner = clientClaims.get(clientId);
    if (
      (owner && owner !== connection) ||
      (claimOwner && claimOwner !== socketId) ||
      clientId === awareness.clientID ||
      (awareness.getStates().has(clientId) && !ownedClientIds.has(clientId)) ||
      (!ownedClientIds.has(clientId) && (!canClaimClientId || acceptedNewClient))
    ) {
      states.delete(clientId);
      continue;
    }
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      states.delete(clientId);
      continue;
    }
    if (!ownedClientIds.has(clientId)) {
      acceptedNewClient = true;
      clientClaims.set(clientId, socketId);
    }
    states.set(clientId, sanitizePresenceState(state, user));
  }

  for (const clientId of removedClients) {
    if (!ownedClientIds.has(clientId)) {
      removedClients.delete(clientId);
    } else {
      clientClaims.delete(clientId);
    }
  }
}

export function createAwarenessRateLimiter(minIntervalMs = 50) {
  const lastAcceptedAt = new WeakMap();
  return (connection, states, now = Date.now()) => {
    if (!connection || states.size === 0) return false;
    const previous = lastAcceptedAt.get(connection);
    if (previous !== undefined && now - previous < minIntervalMs) {
      states.clear();
      return true;
    }
    lastAcceptedAt.set(connection, now);
    return false;
  };
}
