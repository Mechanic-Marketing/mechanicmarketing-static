# Brief C — Confirm No Hero Proof Cards (Static Site)

**Date applied:** 2026-05-01  
**Files:** `index.html`, `css/global.css`

---

## Grep results

```
grep -n "proof-card" /Volumes/KINGSTON/mechanicmarketing-static/index.html
# → 0 matches

grep -n "proof-card" /Volumes/KINGSTON/mechanicmarketing-static/css/global.css
# → 0 matches
```

Both files are clean — no proof-card elements or rules present.

---

## Hero right column verification

The `.hero-img` wrapper contains:

- Workshop photo (`<img>`) with `heroZoom` animation (defined in `components.css`)
- `.hero-motif-overlay` — tyre motif SVG overlay
- `.hero-stat-badge` — added in Brief B (Change 2)
- Orange left-border accent — `.hero-img::before` with `background: var(--mm-orange)` in `components.css`

No changes required. Hero is clean and correct.
