/**
 * Pointer-tracked tilt + glare on the "What I Do" cards.
 * Skipped entirely on touch devices and under reduced-motion.
 */

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export function initTilt() {
  const cards = document.querySelectorAll('.whatido-card');
  if (!cards.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced || !finePointer) return;

  const reset = (card) => {
    card.classList.remove('is-active');
    card.style.setProperty('--mx', '50%');
    card.style.setProperty('--my', '50%');
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
  };

  const update = (card, clientX, clientY) => {
    const rect = card.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);

    card.style.setProperty('--mx', `${(x * 100).toFixed(2)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(2)}%`);
    card.style.setProperty('--tilt-x', `${((0.5 - y) * 7).toFixed(2)}deg`);
    card.style.setProperty('--tilt-y', `${((x - 0.5) * 9).toFixed(2)}deg`);
  };

  cards.forEach((card) => {
    card.addEventListener('pointerenter', (e) => {
      card.classList.add('is-active');
      update(card, e.clientX, e.clientY);
    });
    card.addEventListener('pointermove', (e) => update(card, e.clientX, e.clientY));
    card.addEventListener('pointerleave', () => reset(card));
  });
}
