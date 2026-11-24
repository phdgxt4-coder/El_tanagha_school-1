import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
