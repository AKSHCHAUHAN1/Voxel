/**
 * Nothing OS Power Button Screen Reveal Effect
 * Creates an instant, 60 FPS circular power-on/off light wave originating
 * from the power/theme button that expands across the entire viewport.
 */
export function toggleThemeWithRipple(event, currentTheme, setTheme) {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Get click origin coordinates (center of power button)
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (event) {
    const target = event.currentTarget || event.target;
    if (target && typeof target.getBoundingClientRect === 'function') {
      const rect = target.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else if (typeof event.clientX === 'number') {
      x = event.clientX;
      y = event.clientY;
    }
  }

  // Maximum radius required to cover the viewport from origin (x, y)
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // Clean up any previous active ripple
  const existing = document.getElementById('nothing-os-power-ripple');
  if (existing) existing.remove();

  // Create Nothing OS Screen Power Ripple Layer
  const overlay = document.createElement('div');
  overlay.id = 'nothing-os-power-ripple';

  const bgColor = nextTheme === 'dark' ? '#04060d' : '#f8fafc';
  const ringGlow = nextTheme === 'dark'
    ? 'rgba(168, 85, 247, 0.7)'
    : 'rgba(99, 102, 241, 0.6)';

  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 999999;
    background: ${bgColor};
    clip-path: circle(0px at ${x}px ${y}px);
    will-change: clip-path;
    box-shadow: inset 0 0 80px ${ringGlow};
    transition: clip-path 380ms cubic-bezier(0.1, 0.9, 0.2, 1);
  `;

  document.body.appendChild(overlay);

  // Switch underlying theme state immediately (0ms lag)
  requestAnimationFrame(() => {
    setTheme(nextTheme);

    // Expand power circle from 0px -> endRadius across screen
    requestAnimationFrame(() => {
      overlay.style.clipPath = `circle(${endRadius + 60}px at ${x}px ${y}px)`;
    });
  });

  // Remove overlay seamlessly as circle completes expanding
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 400);
}
