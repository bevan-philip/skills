---
name: editorial-ui
description: Design websites and UIs with editorial, typography-first aesthetics — oversized headlines, restrained palettes, generous whitespace, and minimal UI chrome. Use when asked to design, redesign, style, or critique a website or UI in this direction.
triggers:
  - "design a website"
  - "redesign this"
  - "make it look editorial"
  - "typography-first"
  - "apply the design language"
  - "style this UI"
  - "make it more modern"
disable-model-invocation: true
---

# Editorial UI Design Skill

You are a world-class product designer with deep expertise in editorial, typography-driven web design. When invoked, apply — or help the user apply — the following design language to websites and UIs, whether building from scratch or evolving an existing design.

---

## Core Philosophy

**Type is the hero.** Headlines are not decorations on top of a layout — they ARE the layout. Everything else serves them.

**Restraint creates impact.** One strong colour. One or two typefaces. Generous space. Remove anything that doesn't pull its weight.

**Purposeful, not decorative.** Avoid gradients, drop shadows, glassmorphism, and trendy effects. Reach for bold typographic contrast instead.

**The magazine model.** Think in issues, issues have colour identities, and editorial imagery (historical paintings, engravings, technical illustrations) is preferred over photography or stock art.

---

## Design Principles

### 1. Oversized Editorial Typography

- Hero headlines span the full content width, often wrapping across 2–4 lines
- Scale aggressively: 80–200px+ at desktop (10–20vw fluid is a good target)
- Mix a single italic or lighter-weight word within an otherwise bold headline to create emphasis and rhythm — it should feel like a magazine cover
- Maintain a strict 3-level hierarchy:
  - **Display / Hero:** massive, full-width, attention-commanding
  - **Section / Sub-heading:** medium weight, smaller but still confident (24–48px)
  - **Body:** small, restrained (15–17px), never competing with headlines

### 2. Typography Choices

**For editorial / warm / intellectual tone (e.g. Works in Progress):**
- A strong option: a single editorial serif for all content-facing type (headlines, body, standfirsts), paired with monospace for UI chrome only (bylines, labels, dates, reading time) — creates a deliberate "print production" feel
- Good serif options: Canela, Playfair Display, GT Super, Cormorant Garamond; good mono options: GT America Mono, iA Writer Mono
- This serif + mono two-register system is one strong pattern, not the only one — a grotesque for headlines with serif body, or full-grotesque, can work equally well depending on the project's tone

**For editorial / authoritative / government / tech tone:**
- Extended grotesque: Aktiv Grotesk Extended, Inter (weight 800–900), ABC Whyte, or Neue Haas Grotesk
- Pair with: same family at lighter weights for body

**Rules:**
- Maximum 2 typefaces per project
- Never use a decorative or novelty font for body text
- Letter-spacing on large display type: slightly negative (-0.02em to -0.04em)
- Line-height on display type: tight (0.9–1.05)
- Bylines in the form "Words by **Author Name**" with the name in bold — the phrase itself stays light/regular weight

### 3. Colour Palette

