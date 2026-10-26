# MUIRO - Shoppable Fashion Lookbook & Affiliate Studio

A self-hosted shoppable lookbook storefront with a built-in admin studio and
affiliate analytics. The Express backend in `server.ts` serves the API and the
React front end from a single origin. No Google AI Studio project, Gemini API
key, or other external backend is required.

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   `npm install`
2. (Optional) copy `.env.example` to `.env` to change the port or IP salt.
   No API key is needed.
3. Run the app:
   `npm run dev`

The server prints the exact URL to open, e.g. `http://localhost:3000`.

## Important: pick the right port

Only one process can own `127.0.0.1:<port>`. If another tool (most commonly the
VS Code **Live Preview** extension) already listens on port 3000, the browser
will hit that server instead of this app. That other server has no TypeScript
pipeline, so it returns raw `.tsx` files with a `text/plain` MIME type and the
browser refuses to execute them, producing:

```
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/plain".
```

The dev server detects this and automatically moves to the next free port,
printing the correct URL. To force a specific port:

```
PORT=5174 npm run dev
```

## Production

```
npm run build
npm start
```

`npm run build` compiles the client into `dist/` and bundles the server to
`dist/server.cjs`; `npm start` then serves the built client and the API from the
same Express process.
