# MUIRO — Review Handoff

**Status:** The user authorized pushing the verified changes to `main` for review. The push is intended to trigger the existing Netlify Git integration; it does not create a new site or domain, and no separate Netlify deploy command is being used.

The repository remains `https://github.com/reezancha379/muirofashion.git`. The requested site name remains exactly **MUIRO**. The existing canonical origin is `https://muirofashion.netlify.app/`.

## Visual direction and review image

- [Mobile preview — 390 × 844](/home/ubuntu/muiro-review/mobile.png)

The design follows the approved MUIRO Editorial system: Paper, Ink, Crimson, and Plum; editorial serif headlines paired with sans-serif interface typography; restrained borders and motion; existing photography and visitor journey retained. The public build keeps reduced-motion behavior and accessible carousel targets.

The Owner Studio retains its current sections and adds a managed Categories panel in the same visual system. Product and lookbook forms select from shared categories; owners can create, edit, rename, and delete categories, see assignment counts, and cannot delete an assigned category. Product image descriptions are editable and used as visitor-facing alt text. Existing product/lookbook video URLs, captions, SEO controls, media upload, merchant/program relationships, analytics, hero slides, and content forms are preserved.

## Visitor experience and discovery

The public storefront is built static-first from the content snapshot, so visitors do not wait for Supabase database calls. The current public snapshot is anonymously available from the existing `muiro-public` bucket and contains 9 products, 3 lookbooks, and 4 hero slides. Categories are projected from managed category records and existing product/lookbook labels. Product cards display their category; lookbooks retain their category presentation.

The build provides the exact browser title `MUIRO`, canonical metadata for the existing Netlify origin, Open Graph/Twitter tags, factual structured data, `robots.txt`, `sitemap.xml`, `llms.txt`, and a branded true-404 page. No extra domain or pathname page set was introduced.

## Verification performed

- `npm run lint` — passed.
- `npm run test:snapshot` — passed, including the public field whitelist and URL validation.
- `npm run build:static` — passed using the current public Supabase snapshot.
- `npm run test:static` — passed, including metadata, discovery files, genuine 404 handling, static visitor reads, and no visitor-side API calls.
- `npm run test:integration` — passed against isolated temporary data, including category create/rename propagation/deletion protection, image upload, image-alt create/update, and cleanup.
- Supabase Edge Function transpilation and `git diff --check` — passed.

These are local checks. The earlier Lighthouse lab run measured Performance 76, Accessibility 100, Best Practices 96, and SEO 100; these are lab scores, not field Core Web Vitals.

## Supabase readiness boundary

The existing Supabase project `muiro database` is healthy and the public snapshot endpoint returns HTTP 200. The prior setup pass reported the private-state, rate-limit, and privilege-hardening migrations applied. However, the latest Edge Function listing returned no deployed functions, so `muiro-api` is not live. Consequently, the production Owner Studio’s sign-in, CRUD, and image-upload operations cannot be considered ready to test until the function is deployed and its server-side secrets are configured.

The function also expects `NETLIFY_BUILD_HOOK_URL` as a Supabase Function secret. Without it, the snapshot may be stored but the static storefront will not automatically rebuild after an admin edit; the app reports publication as pending. Never put the admin PIN, service-role key, or build-hook URL in browser-visible `VITE_*` variables.

## What to test after Netlify finishes the review build

You can review the live public design, categories, product cards, lookbook presentation, SEO title/metadata, and 404 behavior. For live admin tests, first deploy the checked-in `muiro-api` to the existing Supabase project with `verify_jwt = false`, configure the approved PIN and backend credentials only as Function Secrets, and configure a build hook on the existing Netlify site as `NETLIFY_BUILD_HOOK_URL`. Then verify sign-in, category CRUD and propagation, product/lookbook saves, image uploads, snapshot publication, and the automatic Netlify rebuild.