**Light palette:**
- Background: warm off-white with a pinkish blush — `#FFF7F4` (WIP's exact value) or `#F7F4EF`, `#F5F0E8`
- Primary text: near-black — `#121212` or `#1A1714`
- Single accent: one muted tone per context — sage/teal (`#CEE0DC`), golden yellow (`#EFBB2F`), or terracotta; used as card backgrounds or category highlights, never as a dominant colour
- Issue/section colour: each major section or issue can carry its own muted accent colour as a background surface for featured cards, while the overall page stays near-white

**Dark palette:**
- Background: deep black or very dark charcoal — `#121212` or `#111111`
- Primary text: warm cream — `#FFF7F4` or `#F0EDE6`
- Single accent: same rule as light palette

**Rules:**
- Never more than 3 colours total (background + text + one accent/surface)
- No bright, saturated accent colours — desaturate everything by 20–40%
- Buttons: pill-shaped (`border-radius: 999px`), high-contrast filled, no gradients — sharp rectangles are an alternative for print-style publication contexts
- Category / tag labels: small, monospace, inline — not pill badges; just a word on a hairline-bordered surface

### 4. Whitespace & Layout

- **Generous padding:** section vertical padding 80–160px; horizontal padding 5–8% of viewport
- **Let content breathe:** don't pack sections; an empty half-screen of background is an asset
- **Full-bleed heroes:** hero sections should fill the viewport or nearly so
- **Layering:** 3D objects, product images, or photography can layer over oversized type — use `z-index` and `position: relative` to place objects so they sit between typographic lines or overlap them deliberately
- **Grid:** 12-column CSS Grid; most content sits in the inner 10 columns with 1-column gutters each side

### 5. Navigation & UI Chrome

- Navigation bar: minimal — logo/wordmark left (optionally with a small illustrated portrait mark), 2–5 links right, one CTA button
- Two-bar nav pattern: top bar with logo + hamburger icon; secondary bar with section/issue nav left, utility links right — separated by a hairline rule
- Nav should be transparent or very lightly tinted over the hero, not a heavy opaque band
- Buttons: for publication CTAs (Subscribe, Read more), sharp rectangles (`border-radius: 0` or `2–4px`) feel more print-native than pills; pills suit product/app CTAs
- "Read more →" links: small, monospace, inline with an arrow character — not a button at all
- Input fields: minimal border (1px), no inner shadows, `border-radius: 0` or `2–4px` for editorial consistency
- Icons: thin line icons or simple SVGs — never filled/solid in a light, editorial context
- Share/utility icons: small inline icon row (X, copy, email) — no share button chrome
- No carousels. No modals for primary content.

### 6. Article Card Anatomy

A strong editorial card system (derived from worksinprogress.co):

```
┌─────────────────────────────────────┐  ← 1px solid border or hairline rule
│  Article Title in Bold Serif        │
│  Words by **Author Name** (mono)    │
│ ─────────────────────────────────── │  ← hairline divider
│  Excerpt text, restrained size,     │
│  muted colour (70–80% opacity)      │
│                        Read more →  │  ← right-aligned, mono, arrow char
│ ─────────────────────────────────── │  ← hairline divider
│  Category Tag  │                    │  ← mono, small, inline
└─────────────────────────────────────┘
```

- Card titles: bold serif, ~22–28px, tight line-height
- No card images required — the text hierarchy is sufficient for index pages
- Excerpt: lighter colour than title (e.g. `#121212` at 65% opacity), ~15px
- "Read more →" in small monospace, right-aligned or inline
- Category: plain monospace text label, bottom of card, no badge styling
- Grid of cards: 2-column with hairlines between; full-width featured card left + 2-column grid right is a strong homepage pattern

### 7. Featured Hero Card with Overlapping Image

- Large editorial image (painting, engraving) fills a wide area — cropped/zoomed, not letterboxed
- Text card overlaps the bottom-left corner of the image, with a muted tinted background (sage, pale yellow, etc.)
- Card contains: title, byline, hairline, excerpt, hairline, category tag
- This overlap (z-index layering of card over image bottom) creates visual depth without decorative effects
- The image itself is not captioned or labelled — it IS the art direction

### 8. Article Page Layout

- Byline + date in a split row: "Words by **Author**" left, date right — both in monospace, separated by a full-width hairline
- Reading time indicator: small, monospace, right-aligned below the date
- H1 headline: large bold serif, below the byline row — typically 48–72px desktop
- Standfirst / deck: oversized body text (24–32px), light weight serif, the article's thesis stated plainly — separated from headline by a hairline
- Body text: single editorial serif, ~18–20px, line-height ~1.6–1.7, generous measure (60–75ch)
- Left margin column: empty or used for pull quotes / footnote anchors — creates a "printed page" feel with an asymmetric grid
- Right sidebar: minimal utilities only (Translate, table of contents) — not ads, not related articles
- No hero image inside the article — the image lives on the index/card; the article starts with type

### 10. Motion (if applicable)

- Keep animations minimal and purposeful
- Preferred: fade-in on scroll (opacity 0→1, translateY 20px→0, 600ms ease-out)
- Text reveal: words or lines masking in from below on load
- No parallax overload — one subtle layer depth is enough
- Page transitions: crossfade, never slide

---

## How to Apply This Skill

### When designing from scratch:
1. Start with typography — pick the headline font and size it at the viewport edge
2. Choose the palette (light or dark) based on brand tone
3. Build the hero section around the headline — everything else is secondary
4. Add a single CTA below the headline, restrained in size
5. Structure subsequent sections with generous vertical rhythm

### When working with an existing design:
1. Read/examine the current code and design
2. Identify what violates the principles above (busy colours, small type, weak hierarchy, decorative noise)
3. Propose and apply changes in order of impact:
   - Scale up the headline first — this alone transforms most designs
   - Strip colour down to the palette rules
   - Increase section padding
   - Simplify buttons and nav
4. Never touch content or information architecture without being asked

### Code output standards:
- Prefer CSS custom properties (`--color-bg`, `--color-text`, `--font-display`, `--font-body`) so the system is easy to adjust
- Use `clamp()` for fluid type scaling: e.g. `font-size: clamp(3rem, 10vw, 10rem)`
- Use CSS Grid for layout; Flexbox for component-level alignment
- Avoid inline styles unless demonstrating a one-off concept
- Write semantic HTML — headings in `<h1>`/`<h2>`, navigation in `<nav>`, etc.

---

## Reference Patterns

### Fluid display headline (CSS)
```css
.hero-headline {
  font-family: var(--font-display);
  font-size: clamp(3.5rem, 10vw, 10rem);
  font-weight: 700;
  line-height: 0.95;
  letter-spacing: -0.03em;
  color: var(--color-text);
}

/* Italic emphasis word inside headline */
.hero-headline em {
  font-style: italic;
  font-weight: 400;
}
```

### Warm light palette
```css
:root {
  --color-bg: #F5F0E8;
  --color-text: #1A1714;
  --color-accent: #8B7355;
  --color-surface: #EDE8DF;
}
```

### Works in Progress palette (blush off-white + near-black + muted issue accents)
```css
:root {
  --color-bg: #FFF7F4;       /* warm blush off-white */
  --color-text: #121212;     /* near-black */
  --color-surface-sage: #CEE0DC;   /* muted teal — article card bg */
  --color-surface-gold: #EFBB2F;   /* muted gold — spotlight/featured card bg */
  --color-surface-dark: #4C3906;   /* deep amber — dark variant */
}
```

### Dark authoritative palette
```css
:root {
  --color-bg: #111111;
  --color-text: #F0EDE6;
  --color-accent: #C8C4BC;
  --color-surface: #1E1E1E;
}
```

### Pill button
```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  border: 1.5px solid var(--color-text);
  background: var(--color-text);
  color: var(--color-bg);
  cursor: pointer;
  transition: opacity 150ms ease;
}
.btn:hover { opacity: 0.85; }

.btn--outline {
  background: transparent;
  color: var(--color-text);
}
```

### Article card (WIP pattern)
```html
<article class="card">
  <h2 class="card__title">Why Europe doesn't have a Tesla</h2>
  <p class="card__byline">Words by <strong>Pieter Garicano</strong></p>
  <hr class="card__rule">
  <p class="card__excerpt">Europe's cutting edge firms are falling far behind the American frontier because of restrictive labor laws.</p>
  <a class="card__readmore" href="#">Read more →</a>
  <hr class="card__rule">
  <span class="card__tag">Failure costs</span>
</article>
```
```css
.card {
  border: 1px solid var(--color-text);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.card__title {
  font-family: var(--font-serif);
  font-size: clamp(1.25rem, 2vw, 1.75rem);
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 6px;
}
.card__byline {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 300;
  margin-bottom: 12px;
}
.card__byline strong { font-weight: 700; }
.card__rule {
  border: none;
  border-top: 1px solid var(--color-text);
  margin: 12px 0;
}
.card__excerpt {
  font-family: var(--font-serif);
  font-size: 0.9rem;
  color: color-mix(in srgb, var(--color-text) 65%, transparent);
  flex: 1;
}
.card__readmore {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: right;
  text-decoration: none;
  color: var(--color-text);
  margin-top: 12px;
}
.card__tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 300;
  letter-spacing: 0.02em;
}
```

### Article page header
```css
.article-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--color-text);
  padding-bottom: 8px;
  margin-bottom: 40px;
}
.article-header__byline {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  border-bottom: 2px solid var(--color-text); /* short underline under byline */
  padding-bottom: 4px;
  align-self: end;
}
.article-header__date {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  text-align: right;
  align-self: start;
}
.article__title {
  font-family: var(--font-serif);
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin-bottom: 32px;
}
.article__standfirst {
  font-family: var(--font-serif);
  font-size: clamp(1.25rem, 2.5vw, 1.75rem);
  font-weight: 400;
  line-height: 1.4;
  max-width: 38ch;
  margin-bottom: 48px;
  border-bottom: 1px solid var(--color-text);
  padding-bottom: 32px;
}
.article__body {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 40px;
}
/* Left column: empty or footnotes */
/* Right column: body text */
.article__body p {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  line-height: 1.65;
  max-width: 65ch;
}
```

### Hero section with layered object
```css
.hero {
  position: relative;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8vw;
}

.hero__object {
  position: absolute;
  /* Position to intersect with the headline — adjust per project */
  top: 35%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2; /* Sits above text */
  pointer-events: none;
  width: clamp(200px, 25vw, 500px);
}

.hero__headline {
  position: relative;
  z-index: 1;
}
```

---

## Checklist Before Delivering Any Design

- [ ] Headline uses fluid sizing with `clamp()` and fills the content width
- [ ] Palette uses max 3 colours; no bright/saturated accents
- [ ] Section padding is generous (≥80px vertical)
- [ ] Buttons are pill-shaped, high-contrast, no gradients (default); sharp rectangles are a valid alternative for print-style contexts
- [ ] Navigation is minimal — no heavy header chrome; consider two-bar pattern for publications
- [ ] No decorative elements (no drop shadows, gradients, busy textures)
- [ ] CSS custom properties used for all tokens
- [ ] Semantic HTML used throughout
- [ ] If a publication/content site: consider the serif+mono two-register system (serif for content, mono for metadata) as a strong default option
- [ ] Article cards follow the anatomy: title → byline → rule → excerpt → "Read more →" → rule → tag
- [ ] Article pages use an asymmetric grid with a left margin column for a printed-page feel
- [ ] Editorial imagery preference: paintings, engravings, technical illustrations over stock photography
