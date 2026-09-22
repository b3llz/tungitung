// ============================================================
// WELP BRAND SYSTEM — satu sumber identitas untuk seluruh app.
// ------------------------------------------------------------
// Aturan pakai:
//  • WelpWordmark / JustruMark : logo resmi versi VEKTOR HD
//    (ditrace dari asset asli). Warna mengikuti teks induk
//    (currentColor) → otomatis tajam di semua ukuran & DPI dan
//    benar di light/dark tanpa dua file PNG.
//  • BrandLogo    : wordmark WELP (tanpa garis dekoratif apa pun).
//    theme="auto" mengikuti light/dark lewat kelas teks.
//  • BrandLockup  : WELP (primer) + tagline "We Eventually Love
//    POS" (font Baloo 2 — satu keluarga dengan bentuk logo)
//    + endorsement "by JUSTru GROUP" (sekunder, selalu tampil,
//    ukuran jelas terbaca di SEMUA device termasuk mobile).
//  • Mascot       : maskot resmi WELP (asset PNG asli project).
//  • AppSymbol    : ikon aplikasi (kepala maskot: topi W) untuk
//    loading screen, splash, dan tempat butuh simbol 16-32px.
// ============================================================
import React from 'react';
import { WelpWordmark, JustruMark } from './brand-marks.jsx';

import poseMenyapa from './assets/mascot/menyapa.png';

/* ---------- MASCOT (pose asli dari asset sheet) ---------- */
const poseModules = import.meta.glob('./assets/mascot/*.png', { eager: true, import: 'default' });
const POSE_URL = {};
for (const [path, url] of Object.entries(poseModules)) {
  POSE_URL[path.split('/').pop().replace('.png', '')] = url;
}

/* Alias bahasa Indonesia agar pemakaian di UI terbaca natural */
const POSE_ALIAS = {
  sapa: 'menyapa', kerja: 'kerja', yuk: 'yuk-transaksi', yukTransaksi: 'yuk-transaksi',
  mantap: 'proud-mantap', proud: 'proud-mantap', senang: 'senang', semangat: 'semangat',
  makasih: 'terima-kasih', terimaKasih: 'terima-kasih', pikir: 'pikir', bingung: 'bingung',
  sedih: 'sedih', kaget: 'kaget', lelah: 'lelah', capek: 'capek',
  istirahat: 'makan-istirahat', makan: 'makan-istirahat', love: 'love',
};

export const MASCOT_POSES = Object.keys(POSE_URL);

export const Mascot = ({ pose = 'menyapa', className = '', alt = '' }) => {
  const key = POSE_ALIAS[pose] || pose;
  const src = POSE_URL[key] || POSE_URL['menyapa'] || poseMenyapa;
  return <img src={src} alt={alt} draggable="false" className={`select-none ${className}`} />;
};

/* ---------- SIZES ----------
   WELP aspek ≈ 4:1 → tinggi h-14 ≈ lebar 225px (aman di sidebar & mobile).
   JUSTru sengaja lebih besar dari versi lama (h-2.5 = 10px terlalu
   kecil): lg h-5 (20px), md h-4 (16px), sm h-3.5 (14px) dan kini
   TETAP TAMPIL di ukuran sm (mobile) sesuai arah brand.            */
const WELP_H = { lg: 'h-12 sm:h-14', md: 'h-8', sm: 'h-[22px]', xs: 'h-4' };
const TAGLINE = { lg: 'text-[11px] tracking-[0.3em]', md: 'text-[8px] tracking-[0.26em]', sm: 'text-[7px] tracking-[0.22em]', xs: '' };
const JUSTRU_H = { lg: 'h-5', md: 'h-4', sm: 'h-3.5', xs: '' };
const JUSTRU_BY = { lg: 'text-[11px]', md: 'text-[9px]', sm: 'text-[8px]', xs: '' };

