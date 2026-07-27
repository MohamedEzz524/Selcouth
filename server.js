// Minimal static server that mirrors nudot.com.tw's clean-URL routing:
//   /              -> index.html
//   /about         -> about.html
//   /work_camp     -> work_camp.html
//   /blog          -> blog.html            (listing page; file wins over blog/ dir)
//   /blog/<slug>   -> blog/<slug>.html
//   /images/...    -> served as-is (exact file match)
// Serves correct MIME types incl. video (mp4/webm) with Range support so
// the WebGL video textures / <video> elements stream like on the live site.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8123;

// Shared site header, injected into every HTML page (React-style global layout).
// Edit partials/header.html once; every page updates. Re-read per request so
// edits show up without restarting the server.
const HEADER_PARTIAL = path.join(ROOT, 'partials', 'header.html');
function injectSiteHeader(html, file) {
  if (file === HEADER_PARTIAL) return html;            // never inject into itself
  if (/<!--\s*no-site-header\s*-->/i.test(html)) return html;   // per-page opt-out
  let header;
  try { header = fs.readFileSync(HEADER_PARTIAL, 'utf8'); } catch (_) { return html; }
  // Insert right after the REAL opening <body> tag — i.e. the first <body>
  // that appears AFTER </head>. (Some pages mention "<body>" inside a <head>
  // script/comment; anchoring past </head> avoids injecting into that.)
  const headEnd = html.search(/<\/head\s*>/i);
  const bodyRe = /<body\b[^>]*>/ig;
  bodyRe.lastIndex = headEnd >= 0 ? headEnd : 0;
  const m = bodyRe.exec(html);
  if (!m) return html;
  const at = m.index + m[0].length;
  return html.slice(0, at) + '\n' + header + html.slice(at);
}

// Shared site footer, injected before </body> on any page that doesn't already
// have its own <footer> (so the home page's bespoke footer is left alone).
const FOOTER_PARTIAL = path.join(ROOT, 'partials', 'footer.html');
function injectSiteFooter(html, file) {
  if (file === FOOTER_PARTIAL) return html;
  if (/<!--\s*no-site-footer\s*-->/i.test(html)) return html;   // per-page opt-out
  if (/<footer[\s>]/i.test(html)) return html;                  // page already has one
  let footer;
  try { footer = fs.readFileSync(FOOTER_PARTIAL, 'utf8'); } catch (_) { return html; }
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx === -1) return html + '\n' + footer;
  return html.slice(0, idx) + footer + '\n' + html.slice(idx);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (p === '/' || p === '') return path.join(ROOT, 'index.html');
  p = p.replace(/^\/+/, '');
  const abs = path.join(ROOT, p);
  if (!abs.startsWith(ROOT)) return null;                 // path traversal guard
  // 1. exact existing file (images, css, js, transitions.js, ...)
  try { if (fs.statSync(abs).isFile()) return abs; } catch (_) {}
  // 2. clean URL -> <path>.html  (/about, /work_camp, /blog, /blog/<slug>)
  try { if (fs.statSync(abs + '.html').isFile()) return abs + '.html'; } catch (_) {}
  // 3. directory index
  try { if (fs.statSync(path.join(abs, 'index.html')).isFile()) return path.join(abs, 'index.html'); } catch (_) {}
  return null;
}

http.createServer((req, res) => {
  const file = resolveFile(req.url);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>' + req.url + '</p>');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';

  // HTML: read into memory, inject the shared header, serve with a correct
  // Content-Length. (No Range needed for documents.)
  if (ext === '.html') {
    let html = fs.readFileSync(file, 'utf8');
    html = injectSiteHeader(html, file);
    html = injectSiteFooter(html, file);
    const buf = Buffer.from(html, 'utf8');
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length });
    res.end(buf);
    return;
  }

  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {                    // video streaming support
    const [s, e] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(s, 10);
    const end = e ? parseInt(e, 10) : stat.size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': type,
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  }
}).listen(PORT, () => console.log(`Nudot clone serving at http://localhost:${PORT}`));
