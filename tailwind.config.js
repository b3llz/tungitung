import animate from 'tailwindcss-animate';

// ============================================================
// WELP DESIGN SYSTEM v6 — "FRESH INK"
// ------------------------------------------------------------
// Prinsip warna (keputusan, bukan selera):
//  - NEUTRAL dulu: light mode = putih/abu netral yang bersih,
//    dark mode = charcoal netral TANPA undertone cokelat/oranye.
//  - Orange = ACCENT, bukan tema. Dipakai dengan sengaja untuk
//    CTA utama, state aktif/terpilih, highlight brand, dan
//    detail maskot. Tidak ada background besar berwarna oranye.
//  - Semantic (success/warning/danger/info) terpisah dari brand.
//  - WCAG AA: putih di atas flame-600 (#D84312) = 4.6:1;
//    ink #1B1F24 di atas paper #F5F6F8 = 15.2:1;
//    flame-700 #B23508 di atas putih = 5.5:1 (teks aksen);
//    apricot #FFA36B di atas night #0F1114 = 8.9:1.
// Hard rules: TIDAK ada krem/krem-gelap/cokelat/cocoa di background.
// TIDAK ada ungu/plum/indigo. Font tetap rounded-friendly WELP.
// ============================================================
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // ---- Kanvas & permukaan (light: netral bersih) ----
        paper: '#F5F6F8',            // latar konten (abu sangat muda, netral)
        night: '#0F1114',            // latar gelap (charcoal netral, tanpa undertone)
        ink: {
          DEFAULT: '#1B1F24',        // teks utama (charcoal tinta)
          soft: '#4E5761',           // teks sekunder (masih terbaca jelas)
          faint: '#7C8590',          // label / teks tersier
          inv:  '#F3F5F7'            // teks di atas permukaan gelap
        },
        line: {
          DEFAULT: '#E6E8ED',        // garis hairline terang (netral)
          dark: '#2A2F37'            // garis hairline gelap (netral)
        },
        surface: {
          DEFAULT: '#FFFFFF',        // kartu (putih bersih)
          dark: '#181C22'            // kartu mode gelap (charcoal netral)
        },
        // ---- Chrome gelap (sidebar, header gelap, bottom nav) ----
        // Netral seperti baja gelap: BUKAN cokelat, BUKAN cocoa.
        chrome: {
          DEFAULT: '#1A1D23',
          deep: '#13161B',
          panel: '#1F242C',
          edge: '#2C323B'
        },
        // ---- Signature accent (v14): palet brand via CSS variables.
        // Nilai default tetap burnt orange WELP (didefinisikan di :root
        // index.css). Fitur Custom Aplikasi cukup menimpa variabel
        // --fl-* / --ap-* di runtime → SEMUA kelas flame/apricot ikut
        // berubah (termasuk versi /alpha & gradient) tanpa rebuild.
        flame: {
          50:'rgb(var(--fl-50) / <alpha-value>)',100:'rgb(var(--fl-100) / <alpha-value>)',
          200:'rgb(var(--fl-200) / <alpha-value>)',300:'rgb(var(--fl-300) / <alpha-value>)',
          400:'rgb(var(--fl-400) / <alpha-value>)',500:'rgb(var(--fl-500) / <alpha-value>)',
          600:'rgb(var(--fl-600) / <alpha-value>)',700:'rgb(var(--fl-700) / <alpha-value>)',
          800:'rgb(var(--fl-800) / <alpha-value>)',900:'rgb(var(--fl-900) / <alpha-value>)',
          950:'rgb(var(--fl-950) / <alpha-value>)'
        },
        // Aksen di atas permukaan gelap (lebih terang agar kontras)
        apricot: {
          DEFAULT:'rgb(var(--ap-base) / <alpha-value>)',
          deep:'rgb(var(--ap-deep) / <alpha-value>)',
          dim:'rgb(var(--ap-dim) / <alpha-value>)'
        },
        // Madu: PRO & peringatan halus (semantic-ish, tetap sekunder)
        gold: { DEFAULT:'#E8A13D', soft:'#FDF3E0', deep:'#96660F' },
        // Semantic status (bukan brand)
        brick: { DEFAULT:'#E2483D', deep:'#B93328', soft:'#FDECEA' },
        leaf:  { DEFAULT:'#3E9B66', deep:'#23734A', soft:'#E7F5EC' },
        teal2: { DEFAULT:'#2E7E8C', soft:'#E4F1F3' }
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'Nunito', 'ui-sans-serif', 'sans-serif'],
        hand: ['"Gochi Hand"', '"Comic Sans MS"', 'cursive'],
        money: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,17,20,.05), 0 8px 24px -12px rgba(15,17,20,.12)',
        pop:  '0 24px 64px -24px rgba(13,15,18,.5)',
        dock: '0 12px 40px -16px rgba(13,15,18,.55)'
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem'
      },
      spacing: { '4.5': '1.125rem' }
    }
  },
  plugins: [animate]
};
