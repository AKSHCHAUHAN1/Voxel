const WIDGET_VIRTUALIZATION_THRESHOLD = 80;
const WIDTH_BY_SIZE = { small: 220, medium: 280, large: 340, wide: 440 };
const HEIGHT_BY_TYPE = { image: 240, chart: 220, table: 260, code: 220, metric: 160 };

const nodeBounds = (node) => ({
  left: Number.isFinite(node.x) ? node.x : 40,
  top: Number.isFinite(node.y) ? node.y : 40,
  width: Number.isFinite(node.customWidth) ? node.customWidth : WIDTH_BY_SIZE[node.size] || 280,
  height: Number.isFinite(node.customHeight) ? node.customHeight : HEIGHT_BY_TYPE[node.type] || 180,
});

export function getVisibleCanvasNodeIds(nodes, viewport, selectedNodeIds = []) {
  if (!viewport || nodes.length <= WIDGET_VIRTUALIZATION_THRESHOLD) {
    return new Set(nodes.map((node) => node.id));
  }

  const horizontalOverscan = Math.max(600, viewport.width * 0.35);
  const verticalOverscan = Math.max(600, viewport.height * 0.35);
  const bounds = {
    left: viewport.x - horizontalOverscan,
    top: viewport.y - verticalOverscan,
    right: viewport.x + viewport.width + horizontalOverscan,
    bottom: viewport.y + viewport.height + verticalOverscan,
  };
  const visible = new Set(selectedNodeIds);

  nodes.forEach((node) => {
    const rect = nodeBounds(node);
    if (
      rect.left <= bounds.right && rect.left + rect.width >= bounds.left &&
      rect.top <= bounds.bottom && rect.top + rect.height >= bounds.top
    ) visible.add(node.id);
  });

  return visible;
}
