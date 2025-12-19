import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: 'http://backend:8882',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://backend:8882',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://backend:8882',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
