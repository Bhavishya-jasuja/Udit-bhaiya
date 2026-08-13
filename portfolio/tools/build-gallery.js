#!/usr/bin/env node
/**
 * Gallery builder.
 *
 * Scans assets/media/, reads each file's real dimensions straight from the
 * MP4/JPEG headers, and writes the Showreel + Portfolio markup into
 * index.html between the GENERATED:* markers.
 *
 * Run it after adding, removing, or renaming anything in assets/media/:
 *   node tools/build-gallery.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MEDIA = path.join(ROOT, 'assets', 'media');
const INDEX = path.join(ROOT, 'index.html');

/* --------------------------------------------------------------------------
   Human-readable labels. Add a folder here to give it a nicer heading;
   anything missing falls back to a title-cased version of the folder name.
   -------------------------------------------------------------------------- */
const LABELS = {
  gastronomy: 'Gastronomy',
  'huber-and-holly': 'Huber & Holly',
  'kaffa-resorts': 'Kaffa Resorts',
  'olive-and-grill': 'Olive & Grill',
  'papaya-chennai': 'Papaya Chennai',
  penthouse: 'Penthouse',
  sandburgs: 'Sandburgs',
  'w-va-bein': 'W Va Bein',
  sports: 'Sports Club',
  videos: 'Video',
  graphics: 'Key Art',
  'real-estate': 'Real Estate'
};

const NOTES = {
  gastronomy: 'Seven hospitality brands, each with its own run of vertical edits.',
  sports: 'A full club package — matchday video cutdowns plus the campaign key art beside them.',
  'real-estate': 'Vertical listing cuts. The long-form landscape film sits up in the show reel.',
  graphics: 'Poster and campaign design in mixed formats.'
};

const titleCase = (s) =>
  s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const label = (slug) => LABELS[slug] || titleCase(slug);

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* --------------------------------------------------------------------------
   Intrinsic dimensions from file headers (no ffmpeg/probe dependency)
   -------------------------------------------------------------------------- */

function mp4Dims(buf) {
  let best = null;
  for (let i = 0; i + 8 < buf.length - 84; i++) {
    if (buf.toString('ascii', i, i + 4) !== 'tkhd') continue;
    const version = buf[i + 4];
    // after 'tkhd': version+flags(4) + [20 (v0) | 32 (v1)] + 16 + matrix(36)
    const base = i + 4 + (version === 1 ? 88 : 76);
    if (base + 8 > buf.length) continue;
    const w = buf.readUInt32BE(base) / 65536;
    const h = buf.readUInt32BE(base + 4) / 65536;
    if (w > 0 && h > 0 && w < 20000 && h < 20000) {
      if (!best || w * h > best.w * best.h) best = { w: Math.round(w), h: Math.round(h) };
    }
  }
  return best;
}

function jpegDims(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function measure(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);
  const d = ext === '.mp4' ? mp4Dims(buf) : ['.jpg', '.jpeg'].includes(ext) ? jpegDims(buf) : null;
  if (!d) return null;
  return { ...d, ratio: +(d.w / d.h).toFixed(3), bytes: buf.length };
}

/* --------------------------------------------------------------------------
   Scan
   -------------------------------------------------------------------------- */

const numeric = (a, b) => {
  const n = (s) => parseInt(path.basename(s).replace(/\D/g, ''), 10) || 0;
  return n(a.file) - n(b.file) || a.file.localeCompare(b.file);
};

function scan(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return scan(full);
      const dims = measure(full);
      if (!dims) return [];
      return [
        {
          file: full,
          rel: path.relative(MEDIA, full).split(path.sep).join('/'),
          kind: path.extname(full).toLowerCase() === '.mp4' ? 'video' : 'image',
          ...dims
        }
      ];
    })
    .sort(numeric);
}

const all = scan(MEDIA);
if (!all.length) {
  console.error('No media found in assets/media/ — nothing to build.');
  process.exit(1);
}

const orient = (d) => (d.ratio >= 1.2 ? 'landscape' : d.ratio <= 0.85 ? 'portrait' : 'square');
const dirOf = (item) => path.dirname(item.rel);
const inDir = (p) => all.filter((i) => dirOf(i) === p);
const under = (p) => all.filter((i) => i.rel.startsWith(p + '/'));
const groupsUnder = (p) => [...new Set(under(p).map(dirOf))].sort();

const M = './assets/media/';

/* --------------------------------------------------------------------------
   Fragments
   -------------------------------------------------------------------------- */

const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

