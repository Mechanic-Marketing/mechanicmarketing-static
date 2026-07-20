# CLAUDE.md — mechanicmarketing-static

> Read this file at the start of every session before doing any other work.

---

## Session state — last updated 2026-07-21

### What's live
- **Production:** `mechanicmarketing.co` — domain cutover to Cloudflare Pages is done (June 2026)
- **Deployment:** Cloudflare Pages auto-deploys from `main` on push. No GitHub Actions workflow — `deploy.yml` was removed. Do NOT recreate it.
- **Old Cloudways hosting:** retired. The `mechanicmarketing` Worker at `calm-thunder-d72d.workers.dev` is also stale — ignore it.

### Contact form
- `functions/contact.js` sends via **Resend API** (replaced MailChannels, which was deprecated)
- Requires `RESEND_API_KEY` set in Cloudflare Pages → Settings → Environment variables → Production
- `onRequestPost` only — GET requests fall through to `contact.html` (do NOT add an `onRequest` handler)
- Resend sending domain `mechanicmarketing.co` must be verified in Resend dashboard for emails to deliver
- Also creates a ClickUp task per lead in the **MM Pipeline** list (`901606822314`, status `lead`) — requires `CLICKUP_API_TOKEN` in Cloudflare Pages → Settings → Environment variables → Production. ClickUp failure never blocks the form response; the visitor only sees an error if both Resend and ClickUp fail.

