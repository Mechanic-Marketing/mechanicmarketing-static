# Brief B — MM Design Refinements (Static Site)

**Date applied:** 2026-05-01  
**Files:** `index.html`, `css/global.css`

---

## Change 1 — Section labels

Added `.section-label` CSS rule to `global.css`.

Added `<span class="section-label">` as first child of each section heading wrapper:

| Section | Label text |
|---|---|
| Services | `SERVICES · 01` |
| How It Works | `PROCESS · 02` |
| Case Studies | `RESULTS · 03` |
| Testimonial | `CLIENTS · 04` |
| Pricing | `INVESTMENT · 05` |

---

## Change 2 — Hero floating stat badge

Added `.hero-stat-badge`, `.hero-stat-number`, `.hero-stat-label` CSS to `global.css`.

Added `position: relative` inline style to `.hero-img` wrapper (already set in `components.css`, inline is redundant but harmless).

Added `.hero-stat-badge` HTML block after `<img>` in the hero right column.

---

## Change 3 — Step timing badges

Added `.step-badge` base CSS and `.section-light .step-badge` light-variant CSS to `global.css` (`.step-badge` was absent from scaffold — base style added alongside light variant).

Added `class="section-light"` to the `<section class="process">` wrapper.

Step badges added:

| Step | Badge text |
|---|---|
| We audit | `Day 1 · 30 min` |
| We build | `Days 2–5` |
| We launch | `Day 7 · Live` |
| You grow | `Ongoing` |

---

## Change 4 — Footer tagline

Added `<p class="footer-tagline">Built for the pit lane.</p>` after copyright `<p>` in `.ft-bot`.

Added `.footer-tagline` CSS and `.ft-copy p { margin: 0; }` reset to `global.css`.

---

## Change 5 — Pricing comparison table accent

Added `.comparison-table` column accent CSS to `global.css`. Table not yet in `index.html` — CSS is ready for `pricing.html` content migration.
