import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// Dev: dashboard :5173, proxy REST + WebSocket sang backend Kyta Swarm (:5178).
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5178',
      '/socket.io': { target: 'http://localhost:5178', ws: true },
    },
  },
});
