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

| Section | Folder | Content |
| --- | --- | --- |
| Show Reel | `real-estate/6.mp4` | the only 16:9 film — auto-picked as the feature |
| Gastronomy | `gastronomy/` | 38 clips across 7 brand subfolders |
| Sports Club | `sports/` | 8 clips + 14 key-art images |
| Real Estate | `real-estate/` | 5 vertical listing cuts |
| Graphics | `graphics/` | 12 posters, mixed ratios, masonry |

**Almost everything is vertical 9:16**, so the galleries are built vertical-first.

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

## What to replace before launch

| Placeholder | Where |
| --- | --- |
| `Client Name` | `<title>`, meta, JSON-LD, header, hero, footer |
| `hello@example.com` | contact block, form `action` |
| `https://example.com/` | canonical, OG tags, JSON-LD |
| `#` in `href="#"` | Instagram / LinkedIn / profile links |
| `img/portrait.svg` | hero portrait — replace with a real 4:5 photo |
| `img/tool-1…5.svg` | tool chips |
| `social-preview.svg` | export a real 1200×630 **JPG** |

**The Journey section has no real content** — it still shows 12 copies of `poster.svg`.
Either fill it in or delete `<section id="journey">` and its nav link.

**Contact form** uses [FormSubmit](https://formsubmit.co) — no backend. Put the real
address in the form `action`, then submit once from the live domain to activate it.

---

## Deploying

Static folder, no build command. The repo root has a `vercel.json` pointing Vercel at this
subfolder, so a plain Git push deploys it.

`assets/media/` is 195MB. Fine for Vercel/Netlify; heavy for GitHub. If the repo gets
unwieldy, move the videos to a CDN or Vimeo and update the `<source>` tags.
