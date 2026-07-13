// Idempotent pass: adds the persistent Mechanic Marketing sales-agent chat
// widget (floating launcher + panel) to every page under public/, right before
// </body>. Safe to re-run - skips files that already have the marker.
//
// Skips sales-agent.html itself - that page already IS the full chat
// experience, so a floating launcher on top of it would be redundant.
//
// Usage: node scripts/add-sales-agent-widget.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MARKER = 'sales-agent-widget.js';
const WIDGET_TAG = '<script src="/js/sales-agent-widget.js?v=1" defer></script>';
const SKIP_FILES = new Set([path.join(PUBLIC_DIR, 'sales-agent.html')]);

function findHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

let touched = 0;
let skippedAlready = 0;
let skippedNoBody = 0;
let skippedExcluded = 0;

for (const file of findHtmlFiles(PUBLIC_DIR)) {
  if (SKIP_FILES.has(file)) {
    skippedExcluded++;
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');

  if (content.includes(MARKER)) {
    skippedAlready++;
    continue;
  }

  const lastBodyClose = content.lastIndexOf('</body>');
  if (lastBodyClose === -1) {
    skippedNoBody++;
    continue;
  }

  const updated =
    content.slice(0, lastBodyClose) +
    WIDGET_TAG + '\n' +
    content.slice(lastBodyClose);

  fs.writeFileSync(file, updated);
  touched++;
}

console.log(`Added widget script to ${touched} file(s).`);
console.log(`Skipped ${skippedAlready} file(s) already containing the marker.`);
console.log(`Skipped ${skippedExcluded} excluded file(s) (sales-agent.html).`);
console.log(`Skipped ${skippedNoBody} file(s) with no </body> tag.`);
