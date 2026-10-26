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
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true

      },
      // Route analytics through Layer 2 Gateway (8080) so JWT headers are properly injected and forwarded
      '/analytics': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/analytics/, '/v1/analytics')
      }
    }
  }
});
