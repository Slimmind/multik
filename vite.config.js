
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      },
      '/upload': 'http://localhost:3000',
      '/jobs': 'http://localhost:3000',
      '/cancel': 'http://localhost:3000',
      '/delete': 'http://localhost:3000',
      '/transcribe': 'http://localhost:3000',
      '/correct': 'http://localhost:3000',
      '/output': 'http://localhost:3000'
    }
  }
})
