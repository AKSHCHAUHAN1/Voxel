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
          ? user.displayName.trim()
          : 'Voxel member',
      avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : null,
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
