/**
 * Entry point. Each concern lives in its own module under ./modules/
 * and fails independently — one broken feature will not take the page down.
 */

import { initNav } from './modules/nav.js';
import { initReveal } from './modules/reveal.js';
import { initLazyVideo } from './modules/lazy-video.js';
import { initLightbox } from './modules/lightbox.js';
import { initScrollSpy } from './modules/scrollspy.js';

const boot = [
  ['nav', initNav],
  ['reveal', initReveal],
  ['lazy-video', initLazyVideo],
  ['lightbox', initLightbox],
  ['scrollspy', initScrollSpy]
];

function start() {
  boot.forEach(([name, init]) => {
    try {
      init();
    } catch (error) {
      console.error(`[portfolio] "${name}" failed to start:`, error);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
