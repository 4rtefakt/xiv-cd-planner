import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server runs on 5173. Wrangler (port 8788) proxies non-/api/*
// requests to this server during `npm run dev`. The proxy block below is
// only used when running Vite standalone (e.g. for visual debug without
// hitting the API).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});
