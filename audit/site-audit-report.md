# Mechanic Marketing — Site Audit Report
**Date:** 2026-05-02
**Auditor:** Claude Code
**Repo:** teddi-coder/mechanicmarketing-static
**Branch audited:** main

---

## Summary scorecard

| Layer | Status | Critical issues | Warnings |
|---|---|---|---|
| Technical | 🟡 | 1 | 4 |
| Analytics & tracking | 🔴 | 2 | 1 |
| Content & SEO | 🟡 | 0 | 4 |

---

## 1. Technical findings

### 1a. Broken internal links
✅ Pass — all `href="/"` targets resolve to a file on disk. Every internal link (47 unique paths checked) maps to an existing `.html` file or `index.html` inside a directory.

Note: `/industries/heavy-vehicle.html` and `/industries/auto-ac.html` exist on disk but are **not listed in any footer nav** (footer only shows Diesel, European, 4x4, American Trucks, Mobile Mechanic). These pages are reachable only via direct URL or the industries index.

### 1b. Broken asset references
All local CSS (`/css/global.css`, `/css/components.css`), JS (`/js/main.js`), and favicon assets (`/assets/mm-icon.svg`, `/assets/favicon.png`) resolve correctly on disk.

**Warning — staging domain used for production images.** 50+ `<img src="">` values point to `https://staging.mechanicmarketing.co/wp-content/uploads/...`. Affected file groups:

| Group | File count |
|---|---|
| Case study hero images | 4 (`bb-garage`, `accelerate-automotive`, `core-diesel`, `busselton-automotive`) |
| Case studies index cards | 4 |
| Blog post hero images | 20 blog posts |
| Blog index card images | 23 |

These will break in production if the staging WP instance is taken down or if staging domain changes. Images should be migrated to `/assets/images/` or a CDN under `mechanicmarketing.co`.

### 1c. External links
No external `href="http..."` links found in any HTML file. ✅ Pass (note: all external image `src` refs are via HTTPS — covered in 1b above).

### 1d. Google Fonts leaking in
✅ Pass — no `fonts.googleapis.com` or `fonts.gstatic.com` references found in any HTML or CSS file. TT Commons Pro is fully self-hosted.

### 1e. Missing alt attributes
✅ Pass — no `<img>` tag was found with a missing or empty `alt` attribute. The earlier grep false-positives were caused by multi-line tag formatting; all alt values are populated. All case study and blog hero images have descriptive alt text.

### 1f. Logo marquee opacity
✅ Pass — `.logos-row img` in `css/components.css` (line 343) sets `opacity: 0.6`, which matches the specified requirement exactly.

```css
.logos-row img {
  height: 36px;
  opacity: 0.6;          /* ✅ correct */
  filter: grayscale(100%);
  transition: all 0.3s;
}
```

### 1g. Console-error-prone patterns

**Warning — MailChannels free tier removed.** `functions/contact.js` sends via `https://api.mailchannels.net/tx/v1/send` with no DKIM signing configuration. MailChannels removed their free Cloudflare Workers integration in April 2024; unauthenticated sends will likely fail silently or be rejected. No `dkim_domain`, `dkim_selector`, or `dkim_private_key` personalisation fields are present in the payload.

**Warning — admin/index.html is publicly accessible with no auth.** The Decap CMS admin at `/admin/` loads `decap-cms.js` from unpkg CDN. There is no `_headers` file setting auth headers and no Cloudflare Access rule visible in this repo. The `admin/config.yml` is also publicly readable. Recommend adding Cloudflare Access protection or confirming that Decap CMS's own Git Gateway auth is sufficient.

**Warning — inconsistent `defer` on `<script src="/js/main.js">`.** Newer blog posts (e.g., `market-european-car-mechanic.html`, `facebook-ads-for-a-mechanic-workshop.html`, `market-dyno-tuning.html`, `tactics-for-growing-auto-repair-chains.html`, `auto-repair-shops-waste-marketing.html`, `google-ads-landing-page-for-mechanics.html`) use `<script src="/js/main.js" defer>` while all other pages load it without `defer` at the bottom of `<body>`. The inconsistency is harmless but messy — either approach is fine, but it should be uniform.

### 1h. CSS custom property mismatches
✅ Pass — all `var(--x)` references used in `css/global.css` and `css/components.css` have corresponding definitions in the `:root` block.

