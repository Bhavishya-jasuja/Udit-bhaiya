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
  gastronomy: 'Cafes & Restaurants',
  'huber-and-holly': 'Huber & Holly',
  'kaffa-resorts': 'Kaffa Resorts',
  'olive-and-grill': 'Olive & Grill',
  'papaya-chennai': 'Papaya Chennai',
  penthouse: 'Penthouse',
  sandburgs: 'Sandburgs',
  'w-va-bein': 'W Va Bein',
  sports: 'Sports Club',
  videos: 'Video',
  /* Note: the "Key Art" sub-heading inside Sports is hardcoded in sportsBody;
     this label is for the top-level Graphics category. */
  graphics: 'Graphics',
  'real-estate': 'Real Estate',
  education: 'Education',
  pharmacy: 'Pharmacy'
};

const NOTES = {
  gastronomy: 'Seven cafe and restaurant brands we work with regularly.',
  sports: 'Match day videos for the club, along with the posters that go with them.',
  'real-estate': 'Property videos for agents. The full-length film is at the top of this page.',
  graphics: 'Posters, offer creatives and social media designs.',
  education: 'Videos for schools and coaching institutes.',
  pharmacy: 'Store and product videos for pharmacy brands.'
};

/* How many clips to show per client folder. Set to Infinity to show all. */
const MAX_PER_GROUP = 4;

/* Order the categories appear in the Portfolio section. */
const CATEGORY_ORDER = ['education', 'pharmacy', 'gastronomy', 'sports', 'real-estate', 'graphics'];

/* Which second of a clip to freeze as its thumbnail. Browsers paint the frame
   at the "#t=" fragment, so this is the poster image without any extra files.
   Default is 0.1s; override any clip that opens on a fade or a dark shot. */
const DEFAULT_THUMB_TIME = 0.1;
const THUMB_TIMES = {
  'real-estate/6.mp4': 2
};

const thumbTime = (rel) => THUMB_TIMES[rel] ?? DEFAULT_THUMB_TIME;

/* Which clip anchors the Show Reel. Pinned rather than auto-picked so adding
   another landscape film later cannot silently move the feature. Set to null
   to fall back to "largest landscape clip". */
const FEATURE_REL = 'real-estate/6.mp4';

/* Headline counts shown in the pills. These describe the body of work, which
   is larger than the curated selection on the page, so they are set here
   rather than derived from the number of visible tiles. */
const COUNT_OVERRIDES = {
  gastronomy: '15 videos, 7 brands'
};

const titleCase = (s) =>
  s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const label = (slug) => LABELS[slug] || titleCase(slug);

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* --------------------------------------------------------------------------
   Intrinsic dimensions from file headers (no ffmpeg/probe dependency)
   -------------------------------------------------------------------------- */

function mp4Dims(buf) {
  let best = null;
  for (let i = 0; i + 8 < buf.length - 84; i++) {
    if (buf.toString('ascii', i, i + 4) !== 'tkhd') continue;
    const version = buf[i + 4];
    // after 'tkhd': version+flags(4) + [20 (v0) | 32 (v1)] + 16 -> matrix(36) -> w,h
    const matrixAt = i + 4 + (version === 1 ? 52 : 40);
    const base = matrixAt + 36;
    if (base + 8 > buf.length) continue;

    let w = buf.readUInt32BE(base) / 65536;
    let h = buf.readUInt32BE(base + 4) / 65536;
    if (!(w > 0 && h > 0 && w < 20000 && h < 20000)) continue;

    // Phone footage is often stored landscape with a 90/270 rotation matrix.
    // Without this the clip is classified with the wrong orientation.
    const fixed = (o) => buf.readInt32BE(matrixAt + o) / 65536;
    const a = fixed(0);
    const b = fixed(4);
    const c = fixed(12);
    const d = fixed(16);
    const rotated = a === 0 && d === 0 && ((b === 1 && c === -1) || (b === -1 && c === 1));
    if (rotated) [w, h] = [h, w];

    const cand = { w: Math.round(w), h: Math.round(h) };
    if (!best || cand.w * cand.h > best.w * best.h) best = cand;
  }
  return best;
}

/* ---- MP4 box tree ----
   Codec detection must walk the real box tree. A plain substring search for
   "hvc1" false-positives constantly: in a 90MB file those four bytes turn up
   inside the compressed video data by chance. */

const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta']);

