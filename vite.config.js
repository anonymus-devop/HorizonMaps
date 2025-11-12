// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "HorizonMaps",
        short_name: "HMaps",
        start_url: ".",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
          { src: "icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
        ],
      },
    }),
  ],
  optimizeDeps: {
    include: ["mapbox-gl", "lucide-react"],
  },
  build: {
    outDir: "dist",
  },
});
