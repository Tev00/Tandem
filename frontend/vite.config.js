import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds straight into ../pb_public so PocketBase serves the SPA.
// base: './' keeps asset paths relative under PocketBase's static handler.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../pb_public', emptyOutDir: true },
})
