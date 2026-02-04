
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      },
      '^/(upload|jobs|cancel|delete|transcribe|correct|output|system-info)': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
