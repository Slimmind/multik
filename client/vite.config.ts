import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/jobs': 'http://localhost:3000',
      '/upload': 'http://localhost:3000',
      '/cancel': 'http://localhost:3000',
      '/delete': 'http://localhost:3000',
      '/output': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
})
