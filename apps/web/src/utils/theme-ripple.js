/**
 * Ultra-Smooth Slower Nothing OS Background Theme Ripple (900ms)
 * Originates from the theme icon center and expands gracefully in slow-motion
 * across the viewport behind all UI content without any frame drops or lag.
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

  // Create GPU-accelerated Background Ripple Layer (z-index: 0 behind content)
  const bgRipple = document.createElement('div');
  bgRipple.id = 'nothing-os-power-ripple';

  const targetBg = nextTheme === 'dark' ? '#04060d' : '#f8fafc';

  bgRipple.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 0;
    background-color: ${targetBg};
    clip-path: circle(0px at ${x}px ${y}px);
    transform: translateZ(0);
    will-change: clip-path;
    transition: clip-path 900ms cubic-bezier(0.22, 1, 0.36, 1);
  `;

  // Insert as first child of body so it sits behind UI components
  document.body.insertBefore(bgRipple, document.body.firstChild);

  // Trigger GPU clip-path expansion slowly from theme icon center -> full screen
  requestAnimationFrame(() => {
    bgRipple.style.clipPath = `circle(${endRadius + 100}px at ${x}px ${y}px)`;
  });

  // Switch underlying theme state smoothly
  setTimeout(() => {
    setTheme(nextTheme);
  }, 40);

  // Remove overlay after 900ms slow-motion completion
  setTimeout(() => {
    if (bgRipple.parentNode) {
      bgRipple.parentNode.removeChild(bgRipple);
    }
  }, 920);
}
