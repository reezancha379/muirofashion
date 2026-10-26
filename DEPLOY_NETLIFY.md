# Deploying MUIRO to Netlify

MUIRO ships in two modes. Pick whichever you need — the storefront looks the same in both.

| Mode | Command | Publish | Backend? | Admin editing? |
|---|---|---|---|---|
| **Static** (Netlify) | `npm run build:static` | `site/` | No | No — reads snapshot data, saves report a clear message |
| **Full-stack** (local) | `node --import tsx server.ts` | — (port 3000) | Yes (Express + JSON store) | Yes |

## Option A — drag and drop (fastest)

```bash
npm run build:static
```

Then drag the **`site/`** folder onto <https://app.netlify.com/drop>. Done.

## Option B — connect the repo

1. Push the repo to GitHub/GitLab.
2. In Netlify: **Add new site → Import an existing project**.
3. `netlify.toml` already sets the build command and publish directory:
   - build command: `npm run build:static`
   - publish directory: `site/`

## What the static build contains

```
site/
  index.html              entry (hashed asset references)
  assets/                 bundled JS + CSS (correct MIME via _headers/netlify.toml)
  fonts/                  self-hosted woff2 — no Google Fonts request
  favicon.png|.ico|.svg   icons (previously 404)
  hero-*.jpg              hero imagery
  content-snapshot.json   content baked from data/store.json at build time
  _redirects              SPA fallback
  _headers                explicit Content-Type for module scripts
```

## Why the static site still shows content

A static host has no API, and its SPA fallback answers **every** unknown path —
including `/api/*` — with `index.html` and status `200`. Naively treating that
as success would try to `JSON.parse` an HTML page and leave the screen empty.

`src/lib/staticData.ts` probes `/api/health` **once** and requires a 200 *and*
a JSON body to consider a backend present. Without one, reads fall back to
`content-snapshot.json`, so lookbooks, products, hero slides, testimonials and
settings all render. Product clicks fall back to the raw affiliate URL.

Writes are impossible without a server, so they reject with an explicit
message instead of failing as a parse error.

## Regenerating the snapshot

The snapshot is captured from `data/store.json` during the build, so **re-run
the build after editing content** through the admin panel:

```bash
node --import tsx server.ts     # edit content at localhost:3000
# then Ctrl+C and:
npm run build:static            # re-bake the content into site/
```

## Editing content on a deployed site

Not possible — a static host cannot write files. For live editing, run the
full-stack mode instead (it is a single process, no database required):

```bash
node --import tsx server.ts     # NOT `npm run dev` if your folder path contains '&'
```

## Self-hosted fonts

`node fetch-fonts.mjs` re-downloads the font files into `public/fonts/`. The
site loads `/fonts/fonts.css` locally, so there is no `fonts.googleapis.com`
request and no `ERR_NAME_NOT_RESOLVED` console error when offline.

## Not using Netlify?

Any static host works as long as it (1) publishes `site/`, (2) falls back to
`index.html` for unknown paths, and (3) serves `.js` as `text/javascript`.


## VS Code static preview

The repository root `index.html` is the Vite development entry and intentionally
contains `/src/main.tsx`. Do not open that source entry directly with a generic
static preview.

To preview the actual production artifact from VS Code:

```bash
npm run build:static
```

Then open the generated `site/index.html` with a static-file server/Live Server
whose document root is the `site/` directory. The generated site uses relative
asset URLs (`./assets`, `./fonts`, `./content-snapshot.json`) so it does not
depend on the Vite dev server.

The Netlify deployment publishes that same `site/` directory.
