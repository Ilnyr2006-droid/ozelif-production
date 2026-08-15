import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8093',
      '/uploads': 'http://127.0.0.1:8093',
    },
  },
  build: {
    rollupOptions: {
      // The public site and /admin have separate HTML entry points, but share
      // the same React application and generated asset graph.
      input: {
        main: 'index.html',
        admin: 'admin/index.html',
      },
    },
  },
})
