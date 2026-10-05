import { defineConfig } from 'vite';

// Stinky Lincoln — Vite config.
// base './' keeps the built game portable (works from any sub-path or file host).
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
  },
});
