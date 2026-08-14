/**
 * Thumbnail lazy-loading.
 *
 * The gallery holds 52 clips totalling ~195MB. Every tile ships with
 * preload="none" so a phone downloads nothing on first paint; this module
 * upgrades a tile to preload="metadata" only once it is near the viewport,
 * which pulls just enough bytes to paint the `#t=0.1` first frame.
 */

export function initLazyVideo() {
  const videos = document.querySelectorAll('video[data-lazy]');
  if (!videos.length) return;

  /**
   * A "#t=" fragment is what paints the thumbnail, but it also sets where
   * playback begins. For a clip whose poster frame is deep into the film that
   * would skip everything before it, so the first play jumps back to the start.
   *
   * Detecting a manual scrub via the "seeking" event does not work: the
   * browser's own seek to satisfy the "#t=" fragment on load also fires
   * "seeking", so that listener disarms itself before the viewer touches
   * anything. Comparing against the known thumbnail time is reliable instead.
   */
  const resetOnFirstPlay = (video) => {
    const thumbStart = Number(video.dataset.resetOnPlay);
    if (!Number.isFinite(thumbStart)) return;

    video.addEventListener(
      'play',
      () => {
        // Still parked at (approximately) the thumbnail frame -> nobody has
        // scrubbed, so this is the fragment's own seek. Jump back to 0.
        if (Math.abs(video.currentTime - thumbStart) < 1.5) {
          video.currentTime = 0;
        }
      },
      { once: true }
    );
  };

  const hydrate = (video) => {
    if (video.dataset.hydrated) return;
    video.dataset.hydrated = 'true';
    video.preload = 'metadata';
    video.load();
    resetOnFirstPlay(video);
  };

  if (!('IntersectionObserver' in window)) {
    videos.forEach(hydrate);
    return;
  }

  // Respect a user's data-saver preference: leave tiles as empty posters.
  const conn = navigator.connection;
  if (conn?.saveData) return;

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        hydrate(entry.target);
        obs.unobserve(entry.target);
      });
    },
    // Start fetching a little before the tile scrolls into view
    { rootMargin: '300px 0px' }
  );

  videos.forEach((video) => observer.observe(video));
}
