import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/HorizonMaps/", // 👈 CRITICAL for GitHub Pages
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "robots.txt"],
      manifest: {
        name: "HorizonMaps",
        short_name: "HorizonMaps",
        description: "AI-powered navigation app with Mapbox and real-time tracking",
        theme_color: "#007aff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/HorizonMaps/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
