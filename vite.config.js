import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA()],
  base: './', // ✅ Important for GitHub Pages and Capacitor
  build: {
    rollupOptions: {
      external: [],
    },
  },
})
