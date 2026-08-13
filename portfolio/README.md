# Portfolio Site

Static portfolio site — plain HTML, CSS and vanilla ES modules. No framework, no
bundler, no `npm install`. Mobile-first and responsive from 320px up.

Accent colour is violet (`#6c3be0`).

---

## Run it locally

The JavaScript uses ES modules, which browsers refuse to load over `file://`.
**You must serve it over HTTP** — opening `index.html` by double-clicking will load the
styles but not the scripts.

```bash
npx serve .
# or
python -m http.server 8000
```

---

## Structure

```
portfolio/
  index.html                  markup only — no inline CSS or JS
  assets/
    css/
      00-tokens.css           colour, type scale, spacing, radii, shadows
      01-base.css             reset, document defaults, a11y primitives
      02-layout.css           shell, header + nav drawer, hero, footer
      03-components.css       cards, galleries, lightbox, forms
      04-responsive.css       all media queries, mobile-first
    js/
      main.js                 entry point; boots each module in isolation
      modules/
        nav.js                mobile drawer, focus trap, scroll lock
        reveal.js             scroll-reveal via IntersectionObserver
        tilt.js               pointer tilt on the "What I Do" cards
        lazy-video.js         defers video metadata until near the viewport
        lightbox.js           full-size player, focus management
        scrollspy.js          highlights the current section in the nav
    img/                      portrait + tool-chip placeholders
    media/                    the work library, 78 files / 195MB
  tools/
    build-gallery.js          regenerates the gallery markup from assets/media/
  README.md
```

The CSS files are loaded in numeric order and that order matters — later files rely on
being able to override earlier ones. Keep the numbering when adding a file.

---

## Adding or changing media

Drop files into the right folder under `assets/media/`, then run:

```bash
node tools/build-gallery.js
```

It scans the folder tree, reads each file's real dimensions straight from the MP4/JPEG
headers (no ffmpeg needed), and rewrites the Showreel and Portfolio sections of
`index.html` between the `<!-- GENERATED:… -->` markers. Everything outside those markers
is yours to edit freely; the script never touches it.

Folder names become headings. To give a folder a nicer label, add it to the `LABELS` map
at the top of the script.

### Current library

| Section | Folder | On disk | Shown |
| --- | --- | --- | --- |
| Show Reel | `real-estate/6.mp4` | — | the pinned 16:9 feature |
| Cafes & Restaurants | `gastronomy/` | 38 clips / 7 brands | 2 per brand |
| Sports Club | `sports/` | 8 clips + 14 key art | 2 + 2 |
| Real Estate | `real-estate/` | 6 films | 2 |
| Education | `education/` | 2 films | 2 |
| Pharmacy | `pharmacy/` | 1 film | 1 |
| Graphics | `graphics/` | 12 posters | all (masonry) |

**Almost everything is vertical 9:16**, so the galleries are built vertical-first.

### Three settings at the top of the script

```js
const MAX_PER_GROUP  = 2;                  // clips shown per client folder
const FEATURE_REL    = 'real-estate/6.mp4' // which clip anchors the Show Reel
const COUNT_OVERRIDES = { gastronomy: '15 edits · 7 brands' }
```

`MAX_PER_GROUP` caps the *display* only — every file stays on disk. `COUNT_OVERRIDES`
sets a headline pill independently of how many tiles are visible, so a section can say
"15 edits" while showing a curated 2 per brand.

### Two things the script checks for you

**HEVC/H.265 clips are skipped.** Chrome and Firefox cannot decode them and they render
as black tiles. The script parses the MP4 box tree to read the real codec (a substring
search for `hvc1` false-positives constantly on large files) and prints a warning naming
any file it dropped. Re-export those as **H.264/AAC** and rerun.

**Rotated phone footage is corrected.** iPhone clips are often stored landscape with a
90° rotation matrix in `tkhd`. The script reads that matrix and swaps the dimensions, so
the clip is classified portrait rather than being laid out as a wide tile.

---

## How the tricky parts work

**Video thumbnails without poster images.** Each `<source>` ends in `#t=0.1`, so the
browser seeks to 0.1s and paints that frame. No separate poster files, no ffmpeg.

**Videos don't blow up mobile data.** All 51 gallery clips ship with `preload="none"`.
`lazy-video.js` upgrades a clip to `preload="metadata"` only once it is within 300px of
the viewport — a phone pulls a handful of thumbnails instead of 195MB. It also bails out
entirely when the browser reports `navigator.connection.saveData`.

**Tiles are thumbnails, not players.** Native video controls shrink to unusable on a
phone, so gallery tiles hide them and put one full-size button over the whole tile. That
button opens the lightbox, which reshapes to 9:16 for portrait clips instead of
letterboxing them. Captions are built from the surrounding headings
(*Gastronomy · Sandburgs · 5*) because the files are just numbered.

**Two CSS gotchas worth knowing before you edit** — both are commented in the source:

1. `.site-header` must not have `backdrop-filter` below 1024px. A filter makes an element
   the containing block for its `position: fixed` descendants, which traps the nav drawer
   inside the header. The blur is added back at ≥1024px where the drawer doesn't exist.
2. The drawer sits inside `.nav-drawer`, a viewport-sized `overflow: hidden` frame. Parked
   at `translateX(100%)`, a fixed element is *not* clipped by `body { overflow-x: hidden }`
   and would add ~320px of horizontal scroll.

---

## Responsive behaviour

| Width | Nav | Gallery | Masonry | Hero |
| --- | --- | --- | --- | --- |
| < 560px | drawer | 2 cols | 2 cols | stacked |
| 560–767 | drawer | 3 cols | 2 cols | stacked |
| 768–1023 | drawer | 3 cols | 3 cols | stacked |
| 1024–1279 | inline | 4 cols | 4 cols | side-by-side |
| ≥ 1280 | inline | 5 cols | 4 cols | side-by-side |

Also handled: landscape phones, `prefers-reduced-motion`, `hover: none` (no hover-only
affordances), and a print stylesheet.

---

## Client details in use

| Detail | Value |
| --- | --- |
| Brand | The Marketing Wonders |
| Founder / portrait | Mansi — `assets/img/portrait.jpg` |
| WhatsApp | `https://wa.me/919548996834` (every WhatsApp icon and CTA) |
| Email | marketingwonders2503@gmail.com (contact block + form action) |

Social is **Instagram + WhatsApp only**; all other networks were removed.

## Still to replace before launch

| Placeholder | Where |
| --- | --- |
| `https://www.instagram.com/` | needs the real Instagram handle — 3 links |
| `https://example.com/` | canonical, OG tags, JSON-LD |
| `social-preview.svg` | export a real 1200×630 **JPG** |

**Contact form** uses [FormSubmit](https://formsubmit.co) — no backend. Submit it once
from the live domain to activate delivery to the Gmail address.

---

## Deploying

Static folder, no build command. The repo root has a `vercel.json` pointing Vercel at this
subfolder, so a plain Git push deploys it.

`assets/media/` is **402MB**, of which only ~261MB is actually referenced — the rest are
the clips held back by `MAX_PER_GROUP`. Options if the deploy gets heavy:

- delete the unused files (the script only emits what it finds), or
- keep them locally and add `assets/media/` to `.gitignore`, uploading media separately, or
- move the large clips to a CDN/Vimeo and point the `<source>` tags there.

Vercel handles this size, but pushing 400MB through GitHub is slow and close to the point
where Git LFS becomes worthwhile.
