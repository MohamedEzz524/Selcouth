# Nudot — local static clone

A faithful local mirror of **https://nudot.com.tw/** (核點設計 NUDOT), captured for
local development / testing. Static HTML/CSS/JS + media, served with a tiny Node
server that reproduces the site's clean-URL routing.

## Run it

```bash
node server.js
# -> http://localhost:8123
# change port:  PORT=9000 node server.js
```

The server maps clean URLs the same way the live site does:

| URL                              | File                                   |
|----------------------------------|----------------------------------------|
| `/`                              | `index.html`                           |
| `/about`, `/work`, `/lab` …      | `about.html`, `work.html`, `lab.html`  |
| `/work_camp` … `/work_ourattan`  | `work_<name>.html`                     |
| `/blog`                          | `blog.html` (listing)                  |
| `/blog/<slug>`                   | `blog/<slug>.html`                     |
| `/images/…`, `/vendor/…`         | served as-is                           |

Video files are served with HTTP Range support so the WebGL video textures and
`<video>` backgrounds stream exactly like the live site.

## Project structure

```
.
├── index.html                 # home  (served at /)
├── about.html  contact.html  lab.html  work.html  blog.html
├── work_*.html                # 10 case-study pages (camp, cnc, co, food, nod,
│                              #   oil, machine, sun, beauty, ourattan)
├── blog/                      # 10 blog articles  (/blog/<slug>)
├── css/                       # 5 site stylesheets
│   ├── cursor-shared.css   nav-menu-shared.css   page-transitions.css
│   └── project-creative-process.css   work_cont.css
├── js/                        # 5 site scripts
│   ├── transitions.js   noise.js   cursor-shared.js
│   └── project-creative-process.js   work_cont.js
├── images/                    # 315 media files (~254 MB) — WebP, SVG, MP4
├── vendor/                    # offline copies of the CDN libraries
├── tools/                     # fetch-assets.sh + assets_all.txt (re-sync helpers)
├── server.js                  # local clean-URL static server
├── robots.txt   sitemap.xml   README.md
```

Page HTML stays at the root on purpose: the clean-URL routing (`/about` → `about.html`)
and the inter-page links (`href="work_camp"`) depend on it. Inline `<style>`/`<script>`
blocks remain inline in each page, exactly as the original. `images/` keeps its name
because the site's JS builds those paths as literal strings.

## Known differences from the live site

These are intentional/unavoidable, not bugs in the copy:

1. **Adobe Typekit fonts** (`forma-djr-mono`, `komet`, `lores-12`) still load from
   `use.typekit.net`. The kit is licensed to Adobe's CDN and domain-locked, so it is **not**
   self-hosted here. Online, fonts load normally; fully offline they fall back to `sans-serif`.
2. **CDN libraries** are still linked from their CDNs in the HTML (most faithful to the
   original). Offline copies exist in `vendor/` if you want to switch the `<script>` tags.
3. **Google Analytics (GA4 `G-N53QVZL8TL`)** is still in the HTML and points at the original
   property. Remove those two `<script>` tags in each page if you don't want the local copy
   sending pageviews.
4. **9 asset references 404** (`images/home/banner05.mp4`, `banner01.webp`, `work/star.mp4`,
   `about/box1.mp4`, `core-capabilities/ring/0{1,2,3}.jpg`) — these are dead links **on the
   live server too**; the site's own JS has fallbacks, so behavior matches the original.

## Re-syncing with the live site

`tools/assets_all.txt` lists every asset referenced across all pages + CSS. To re-pull
anything missing or updated, run from the project root:

```bash
bash tools/fetch-assets.sh
```
