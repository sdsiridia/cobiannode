import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, el frontend corre en 5173 y redirige /api al backend (3000).
// En producción, `npm run build` genera dist/ que sirve el propio Express.
export default defineConfig({
  plugins: [react()],
  publicDir: '../img',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
