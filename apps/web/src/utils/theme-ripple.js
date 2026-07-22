/**
 * Nothing OS Power Ripple Theme Transition
 * Creates a circular clip-path ripple expanding from the power/theme button,
 * covering the entire screen in a single fluid motion.
 */
export function toggleThemeWithRipple(event, currentTheme, setTheme) {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Get click origin coordinates (or center of screen if event is null/keyboard)
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (event) {
    // If event comes from button element, target center of button
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

  // 1. View Transitions API (Modern Chromium, Safari 18+, Edge)
  if (typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(() => {
      setTheme(nextTheme);
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];

      document.documentElement.animate(
        {
          clipPath: nextTheme === 'dark' ? clipPath : [...clipPath].reverse(),
        },
        {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          pseudoElement: nextTheme === 'dark' ? '::view-transition-new(root)' : '::view-transition-old(root)',
        }
      );
    });
    return;
  }

  // 2. Fallback Ripple Overlay for legacy browsers
  createFallbackRippleOverlay(x, y, endRadius, nextTheme, () => {
    setTheme(nextTheme);
  });
}

function createFallbackRippleOverlay(x, y, endRadius, nextTheme, applyThemeCallback) {
  const overlay = document.createElement('div');
  overlay.className = 'nothing-os-ripple-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 99999;
    background: ${nextTheme === 'dark' ? '#04060d' : '#f8fafc'};
    clip-path: circle(0px at ${x}px ${y}px);
    transition: clip-path 600ms cubic-bezier(0.2, 0.8, 0.2, 1);
  `;

  document.body.appendChild(overlay);

  // Force reflow
  overlay.getBoundingClientRect();

  // Trigger clip-path expand
  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`;
  });

  // Apply theme halfway through transition for instant seamlessness
  setTimeout(() => {
    applyThemeCallback();
  }, 250);

  // Remove overlay when transition ends
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 650);
}
