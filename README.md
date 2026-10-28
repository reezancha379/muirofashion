# MUIRO — Shoppable Fashion Lookbook & Affiliate Studio

MUIRO is a mobile-first fashion editorial storefront with lookbooks, retailer links, and an owner-only content studio. Local development remains available as a single-origin Express application. The production target is a Netlify static storefront backed by a Supabase Edge Function for owner operations and live CMS data.

## Run locally

**Prerequisite:** Node.js 20 or newer.

```bash
npm install
cp .env.example .env   # optional; set a private MUIRO_ADMIN_PIN for local owner access
npm run dev
```

Open the URL printed by the server (normally `http://localhost:3000`). If the port is occupied, the dev server selects a free port; use `PORT=5174 npm run dev` to request a specific port.

For the local Express production build:

```bash
npm run build
npm start
```

The tracked `data/store.json` is a content-only seed. Local runtime credentials, authenticator state, and collected analytics are kept in ignored `data/.store.runtime.json`; do not add that runtime file to Git.

## Production architecture

- **Public storefront:** Netlify serves the prebuilt static site from `site/`. Visitors read an allowlisted public snapshot and do not probe the private API just to render catalog content.
- **Owner/CMS API:** Supabase Edge Function `muiro-api` handles owner authentication, CRUD, analytics, uploads, and public-event collection. Private state and rate-limit data remain in protected Supabase tables; the browser receives only a public Supabase project URL and publishable key.
- **Static refresh:** CMS mutations publish the public snapshot and can invoke a Netlify build hook. If the database save succeeds but a rebuild is not confirmed, the owner studio displays a pending-publication notice.
- **Local fallback:** Express remains the local development/runtime backend; its behavior is separate from the production Edge Function transport.

## Production configuration and release checklist

The repository contains the function, migrations, and static integration, but this continuation has **not** applied migrations, deployed the Edge Function, published to Netlify, or pushed a Git commit. Complete these operator steps in the selected existing Supabase and Netlify projects:

1. Apply the checked-in migrations in `supabase/migrations/` to the existing Supabase project.
2. Set Edge Function secrets in Supabase (never in Vite or tracked files): `SUPABASE_URL`, one server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, and `MUIRO_ADMIN_PIN` for initial owner bootstrap. Configure `MUIRO_MASTER_KEY` only if private recovery is required. Set `NETLIFY_BUILD_HOOK_URL` to the private Netlify build-hook URL to automate static refresh. Production uses a fixed affiliate-host allowlist; adding a host requires updating both validators and their tests, not setting a runtime bypass.
3. Deploy `supabase/functions/muiro-api` with the checked-in gateway setting `verify_jwt = false`. The function uses its own signed MUIRO owner session and route-level checks; this is not permission to leave owner routes unauthenticated.
4. Configure Netlify build environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is browser-safe; do not put `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, owner PINs, TOTP secrets, or recovery values in any `VITE_*` variable.
5. Build and deploy the Netlify site. Netlify builds require the configured Supabase URL and publishable key and fail rather than silently replacing current CMS content with an old Git seed. For an intentional local-only seed preview, use `MUIRO_ALLOW_SEED_SNAPSHOT=true npm run build:static` only when a remote snapshot is not yet available.

If the private Netlify hook is absent or fails, CMS saves remain in Supabase but the static public site may not reflect them until an operator triggers a deploy; the owner-facing notice reports this state.

## Verification

Source checks and public-snapshot tests:

```bash
npm run lint
npm run test:snapshot
```

The client and CMS integration E2E tests require a local Express server and the same test-only PIN in both terminals. Use a disposable PIN, not the production owner credential:

```bash
# Terminal 1
MUIRO_ADMIN_PIN='123456' PORT=3131 HOST=127.0.0.1 npm run dev

# Terminal 2
BASE_URL=http://127.0.0.1:3131 MUIRO_ADMIN_PIN='123456' npm run test:client
BASE_URL=http://127.0.0.1:3131 MUIRO_ADMIN_PIN='123456' npm run test:integration
```

Build and run the static visitor E2E checks:

```bash
npm run build:static
npm run test:static
```

`test:static` expects `site/` to have been built first. `build:static` packages the local sanitized seed when no Supabase URL is configured; with a URL, it fetches and validates the current public Supabase Storage snapshot. Netlify production builds specifically require `VITE_SUPABASE_URL` and the publishable key described above.
