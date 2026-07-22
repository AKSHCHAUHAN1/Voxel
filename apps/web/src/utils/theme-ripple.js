/**
 * Nothing OS Power Button Screen Reveal Effect
 * Originates from the exact center of the theme icon button and gracefully
 * expands across the screen in slow-motion with a glowing aura ring.
 */
export function toggleThemeWithRipple(event, currentTheme, setTheme) {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Get click origin coordinates (exact center of theme icon button)
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

  // Clean up any previous active ripple overlay
  const existing = document.getElementById('nothing-os-power-ripple');
  if (existing) existing.remove();

  // Create Nothing OS Screen Power Ripple Layer
  const overlay = document.createElement('div');
  overlay.id = 'nothing-os-power-ripple';

  const bgColor = nextTheme === 'dark' ? '#04060d' : '#f8fafc';
  const ringGlow = nextTheme === 'dark'
    ? 'rgba(168, 85, 247, 0.85)'
    : 'rgba(99, 102, 241, 0.75)';

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
    box-shadow: inset 0 0 100px ${ringGlow}, 0 0 50px ${ringGlow};
    transition: clip-path 850ms cubic-bezier(0.25, 1, 0.4, 1);
  `;

  document.body.appendChild(overlay);

  // Switch underlying theme state immediately (0ms lag)
  requestAnimationFrame(() => {
    setTheme(nextTheme);

    // Gracefully expand power circle slowly from theme icon center -> full screen
    requestAnimationFrame(() => {
      overlay.style.clipPath = `circle(${endRadius + 80}px at ${x}px ${y}px)`;
    });
  });

  // Remove overlay seamlessly after 850ms slow-motion completion
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 870);
}
