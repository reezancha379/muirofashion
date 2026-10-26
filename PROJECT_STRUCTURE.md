# MUIRO project structure

MUIRO is a standalone affiliate fashion lookbook and content-management site.
It is intentionally separate from other projects.

## Source boundaries

- `src/` — browser-facing React application.
- `src/components/` — reusable UI grouped by responsibility.
- `src/types/` — domain types shared by the frontend.
- `src/lib/` — browser-side API, affiliate navigation, and utility code.
- `server/` — MUIRO API, authentication, security, and persistence logic.
- `data/` — current JSON persistence/seed data; this is the migration point for a future database.
- `public/` — static assets served by the site.
- `scripts/` — build/deployment helpers.
- `tests/` — automated tests.

## Generated files

Do not commit or manually edit `node_modules/`, `dist/`, or `site/`. They are generated and can be recreated.

## Content management goal

Products, lookbooks, hero slides, testimonials, and affiliate settings should be created/edited through the admin UI. React source files should define the UI and behavior, not individual catalog entries.

## Future database boundary

`server/dataStore.ts` is intentionally isolated so the current JSON store can later be replaced by PostgreSQL without rewriting the React UI.
