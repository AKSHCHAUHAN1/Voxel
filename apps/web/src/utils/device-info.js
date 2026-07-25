/**
 * Helper function to detect the precise OS, architecture, and chip model.
 * Handles Apple Silicon (M1/M2/M3/M4) detection via WebGL unmasked renderer & Client Hints,
 * overriding legacy browser `navigator.platform` which defaults to 'MacIntel'.
 */
function getWebGLRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';
    return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
  } catch {
    return '';
  }
}

export function getDeviceOSString() {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '';

  // 1. WebGL Renderer Detection for Apple M-Series (Detects Apple M1/M2/M3/M4 GPU directly)
  const gpu = getWebGLRenderer();
  if (gpu && /Apple M/i.test(gpu)) {
    const match = gpu.match(/Apple M\d(?:\s\w+)?/i);
    return `macOS (${match ? match[0] : 'Apple Silicon M-Series'})`;
  }
  if (gpu && /Apple/i.test(gpu)) {
    return 'macOS (Apple Silicon M-Series)';
  }

  // 2. Check if macOS platform
  if (/Macintosh|Mac OS X|MacIntel|MacPPC|Mac68K/i.test(userAgent) || /Mac/i.test(platform)) {
    // Virtually all modern Macs sold since 2020 are Apple Silicon M-Series
    return 'macOS (Apple Silicon M-Series)';
  }

  if (/Win/i.test(platform) || /Windows/i.test(userAgent)) {
    if (/Windows NT 10.0/i.test(userAgent)) return 'Windows 11 / 10';
    return 'Windows PC';
  }

  if (/Linux/i.test(platform) || /Linux/i.test(userAgent)) {
    return 'Linux';
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'iOS Device';
  }

  if (/Android/i.test(userAgent)) {
    return 'Android Device';
  }

  return 'macOS (Apple Silicon M-Series)';
}
