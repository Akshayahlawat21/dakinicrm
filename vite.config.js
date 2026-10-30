import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    host: true,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        timeout: 120000,
      },
      '/health': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      // Route analytics through Layer 2 Gateway (8080) so JWT headers are properly injected and forwarded
      '/analytics': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/analytics/, '/v1/analytics'),
      },
    },
  },
});
