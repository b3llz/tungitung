import animate from 'tailwindcss-animate';

export default {
  // 👇 INI YANG WAJIB DITAMBAHKAN
  darkMode: 'class', 

  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {}
  },
  // FIX AUDIT: seluruh aplikasi memakai kelas `animate-in`, `fade-in`,
  // `zoom-in-*`, `slide-in-from-*` (tailwindcss-animate) tanpa plugin-nya,
  // sehingga SEMUA animasi tersebut diam-diam tidak pernah jalan (no-op).
  plugins: [animate]
}
