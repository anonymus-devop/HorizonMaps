import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración lista para Capacitor y Mapbox
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
