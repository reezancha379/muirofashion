# MUIRO - Shoppable Fashion Lookbook & Affiliate Studio

A static React storefront deployed on Netlify. The production build uses the
tracked products, lookbooks and hero images, without requiring a running API.
The legacy `server.ts` references backend modules that are not present in this
repository; that server and its admin studio are not part of the static deploy.

## Production Build

**Prerequisites:** Node.js 22+ and Python 3 for the browser verification server.

```sh
npm ci
npm run build:static
npm run verify:static
```

Netlify runs `npm run build:static` and publishes **`site/`**, as configured in
`netlify.toml`. Both `npm run build` and `npm run build:static` use the same
production pipeline.

The root `index.html` is a Vite **source entry**, never a deploy artifact. Vite
transforms it into `dist/index.html` with hashed `/assets/*.js` and
`/assets/*.css` references. The build verifies those files, copies the complete
Vite output into `site/`, adds the content snapshot and existing static pages,
then verifies the final output again. It prints the exact final HTML in the
build log and removes `site/` on failure to prevent publishing stale output.

The client stylesheet imports real self-hosted fonts from `src/fonts/`. Vite
emits their hashed files into `assets/`; there is no runtime request for
`/fonts/fonts.css`. Font assets are tracked, so production builds do not
depend on a font download service. `node fetch-fonts.mjs` refreshes them when
needed. Hero images and the favicon are included in the publish directory.

Do not upload the repository root or select `.` as the publish directory.
Neither the development server nor the legacy Express server verifies a
Netlify artifact.

## Verify The Publish Directory

```sh
npm run lint
npm run test:artifact
npx playwright install chromium
npm run test:static
```

The browser test refuses to start unless `site/` passes artifact verification.
It starts `python3 -m http.server` against exactly `site/` on port 8889, then
checks React rendering, generated JavaScript and CSS, real font loading, the
hero image, local network failures and forbidden development requests.

For manual inspection of the same static output:

```sh
python3 -m http.server 8889 --bind 127.0.0.1 --directory site
```

Open `http://127.0.0.1:8889` and inspect the browser Network panel. After the
production deploy finishes, repeat the checks on the live production domain:
its source must use hashed assets, and every referenced local asset must load.
A successful local check alone is not proof that production has been fixed.
The same browser checks can target production without starting a local server:

```sh
STATIC_TEST_URL=https://muirofashion.netlify.app npm run test:static
```
