/**
 * Ultra-Optimized 60 FPS Nothing OS Background Theme Ripple
 * Uses hardware-accelerated GPU layers without heavy shadow filters,
 * eliminating all frame drops & layout lag for instant text/content loading.
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

  // Clean up any previous active ripple
  const existing = document.getElementById('nothing-os-power-ripple');
  if (existing) existing.remove();

  // Create GPU-accelerated Background Layer (z-index: 0 behind content)
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
    transition: clip-path 450ms cubic-bezier(0.16, 1, 0.3, 1);
  `;

  document.body.insertBefore(bgRipple, document.body.firstChild);

  // Trigger GPU clip-path expansion instantly
  requestAnimationFrame(() => {
    bgRipple.style.clipPath = `circle(${endRadius + 60}px at ${x}px ${y}px)`;
  });

  // Switch theme state after GPU layer starts expanding so React re-renders don't block frame 1
  setTimeout(() => {
    setTheme(nextTheme);
  }, 30);

  // Clean up overlay when animation completes
  setTimeout(() => {
    if (bgRipple.parentNode) {
      bgRipple.parentNode.removeChild(bgRipple);
    }
  }, 470);
}