### Conversion tracking — current state (as of 2026-07-21)
- **GTM container:** `GTM-KVCKK93P` / GA4 ID `G-DNK8STLEH3`
- **`booking_conversion`** — fires unconditionally on page load in `public/thanks-for-booking.html` (added PR #76). The Reclaim booking redirect must point to `https://mechanicmarketing.co/thanks-for-booking`. Verify in GTM Preview mode before retiring the legacy trigger.
- **Legacy GTM trigger `Book a Meeting Click`** (Click URL contains "reclaim") — still active as of 2026-07-21. Must NOT be retired until `booking_conversion` is confirmed firing via GTM Preview mode on the live `/thanks-for-booking` URL. Retiring early would zero out booking conversion data.
- **57 pages carry a now-harmless `indexOf('thanks-for-booking')` block** — these are always-false since those pages are never served at that URL. Optional cleanup; do not remove them unless a specific brief covers it.
- **`generate_lead`** — fires on contact form success (`result.success === true`) with `form_name: 'contact'`; also fires on free-audit quiz submit with `form_name: 'free_audit_quiz'` and on free-audit contact section with `form_name: 'free_audit_contact'`. Push uses `form_name`, not `form_id`.
- **`quiz_lead`** — fires inline on free-audit quiz submit (no redirect; stays on `free-audit.html`).
- **`schedule_click`** — fires on the "Book my free audit →" button click in `free-audit.html`.
- **`thanks-for-enquiring.html`** — has no page-load tracking of its own; relies entirely on the submit-time `generate_lead` push from `contact.html`.
- **GTM `generate_lead` tag setup** — brief exists (`brief-mm-gtm-form-submission-tag.md`). Code is live. Still needs manual setup in GTM UI.

### Blog — scheduled posts
- **14 forward-scheduled posts** live in `_scheduled/blog/` (Jul–Oct 2026). Published weekly by GitHub Actions cron (`.github/workflows/publish-scheduled-posts.yml`, runs 22:00 UTC Monday = 08:00 AEST Tuesday).
- Schedule defined in `_scheduled/schedule.json`. Cron copies HTML + SVG to `public/blog/`, injects card HTML into `blog/index.html`, appends sitemap entry, commits to `main`.
- **11 backfill posts** (Sep 2025–Jul 2026) already live in `public/blog/`.
- **Blog post missing** — `blog/index.html` links to `/blog/the-complete-guide-to-automotive-workshop-marketing-in-2026` but the file doesn't exist yet. Link is future-ready.

### Outstanding items
- **Verify `booking_conversion` firing** — use GTM Preview mode on live `/thanks-for-booking` to confirm the push appears in dataLayer, then retire the legacy `Book a Meeting Click` trigger in GTM.
- **Resend domain verification** — if emails aren't arriving, check Resend dashboard for `mechanicmarketing.co` domain status.

### Recent PRs (this codebase)
| PR | Branch | What |
|---|---|---|
| #27 | `new-feature` | Guy's homepage redesign |
| #28 | `fix/blog-featured-link` | Fixed `href="#"` on blog featured article CTA |
| #29 | `fix/contact-form-endpoint` | Replaced placeholder endpoint + added GA4 dataLayer push |
| #30 | `fix/clean-url-links` | Stripped `.html` from 496 internal `href` attributes across 37 files |
| #31 | `fix/contact-form-resend` | Replaced MailChannels with Resend in `functions/contact.js` |
| #72 | `content/blog-batch-1` | Added 11 backfill posts + 14 scheduled posts + cron workflow |
| #73 | `fix/remove-guy` | Removed Guy from team sections on `free-audit.html` and `mechanics-only.html` |
| #75 | `fix/booking-conversion-pathname-mismatch` | Fixed `indexOf('thank-you')` → `indexOf('thanks-for-booking')` in 57 pages (necessary but not sufficient — see PR #76) |
| #76 | `fix/booking-conversion-wrong-file` | Added `booking_conversion` push directly to `thanks-for-booking.html` (the actual fix) |

### Internal link convention
All internal `href` values now use clean URLs (no `.html` extension). Keep this consistent in any new pages or edits. Nav links in the header still use `.html` — do not change those without updating all pages.

---

## What this repo is

The Mechanic Marketing website (`mechanicmarketing.co`) — static HTML served via Cloudflare Pages.
No framework, no build step, no npm. Plain HTML + CSS + a `functions/` directory for Cloudflare
Pages Functions (contact form).

**Production:** mechanicmarketing.co
**Owner:** Teddi Russell

---

## Git workflow — read this first

**Never commit directly to `main`.** Always work on a feature branch and open a PR.

```bash
git checkout main
git pull
git checkout -b fix/<branch-from-brief>
# do the work
git add -A
git commit -m "brief description of change"
git push origin fix/<branch-from-brief>
# open a PR on GitHub
```

Teddi reviews and merges. She does not merge without checking the preview.

---

## Staging via Cloudflare Pages PR previews

Cloudflare Pages automatically builds and deploys every pull request to a unique preview URL:

```
https://<branch-name>.mechanicmarketing-static.pages.dev
```

This is the staging environment. Every PR gets its own live preview URL the moment it is opened.
**Always include the preview URL in the PR description** so Teddi can click through and check it
before merging to main.

Nothing goes to production until Teddi merges the PR.

---

## Working rules

### 1. Always work from a brief
Teddi will paste a brief at the start of each session. Do not freelance — even if you spot
something broken nearby, do not fix it unless the brief covers it. Surface it in the PR
description or as a comment, but don't bundle "while I was in there" changes.

### 2. Always work on a feature branch
The brief specifies the branch name. Use it. If no branch name is specified, use
`fix/<short-descriptor>` or `feat/<short-descriptor>`.

### 3. Always pull `main` before starting
```bash
git checkout main && git pull
```
Ensures you're working from the latest state before branching.

### 4. One brief per branch
Each brief gets its own branch and PR. Don't combine unrelated changes in a single PR —
it makes reviewing harder and rollback messier.

### 5. Include the preview URL in every PR
After pushing, open the PR and add the Cloudflare preview URL to the PR description.
Teddi will use this to review before merging.

### 6. No build step
This repo has no `package.json`, no bundler, no framework. Files are served directly by
Cloudflare Pages. `functions/` contains Cloudflare Pages Functions (plain JS modules,
`export async function onRequestPost(context) { ... }`). Do not add a build step.

---

## CSS architecture

- `css/global.css` — layout, nav, typography, hero, footer, blog post styles
- `css/components.css` — section-level components (cards, grids, case study layouts, etc.)

The canonical nav structure for all pages (including homepage) is:
```html
<header class="site-header">
  <div class="container">
    <a href="/" class="logo nav-logo">
      <span class="nav-mm">MM</span>
      <span class="nav-wm">Mechanic<br>Marketing</span>
    </a>
    <nav class="site-nav">
      <ul>
        <li><a href="/services/google-ads.html">Services</a></li>
        <li><a href="/case-studies/">Case Studies</a></li>
        <li><a href="/pricing.html">Pricing</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/about.html">About</a></li>
      </ul>
    </nav>
    <a href="/contact.html" class="btn btn-primary nav-cta">Get in touch</a>
    <button class="nav-toggle" aria-label="Toggle menu">&#9776;</button>
  </div>
</header>
```

Do not use `<nav class="nav">` — that is the old homepage-only structure and has been deprecated.
