# MUIRO Fix Report — stale frontend, stuck skeleton, hero 4:3 frame (2026-10-11)

Scope: `C:\Users\Reezon Chy\Downloads\muiro-x`
Status: fixed and verified. Real CMS content preserved (only analytics counters
moved, as a natural consequence of actual page loads).

---

## 1. Root cause — "old version still loading" / broken production restart

**`dist/server.cjs` did not exist on disk.** `package.json`'s build was
`vite build && esbuild … --outfile=dist/server.cjs`. `vite build` empties the
whole `dist/` outDir (its default `emptyOutDir`), deleting the previously built
`server.cjs`, and if the esbuild step then does not (re)run, `npm start`
(`node dist/server.cjs`) fails with `Cannot find module dist/server.cjs`. This
is the exact regression documented in `REGRESSION_FIX_REPORT.md` (round 3).

Consequence here: the process listening on port 3000 (PID 13796, started before
the last build) was an **orphan** — it kept answering from the server.cjs it had
loaded into memory, so port 3000 returned HTTP 200 for `/api/*` and `/` while
being **impossible to restart** and serving state from when it started. It also
booted in dev mode because `process.env.NODE_ENV` is unset by npm, so
`node dist/server.cjs` would start the Vite middleware pipeline ("WebSocket
server error: Port 24678 …") instead of the production static+API server.

**Fixes applied**
- `package.json` — split the build into `build:client` (`vite build`) and
  `build:server` (esbuild → `dist/server.cjs`) so the server bundle can be
  regenerated independently and `npm run build` reliably produces both.
  Added `build:server` script.
- `server.ts` — production-vs-dev is now detected robustly: production when
  `NODE_ENV === 'production'` **or** the entry file is `server.cjs`
  (`npm start` → `node dist/server.cjs` → production even though npm sets no
  NODE_ENV). Dev (`tsx server.ts`) still gets the Vite middleware + HMR.
- `server.ts` — production static serving now sends
  `Cache-Control: no-cache, no-store, must-revalidate` on `index.html` so a
  rebuilt bundle is always re-fetched (no stale shell), and hashed `/assets`
  get `max-age=604800`.
- `server.ts` — all `/api/*` responses get `Cache-Control: no-store` so the
  public Hero/Admin never read a stale cached JSON response.

**Verified:** `npm run build` now ends with `dist/server.cjs` present; port 3000
was restarted from the fresh bundle and serves `./assets/index-BU6zOmGZ.js`
with `no-store, must-revalidate, no-cache` on the shell; `/api/*` works.

---

## 2. Root cause — stuck loading skeleton

The source's `App.tsx::loadData` used a single `Promise.all` with three
uncaught reads. Any failure (a rejected fetch, a `JSON.parse('<!doctype …>')`
mismatch on a static host, a hung request) either threw out the whole batch or
hung it: every collection (lookbooks/products/testimonials) was then empty,
there was **no timeout**, no error message and no retry. On a static deployment
that is exactly how "the old version with a loading skeleton" persists.

**Fixes applied (src/App.tsx)**
- Each endpoint loads independently (`safeLoad`): one failing section cannot
  blank the others; on failure it keeps the previously loaded content.
- The whole batch is raced against a 20s timeout, so `isLoading` is guaranteed
  to clear — a hung request can never leave the page permanently stuck.
- Loading / success / partial-failure / total-timeout handled separately; an
  amber banner (with a **Retry** button) appears above the content on any
  problem while the last good content stays on screen.
- Once any content has loaded (`hasContent`), the skeleton is never shown over
  it again — reloads keep the page visible and only the banner communicates
  failures.

**Verified:** headless render of `http://localhost:3000` shows real content and
**no `shimmer-box` skeleton**; hero/lookbooks/footer are present.

---

## 3. Root cause — hero image problem

The Hero used a **2:3 portrait frame** (`max-w-[680px] aspect-[2/3]`) with
`object-contain` + a blurred `object-cover` background. It rendered portrait
sources well but made the hero very tall/narrow on desktop and did not meet the
required **consistent 4:3 presentation frame for all source ratios**.

**Fixes applied (src/components/sections/Hero.tsx)**
- Stable **4:3 frame**: `max-w-[840px] aspect-[4/3]` at every breakpoint — the
  Hero height is identical across slides regardless of source aspect ratio (no
  height jumps / layout shift).
- Foreground image keeps `object-fit: contain` — portrait 2:3, square 1:1,
  3:2, 4:3, 16:9 sources are shown **entirely, never cropped or stretched**;
  unused space is handled by an intentional blurred `object-cover` fill.
- New per-slide image fallback state: primary image → `fallbackImage` → neutral
  placeholder card (title/category) when nothing loads, instead of a blank
  hidden image.
- Accessibility: `role="group"`, `aria-roledescription="carousel"`,
  `aria-label="Featured looks carousel"`, `aria-current` on active dot,
  meaningful `alt` kept. Touch swipe, mouse drag, arrows, dots, autoplay (5.5s)
  and transitions unchanged.

**Verified (CDP measurements on an isolated instance):**

| source ratio | natural | desktop frame | mobile frame | object-fit |
|---|---|---|---|---|
| 2:3 portrait | 0.667 | 840×630 aspect 1.333 | 462×347 aspect 1.333 | contain |
| 1:1 square   | 1.000 | 840×630 aspect 1.333 | 462×347 aspect 1.333 | contain |
| 3:2 landscape| 1.500 | 840×630 aspect 1.333 | 462×347 aspect 1.333 | contain |
| 16:9 wide    | 1.778 | 840×630 aspect 1.333 | 462×347 aspect 1.333 | contain |

Frame aspect is constant 4:3 at both viewports; object-fit is `contain` for
every ratio (nothing cropped, nothing stretched).

---

## 4. Hero Slide CMS integration

Field names match end-to-end (`id`, `image`, `fallbackImage`, `title`,
`tagline`, `category`, `lookId`, `keyPieces`, `isActive`, `order`):
- Server routes: `GET/POST/PUT/DELETE /api/hero-slides`, bulk `PUT
  /api/hero-slides`, `POST /api/upload`, and `/uploads/*` serving.
- Admin form (`AdminManager.tsx`) writes exactly those fields, uploads via
  `ImageFieldWithUpload` → `/uploads/<file>` URL persisted as `image`.

**Verified (isolated instance on port 3211, `MUIRO_DATA_DIR` set — the real
store was never written):**
- `tests/cms-integration.test.ts` → **0 failures** (upload auth + type
  sniffing, upload round-trip, hero slide create/read-back/update/order,
  delete-all persists empty, restore, cleanup).
- `tests/client-e2e.test.ts` (against real production 3000) → **0 failures**:
  client token attach, 401 broadcast, product/lookbook/testimonial/hero
  create+edit+cleanup, bulk reorder, click resolution.
- The 4 real hero slides (`hero-1..4`) are untouched; their images and orders
  still resolve on the public homepage.

---

## 5. Data safety

- `data/store.backup-agent-20261011-084234.json` — explicit backup created
  before any changes.
- After all builds/tests, the real store is byte-identical to that backup for
  every CMS collection (products 8, lookbooks 4, hero slides 4, testimonials 0,
  merchants 3, programs 3, settings, admin credentials). Only analytics
  counters moved (`impressions`, `clicks`) because the headless renders and the
  client test genuinely visited the site (impression) and verified click
  destinations.
- No `/api/reset` was ever called; no records were deleted or overwritten.

---

## 6. Build / type / test results

- `npx tsc --noEmit` → **exit 0**.
- `npm run build` → **exit 0** (client bundle `dist/assets/index-BU6zOmGZ.js` +
  `dist/server.cjs`, both produced).
- `npm run build:static` → **exit 0** (`site/` rebuilt with the new bundle,
  `content-snapshot.json` re-baked from the real store: 4 lookbooks, 8
  products, 4 hero slides, 830 clicks; reference check [true]).
- `tests/cms-integration.test.ts` (isolated) → **0 failures**.
- `tests/client-e2e.test.ts` (production 3000) → **0 failures**.
- Production served assets: shell references `./assets/index-BU6zOmGZ.js`,
  CSS `index-B4vwQ6kZ.css`, `Cache-Control` correct.

---

## 7. How to run

**Development (with HMR):**
```
npm run dev          # => http://localhost:3000  (fallback: http://localhost:5174)
```
(or `PORT=5174 npm run dev` — the diff server the browser is pointed at.)

**Production:** build first, then start:
```
npm run build        # client + dist/server.cjs
npm start            # node dist/server.cjs -> http://localhost:3000
```

**Static (Netlify / VS Code Live Server):**
```
npm run build:static # regenerates site/
# Netlify deploy site/ or open site/index.html with Live Server
```

---

## 8. Remaining notes / limitations

- Pre-existing data quirk (not caused by this work): the store's default
  testimonials array is empty; the first lookbook record is titled "jgjk"
  (test-like content that already existed before this session).
- Analytics counters (`impressions`/`clicks`) advanced during testing; this is
  expected tracking behavior. A write race can occasionally lose a couple of
  counter increments between concurrent persists — content is unaffected.
- `vite build`/`build:static` delete `dist/server.cjs` by design; always end
  with `npm run build:server` (or use `npm run build` which does both) before
  `npm start` — the scripts now make this explicit.
- Headless pixel screenshots were captured but could not be visually inspected
  because the current model does not accept image input; objective CDP geometry
  measurements (above) were used instead.
