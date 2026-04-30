# Brief: Mechanic Marketing Static Site Scaffold

## Date
2026-04-30

## Project
Mechanic Marketing — complete static HTML site scaffold for Cloudflare Pages hosting.

## Tech Stack
- Pure HTML + CSS + vanilla JS — no frameworks, no build step
- Decap CMS for blog + case study content management
- Cloudflare Pages hosting
- Cloudflare Worker contact form (endpoint placeholder `__CONTACT_FORM_ENDPOINT__`)
- TT Commons font via @font-face from `/assets/fonts/` — system fallback `'Helvetica Neue', Arial, sans-serif`

## Brand Tokens
- `--mm-orange: #FF3D02`
- `--mm-warm-white: #F0F0EC`
- `--mm-dark: #1c1c1a`
- `--mm-golden: #F0AA00`
- Tints: `--mm-orange-t1` through `--mm-orange-t4`
- Display font: TT Commons Condensed
- Body font: TT Commons

## File Structure
```
/
├── index.html
├── pricing.html
├── about.html
├── contact.html
├── services/ (google-ads, seo, lead-generation, consultant)
├── industries/ (index + 7 industry pages)
├── case-studies/ (index + 4 case study pages)
├── blog/ (index)
├── css/ (global.css, components.css)
├── js/ (main.js)
├── assets/ (fonts/, images/, logo/ — placeholder .gitkeep files)
└── admin/ (index.html + config.yml for Decap CMS)
```

## Hard Constraints
- NEVER use `#000000` — all black is `var(--mm-dark)` or `#1c1c1a`
- NEVER invent statistics — use `[STAT]` or `[PLACEHOLDER]`
- NEVER add Google Fonts, CSS frameworks, or JS frameworks
- `__CONTACT_FORM_ENDPOINT__` must remain as literal string
- No analytics scripts
- All service/industry pages need full page shells with hero + 2–3 placeholder sections

## CMS (Decap)
- Backend: GitHub (`teddi-coder/mechanicmarketing-static`, `main` branch)
- Collections: `blog` (create: true) and `case_studies` (create: false, 4 files)
- Media folder: `assets/images/uploads`

## Git
- Repo: `teddi-coder/mechanicmarketing-static` (public)
- Initial commit: "scaffold: initial static site structure"