function* boxes(buf, start = 0, end = buf.length) {
  let off = start;
  while (off + 8 <= end) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    let header = 8;

    if (size === 1) {
      if (off + 16 > end) return;
      // 64-bit size; the high word is always 0 for real-world files
      size = Number(buf.readBigUInt64BE(off + 8));
      header = 16;
    } else if (size === 0) {
      size = end - off;
    }

    if (size < header || off + size > end) return;
    yield { type, start: off + header, end: off + size };
    off += size;
  }
}

function findBox(buf, pathParts, start = 0, end = buf.length) {
  const [head, ...rest] = pathParts;
  for (const box of boxes(buf, start, end)) {
    if (box.type !== head) continue;
    if (!rest.length) return box;
    if (CONTAINERS.has(box.type)) {
      const hit = findBox(buf, rest, box.start, box.end);
      if (hit) return hit;
    }
  }
  return null;
}

/* Returns the video track's codec fourcc, e.g. "avc1" or "hvc1". */
function videoCodec(buf) {
  const moov = findBox(buf, ['moov']);
  if (!moov) return null;

  for (const trak of boxes(buf, moov.start, moov.end)) {
    if (trak.type !== 'trak') continue;

    const hdlr = findBox(buf, ['mdia', 'hdlr'], trak.start, trak.end);
    if (!hdlr) continue;
    // hdlr: version+flags(4), pre_defined(4), handler_type(4)
    const handler = buf.toString('ascii', hdlr.start + 8, hdlr.start + 12);
    if (handler !== 'vide') continue;

    const stsd = findBox(buf, ['mdia', 'minf', 'stbl', 'stsd'], trak.start, trak.end);
    if (!stsd) continue;
    // stsd: version+flags(4), entry_count(4), then entry: size(4), format(4)
    return buf.toString('ascii', stsd.start + 12, stsd.start + 16);
  }
  return null;
}

/* Chrome and Firefox cannot decode HEVC/H.265. Such a clip renders as a black
   tile, so it is skipped with a loud warning rather than silently shipped. */
const UNPLAYABLE = new Set(['hvc1', 'hev1']);

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

const skipped = [];

