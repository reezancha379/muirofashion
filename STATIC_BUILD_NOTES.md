# MUIRO static build notes

- `npm run build:static` is the production static build.
- Netlify publishes `site/`.
- Vite generates hashed assets under `site/assets/`.
- `site/index.html` must never reference `/src/main.tsx`.
- Self-hosted fonts are copied to `site/fonts/`.
- Static data is baked into `site/content-snapshot.json`.
- `src/lib/staticData.ts` uses a relative snapshot URL so the generated `site/`
  can also be previewed from VS Code's static/Live Server tooling.
- `Hero.tsx` exports only the React component; hero slide data/helpers live in
  `src/data/heroSlides.ts`, avoiding Fast Refresh export incompatibility.
- Hero autoplay uses one interval per pause/slide-count state rather than
  recreating the timer on every slide transition.
