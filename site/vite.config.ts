/// <reference types="vitest" />
import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILES = ['summary.json'];

/**
 * Serve ../data/*.json at /data/* in dev and copy them into dist/data on
 * build, so the dashboard fetches the collector's output at runtime instead
 * of bundling it (the file grows daily and caches independently).
 */
function collectorData(): Plugin {
  return {
    name: 'pulse-collector-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = DATA_FILES.find((f) => req.url === `/data/${f}`);
        if (!name) return next();
        res.setHeader('Content-Type', 'application/json');
        fs.createReadStream(path.join(DATA_DIR, name)).pipe(res);
      });
    },
    closeBundle() {
      const out = path.resolve(__dirname, 'dist/data');
      fs.mkdirSync(out, { recursive: true });
      for (const f of DATA_FILES) {
        fs.copyFileSync(path.join(DATA_DIR, f), path.join(out, f));
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
