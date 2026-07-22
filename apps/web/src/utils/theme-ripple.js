/**
 * Nothing OS Background Theme Ripple Effect
 * Originates from the exact center of the theme icon button and expands
 * behind all page content (z-index: 0, pointer-events: none) so the background
 * color ripples gracefully without covering any UI elements, text, or cards.
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

  // Clean up any previous active background ripple
  const existing = document.getElementById('nothing-os-power-ripple');
  if (existing) existing.remove();

  // Create Background Ripple Layer (z-index: 0 - BEHIND UI CONTENT)
  const bgRipple = document.createElement('div');
  bgRipple.id = 'nothing-os-power-ripple';

  const targetBg = nextTheme === 'dark' ? '#04060d' : '#f8fafc';
  const ringGlow = nextTheme === 'dark'
    ? 'rgba(168, 85, 247, 0.5)'
    : 'rgba(99, 102, 241, 0.4)';

  bgRipple.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 0;
    background: ${targetBg};
    clip-path: circle(0px at ${x}px ${y}px);
    will-change: clip-path;
    box-shadow: inset 0 0 100px ${ringGlow};
    transition: clip-path 850ms cubic-bezier(0.25, 1, 0.4, 1);
  `;

  // Insert as first child of body so it sits behind UI elements
  document.body.insertBefore(bgRipple, document.body.firstChild);

  // Switch underlying theme state immediately so text/cards/borders update smoothly
  requestAnimationFrame(() => {
    setTheme(nextTheme);

    // Expand background ripple from theme icon center -> full screen
    requestAnimationFrame(() => {
      bgRipple.style.clipPath = `circle(${endRadius + 80}px at ${x}px ${y}px)`;
    });
  });

  // Remove overlay seamlessly after 850ms slow-motion completion
  setTimeout(() => {
    if (bgRipple.parentNode) {
      bgRipple.parentNode.removeChild(bgRipple);
    }
  }, 870);
}
