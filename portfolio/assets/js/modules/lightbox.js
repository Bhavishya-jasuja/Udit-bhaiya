/**
 * Video lightbox.
 *
 * Gallery tiles are thumbnails, not players — each carries a full-size
 * `.tile__open` button that hands its dataset to this modal. The panel
 * reshapes to 9:16 for portrait clips instead of letterboxing them.
 */

const FOCUSABLE = 'button, [href], video';

export function initLightbox() {
  const modal = document.getElementById('video-popup');
  const player = document.getElementById('video-popup-player');
  const title = document.getElementById('video-popup-title');
  const triggers = document.querySelectorAll('[data-video-open]');

  if (!modal || !player || !title || !triggers.length) return;

  let open = false;
  let lastFocused = null;
  let hideTimer = null;
  const CLOSE_MS = 260;

  function clearPlayer() {
    player.pause();
    player.removeAttribute('src');
    while (player.firstChild) player.removeChild(player.firstChild);
    player.load();
  }

  function close() {
    if (!open) return;
    open = false;

    modal.classList.remove('is-open', 'is-portrait');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');

    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      modal.hidden = true;
      clearPlayer();
    }, CLOSE_MS);

    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  function openFrom(button) {
    const src = button.dataset.videoSrc;
    if (!src) return;

    window.clearTimeout(hideTimer);
    clearPlayer();

    const source = document.createElement('source');
    source.src = src;
    source.type = button.dataset.videoType || 'video/mp4';
    player.appendChild(source);

    modal.classList.toggle('is-portrait', button.dataset.videoOrient === 'portrait');
    title.textContent = button.dataset.videoTitle || 'Video';

    lastFocused = button;
    document.body.classList.add('is-locked');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => modal.classList.add('is-open'));

    open = true;
    player.load();
    player.play().catch(() => {
      /* autoplay may be blocked — the controls are still there */
    });

    modal.querySelector('.video-popup__close')?.focus();
  }

  triggers.forEach((btn) => btn.addEventListener('click', () => openFrom(btn)));

  modal.querySelectorAll('[data-close-video-popup]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      close();
    })
  );

  document.addEventListener('keydown', (event) => {
    if (!open) return;

    if (event.key === 'Escape') {
      close();
      return;
    }

    if (event.key === 'Tab') {
      const items = [...modal.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
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
}