function tile(item, captionParts, indent) {
  const i = ' '.repeat(indent);
  const o = orient(item);
  const caption = captionParts.filter(Boolean).join(' · ');
  const wide = o === 'landscape' ? ' tile--wide' : '';

  return [
    `${i}<figure class="tile${wide}" data-reveal>`,
    `${i}  <video data-lazy muted playsinline preload="none" aria-hidden="true" tabindex="-1">`,
    `${i}    <source src="${M}${item.rel}#t=0.1" type="video/mp4" />`,
    `${i}  </video>`,
    `${i}  <button class="tile__open" type="button" data-video-open`,
    `${i}    data-video-src="${M}${item.rel}"`,
    `${i}    data-video-orient="${o}"`,
    `${i}    data-video-title="${esc(caption)}">`,
    `${i}    <span class="tile__play" aria-hidden="true">${PLAY_ICON}</span>`,
    `${i}    <span class="visually-hidden">Play ${esc(caption)}</span>`,
    `${i}  </button>`,
    `${i}</figure>`
  ].join('\n');
}

function shot(item, alt, indent) {
  const i = ' '.repeat(indent);
  return [
    `${i}<figure class="shot" data-reveal>`,
    `${i}  <img src="${M}${item.rel}" alt="${esc(alt)}" width="${item.w}" height="${item.h}" loading="lazy" decoding="async" />`,
    `${i}</figure>`
  ].join('\n');
}

function masonryItem(item, alt, indent) {
  const i = ' '.repeat(indent);
  return [
    `${i}<figure data-reveal>`,
    `${i}  <img src="${M}${item.rel}" alt="${esc(alt)}" width="${item.w}" height="${item.h}" loading="lazy" decoding="async" />`,
    `${i}</figure>`
  ].join('\n');
}

/* --------------------------------------------------------------------------
   Showreel — the widest landscape film anchors the section
   -------------------------------------------------------------------------- */

const landscape = all.filter((i) => i.kind === 'video' && orient(i) === 'landscape');
const feature = landscape.sort((a, b) => b.w * b.h - a.w * a.h)[0];

const videoCount = all.filter((i) => i.kind === 'video').length;
const imageCount = all.filter((i) => i.kind === 'image').length;
const brandCount = groupsUnder('gastronomy').length;

const showreel = `      <section class="section" id="showreel">
        <p class="section__script">show reel</p>
        <h2 class="section__title" data-reveal>Show Reel</h2>
        <p class="section__lead" data-reveal>
          The feature film below is the long-form cut. Everything else is built vertical-first for social and
          in-venue screens — browse it all in the portfolio.
        </p>

        <div class="showreel-grid is-single">
          <article class="showreel-card" data-reveal>
            <div class="showreel-frame">
              <video controls playsinline preload="none" width="${feature.w}" height="${feature.h}">
                <source src="${M}${feature.rel}#t=0.1" type="video/mp4" />
                Your browser does not support embedded video.
              </video>
            </div>
            <div class="showreel-caption">
              <h3>${label(dirOf(feature))} Feature</h3>
              <p>Full-length ${feature.w}&times;${feature.h} cut — the anchor piece of the reel.</p>
            </div>
          </article>
        </div>

        <div class="whatido-block" data-reveal>
          <h3 class="whatido-title">What I Do</h3>
          <p class="whatido-intro">Four working verticals, ${all.length} finished pieces across video and design.</p>
          <div class="whatido-grid">
            <article class="whatido-card">
              <span class="whatido-meta">${under('gastronomy').length} edits · ${brandCount} brands</span>
              <h4>Gastronomy</h4>
              <p>Vertical food and hospitality edits for restaurants, cafes, and resorts — cut for reels, stories, and in-venue screens.</p>
            </article>
            <article class="whatido-card">
              <span class="whatido-meta">${inDir('sports/videos').length} edits · ${inDir('sports/graphics').length} graphics</span>
              <h4>Sports Club</h4>
              <p>Matchday cutdowns and campaign key art for club social channels, delivered as one video and design package.</p>
            </article>
            <article class="whatido-card">
              <span class="whatido-meta">${inDir('real-estate').length} films</span>
              <h4>Real Estate</h4>
              <p>Property walkthroughs and listing films in both long-form landscape and vertical social cuts.</p>
            </article>
            <article class="whatido-card">
              <span class="whatido-meta">${inDir('graphics').length} pieces</span>
              <h4>Graphics &amp; Key Art</h4>
              <p>Static design work — posters, campaign key art, and social templates matching the motion work.</p>
            </article>
          </div>
        </div>
      </section>`;