/* ---------- BRAND LOGO (wordmark saja) ---------- */
export const BrandLogo = ({ theme = 'auto', size = 'md', withTagline = false, className = '' }) => {
  const h = WELP_H[size] || WELP_H.md;
  const tag = TAGLINE[size];
  const color = theme === 'auto' ? 'text-ink dark:text-ink-inv [&_svg]:fill-current'
    : theme === 'dark' ? 'text-ink-inv [&_svg]:fill-current' : 'text-ink [&_svg]:fill-current';
  return (
    <span className={`inline-flex flex-col items-center gap-1.5 leading-none select-none ${color} ${className}`}>
      <WelpWordmark className={`${h} w-auto block`} />
      {withTagline && tag && (
        <span className={`font-display font-extrabold uppercase whitespace-nowrap ${tag} ${theme === 'auto'
          ? 'text-ink-faint dark:text-ink-inv/70'
          : theme === 'dark' ? 'text-ink-inv/70' : 'text-ink-faint'}`}>
          We Eventually Love POS
        </span>
      )}
    </span>
  );
};

/* ---------- BRAND LOCKUP (WELP + by JUSTru GROUP) ---------- */
/* WELP selalu primer; JUSTru GROUP endorsement yang jelas terbaca.
   align="center" dipakai login mobile; default start (sidebar).    */
export const BrandLockup = ({ theme = 'auto', size = 'md', withTagline = true, endorsement = true, align = 'start', className = '' }) => {
  const showEndorsement = endorsement && !!JUSTRU_H[size];
  const color = theme === 'auto' ? 'text-ink dark:text-ink-inv [&_svg]:fill-current'
    : theme === 'dark' ? 'text-ink-inv [&_svg]:fill-current' : 'text-ink [&_svg]:fill-current';
  return (
    <span className={`inline-flex flex-col ${align === 'center' ? 'items-center' : 'items-start'} gap-2 leading-none select-none ${color} ${className}`}>
      <BrandLogo theme={theme} size={size} withTagline={withTagline} />
      {showEndorsement && (
        <span className={`inline-flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : ''}`}
          role="img" aria-label="by JUSTru GROUP">
          <span className={`font-bold italic lowercase ${JUSTRU_BY[size]} ${theme === 'auto'
            ? 'text-ink-faint dark:text-ink-inv/85'
            : theme === 'dark' ? 'text-ink-inv/85' : 'text-ink-faint'}`}>by</span>
          <JustruMark className={`${JUSTRU_H[size]} w-auto block ${theme === 'auto'
            ? 'text-ink-soft dark:text-ink-inv'
            : theme === 'dark' ? 'text-ink-inv' : 'text-ink-soft'}`} />
        </span>
      )}
    </span>
  );
};

/* ---------- APP SYMBOL (kepala maskot: topi W) ---------- */
export const AppSymbol = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <rect width="64" height="64" rx="14.5" fill="#17191D" />
    <circle cx="32" cy="37" r="19" fill="#FFF3E4" />
    <circle cx="24.5" cy="40.5" r="3.1" fill="#F8B48B" opacity=".75" />
    <circle cx="39.5" cy="40.5" r="3.1" fill="#F8B48B" opacity=".75" />
    <circle cx="25.5" cy="37.5" r="2.2" fill="#2A2320" />
    <circle cx="38.5" cy="37.5" r="2.2" fill="#2A2320" />
    <path d="M28.6 42.4q3.4 2.9 6.8 0" stroke="#2A2320" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <path d="M11.5 30.5q1.5-13.5 20.5-13.5t20.5 13.5l-1.2 2.2q-19.3-6.2-38.6 0Z" fill="#1F2126" />
    <path d="M12.3 31.9q19.7-6.1 39.4 0l-2.1 3.4q-17.6-5-35.2 0Z" fill="#F4622E" />
    <path d="M25.2 20.6l2.5 6.2 2.4-4.6h1.7l2.4 4.6 2.5-6.2h2.4l-3.9 8.9h-2.2l-2.1-4.1-2.1 4.1h-2.2l-3.9-8.9Z" fill="#FFFFFF" />
  </svg>
);