function measure(file, rel) {
  const ext = path.extname(file).toLowerCase();
  const buf = fs.readFileSync(file);

  if (ext === '.mp4') {
    const codec = videoCodec(buf);
    if (codec && UNPLAYABLE.has(codec)) {
      skipped.push(`${rel} (${codec})`);
      return null;
    }
  }

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
      const relPath = path.relative(MEDIA, full).split(path.sep).join('/');
      const dims = measure(full, relPath);
      if (!dims) return [];
      return [
        {
          file: full,
          rel: relPath,
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
/* Curated selection for display: drops whichever clip anchors the show reel so
   it never appears twice, then caps the group. inDir() still reports the
   full archive for the headline counts. */
const pick = (p) => inDir(p).filter((i) => i.rel !== feature.rel).slice(0, MAX_PER_GROUP);
const under = (p) => all.filter((i) => i.rel.startsWith(p + '/'));
const groupsUnder = (p) => [...new Set(under(p).map(dirOf))].sort();

const M = './assets/media/';

/* --------------------------------------------------------------------------
   Fragments
   -------------------------------------------------------------------------- */

// stroke-linejoin="round" on a fill also gives the triangle rounded corners
const PLAY_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.4-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

function tile(item, captionParts, indent) {
  const i = ' '.repeat(indent);
  const o = orient(item);
  const caption = captionParts.filter(Boolean).join(' · ');
  const wide = o === 'landscape' ? ' tile--wide' : '';

  return [
    `${i}<figure class="tile${wide}" data-reveal>`,
    `${i}  <video data-lazy muted playsinline preload="none" aria-hidden="true" tabindex="-1">`,
    `${i}    <source src="${M}${item.rel}#t=${thumbTime(item.rel)}" type="video/mp4" />`,
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
const feature =
  (FEATURE_REL && all.find((i) => i.rel === FEATURE_REL)) ||
  landscape.sort((a, b) => b.w * b.h - a.w * a.h)[0];

if (FEATURE_REL && feature.rel !== FEATURE_REL) {
  console.warn(`warning: FEATURE_REL "${FEATURE_REL}" not found — fell back to ${feature.rel}`);
}

const videoCount = all.filter((i) => i.kind === 'video').length;
const imageCount = all.filter((i) => i.kind === 'image').length;
const brandCount = groupsUnder('gastronomy').length;

/* --------------------------------------------------------------------------
   Portfolio
   (There used to be a separate Show Reel section above this, with the pinned
   feature film and a "What We Do" summary grid — removed at the client's
   request. `feature` is still computed above because pick() uses it to keep
   that one film out of the Real Estate grid; the film itself is no longer
   shown anywhere on the page.)
   -------------------------------------------------------------------------- */

function categoryBlock({ id, count, note, body }) {
  return `        <div class="cat-block">
          <h3 class="cat-heading" data-reveal>
            ${label(id)}<span class="cat-count">${COUNT_OVERRIDES[id] || count}</span>
          </h3>
${note ? `          <p class="cat-note" data-reveal>${note}</p>\n` : ''}${body}
        </div>`;
}

// Cafes & Restaurants — one brand group per subfolder
const gastroBody = groupsUnder('gastronomy')
  .map((dir) => {
    const brand = path.basename(dir);
    const items = pick(dir);
    return `          <div class="brand-group">
            <h4 class="brand-head">${label(brand)}</h4>
            <div class="gallery">
${items.map((it, n) => tile(it, [label(brand), `${n + 1}`], 14)).join('\n')}
            </div>
          </div>`;
  })
  .join('\n\n');

// Sports — videos are curated; key art shows the complete set
const sportsVideos = pick('sports/videos');
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

// Real estate — curated (pick() already drops the show reel feature)
const realEstate = pick('real-estate');
const realEstateBody = `          <div class="gallery">
${realEstate.map((it, n) => tile(it, ['Real Estate', `${n + 1}`], 12)).join('\n')}
          </div>`;

// Education
const education = pick('education');
const educationBody = `          <div class="gallery">
${education.map((it, n) => tile(it, ['Education', `${n + 1}`], 12)).join('\n')}
          </div>`;

// Pharmacy
const pharmacy = pick('pharmacy');
const pharmacyBody = `          <div class="gallery">
${pharmacy.map((it, n) => tile(it, ['Pharmacy', `${n + 1}`], 12)).join('\n')}
          </div>`;

// Graphics — mixed ratios, masonry (design work is not capped per client)
const graphics = inDir('graphics');
const graphicsBody = `          <div class="masonry">
${graphics.map((it, n) => masonryItem(it, `Graphic design piece ${n + 1}`, 12)).join('\n')}
          </div>`;

/* Each category is built once, then emitted in CATEGORY_ORDER. Reordering the
   page is a one-line change to that array rather than moving template blocks. */
const CATEGORY_BLOCKS = {
  education: { count: plural(education.length, 'video'), body: educationBody },
  pharmacy: { count: plural(pharmacy.length, 'video'), body: pharmacyBody },
  gastronomy: { count: `${under('gastronomy').length} videos`, body: gastroBody },
  sports: { count: plural(sportsVideos.length + sportsGraphics.length, 'piece'), body: sportsBody },
  'real-estate': { count: plural(realEstate.length, 'video'), body: realEstateBody },
  graphics: { count: plural(graphics.length, 'design'), body: graphicsBody }
};

const orderedBlocks = CATEGORY_ORDER.filter((id) => CATEGORY_BLOCKS[id])
  .map((id) => categoryBlock({ id, ...CATEGORY_BLOCKS[id], note: NOTES[id] }))
  .join('\n\n');

const portfolio = `      <section class="section" id="portfolio">
        <p class="section__script">our work</p>
        <h2 class="section__title" data-reveal>Our Work</h2>
        <p class="section__lead" data-reveal>
          A selection of what we have made for our clients. Tap any video to play it.
        </p>

${orderedBlocks}
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
html = inject(html, 'PORTFOLIO', portfolio);
fs.writeFileSync(INDEX, html, 'utf8');

if (skipped.length) {
  console.warn('');
  console.warn('!! SKIPPED ' + skipped.length + ' HEVC/H.265 clip(s) — Chrome and Firefox cannot play these:');
  skipped.forEach((s) => console.warn('     ' + s));
  console.warn('   Re-export them as H.264/AAC MP4 and rerun this script.');
  console.warn('');
}

const mb = (all.reduce((a, i) => a + i.bytes, 0) / 1048576).toFixed(0);
console.log(`media scanned : ${all.length} files (${videoCount} video, ${imageCount} image, ${mb}MB)`);
console.log(`excluded      : ${feature.rel} (${feature.w}x${feature.h}) — was the Show Reel feature, no longer shown anywhere`);
console.log(`gastronomy    : ${under('gastronomy').length} across ${brandCount} brands`);
console.log(`sports        : ${sportsVideos.length} video + ${sportsGraphics.length} key art`);
console.log(`real estate   : ${realEstate.length} vertical`);
console.log(`graphics      : ${graphics.length}`);
console.log('index.html updated between GENERATED markers.');
