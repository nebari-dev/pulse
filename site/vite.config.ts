/// <reference types="vitest" />
import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const DATA_DIR = path.resolve(__dirname, '../data');
/** The files the dashboard fetches: the index, the repos file, and one file per product. */
const DATA_PATTERN =
  /^\/data\/(summary\.json|repos\.json|docs\.json|products\/[A-Za-z0-9._-]+\.json)$/;

/**
 * Serve the collector's JSON at /data/* in dev and copy it into dist/data on
 * build, so the dashboard fetches it at runtime instead of bundling it (the
 * files grow daily and cache independently). Raw CSVs are not served.
 */
function collectorData(): Plugin {
  return {
    name: 'pulse-collector-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = DATA_PATTERN.exec(req.url ?? '');
        if (!m) return next();
        const file = path.join(DATA_DIR, m[1]);
        if (!fs.existsSync(file)) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader('Content-Type', 'application/json');
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const out = path.resolve(__dirname, 'dist/data');
      fs.mkdirSync(path.join(out, 'products'), { recursive: true });
      for (const f of ['summary.json', 'repos.json', 'docs.json']) {
        fs.copyFileSync(path.join(DATA_DIR, f), path.join(out, f));
      }
      for (const f of fs.readdirSync(path.join(DATA_DIR, 'products'))) {
        if (!f.endsWith('.json')) continue;
        fs.copyFileSync(
          path.join(DATA_DIR, 'products', f),
          path.join(out, 'products', f),
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), collectorData()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
