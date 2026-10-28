# MUIRO Deployment Readiness — Review Push

**Checked:** 2026-10-28. The user has authorized a push to `main` so they can review the updated site. This push is expected to trigger the existing Netlify Git integration; no separate Netlify site or domain will be created.

## Verified state

- **Supabase project:** `muiro database` (`apbuobhhaczrruovfkdu`, Mumbai) is `ACTIVE_HEALTHY`.
- **Public snapshot:** Anonymous retrieval of `muiro-public/content-snapshot.json` returned HTTP 200. The current snapshot contains 9 products, 3 lookbooks, 4 hero slides, and 0 testimonials. Category labels are derived from product/lookbook records by the shared public projector when building the site.
- **Database migrations:** The prior setup pass reported the private-state, rate-limit, and privilege-hardening migrations applied. The project has no deployed Edge Functions at this check.
- **Owner API:** `muiro-api` is absent from the project’s Edge Function list. Its deployment and live admin-write path have not been verified. Function secret values cannot be checked because no function is deployed; never put the owner PIN or service-role key into a `VITE_*` variable.
- **Publication hook:** The Edge Function expects `NETLIFY_BUILD_HOOK_URL` to request a static rebuild after writing a snapshot. If it is not set as a Supabase Function secret, a content save can be stored and the snapshot uploaded while the public Netlify site remains on its prior build (the UI reports publication pending).
- **Netlify target:** The repository remains linked to the existing `muirofashion` site and its existing `muirofashion.netlify.app` origin. The project environment already has the browser-safe Supabase URL/publishable-key settings from the prior setup; local static build and HTTP checks pass against the existing public snapshot.

## Review-push boundary

The authorized GitHub push updates `main` and relies on the pre-existing Netlify Git connection for the review build. No new domain/site is created and no separate Netlify deployment command is used. The public storefront can be reviewed after Netlify finishes building. The Supabase-backed Owner Studio cannot be considered live-ready until `muiro-api` is deployed with `verify_jwt = false` (the function performs its own signed-session authorization), required function secrets are present, and the Netlify build hook is configured.

## Required follow-up for live admin testing

1. In the existing Supabase project, deploy the checked-in `supabase/functions/muiro-api` function with `verify_jwt = false`.
2. Confirm Function Secrets contain the approved admin PIN and the project URL/service-role key; keep all of them server-side.
3. Create or select a build hook on the existing Netlify site and store its URL only as the Supabase Function secret `NETLIFY_BUILD_HOOK_URL`.
4. Test admin sign-in, product/lookbook/category CRUD, image uploads, public snapshot update, and the follow-up Netlify rebuild.

## Local verification for this review push

- `npm run lint` — passed.
- `npm run test:snapshot` — passed.
- `npm run build:static` — passed using the current public Supabase snapshot.
- `npm run test:static` — passed, including SEO files, real 404 behavior, static visitor reads, and no visitor-side backend calls.
- `npm run test:integration` — passed against isolated temporary local storage, including category create/rename propagation/delete safeguards and product image-alt persistence.
- Supabase Edge Function source transpile check and `git diff --check` — passed.
