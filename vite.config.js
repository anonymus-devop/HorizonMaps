import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/HorizonMaps/", // 👈 importante para GitHub Pages
  plugins: [
    react(),
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
