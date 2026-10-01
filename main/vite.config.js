import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "./",
  plugins: [react()],

  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase'
            if (id.includes('xlsx')) return 'xlsx'
            if (id.includes('lucide-react')) return 'lucide'
            return 'vendor'
          }
        }
      }
    }
  }
})
