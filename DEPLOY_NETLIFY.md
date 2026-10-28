# Deploying MUIRO to Netlify

MUIRO's production target is a static Netlify storefront plus an owner API on Supabase. Local Express development remains available separately. A Netlify deploy is not complete until the Supabase Edge Function, private migrations, browser-safe build settings, and (for automatic publication) a private Netlify build hook are configured.

| Mode | Storefront | Backend | Owner editing |
|---|---|---|---|
| Production | Netlify static CDN (`site/`) | Supabase Edge Function `muiro-api` and private state | Yes, after the Supabase setup below |
| Local development | Vite/Express on one origin | Local Express + ignored runtime JSON state | Yes |

## Production setup

### 1. Prepare the existing Supabase project

1. Apply the migrations in `supabase/migrations/` in version order. The privilege-hardening migration is deliberately versioned after the existing rate-limit migration.
2. Configure these as **Supabase Edge Function secrets**, never as Vite or Git-tracked values:
   - `SUPABASE_URL`
   - one server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
   - `MUIRO_ADMIN_PIN` for initial owner bootstrap
   - optional `MUIRO_MASTER_KEY` only if private recovery is desired
   - `NETLIFY_BUILD_HOOK_URL` for automatic static refresh after a content save
3. Deploy `supabase/functions/muiro-api` using the checked-in function configuration (`verify_jwt = false`). MUIRO uses its own signed owner session; protected routes still perform server-side session checks and rate limiting.
4. Confirm that private state and rate-limit tables are not accessible to `anon` or `authenticated` roles. The public storage bucket is for the allowlisted public snapshot and approved media only.

Production affiliate destinations use a fixed allowlist shared by the Edge Function and the static snapshot projector. Adding a merchant host requires updating both allowlists and the tests; the local Express custom-domain setting is not a production bypass.

### 2. Configure Netlify

`netlify.toml` sets `npm run build:static` and publishes `site/`. Add these build environment variables in Netlify:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or the legacy `VITE_SUPABASE_ANON_KEY` if the project still uses that key format)

Both are browser-visible project configuration. Never set a service-role/secret key, owner PIN, authenticator seed, recovery key, or build-hook URL as a `VITE_*` variable. Netlify builds require `VITE_SUPABASE_URL` specifically because that exact value is compiled into the browser client; a server-only `SUPABASE_URL` is not enough.

### 3. Build and publish

Connect the repository and use the configured Netlify build command, or build locally after setting the public Supabase variables and publish the generated `site/` directory. A configured build fetches the current public `content-snapshot.json` from the `muiro-public` Supabase Storage bucket, projects it through an explicit field allowlist, and fails rather than silently shipping a stale Git seed if the snapshot is unavailable.

For a deliberate first bootstrap where the bucket snapshot does not exist yet, `MUIRO_ALLOW_SEED_SNAPSHOT=true` permits fallback only for an HTTP 404. Do not use it as a routine production fallback; verify the content and create the first published snapshot before relying on live owner edits.

If `NETLIFY_BUILD_HOOK_URL` is configured in Supabase, a successful CMS content save stores the public snapshot and requests a Netlify rebuild. If the snapshot upload or hook cannot be confirmed, the owner studio reports that public publication is pending; the saved database content is not rolled back.

## What a static visitor receives

```text
site/
  index.html
  assets/                  hashed JS and CSS
  fonts/                   self-hosted font files
  favicon.svg              MUIRO monogram
  favicon-32.png
  apple-touch-icon.png
  404.html                 branded not-found page, noindex
  robots.txt               public crawl policy + sitemap reference
  sitemap.xml              canonical public homepage
  llms.txt                 optional plain-text site guide for AI agents
  content-snapshot.json    allowlisted storefront data only
  _headers                 explicit module-script MIME and security headers
```

The static storefront reads its snapshot for products, lookbooks, hero slides, testimonials, and settings. Public visitors do not probe `/api` to render the page. Product links use the sanitized direct affiliate destination immediately; configured telemetry is best-effort. Analytics, private auth data, event logs, and owner-only collections are not included in the snapshot.

## Local development and verification

```bash
npm install
cp .env.example .env        # optional; set a private local MUIRO_ADMIN_PIN
npm run dev
```

For a local seed-based static preview, run `npm run build:static` without Supabase variables, then serve `site/`. With a Supabase URL configured, the builder fetches the remote snapshot. Run `npm run lint` and `npm run test:snapshot`; `npm run test:static` expects the static build to exist first. The client and CMS integration E2E suites require a local Express server; see the test commands in `README.md`.

## Other static hosts and previews

Any static host can serve the generated `site/` directory and bundled `.js` as `text/javascript`. The app uses query-driven views rather than pathname routes, so do not add a wildcard SPA rewrite: unknown paths should return the included `404.html` with HTTP 404. For a VS Code/static preview, serve `site/` as the document root after `npm run build:static`; do not open the Vite source entry as a raw file.
