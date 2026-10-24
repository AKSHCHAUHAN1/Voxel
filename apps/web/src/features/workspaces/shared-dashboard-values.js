const numericValue = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function resolveSharedDashboardValues(nodes = [], connections = [], rendererForNode = (node) => node.type) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const resolved = new Map();

  const resolve = (nodeId, visited = new Set()) => {
    if (resolved.has(nodeId)) return resolved.get(nodeId);
    if (visited.has(nodeId)) return undefined;

    const node = nodesById.get(nodeId);
    if (!node) return undefined;
    const nextVisited = new Set(visited);
    nextVisited.add(nodeId);
    const renderer = rendererForNode(node) || node.type;

    if (renderer === 'logic') {
      const operand = (value) => {
        if (!value) return 0;
        const sourceNode = nodesById.get(value);
        const sourceValue = sourceNode ? resolve(sourceNode.id, nextVisited) : value;
        if (sourceValue == null) return undefined;
        return numericValue(sourceValue) ?? 0;
      };
      const left = operand(node.logicA);
      const right = operand(node.logicB);
      if (left === undefined || right === undefined) return undefined;
      switch (node.logicOp) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        default: return 0;
      }
    }

    if (node.valueSource === 'workspace-file') return undefined;
    if (node.valueSource !== 'connections') return node.content ?? '';

    const sourceIds = connections.filter((connection) => connection.toId === nodeId).map((connection) => connection.fromId);
    if (sourceIds.length === 0) return '0';
    const values = sourceIds.map((sourceId) => numericValue(resolve(sourceId, nextVisited)));
    if (values.some((value) => value === undefined)) return undefined;

    const operator = node.aggregationOperator || 'sum';
    let result;
    switch (operator) {
      case 'avg': result = values.reduce((sum, value) => sum + value, 0) / values.length; break;
      case 'prod': result = values.reduce((product, value) => product * value, 1); break;
      case 'min': result = Math.min(...values); break;
      case 'max': result = Math.max(...values); break;
      default: result = values.reduce((sum, value) => sum + value, 0);
    }
    return Number.isInteger(result) ? String(result) : result.toFixed(2);
  };

  nodes.forEach((node) => resolved.set(node.id, resolve(node.id)));
  return resolved;
}
