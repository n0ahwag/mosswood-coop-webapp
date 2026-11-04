import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Im Dev-Modus leitet Vite API- und WebSocket-Aufrufe an den Express-Server weiter.
// VITE_BASE setzt den Pfad für GitHub Pages (z. B. "/mosswood-coop-webapp/").
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
