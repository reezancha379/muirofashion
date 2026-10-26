# MUIRO — VS Code Live Server

## Important

This project is a Vite + React + TypeScript application. VS Code Live Server is a **static file server**; it does not transpile `src/main.tsx`, resolve the `@/` TypeScript aliases, or process Vite plugins.

That is why opening the repository-root `index.html` with Live Server produced:

- `main.tsx` MIME type `application/octet-stream`
- `/fonts/fonts.css` MIME type `text/html`

The repository-root `index.html` is intentionally the **Vite source entry**. Do not open it with Live Server.

## Correct Live Server workflow

1. Open this project folder in VS Code.
2. Install dependencies once:

   ```bash
   npm ci
   ```

3. Build the static site:

   ```bash
   npm run build:static
   ```

4. Open **`site/index.html`** with **Live Server**.

The workspace settings already point Live Server at `/site`, so the generated application is the document root.

The generated site contains:

```text
site/
├── index.html
├── assets/              # Vite-hashed JS/CSS bundles
├── fonts/               # self-hosted font files + fonts.css
├── hero-1.jpg
├── hero-2.jpg
├── hero-3.jpg
├── hero-4.jpg
├── content-snapshot.json
├── _headers
└── _redirects
```

`site/index.html` must contain hashed `./assets/...` references and must **not** contain `/src/main.tsx`.

## If you want live React/HMR while coding

Use the Vite-backed development server instead of Live Server:

```bash
npm run dev
```

Then open the URL printed by the terminal (normally `http://localhost:3000`).

This is the correct development mode for editing `.tsx`, `.ts`, CSS, React components, and Vite configuration.
