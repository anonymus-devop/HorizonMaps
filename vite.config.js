import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/HorizonMaps/",
  optimizeDeps: {
    include: ["mapbox-gl", "@turf/turf", "raf"],
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      external: [],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5173,
  },
});