Defined-but-unused variables (not an error, but may indicate dead code):

| Variable | Likely purpose |
|---|---|
| `--mm-golden` | Alternate accent colour, unused |
| `--mm-orange-t3` | Tint level 3, unused |
| `--mm-orange-t4` | Tint level 4, unused |
| `--sp-xxs` | Extra-extra-small spacing, unused |
| `--t1` | Unknown — possibly text opacity, unused |
| `--g` | Unknown — possibly gap or grid, unused |

Inline HTML `var()` usage (from `style=""` attributes) was also checked — all reference defined variables.

### 1i. Favicon
✅ Pass — both favicon files exist on disk and are wired up correctly in all pages:

- `/assets/mm-icon.svg` — exists
- `/assets/favicon.png` — exists

All audited pages include:
```html
<link rel="icon" type="image/svg+xml" href="/assets/mm-icon.svg">
<link rel="icon" type="image/png" sizes="200x200" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/favicon.png">
```

### 1j. robots.txt and sitemap.xml
**Warning — both missing.** Neither `robots.txt` nor `sitemap.xml` exists at the repo root. Cloudflare Pages will serve a 404 for both.

- `robots.txt` missing means crawlers operate without guidance (not blocking, but unprofessional and a mild SEO concern).
- `sitemap.xml` missing means Google cannot efficiently discover all 46 HTML pages; manual submission or GSC sitemap entry is the only path.

---

## 2. Analytics & tracking findings

### 2a. GA4 tag presence
**Critical — no analytics tag found anywhere.** Zero references to `G-`, `gtag`, `googletagmanager`, or `GTM-` in any HTML file. The site is live (or soon will be) with no measurement in place. No page views, sessions, or user data is being collected.

### 2b. Conversion events
**Critical — no conversion tracking.** No `gtag('event', ...)` or `dataLayer.push` calls exist in any HTML or JS file. No form submission events, call click events, or CTA click events are tracked.

### 2c. Phone number tracking
**Warning — no `tel:` links anywhere on the site.** The contact page only offers a form and email. There is no clickable phone number anywhere in the codebase. This is either intentional (phone-free brand) or an omission — if a phone number is ever added, `href="tel:..."` click tracking should be wired up.

### 2d. Form audit
One form exists: `contact.html` — `<form class="contact-form" id="contact-form" action="/contact" method="POST" novalidate>`.

The form collects: full name, email, phone, workshop name, website URL, monthly revenue, message.

Form submission JS is inline in `contact.html` (lines ~190–230). It uses `fetch('/contact', ...)` and handles success/error states with DOM updates. The handler in `functions/contact.js` sends to `hello@mechanicmarketing.co` via MailChannels. No conversion event fires on successful submission (ties back to 2b above).

---

## 3. Content & SEO findings

### 3a. Page inventory
46 HTML pages total across 7 directories:

| Section | Count |
|---|---|
| Root pages | 4 (`index`, `about`, `contact`, `pricing`) |
| Services | 4 |
| Industries | 8 |
| Case Studies | 5 (4 individual + index) |
| Blog | 24 (23 posts + index) |
| Admin | 1 |

All pages have a `<title>` tag. Title format is consistent: `[Page Name] — Mechanic Marketing`.

### 3b. Title tags
✅ Pass — all 45 content pages have unique, descriptive title tags in the correct format. Blog titles are specific and keyword-rich. No duplicate titles found.

Note: `admin/index.html` title is `Mechanic Marketing CMS` — this is fine but should be excluded from sitemaps.

### 3c. Meta descriptions
**Warning — 23 of 23 blog posts are missing meta descriptions.** All non-blog pages (root, services, industries, case studies) have meta descriptions. All blog posts lack them entirely.

Pages missing meta descriptions (full list):
- All 23 blog post `.html` files under `/blog/` (excluding `blog/index.html` which has one)

This affects click-through rates from Google SERPs as Google will auto-generate snippets from body content.

### 3d. H1 structure
✅ Pass — every content page has exactly one `<h1>`. H1 text is unique, descriptive, and appropriate for each page context.

Note: `admin/index.html` has no `<h1>` — this is expected for a CMS admin page.

