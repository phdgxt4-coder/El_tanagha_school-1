import { defineConfig } from 'vite';

const base = process.env.VITE_BASE_PATH?.trim() || '/';
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error('VITE_BASE_PATH must start and end with /.');
}

export default defineConfig({
  base,
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { main: 'index.html', studycrewDemo: 'studycrew-demo.html' }
    }
  }
});
