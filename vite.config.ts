import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Relative asset URLs keep the generated static site usable from Netlify,
    // VS Code Live Server, and other static hosts without a Vite dev server.
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    server: {
      port: Number(process.env.PORT) || 3000,
      // Fail loudly instead of silently serving on a port the browser is not
      // pointed at (e.g. when VS Code Live Preview already owns 3000).
      strictPort: true,
      // HMR is disabled when DISABLE_HMR=true.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              // Editor/tooling write files via temp + rename. Without this,
              // chokidar tries to watch the temp artifact, throws
              // "EBUSY: resource busy or locked", and takes the dev server
              // down mid-edit. Ignore permission hiccups for the same reason.
              ignored: ['**/*.tmp', '**/*.tmpdir', '**/*.tmpdir/**', '**/data/**'],
              ignorePermissionErrors: true,
            },
    },
  };
});
