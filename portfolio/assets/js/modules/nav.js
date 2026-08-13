/**
 * Mobile navigation drawer.
 * Above 1024px the CSS turns the panel back into an inline bar and this
 * module effectively idles — the toggle button is display:none.
 */

const FOCUSABLE = 'a[href], button:not([disabled])';

export function initNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const panel = document.querySelector('[data-nav-panel]');
  const backdrop = document.querySelector('[data-nav-backdrop]');

  if (!toggle || !panel || !backdrop) return;

  let open = false;
  let lastFocused = null;

  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

  function setOpen(next) {
    if (next === open) return;
    open = next;

    toggle.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);

    if (open) {
      lastFocused = document.activeElement;
      panel.querySelector(FOCUSABLE)?.focus();
    } else if (lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  }

  toggle.addEventListener('click', () => setOpen(!open));
  backdrop.addEventListener('click', () => setOpen(false));

  // Any nav link closes the drawer before the smooth scroll starts
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (!open) return;

    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    // Keep tabbing inside the open drawer
    if (event.key === 'Tab') {
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // Resizing past the desktop breakpoint must not leave the body scroll-locked
  window.addEventListener('resize', () => {
    if (isDesktop() && open) setOpen(false);
  });
}
