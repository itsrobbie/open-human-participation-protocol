import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      '/api': 'http://localhost:5040',
      '/.well-known': 'http://localhost:5040',
      '/ohpp': 'http://localhost:5040',
      '/health': 'http://localhost:5040',
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
});
