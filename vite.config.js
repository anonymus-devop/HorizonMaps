import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  base: "./", // Changed from /HorizonMaps/ for Electron compatibility
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.js',
      },
      preload: {
        input: 'electron/preload.js',
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "HorizonMaps",
        short_name: "HMaps",
        description: "AI-powered navigation with Liquid Glass UI.",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webp}"],
      },
    }),
  ],

  optimizeDeps: {
    include: ["mapbox-gl"],
  },

  server: {
    port: 5173,
    host: true,
  }
});
