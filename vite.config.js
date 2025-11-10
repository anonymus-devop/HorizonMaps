import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚙️ IMPORTANT: this must match your GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: '/HorizonMaps/', // <-- This line fixes blank screen on GitHub Pages
})
