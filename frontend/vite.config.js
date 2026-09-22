import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // shared/wordBank.mjs lives at the repo root so the frontend and backend
      // cannot drift. Vite's dev server only serves files under the frontend/
      // workspace root by default, so the parent has to be allowed explicitly.
      allow: ['..'],
    },
  },
})
