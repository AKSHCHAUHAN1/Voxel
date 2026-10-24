export function createCanvasClipboard(nodes, connections, selectedNodeIds) {
  const selectedIds = new Set(Array.isArray(selectedNodeIds) ? selectedNodeIds : []);
  const selectedNodes = (Array.isArray(nodes) ? nodes : [])
    .filter((node) => node && typeof node === 'object' && typeof node.id === 'string' && selectedIds.has(node.id));
  const selectedNodeIdSet = new Set(selectedNodes.map((node) => node.id));

  return {
    nodes: selectedNodes,
    connections: (Array.isArray(connections) ? connections : []).filter((connection) =>
      connection && selectedNodeIdSet.has(connection.fromId) && selectedNodeIdSet.has(connection.toId),
    ),
  };
}

export function cloneCanvasClipboard(clipboard, offset = 30) {
  const sourceNodes = Array.isArray(clipboard?.nodes)
    ? clipboard.nodes.filter((node) => node && typeof node === 'object' && !Array.isArray(node))
    : [];
  const idMap = new Map();
  const groupIdMap = new Map();
  const nodes = sourceNodes.map((node) => {
    const id = crypto.randomUUID();
    if (typeof node.id === 'string') idMap.set(node.id, id);
    if (typeof node.groupId === 'string' && !groupIdMap.has(node.groupId)) {
      groupIdMap.set(node.groupId, crypto.randomUUID());
    }
    return {
      ...node,
      id,
      ...(groupIdMap.has(node.groupId) ? { groupId: groupIdMap.get(node.groupId) } : {}),
      x: (Number.isFinite(node.x) ? node.x : 100) + offset,
      y: (Number.isFinite(node.y) ? node.y : 100) + offset,
    };
  });
  const connections = (Array.isArray(clipboard?.connections) ? clipboard.connections : [])
    .filter((connection) =>
      connection && typeof connection === 'object'
      && idMap.has(connection.fromId)
      && idMap.has(connection.toId),
    )
    .map((connection) => ({
      ...connection,
      fromId: idMap.get(connection.fromId),
      toId: idMap.get(connection.toId),
    }));

  return { nodes, connections };
}
