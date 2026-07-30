#!/usr/bin/env node
/**
 * build-pages.js — make the site work as plain static files (GitHub Pages).
 *
 * server.js does two things at request time that a static host cannot:
 *   1. injects partials/header.html + partials/footer.html into every page
 *   2. resolves clean URLs  (/about-us -> about-us.html)
 *
 * This bakes both into the HTML files in place:
 *   - partials are written between BEGIN/END marker comments, so re-running
 *     the script REPLACES the previous injection instead of stacking copies
 *   - each built page gets <!-- no-site-header --> / <!-- no-site-footer -->,
 *     which server.js already honours as a per-page opt-out — so `node
 *     server.js` keeps working locally with no double headers
 *   - root-absolute links become relative and gain their .html extension, so
 *     the site also works from a project subpath (dahy1.github.io/Selcouth/)
 *
 * Run after editing partials/header.html or partials/footer.html:
 *   node tools/build-pages.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HEADER = path.join(ROOT, 'partials', 'header.html');
const FOOTER = path.join(ROOT, 'partials', 'footer.html');

const MARK = (what, edge) => `<!-- ${edge} build-pages:${what} — generated, edit partials/${what}.html -->`;

// Clean URL -> file, matching server.js's resolveFile(). Query strings and
// fragments ride along untouched.
function toStaticHref(href) {
  if (href === '/') return 'index.html';
  const m = /^\/([^?#]*)([?#].*)?$/.exec(href);
  if (!m) return href;
  const [, p, tail = ''] = m;
  if (fs.existsSync(path.join(ROOT, p))) return p + tail;           // real file (images/…)
  if (fs.existsSync(path.join(ROOT, p + '.html'))) return p + '.html' + tail;
  return p + tail;
}

function relativise(html) {
  return html.replace(/\b(href|src)="(\/[^"]*)"/g, (_, attr, href) => `${attr}="${toStaticHref(href)}"`);
}

// Strip a previous injection so the script is idempotent.
function stripBlock(html, what) {
  const re = new RegExp(
    MARK(what, 'BEGIN').replace(/[.*+?^${}()|[\]\\—]/g, '\\$&') +
      '[\\s\\S]*?' +
      MARK(what, 'END').replace(/[.*+?^${}()|[\]\\—]/g, '\\$&'),
    'g'
  );
  return html.replace(re, '');
}

function wrap(what, body) {
  return `\n${MARK(what, 'BEGIN')}\n${body}\n${MARK(what, 'END')}\n`;
}

const header = relativise(fs.readFileSync(HEADER, 'utf8'));
const footer = relativise(fs.readFileSync(FOOTER, 'utf8'));

const pages = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith('.html'))
  .sort();

let built = 0;
for (const file of pages) {
  const abs = path.join(ROOT, file);
  let html = fs.readFileSync(abs, 'utf8');

  html = stripBlock(html, 'header');
  html = stripBlock(html, 'footer');
  html = relativise(html);

  // --- header: right after the real <body> (the first one past </head>) ---
  const headEnd = html.search(/<\/head\s*>/i);
  const bodyRe = /<body\b[^>]*>/gi;
  bodyRe.lastIndex = headEnd >= 0 ? headEnd : 0;
  const bodyTag = bodyRe.exec(html);
  if (!bodyTag) {
    console.warn(`  skip ${file} — no <body>`);
    continue;
  }
  const at = bodyTag.index + bodyTag[0].length;
  html = html.slice(0, at) + wrap('header', header) + html.slice(at);

  // --- footer: only where the page has no <footer> of its own (server.js rule).
  // Checked against the page as it was BEFORE this injection. ---
  const hadOwnFooter = /<footer[\s>]/i.test(stripBlock(html, 'header'));
  if (!hadOwnFooter) {
    const idx = html.toLowerCase().lastIndexOf('</body>');
    const block = wrap('footer', footer);
    html = idx === -1 ? html + block : html.slice(0, idx) + block + html.slice(idx);
  }

  // --- tell server.js not to inject again on top of the baked-in copies ---
  if (!/<!--\s*no-site-header\s*-->/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n    <!-- no-site-header -->\n    <!-- no-site-footer -->`);
  }

  fs.writeFileSync(abs, html);
  console.log(`  ${file}${hadOwnFooter ? '  (own footer kept)' : ''}`);
  built++;
}

console.log(`\nbuilt ${built} page(s)`);
