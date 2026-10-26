# MUIRO CMS Architecture

## Content model

- **Products**: shoppable items. Products keep the existing `merchant` display name for backward compatibility and now also store `merchantId` and `affiliateProgramId`.
- **Merchants**: reusable retail destinations with a website and optional affiliate-program relationship.
- **Affiliate Programs**: reusable partner/network records with default commission and disclosure settings.
- **Lookbooks**: editorial collections that reference product IDs.
- **Hero Slides**: presentation records that may reference a lookbook.
- **Settings / Testimonials / Analytics**: existing editorial and measurement data.

The owner manages programs and merchants from **Admin Studio → Programs & Merchants**. Product creation now uses the live merchant list instead of a hard-coded merchant dropdown.

## Authentication

- Admin PINs are stored as salted scrypt hashes.
- The browser never receives the current PIN.
- The old recoverable-PIN path was removed.
- The old fixed master recovery credential was removed.
- Optional `MUIRO_MASTER_KEY` is accepted only by the forgotten-PIN reset endpoint. If it is unset, reset requires the paired Authenticator/TOTP code.
- Session tokens are signed server-side and stored only in `sessionStorage`.
- Authenticator secrets are generated per installation and are never compiled into the public bundle.

## Size / performance cleanup

- Removed `src/assets/images` because those files were not imported and duplicated public assets.
- Optimized the four local hero images and favicon.
- Removed unused font families/weights and kept the two font families actually referenced by the UI.
- Admin Studio, Analytics, Auth Modal, and QR/TOTP code are lazy-loaded so normal shoppers do not download the owner-only UI up front.
- `node_modules`, `.env`, build output, and static-site output are excluded from the deliverable.

## First run

1. Copy `.env.example` to `.env`.
2. Set `MUIRO_ADMIN_PIN` to a 6–12 digit owner PIN.
3. Optionally set `MUIRO_MASTER_KEY` to a private recovery value.
4. Start with `npm install` then `npm run dev`.

The sanitized `data/store.json` preserves content and analytics but intentionally excludes credentials/session secrets. The server creates fresh auth state on first boot.
