import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:5030',
      '/.well-known': 'http://localhost:5030',
      '/ohpp': 'http://localhost:5030',
      '/health': 'http://localhost:5030',
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
});
