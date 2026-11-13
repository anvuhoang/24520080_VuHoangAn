// vite.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The API runs on its own port (npm run server); the browser only talks to /api on the page's own origin
const api = { '/api': { target: 'http://localhost:3001', changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/*.test.{js,jsx}'],
    restoreMocks: true,
  },
});
