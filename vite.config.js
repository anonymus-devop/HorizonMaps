import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/HorizonMaps/", // 👈 Important for GitHub Pages (repo name)
  optimizeDeps: {
    include: ["mapbox-gl", "@turf/turf"],
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      external: [], // Fixes Rollup external error
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5173,
  },
});
