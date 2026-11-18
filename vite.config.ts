import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Relative base so the bundle loads from the Android WebView (https://localhost) as well as a browser.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
