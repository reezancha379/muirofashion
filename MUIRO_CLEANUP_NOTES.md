# MUIRO cleanup notes

This version is a standalone MUIRO affiliate lookbook. It is not connected to Echo, SafeTour, or another application.

## What changed

- Removed `node_modules/`, `dist/`, and `site/` from the source package.
- Removed the Bun lockfile so npm is the single package manager represented here.
- Grouped React components by responsibility.
- Split shared domain types into `src/types/`.
- Isolated backend auth, security, and persistence into dedicated server folders.
- Added Vite client type declarations and corrected the `@/*` TypeScript path.
- Added dedicated client/static E2E test scripts under `tests/`.
- Changed affiliate URL validation to a real allowlist by default. Custom domains require explicit `MUIRO_ALLOW_CUSTOM_AFFILIATE_DOMAINS=true`.
- Changed client-IP extraction to use Express `req.ip`, with forwarded headers trusted only when `TRUST_PROXY=true`.
- Removed the factory admin PIN from source and shipped data. First run requires `MUIRO_ADMIN_PIN` in `.env` (6-12 digits).
- Fixed an API response-body bug in `updateAdminPin` where the response was parsed twice.
- Removed the hardcoded default PIN from the reset API client.

## First run

1. Copy `.env.example` to `.env`.
2. Set `MUIRO_ADMIN_PIN` to a private 6-12 digit PIN.
3. Run `npm install`.
4. Run `npm run dev`.

## Content workflow

Use the MUIRO admin UI to add/edit products, lookbooks, hero slides, and testimonials. Catalog content should not require source-code edits.

## Storage

The current persistence layer remains `data/store.json` so the existing app can keep working. It is intentionally isolated in `server/database/dataStore.ts` so it can later be replaced with PostgreSQL without changing the public React components.