### 3e. Canonical tags
**Warning — no canonical tags on any page.** Zero `rel="canonical"` references found across the entire site. At launch, this creates risk of duplicate content issues if:
- Cloudflare serves pages at both `mechanicmarketing.co` and `www.mechanicmarketing.co`
- The old WP site remains indexed during cutover
- Any trailing-slash / non-trailing-slash URL variants are served

Canonical tags should be added to all pages before launch.

### 3f. Open Graph tags
**Warning — no Open Graph tags on any page.** Zero `og:title`, `og:description`, or `og:image` tags found across the entire site. When pages are shared on social media (LinkedIn, Facebook, etc.), no rich preview will be rendered — just a plain URL. Given this is a marketing agency site, this is a meaningful gap.

### 3g. Structured data
**Warning — no structured data found.** Zero `application/ld+json` blocks exist on any page. For a local marketing agency:
- `LocalBusiness` or `ProfessionalService` schema on the homepage/contact page would help local SEO
- `Article` schema on blog posts would improve SERP presentation
- `FAQPage` schema — multiple service and industry pages contain FAQ sections with question/answer markup that could benefit from this

### 3h. NAP consistency
**Partial pass.** The business name "Mechanic Marketing" and email `hello@mechanicmarketing.co` are used consistently wherever they appear. No physical address or phone number is published on the site (appears intentional for a remote agency). Copyright footer consistently reads `© 2026 Mechanic Marketing. All rights reserved.` across all pages. No inconsistencies found in what is present.

---

## Prioritised fix list

| Priority | Issue | Layer | File(s) | Effort |
|---|---|---|---|---|
| P0 — Critical | No GA4 tag — site launches with zero measurement | Analytics | All HTML pages | S — add GTM snippet to `<head>` template |
| P0 — Critical | No conversion tracking — form submissions untracked | Analytics | `contact.html`, `js/main.js` | S — add `gtag('event')` on form success |
| P0 — Critical | MailChannels DKIM missing — contact form emails likely failing | Technical | `functions/contact.js` | M — add DKIM fields or switch to Resend/SendGrid |
| P1 — High | Staging domain images (`staging.mechanicmarketing.co`) — will break at WP cutover | Technical | All case study pages, all blog pages, `index.html` | L — migrate ~50 images to `/assets/` or CDN |
| P1 — High | No canonical tags — duplicate content risk at domain cutover | SEO | All 45 content pages | M — add `<link rel="canonical">` to each page |
| P1 — High | No OG tags — no social sharing previews | SEO | All 45 content pages | M — add og:title/description/image per page |
| P2 — Medium | No robots.txt — crawlers unguided | Technical | Repo root | XS — create single file |
| P2 — Medium | No sitemap.xml — Googlebot cannot discover all pages | Technical | Repo root | S — generate 46-URL sitemap |
| P2 — Medium | 23 blog posts missing meta descriptions | SEO | `/blog/*.html` (23 files) | M — write and add to each post |
| P2 — Medium | Admin page (`/admin/`) publicly accessible with no auth | Technical | `admin/index.html` | S — add Cloudflare Access rule or `_headers` |
| P3 — Low | No structured data (LocalBusiness, Article, FAQPage) | SEO | Homepage, contact, blog posts, FAQ pages | M — add JSON-LD blocks |
| P3 — Low | `heavy-vehicle` and `auto-ac` industry pages absent from footer nav | Technical | All pages with footer | XS — add 2 links to footer nav template |
| P3 — Low | 6 defined-but-unused CSS variables | Technical | `css/global.css` / `css/components.css` | XS — remove dead vars |
| P3 — Low | Inconsistent `defer` on `<script src="/js/main.js">` | Technical | 6 blog posts | XS — normalise |

---

## Known pending items (exclude from fix list)

The following issues are already addressed by open PRs and should not be re-raised or bundled:

- **PR #3 — nav-css-dedup:** Deduplication of navigation CSS; nav structure and `.site-header` class consistency work
- **PR #4 — css-consolidation:** CSS architecture consolidation between `global.css` and `components.css`; any CSS variable or selector overlap findings from 1h may be covered here
- **PR #5 — html-spots (current branch):** H1 spacing, case study hero spacing, `opacity` → `rgba()` replacements — the `opacity: 0.75` inline style on `services/consultant.html:44` is likely in scope for this PR
