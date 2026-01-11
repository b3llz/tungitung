import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GANTI 'nama-repo-kamu' dengan nama repository GitHub-mu yang asli
  // Contoh: jika repo kamu https://github.com/User/kasir-app, maka isinya '/kasir-app/'
  base: "/tungitung/", 
})

