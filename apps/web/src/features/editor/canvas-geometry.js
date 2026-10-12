export const CANVAS_PADDING = 1200;
export const CANVAS_INNER_PADDING = 48;

const scaleOf = (zoom) => (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);

export function pointerToCanvasPoint(clientX, clientY, bounds, scrollLeft, scrollTop, zoom) {
  const scale = scaleOf(zoom);
  return {
    x: (clientX - bounds.left + scrollLeft - CANVAS_PADDING) / scale - CANVAS_INNER_PADDING,
    y: (clientY - bounds.top + scrollTop - CANVAS_PADDING) / scale - CANVAS_INNER_PADDING,
  };
}

export function getCanvasViewport(scrollLeft, scrollTop, width, height, zoom) {
  const scale = scaleOf(zoom);
  return {
    x: (scrollLeft - CANVAS_PADDING) / scale - CANVAS_INNER_PADDING,
    y: (scrollTop - CANVAS_PADDING) / scale - CANVAS_INNER_PADDING,
    width: width / scale,
    height: height / scale,
  };
}

export function canvasPointToScreen(point, bounds, scrollLeft, scrollTop, zoom) {
  const scale = scaleOf(zoom);
  return {
    x: bounds.left + CANVAS_PADDING + (point.x + CANVAS_INNER_PADDING) * scale - scrollLeft,
    y: bounds.top + CANVAS_PADDING + (point.y + CANVAS_INNER_PADDING) * scale - scrollTop,
  };
}

export function scrollOffsetForCanvasPoint(point, width, height, zoom) {
  const scale = scaleOf(zoom);
  return {
    left: CANVAS_PADDING + (point.x + CANVAS_INNER_PADDING) * scale - width / 2,
    top: CANVAS_PADDING + (point.y + CANVAS_INNER_PADDING) * scale - height / 2,
  };
}
