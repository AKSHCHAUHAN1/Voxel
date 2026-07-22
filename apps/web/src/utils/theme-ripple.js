/**
 * Synchronized Nothing OS Power Button Theme Reveal Wave (1100ms Slow Motion)
 * Originates from the exact center of the theme icon button.
 * Sweeps a 1:1 synchronized wave across the viewport where background, text,
 * cards, and icons transform together in real-time as the wave passes over them.
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

  // Modern Hardware-Accelerated View Transitions API
  if (typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(() => {
      setTheme(nextTheme);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius + 80}px at ${x}px ${y}px)`
          ],
        },
        {
          duration: 1100,
          easing: 'cubic-bezier(0.25, 1, 0.35, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
    return;
  }

  // Fallback for browsers without View Transitions
  setTheme(nextTheme);
}
