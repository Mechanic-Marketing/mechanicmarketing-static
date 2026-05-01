# CLAUDE.md — mechanicmarketing-static

> Read this file at the start of every session before doing any other work.

---

## What this repo is

The Mechanic Marketing website (`mechanicmarketing.co`) rebuilt as static HTML on Cloudflare Pages.
No framework, no build step, no npm. Plain HTML + CSS + a `functions/` directory for Cloudflare
Pages Functions (contact form, etc.).

**Live preview:** mechanicmarketing.calm-thunder-d72d.workers.dev
**Production (post-cutover):** mechanicmarketing.co
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
