# MUIRO CMS Architecture

## Runtime modes

### Local development

`server.ts` runs the Express API and frontend on one origin. `data/store.json` is a content-only starter seed. On first run the data store copies seed content into ignored `data/.store.runtime.json`; private authentication state and new analytics belong only in that runtime file. Do not commit the runtime file.

### Production target

- **Netlify static site** serves the public storefront from `site/`.
- **Supabase Edge Function `muiro-api`** handles owner sessions, CMS operations, analytics, uploads, and best-effort visitor events.
- **Supabase Storage bucket `muiro-public`** holds the public `content-snapshot.json` consumed by static builds and visitors.
- **Netlify build hook** refreshes the static site after content changes. The function exposes publication status; the owner UI shows a notice when saving succeeded but a public rebuild was not confirmed.

The private-state, rate-limit, and privilege-hardening migrations were applied in the existing Supabase project, the public snapshot is readable, and the existing Netlify site has browser-safe Supabase build settings. The latest function listing is empty: `muiro-api` is not deployed yet, and no production admin-write test has been completed.

## Content model

- **Products**: shoppable items. Preserve the existing merchant display name and the `merchantId` / `affiliateProgramId` relationships.
- **Categories**: shared, managed labels with stable IDs/slugs, assignment counts, rename propagation, and guarded deletion; product/lookbook labels are projected for static visitors.
- **Merchants**: reusable retail destinations with an optional affiliate-program relationship.
- **Affiliate Programs**: reusable partner/network records with commission and disclosure settings.
- **Lookbooks**: editorial collections that reference product IDs.
- **Hero Slides**: presentation records that may reference a lookbook.
- **Settings and testimonials**: editorial content.
- **Analytics**: measured event records and aggregates; never synthesize impressions, clicks, views, likes, or growth claims.

The owner manages programs and merchants in **Admin Studio → Programs & Merchants**. Product creation uses the merchant list rather than a hard-coded dropdown.

## Public/private boundary

`src/lib/publicSnapshot.ts` is the shared public projection. It whitelists storefront fields, excludes admin-only collections, secrets, session state, event records, and internal notes, zeroes any legacy seeded engagement values, and accepts only valid affiliate destinations. Static visitors render from the resulting snapshot. A visitor without a configured event backend can still use the already-safe affiliate URL immediately; telemetry is best-effort and must never delay retailer navigation.

Owner-only live data requests require an authenticated MUIRO session. Anonymous calls to protected or unknown API paths are rejected before the private CMS row is loaded; authentication and the legacy `/r/:id` redirect are the deliberate public exceptions, and both are rate-limited before state access. Keep Supabase secret/service-role keys, owner PINs, authenticator seeds, recovery values, and private rate-limit state server-side only. The browser may contain only the project URL and publishable key.

## Authentication and abuse controls

- Admin PIN verification and reset are performed server-side; the browser never receives the configured PIN.
- Owner session tokens are signed by the backend, expire, and are stored only in `sessionStorage`; manually locking the studio clears the token as well as the UI marker.
- The production Edge Function gateway is configured with `verify_jwt = false` because MUIRO uses a custom signed owner session, not a Supabase Auth JWT. The function still verifies that session on protected routes; never remove its route-level authorization checks.
- Login/reset protections use durable rate-limit state plus shared minute/day ceilings so client-supplied forwarding headers alone cannot bypass the limits.
- The production Edge Function and static projector use the same fixed affiliate-host allowlist; embedded URL credentials and unsafe schemes are rejected. A new host must be added to both validators and tests; the local Express override is not a production bypass.
- The public storage bucket contains only the public snapshot and approved uploaded media. Private state/rate-limit tables must remain inaccessible to anon/authenticated client roles.

## Visual system and performance

- The public experience uses the source-derived MUIRO system documented in `.stitch/DESIGN.md`: Paper, Ink, Crimson, and Plum anchors; bundled Libre Caslon Text and DM Sans; 8px spacing rhythm; restrained borders and motion.
- The site keeps the existing product imagery, editorial content, wordmark, and visitor journeys. The compact SVG/PNG M favicon uses the same identity.
- The static client reads its JSON snapshot without a visitor-side `/api` probe. Admin/authentication and configured analytics use the shared transport.
- Product/lookbook engagement starts at zero; dashboards report measured activity only and avoid unsupported comparative-growth statements.

## First run and production setup

For local Express development, copy `.env.example`, set a private `MUIRO_ADMIN_PIN`, then run `npm install` and `npm run dev`. Local Express remains available independently of the production function.

For the current project, the migrations, public snapshot object, and Netlify browser-safe URL/publishable-key settings are already present. Remaining Owner Studio setup is to deploy `supabase/functions/muiro-api` with `verify_jwt = false`, verify server-side Function Secrets (including the approved admin PIN and service-role credentials), and configure a build hook on the existing Netlify site as the Supabase Function secret `NETLIFY_BUILD_HOOK_URL`. A GitHub push only triggers the existing Netlify frontend build; it does not deploy Supabase functions. Never put these private values in `VITE_*` variables.

## Verification commands

```bash
npm run lint
npm run test:snapshot
npm run test:client
npm run test:integration
npm run test:integration
npm run build:static
npm run test:static
```

The static E2E test expects `site/` to have been generated by `build:static` first. The public snapshot tests validate the field allowlist and affiliate URL restrictions.
