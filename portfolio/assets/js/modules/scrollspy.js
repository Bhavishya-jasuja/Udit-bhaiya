/** Marks the nav link for whichever section is currently on screen. */

export function initScrollSpy() {
  const links = [...document.querySelectorAll('[data-nav-panel] a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;

  const map = new Map();
  links.forEach((link) => {
    const section = document.querySelector(link.getAttribute('href'));
    if (section) map.set(section, link);
  });

  if (!map.size) return;

  const setCurrent = (link) => {
    links.forEach((l) => l.removeAttribute('aria-current'));
    link?.setAttribute('aria-current', 'true');
  };

  const observer = new IntersectionObserver(
    (entries) => {
      // Pick the entry nearest the top of the viewport that is on screen
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length) setCurrent(map.get(visible[0].target));
    },
    { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
  );

  map.forEach((_link, section) => observer.observe(section));
}
