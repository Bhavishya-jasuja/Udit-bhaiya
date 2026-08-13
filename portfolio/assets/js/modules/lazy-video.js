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

  const hydrate = (video) => {
    if (video.dataset.hydrated) return;
    video.dataset.hydrated = 'true';
    video.preload = 'metadata';
    video.load();
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
