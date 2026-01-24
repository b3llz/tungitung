import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // HAPUS atau KOMENTARI baris base ini jika deploy ke Vercel!
  // base: "/tungitung/", 
  
  // Tambahkan ini biar Vercel tidak protes soal ukuran file
  build: {
    chunkSizeWarningLimit: 1600, 
    rollupOptions: {
        output: {
            manualChunks(id) {
                if (id.includes('node_modules')) {
                    if (id.includes('firebase')) return 'firebase';
                    if (id.includes('xlsx')) return 'xlsx';
                    if (id.includes('lucide-react')) return 'lucide';
                    return 'vendor';
                }
            }
        }
    }
  }
})
