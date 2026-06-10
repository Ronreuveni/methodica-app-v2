import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    port: 5173,
    host: true,
    // Local SQLite backend (npm run server)
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { outDir: 'dist', sourcemap: true },
});