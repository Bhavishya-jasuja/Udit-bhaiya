# Portfolio Site

A single-file static portfolio site. Same stack and structure as the reference site
(`athulrajan.com`): plain HTML, inline CSS, vanilla JavaScript — **no framework, no build
step, no npm install**. Open `index.html` and it runs.

Accent colour is violet (`#6c3be0`) instead of the reference blue.

---

## Run it

Just double-click `index.html`.

For a proper local server (needed if you want the video lightbox to load real `.mp4`
files without file:// restrictions):

```powershell
npx serve .
# or
python -m http.server 8000
```

---

## Files

```
portfolio/
  index.html          <- everything: markup, styles, scripts
  assets/
    img/              <- portrait + tool-chip placeholders (still to replace)
    media/            <- the real work library, 78 files / 195MB
      gastronomy/     <- 38 vertical edits across 7 brand folders
      sports/
        videos/       <- 8 vertical edits
        graphics/     <- 14 key-art JPGs (4:5)
      real-estate/    <- 6 films (5 vertical + 1 landscape feature)
      graphics/       <- 12 mixed-ratio design pieces
    fonts/display/    <- optional display font for the hero watermark
  README.md
```

## The media library

Pulled from the four shared Drive folders and wired into the page:

| Section | Source folder | Content |
| --- | --- | --- |
| Show Reel | `real-estate/6.mp4` | the only 16:9 film — used as the anchor feature |
| Gastronomy | Gastronomy Showcase | 38 clips, grouped under 7 brand headings |
| Sports Club | Portfolio for Sports Club | 8 clips + 14 key-art images |
| Real Estate | Real Estate | 5 vertical listing cuts |
| Graphics | Graphics | 12 posters in a mixed-ratio masonry |

**Almost everything is vertical 9:16** (720×1280 / 1080×1920), so the grids are built
vertical-first rather than the 16:9 layout the reference site uses.

### Video posters

There are no separate poster images. Each `<source>` ends in `#t=0.1`, which makes the
browser seek to 0.1s and paint that frame as the thumbnail — no extra files, no ffmpeg.
If you later want designed thumbnails, add `poster="..."` to each `<video>`.

### Renaming or adding clips

Files are numbered per folder (`1.mp4`, `2.mp4` …). Because the names carry no meaning,
the lightbox builds its caption from the surrounding headings instead — e.g.
*Gastronomy · Sandburgs · 5*. Add a `<figcaption>` to any `<figure>` to override that.

---

## What to swap in

### 1. Colours — one place

All colour comes from the CSS variables at the top of the `<style>` block in
`index.html`:

```css
:root {
  --accent:        #6c3be0;   /* main violet */
  --accent-strong: #5326bd;   /* hover / pressed */
  --accent-soft:   #e6dcff;
  --accent-rgb:    108, 59, 224;  /* keep in sync with --accent */
  --ink:           #131017;
  --muted:         #5a5566;
}
```

To retune the whole site, change `--accent` **and** `--accent-rgb` (the RGB triplet feeds
every translucent glow, tint, and focus ring). Nothing else needs touching.

### 2. Text

Search `index.html` for these and replace:

| Placeholder | Where |
| --- | --- |
| `Client Name` | `<title>`, meta tags, JSON-LD, header brand, hero kicker, footer |
| `hello@example.com` | contact block, form `action`, footer |
| `https://example.com/` | canonical, OG tags, JSON-LD |
| `Creative Professional` | hero `<h1>`, JSON-LD `jobTitle` |
| `Service Title One…Four` | the "What I Do" cards |
| `Project Title (YYYY)` | journey poster wall captions |
| `#` in `href="#"` | Instagram / LinkedIn / profile links |

### 3. Images still to replace

The work library is real. These few placeholders are not:

| File | Ratio | Used for |
| --- | --- | --- |
| `img/portrait.svg` | 4:5 | hero portrait — **replace with a real photo** |
| `img/tool-1…5.svg` | square | tool chips (white glyph on dark circle) |
| `img/poster.svg` | 2:3 | journey poster wall — reused 12× |
| `img/social-preview.svg` | 1200×630 | Open Graph card — export as **.jpg** |

If you change extensions (`.svg` → `.jpg`), update the `src` attributes.

### 4. The Journey section

This is the one section with no Drive content behind it — it still shows 12 copies of
`poster.svg` with `Project Title (YYYY)` captions. Either fill it with real career
milestones or delete the whole `<section id="journey">` block plus its nav link.

### 5. Contact form

Uses [FormSubmit](https://formsubmit.co) — no backend required. Put the client's real
address in the form `action`, then submit the form **once from the live domain**; FormSubmit
emails a confirmation link that activates it.

---

## How it works

Three self-contained IIFEs at the bottom of `index.html`:

1. **Reveal on scroll** — `IntersectionObserver` adds `.is-in` to every `[data-reveal]`
   element as it enters the viewport, then unobserves it. Falls back to showing everything
   if the API is missing.
2. **Card tilt** — pointer position on each `.whatido-card` drives CSS custom properties
   (`--mx`, `--my`, `--tilt-x`, `--tilt-y`) for the 3D tilt and glare. Disabled on touch
   devices and under `prefers-reduced-motion`.
3. **Video lightbox** — clicking any `#portfolio video` clones its `<source>` elements into
   the fixed glass modal and plays there instead of inline. Closes on backdrop click, the
   × button, or Escape. Each clip carries `data-orient`, and the modal adds `.is-portrait`
   for 9:16 clips so the panel narrows instead of letterboxing.

Fonts load from Google Fonts: Space Grotesk (headings), Manrope (body), Caveat
(handwritten accents). The optional `Display Outline` `@font-face` at the top of the
stylesheet is for the oversized hero watermark — drop files into `assets/fonts/display/`
or delete the block; it falls back to Space Grotesk.

Responsive breakpoints at **1080px** and **760px**, plus a full
`prefers-reduced-motion` block that kills all animation.

---

## Deploying

It is a static folder — drag it into Netlify Drop, or push to GitHub and enable Pages /
connect Vercel. No build command, no output directory.

Before going live, update `https://example.com/` in the canonical link, OG tags, and
JSON-LD to the real domain, and swap `social-preview.svg` for a real 1200×630 JPG.