/* --------------------------------------------------------------------------
   Portfolio
   -------------------------------------------------------------------------- */

function categoryBlock({ id, count, note, body }) {
  return `        <div class="cat-block">
          <h3 class="cat-heading" data-reveal>
            ${label(id)}<span class="cat-count">${count}</span>
          </h3>
${note ? `          <p class="cat-note" data-reveal>${note}</p>\n` : ''}${body}
        </div>`;
}

// Gastronomy — one brand group per subfolder
const gastroBody = groupsUnder('gastronomy')
  .map((dir) => {
    const brand = path.basename(dir);
    const items = inDir(dir);
    return `          <div class="brand-group">
            <h4 class="brand-head">${label(brand)}</h4>
            <div class="gallery">
${items.map((it, n) => tile(it, ['Gastronomy', label(brand), `${n + 1}`], 14)).join('\n')}
            </div>
          </div>`;
  })
  .join('\n\n');

// Sports — videos then key art
const sportsVideos = inDir('sports/videos');
const sportsGraphics = inDir('sports/graphics');

const sportsBody = `          <div class="brand-group">
            <h4 class="brand-head">Video</h4>
            <div class="gallery">
${sportsVideos.map((it, n) => tile(it, ['Sports Club', `${n + 1}`], 14)).join('\n')}
            </div>
          </div>

          <div class="brand-group">
            <h4 class="brand-head">Key Art</h4>
            <div class="gallery">
${sportsGraphics.map((it, n) => shot(it, `Sports club key art ${n + 1}`, 14)).join('\n')}
            </div>
          </div>`;

// Real estate — everything except the showreel feature
const realEstate = inDir('real-estate').filter((i) => i.rel !== feature.rel);
const realEstateBody = `          <div class="gallery">
${realEstate.map((it, n) => tile(it, ['Real Estate', `${n + 1}`], 12)).join('\n')}
          </div>`;

// Graphics — mixed ratios, masonry
const graphics = inDir('graphics');
const graphicsBody = `          <div class="masonry">
${graphics.map((it, n) => masonryItem(it, `Graphic design piece ${n + 1}`, 12)).join('\n')}
          </div>`;

const portfolio = `      <section class="section" id="portfolio">
        <p class="section__script">selected work</p>
        <h2 class="section__title" data-reveal>A shelf of finished work.</h2>
        <p class="section__lead" data-reveal>
          ${all.length} pieces across four verticals. Tap any tile to open it full size.
        </p>

${categoryBlock({
  id: 'gastronomy',
  count: `${under('gastronomy').length} edits`,
  note: NOTES.gastronomy,
  body: gastroBody
})}

${categoryBlock({
  id: 'sports',
  count: `${sportsVideos.length + sportsGraphics.length} pieces`,
  note: NOTES.sports,
  body: sportsBody
})}

${categoryBlock({
  id: 'real-estate',
  count: `${realEstate.length} vertical cuts`,
  note: NOTES['real-estate'],
  body: realEstateBody
})}

${categoryBlock({
  id: 'graphics',
  count: `${graphics.length} pieces`,
  note: NOTES.graphics,
  body: graphicsBody
})}
      </section>`;

/* --------------------------------------------------------------------------
   Inject
   -------------------------------------------------------------------------- */

function inject(html, name, replacement) {
  const start = `<!-- GENERATED:${name}:START -->`;
  const end = `<!-- GENERATED:${name}:END -->`;
  const s = html.indexOf(start);
  const e = html.indexOf(end);
  if (s === -1 || e === -1) throw new Error(`markers for ${name} not found in index.html`);
  return html.slice(0, s + start.length) + '\n' + replacement + '\n      ' + html.slice(e);
}

let html = fs.readFileSync(INDEX, 'utf8');
html = inject(html, 'SHOWREEL', showreel);
html = inject(html, 'PORTFOLIO', portfolio);
fs.writeFileSync(INDEX, html, 'utf8');

const mb = (all.reduce((a, i) => a + i.bytes, 0) / 1048576).toFixed(0);
console.log(`media scanned : ${all.length} files (${videoCount} video, ${imageCount} image, ${mb}MB)`);
console.log(`showreel      : ${feature.rel} (${feature.w}x${feature.h})`);
console.log(`gastronomy    : ${under('gastronomy').length} across ${brandCount} brands`);
console.log(`sports        : ${sportsVideos.length} video + ${sportsGraphics.length} key art`);
console.log(`real estate   : ${realEstate.length} vertical`);
console.log(`graphics      : ${graphics.length}`);
console.log('index.html updated between GENERATED markers.');
