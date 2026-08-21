import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend origin this dev server proxies `/api` to (same pattern as `frontend/vite.config.ts`:
// same-origin relative requests from the browser, no CORS needed). Override with
// VITE_API_PROXY_TARGET when the API runs elsewhere.
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:5184'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
