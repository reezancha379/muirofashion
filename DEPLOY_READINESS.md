# MUIRO Deployment Readiness — Review Push

**Checked:** 2026-10-28. Commit `982811b` is on the existing GitHub `main` branch. The push did not trigger a new Netlify build: the site still served the previous commit. To make the review visible, the already-built static artifact was published to the existing `muirofashion` Netlify site (`muirofashion.netlify.app`), not to a new site or domain. Netlify deploy `6ae166d7a6aa57ba1cdc6685` is `ready`; the live alias returns HTTP 200 with the exact title `MUIRO`.

## Verified state

- **Supabase project:** `muiro database` (`apbuobhhaczrruovfkdu`, Mumbai) is `ACTIVE_HEALTHY`.
- **Public snapshot:** Anonymous retrieval of `muiro-public/content-snapshot.json` returned HTTP 200. The current snapshot contains 9 products, 3 lookbooks, 4 hero slides, and 0 testimonials. Category labels are derived from product/lookbook records by the shared public projector during the static build.
- **Database migrations:** The prior setup pass reported the private-state, rate-limit, and privilege-hardening migrations applied.
- **Owner API:** The latest Supabase Edge Function listing returned no functions. `muiro-api` is not deployed, so production Owner Studio sign-in, CRUD, and image upload are not live. Function secret values cannot be checked until the function is deployed; never put the owner PIN or service-role key into a `VITE_*` variable.
- **Publication hook:** The function expects `NETLIFY_BUILD_HOOK_URL` as a Supabase Function Secret. Without it, content can be saved and the snapshot uploaded while the static storefront stays on its previous build; the app reports publication pending.
- **Netlify target:** The existing `muirofashion` site is healthy and its alias serves the new static bundle. The Git push did not automatically trigger the new build in this check; future automatic Git-to-Netlify behavior remains unverified.

## Review state

The public storefront is available now at https://muirofashion.netlify.app/. No new site or domain was created. The main GitHub push and the same-site Netlify static deploy are complete. The Supabase-backed Owner Studio cannot be considered live-ready until `muiro-api` is deployed with `verify_jwt = false` (the function performs its own signed-session authorization), server-side function secrets are present, and the Netlify build hook is configured.

## Required follow-up for live admin testing

1. In the existing Supabase project, deploy the checked-in `supabase/functions/muiro-api` function with `verify_jwt = false`.
2. Confirm Function Secrets contain the approved admin PIN and project URL/service-role key; keep these values server-side only.
3. Create or select a build hook on the existing Netlify site and store its URL only as the Supabase Function Secret `NETLIFY_BUILD_HOOK_URL`.
4. Test admin sign-in, product/lookbook/category CRUD, image uploads, public snapshot update, and the follow-up Netlify rebuild.

## Local verification

- `npm run lint` — passed.
- `npm run test:client` — passed against the isolated local server with a disposable test PIN.
- `npm run test:snapshot` — passed.
- `npm run build` and `npm run build:static` — passed.
- `npm run test:static` — passed, including SEO files, real 404 behavior, static visitor reads, and no visitor-side backend calls.
- `npm run test:integration` — passed against isolated temporary storage, including category create/rename propagation/delete safeguards and product image-alt persistence.
- Supabase Edge Function source transpile check and `git diff --check` — passed.
