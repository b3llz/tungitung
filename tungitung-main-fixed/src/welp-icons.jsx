/* ============================================================
   WELP ICON SYSTEM v5 — "Warm Ink Buddies"
   ------------------------------------------------------------
   Bahasa konstruksi (satu aturan untuk semua ikon):
   1. DUA TIER.
      • Buddy (fitur/brand): viewBox 48, outline currentColor
        stroke 3 (round cap+join), flat fill 2-3 tone dari palet
        ember: FLAME #F4622E, PEACH #FFD9BC, CREAM #FFF3E4,
        HONEY #FFC64D, COCOA #4A3325, LEAF/TOMATO (status saja).
      • Utility (aksi/kontrol): viewBox 24, stroke currentColor
        2.4, tanpa fill, bentuk terbuka membulat.
   2. SILUET lebih dulu: satu massa dominan per ikon, terbaca
      pada 18-24px; detail (wajah, pijar) hanya bonus di ukuran
      besar. Negative space >= 25%.
   3. WAJAH: maksimal satu per ikon, hanya pada objek (bukan
      abstrak): dua titik mata + senyum kecil, warna cocoa.
      Ekspresi khusus: kedip, X_X (expired), zzZ (gelap/tidur).
   4. SUDUT: semua membulat. Tidak ada spike selain bintang
      4-tituks yang jadi "perhatian" khas WELP.
   5. WARNA IKON tidak mengikuti konteks (flat brand), outline
      mengikuti currentColor agar adaptif di terang/gelap.
   ------------------------------------------------------------
   Semua ikon SVG murni, tanpa dependency, dapat menerima
   className (ukuran via Tailwind, mis. w-5 h-5).
   ============================================================ */
import React from 'react';

/* ---- Palet flat ikon (tidak berubah di tema apapun) ---------- */
const F = {
  flame: '#F4622E', peach: '#FFD9BC', cream: '#FFF3E4',
  honey: '#FFC64D', cocoa: '#4A3325', leaf: '#4CAF7D',
  tomato: '#EF5350', blush: '#FDA671', sky: '#DFF1F5'
};

/* ---- Wrapper Buddy (48 grid) --------------------------------- */
const Bud = ({ className = 'w-6 h-6', children, ...rest }) => (
  <svg viewBox="0 0 48 48" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"
    className={className} aria-hidden="true" {...rest}>{children}</svg>
);
const O = { stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
const O2 = { stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

/* Wajah standar: dua titik + senyum */
const Face = ({ x = 24, y = 27, s = 1.5, w = 2.2 }) => (
  <g>
    <circle cx={x - 4.6} cy={y} r={s} fill={F.cocoa} />
    <circle cx={x + 4.6} cy={y} r={s} fill={F.cocoa} />
    <path d={`M${x - 3.4} ${y + 2.6} Q${x} ${y + 5.4} ${x + 3.4} ${y + 2.6}`} stroke={F.cocoa} strokeWidth={w} strokeLinecap="round" fill="none" />
  </g>
);
/* Pipi merona */
const Blush = ({ x = 24, y = 31, r = 2, dx = 8.6 }) => (
  <g>
    <circle cx={x - dx} cy={y} r={r} fill={F.blush} opacity=".85" />
    <circle cx={x + dx} cy={y} r={r} fill={F.blush} opacity=".85" />
  </g>
);
/* Bintang 4-titik khas WELP */
const Spark = ({ x, y, s = 3, fill = F.honey }) => (
  <path d={`M${x} ${y - s} L${x + s * .34} ${y - s * .34} L${x + s} ${y} L${x + s * .34} ${y + s * .34} L${x} ${y + s} L${x - s * .34} ${y + s * .34} L${x - s} ${y} L${x - s * .34} ${y - s * .34} Z`} fill={fill} />
);

/* ============================================================
   TIER A — BUDDY ICONS (fitur & navigasi WELP)
   ============================================================ */

/* KASIR — mesin kasir tersenyum + kilau "cha-ching" */
export const Kasir = (p) => (
  <Bud {...p}>
    <Spark x={8} y={8} s={3.4} />
    <rect x="15" y="8" width="18" height="7" rx="3" fill={F.cream} {...O} />
    <rect x="8" y="19" width="32" height="19" rx="6" fill={F.flame} {...O} />
    <circle cx="16" cy="24" r="1.5" fill={F.cocoa} />
    <circle cx="24" cy="24" r="1.5" fill={F.cocoa} />
    <circle cx="32" cy="24" r="1.5" fill={F.cocoa} />
    <Face x={24} y={29.5} s={1.4} w={2} />
  </Bud>
);

/* HPP — kartu resep + koin senyum */
export const HppCalc = (p) => (
  <Bud {...p}>
    <rect x="9" y="7" width="21" height="32" rx="4.5" fill={F.cream} {...O} />
    <path d="M14 15h11" stroke={F.blush} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M14 20.5h11" stroke={F.blush} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M14 26h7" stroke={F.blush} strokeWidth="2.6" strokeLinecap="round" />
    <Spark x={38} y={9.5} s={2.6} />
    <circle cx="31" cy="31" r="9.5" fill={F.honey} {...O} />
    <circle cx="28.6" cy="29.6" r="1.3" fill={F.cocoa} />
    <circle cx="33.4" cy="29.6" r="1.3" fill={F.cocoa} />
    <path d="M29.4 32.6q1.6 1.8 3.2 0" stroke={F.cocoa} strokeWidth="1.9" strokeLinecap="round" fill="none" />
  </Bud>
);

/* RIWAYAT — gulungan struk + jam */
export const Riwayat = (p) => (
  <Bud {...p}>
    <path d="M13 7h18q4 0 4 4v20.5l-3.5-2.7-3.5 2.7-3.5-2.7-3.5 2.7-3.5-2.7L14 31.5l-3.5 2.7L9 31.5V11q0-4 4-4Z" fill={F.cream} {...O} />
    <path d="M15 14.5h14" stroke={F.blush} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M15 19h14" stroke={F.blush} strokeWidth="2.4" strokeLinecap="round" />
    <Face x={22} y={24} s={1.2} w={1.8} />
    <circle cx="34" cy="33" r="8" fill={F.flame} {...O} />
    <path d="M34 29.8V33l2.4 1.6" stroke={F.cream} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Bud>
);

/* KAS KELUAR — dompet + koin melompat keluar */
export const KasKeluar = (p) => (
  <Bud {...p}>
    <path d="M25.5 13.5h4.5" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
    <path d="M23.5 9l3.4 2" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
    <circle cx="36" cy="11.5" r="6.2" fill={F.honey} {...O} />
    <rect x="7" y="21" width="27" height="17" rx="5.5" fill={F.peach} {...O} />
    <rect x="29" y="26" width="10" height="7.5" rx="3.2" fill={F.flame} {...O} />
    <circle cx="34" cy="29.8" r="1.4" fill={F.cream} />
    <Face x={17} y={27.5} s={1.4} w={2} />
  </Bud>
);

/* DISKON — label harga kedip + jebikan gunting */
export const Diskon = (p) => (
  <Bud {...p}>
    <path d="M36.5 7.5l4.5 4.5M41 7.5L36.5 12" stroke={F.blush} strokeWidth="2.4" strokeLinecap="round" />
    <g transform="rotate(-8 24 25)">
      <rect x="11" y="16" width="25" height="19" rx="5.5" fill={F.flame} {...O} />
      <circle cx="17" cy="21.8" r="2.1" fill={F.cream} {...O2} />
      <path d="M21 26.5q1.7-1.9 3.4 0" stroke={F.cocoa} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="28.6" cy="26" r="1.5" fill={F.cocoa} />
      <path d="M22.5 29.5q3 2.4 6 0" stroke={F.cocoa} strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
    <path d="M15 34.5q3.5 4 8.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".5" />
  </Bud>
);

/* STOK — peti terbuka, isintukintir menyembam */
export const Stok = (p) => (
  <Bud {...p}>
    <path d="M18.6 21a5.4 5.4 0 0 1 10.8 0Z" fill={F.cream} {...O} />
    <circle cx="22.4" cy="17.6" r="1.2" fill={F.cocoa} />
    <circle cx="25.6" cy="17.6" r="1.2" fill={F.cocoa} />
    <rect x="8" y="20.5" width="32" height="18.5" rx="4.5" fill={F.peach} {...O} />
    <path d="M18.5 24v11.5M29.5 24v11.5" stroke={F.cocoa} strokeWidth="2" strokeLinecap="round" opacity=".5" />
    <g transform="rotate(-6 24 14)">
      <rect x="7" y="10.5" width="34" height="7.5" rx="3.5" fill={F.flame} {...O} />
    </g>
  </Bud>
);

/* OPNAME — papan ceklis + pensel */
export const Opname = (p) => (
  <Bud {...p}>
    <rect x="11" y="9" width="23" height="31" rx="4.5" fill={F.peach} {...O} />
    <rect x="18" y="5.5" width="9" height="6" rx="2.5" fill={F.flame} {...O} />
    <path d="M15.5 18.5l2.2 2.2 4-4.2" stroke={F.leaf} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M25.5 18.5h5" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
    <circle cx="16.5" cy="26.5" r="1.5" fill={F.cocoa} />
    <path d="M21.5 26.5h9" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
    <circle cx="16.5" cy="33" r="1.5" fill={F.cocoa} />
    <path d="M21.5 33h6" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
    <g transform="rotate(38 35 31)">
      <rect x="32" y="22" width="6.5" height="14" rx="2.2" fill={F.flame} {...O} />
      <path d="M32 36l3.25 5 3.25-5Z" fill={F.honey} {...O2} />
    </g>
  </Bud>
);

/* MASUK-KELUAR — gudang + kotak masuk */
export const InOut = (p) => (
  <Bud {...p}>
    <rect x="8" y="14.5" width="32" height="23.5" rx="4.5" fill={F.cream} {...O} />
    <rect x="6" y="10" width="36" height="7.5" rx="3.5" fill={F.flame} {...O} />
    <path d="M8.5 21h9m0 0-3.2-3.2M17.5 21l-3.2 3.2" stroke={F.cocoa} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".65" />
    <rect x="17.5" y="24.5" width="13.5" height="13.5" rx="2.5" fill={F.cocoa} />
    <rect x="19.5" y="28" width="9.5" height="9.5" rx="2" fill={F.flame} {...O} />
  </Bud>
);

/* RIWAYAT STOK — stoples kadaluarsa (mata X_X) + chip kalender */
export const StokRiwayat = (p) => (
  <Bud {...p}>
    <rect x="30" y="7.5" width="11.5" height="10.5" rx="3" fill={F.cream} {...O} />
    <circle cx="33.8" cy="13" r="1.2" fill={F.flame} />
    <circle cx="37.8" cy="13" r="1.2" fill={F.flame} />
    <rect x="12" y="15" width="19.5" height="26" rx="7" fill={F.peach} {...O} />
    <rect x="14.5" y="9" width="14.5" height="6.5" rx="2.8" fill={F.flame} {...O} />
    <path d="M17.6 27.2l3 3M20.6 27.2l-3 3M24 27.2l3 3M27 27.2l-3 3" stroke={F.cocoa} strokeWidth="1.9" strokeLinecap="round" />
    <path d="M19.5 34.5q1.6-1.6 3.2 0t3.2 0" stroke={F.cocoa} strokeWidth="1.9" strokeLinecap="round" fill="none" />
  </Bud>
);

/* SUPPLIER — truk tersenyum + garis kecepatan */
export const Supplier = (p) => (
  <Bud {...p}>
    <path d="M2 19.5h4M1 24.5h3.5M2 29.5h4" stroke={F.blush} strokeWidth="2.4" strokeLinecap="round" />
    <rect x="6" y="13.5" width="23" height="17.5" rx="4" fill={F.flame} {...O} />
    <Face x={17.5} y={20} s={1.4} w={2} />
    <rect x="29" y="19" width="12.5" height="12" rx="3" fill={F.peach} {...O} />
    <rect x="32" y="21.5" width="6.2" height="5" rx="1.5" fill={F.cream} {...O2} />
    <circle cx="14" cy="34.5" r="3.6" fill={F.cocoa} {...O2} />
    <circle cx="14" cy="34.5" r="1.2" fill={F.cream} />
    <circle cx="33.5" cy="34.5" r="3.6" fill={F.cocoa} {...O2} />
    <circle cx="33.5" cy="34.5" r="1.2" fill={F.cream} />
  </Bud>
);

/* LAPORAN — kertas grafik menanjak + bintang */
export const Laporan = (p) => (
  <Bud {...p}>
    <rect x="10" y="7" width="28" height="34" rx="4.5" fill={F.cream} {...O} />
    <Face x={19} y={13} s={1.2} w={1.8} />
    <path d="M15 34.5h21" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
    <path d="M15 30l6.2-6 5 3 7.8-11" stroke={F.flame} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="34" cy="16" r="2.3" fill={F.flame} />
    <Spark x={38.5} y={9} s={2.8} />
  </Bud>
);

/* KARYAWAN — kartu ID dengan tali gantung */
export const Karyawan = (p) => (
  <Bud {...p}>
    <path d="M17 4l4.5 8M31 4l-4.5 8" stroke={F.blush} strokeWidth="2.6" strokeLinecap="round" />
    <rect x="20" y="11" width="8" height="5.5" rx="2.2" fill={F.honey} {...O} />
    <rect x="12" y="15.5" width="24" height="25" rx="5" fill={F.cream} {...O} />
    <path d="M14.5 22.5h19" stroke={F.flame} strokeWidth="3" strokeLinecap="round" />
    <circle cx="24" cy="19" r="1.3" fill={F.cocoa} />
    <Face x={24} y={29.5} s={1.4} w={2} />
  </Bud>
);

/* OUTLET — dua toko, depan & belakang */
export const Outlet = (p) => (
  <Bud {...p}>
    <rect x="26" y="17" width="16" height="21" rx="3.5" fill={F.peach} {...O} />
    <rect x="24.5" y="12.5" width="19" height="6" rx="3" fill={F.honey} {...O} />
    <path d="M5.5 15.5q0-1 1-1h17q1 0 1 1v5.6a3.2 3.2 0 0 1-6.4 0 3.2 3.2 0 0 1-6.3 0 3.2 3.2 0 0 1-6.3 0Z" fill={F.flame} {...O} />
    <rect x="7.5" y="21.5" width="15.5" height="16.5" rx="3" fill={F.cream} {...O} />
    <rect x="12" y="27" width="6.5" height="11" rx="2.2" fill={F.cocoa} />
    <circle cx="20" cy="26" r="1.5" fill={F.flame} />
  </Bud>
);

/* TOKO — etalase dengan awning strips + bendera */
export const Toko = (p) => (
  <Bud {...p}>
    <path d="M36 14.5V6.5" stroke={F.cocoa} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M36 6.5h6.8L41 8.7l1.8 2.2H36Z" fill={F.honey} {...O2} />
    <rect x="9" y="20.5" width="30" height="19.5" rx="4" fill={F.cream} {...O} />
    <path d="M7 15.5q0-1 1-1h32q1 0 1 1v6.2a3.55 3.55 0 0 1-7.1 0 3.55 3.55 0 0 1-7.1 0 3.55 3.55 0 0 1-7.1 0 3.55 3.55 0 0 1-7.1 0 3.55 3.55 0 0 1-7.1 0Z" fill={F.flame} {...O} />
    <rect x="20" y="28" width="8" height="12" rx="2.6" fill={F.cocoa} />
    <circle cx="14.5" cy="27" r="2" fill={F.flame} />
    <circle cx="33.5" cy="27" r="2" fill={F.flame} />
  </Bud>
);

/* BAYAR — dompet dengan kartu berjoget */
export const Bayar = (p) => (
  <Bud {...p}>
    <g transform="rotate(-8 22 15)"><rect x="13" y="9" width="17" height="11" rx="2.5" fill={F.honey} {...O2} /></g>
    <g transform="rotate(7 27 14)"><rect x="18" y="7.5" width="17" height="11" rx="2.5" fill={F.cream} {...O2} /></g>
    <rect x="8" y="18" width="30" height="21" rx="6" fill={F.flame} {...O} />
    <rect x="26" y="25" width="12" height="9" rx="4" fill={F.peach} {...O} />
    <circle cx="32" cy="29.5" r="1.6" fill={F.cocoa} />
    <Face x={17.5} y={27.5} s={1.4} w={2} />
  </Bud>
);

/* ALAT — printer dengan kertas tersenyum */
export const Alat = (p) => (
  <Bud {...p}>
    <rect x="15" y="6" width="18" height="13" rx="2.5" fill={F.cream} {...O} />
    <path d="M19.5 11h9M19.5 14.5h5.5" stroke={F.blush} strokeWidth="2.2" strokeLinecap="round" />
    <rect x="7" y="18" width="34" height="16.5" rx="5" fill={F.flame} {...O} />
    <circle cx="37" cy="23.5" r="1.7" fill={F.honey} />
    <rect x="14.5" y="27.5" width="19" height="9.5" rx="2.2" fill={F.cream} {...O} />
    <circle cx="20.5" cy="31" r="1.2" fill={F.cocoa} />
    <circle cx="27.5" cy="31" r="1.2" fill={F.cocoa} />
    <path d="M21.5 33.4q2.5 2 5 0" stroke={F.cocoa} strokeWidth="1.8" strokeLinecap="round" fill="none" />
  </Bud>
);

/* SETELAN — papan slider, bukan gir */
export const Setelan = (p) => (
  <Bud {...p}>
    <rect x="8" y="9" width="32" height="30" rx="6" fill={F.cream} {...O} />
    <path d="M13.5 17h21" stroke={F.cocoa} strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
    <circle cx="19" cy="17" r="3.6" fill={F.flame} {...O2} />
    <path d="M13.5 24.5h21" stroke={F.cocoa} strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
    <circle cx="29.5" cy="24.5" r="3.6" fill={F.honey} {...O2} />
    <path d="M13.5 32h21" stroke={F.cocoa} strokeWidth="2.4" strokeLinecap="round" opacity=".55" />
    <circle cx="23" cy="32" r="3.6" fill={F.peach} {...O2} />
    <Spark x={43} y={7.5} s={2.4} />
  </Bud>
);

/* TERANG — matahari senyum */
export const Terang = (p) => (
  <Bud {...p}>
    <path d="M24 6.5v4M24 37.5v4M6.5 24h4M37.5 24h4M11.6 11.6l2.8 2.8M33.6 33.6l2.8 2.8M36.4 11.6l-2.8 2.8M14.4 33.6l-2.8 2.8" stroke={F.honey} strokeWidth="3" strokeLinecap="round" />
    <circle cx="24" cy="24" r="9.5" fill={F.flame} {...O} />
    <circle cx="20.6" cy="22.6" r="1.4" fill={F.cocoa} />
    <circle cx="27.4" cy="22.6" r="1.4" fill={F.cocoa} />
    <path d="M20.8 26.2q3.2 2.8 6.4 0" stroke={F.cocoa} strokeWidth="2" strokeLinecap="round" fill="none" />
  </Bud>
);

/* GELAP — bulan ngantuk zzZ */
export const Gelap = (p) => (
  <Bud {...p}>
    <path d="M30.5 7A16.5 16.5 0 1 0 41 28.5 13 13 0 0 1 30.5 7Z" fill={F.honey} {...O} />
    <path d="M19.5 20.5q2.4 2.4 4.8 0" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <circle cx="20.5" cy="27" r="1.4" fill={F.cocoa} />
    <path d="M37.5 8.5h5l-5 5.5h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".65" />
    <Spark x={43} y={19} s={2.4} fill={F.cream} />
  </Bud>
);

/* KELUAR — pintu terbuka + panah pamit */
export const Keluar = (p) => (
  <Bud {...p}>
    <rect x="8" y="9" width="18" height="30" rx="4.5" fill={F.cream} {...O} />
    <g transform="rotate(-16 13 24)">
      <rect x="10.5" y="12" width="11" height="24" rx="3" fill={F.peach} {...O} />
      <circle cx="18" cy="24.5" r="1.4" fill={F.cocoa} />
    </g>
    <path d="M29 24h11.5M40.5 24l-4.6-4.6M40.5 24l-4.6 4.6" stroke={F.blush} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Spark x={43} y={9.5} s={2.4} />
  </Bud>
);

/* BERANDA — rumah senyum berpipi */
export const Beranda = (p) => (
  <Bud {...p}>
    <rect x="32.5" y="10" width="5.5" height="8" rx="1.8" fill={F.peach} {...O2} />
    <rect x="11" y="21" width="26" height="19" rx="4" fill={F.cream} {...O} />
    <path d="M7.5 22.5q0-1.5 1.2-2.6L22 8.7a3 3 0 0 1 4 0l13.3 11.2q1.2 1.1 1.2 2.6Z" fill={F.flame} {...O} />
    <rect x="20.5" y="28" width="7" height="12" rx="2.6" fill={F.cocoa} />
    <circle cx="15.8" cy="27.5" r="1.4" fill={F.cocoa} />
    <circle cx="32.2" cy="27.5" r="1.4" fill={F.cocoa} />
    <Blush x={24} y={31} r={1.7} dx={9.2} />
  </Bud>
);

/* PINDAI — scanner handheld + sinar */
export const Pindai = (p) => (
  <Bud {...p}>
    <path d="M34.5 14.5h6.5M33 20h8M34.5 25.5h6.5" stroke={F.honey} strokeWidth="2.8" strokeLinecap="round" />
    <rect x="8" y="11.5" width="22" height="12.5" rx="4.5" fill={F.flame} {...O} />
    <rect x="11.5" y="15" width="7.5" height="5.5" rx="1.8" fill={F.cream} {...O2} />
    <path d="M13.5 24l-2 11q-.4 2.6 2.2 2.6h4.6q2 0 2-2l.5-11.6Z" fill={F.peach} {...O} />
  </Bud>
);

/* KERANJANG — keranjang miring tersenyum */
export const Keranjang = (p) => (
  <Bud {...p}>
    <g transform="rotate(-4 24 24)">
      <path d="M17.5 17.5q2-8 7-8M30.5 17.5q-2-8-7-8" stroke={F.blush} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M9.5 17.5h29L35.5 35.5q-.5 3.5-4 3.5h-15q-3.5 0-4-3.5Z" fill={F.flame} {...O} />
      <Face x={24} y={26.5} s={1.5} w={2.1} />
    </g>
  </Bud>
);

/* UANG — lembar bill dengan wajah di oval */
export const Uang = (p) => (
  <Bud {...p}>
    <rect x="6" y="14" width="36" height="20" rx="4.5" fill={F.cream} {...O} />
    <circle cx="11" cy="19" r="1.2" fill={F.honey} />
    <circle cx="37" cy="29" r="1.2" fill={F.honey} />
    <ellipse cx="24" cy="24" rx="6.8" ry="6.2" fill={F.flame} {...O2} />
    <circle cx="21.9" cy="22.9" r="1.1" fill={F.cream} />
    <circle cx="26.1" cy="22.9" r="1.1" fill={F.cream} />
    <path d="M22.2 25.4q1.8 1.6 3.6 0" stroke={F.cream} strokeWidth="1.7" strokeLinecap="round" fill="none" />
  </Bud>
);

/* QRIS — ubin QR ramah */
export const Qris = (p) => (
  <Bud {...p}>
    <rect x="7" y="7" width="34" height="34" rx="7" fill={F.cream} {...O} />
    <rect x="11.5" y="11.5" width="9" height="9" rx="2.2" fill={F.cocoa} />
    <rect x="27.5" y="11.5" width="9" height="9" rx="2.2" fill={F.cocoa} />
    <rect x="11.5" y="27.5" width="9" height="9" rx="2.2" fill={F.cocoa} />
    <circle cx="26.5" cy="20" r="1.7" fill={F.flame} />
    <circle cx="33" cy="20" r="1.7" fill={F.flame} />
    <circle cx="26.5" cy="26.5" r="1.7" fill={F.flame} />
    <circle cx="33" cy="26.5" r="1.7" fill={F.flame} />
    <circle cx="26.5" cy="33" r="1.7" fill={F.flame} />
    <circle cx="33" cy="33" r="1.7" fill={F.honey} />
  </Bud>
);

/* DOMPET — dompet tebal untuk e-wallet */
export const Dompet = (p) => (
  <Bud {...p}>
    <rect x="8" y="13" width="32" height="23" rx="6.5" fill={F.flame} {...O} />
    <path d="M8 20.5h32" stroke={F.cocoa} strokeWidth="2" opacity=".35" />
    <rect x="28" y="22" width="12" height="8.5" rx="3.8" fill={F.peach} {...O} />
    <circle cx="34" cy="26.2" r="1.5" fill={F.cocoa} />
    <Face x={17.5} y={27} s={1.4} w={2} />
  </Bud>
);

/* Status buddies ------------------------------------------------ */
export const Selesai = (p) => (
  <Bud {...p}>
    <circle cx="24" cy="24" r="17" fill={F.leaf} {...O} />
    <path d="M16.5 24.5 22 30l10-11" stroke={F.cream} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Spark x={40} y={9} s={2.6} fill={F.honey} />
  </Bud>
);
export const Galat = (p) => (
  <Bud {...p}>
    <circle cx="24" cy="24" r="17" fill={F.tomato} {...O} />
    <path d="M17.8 17.8l12.4 12.4M30.2 17.8 17.8 30.2" stroke={F.cream} strokeWidth="4" strokeLinecap="round" />
  </Bud>
);
export const Perhatian = (p) => (
  <Bud {...p}>
    <g transform="rotate(-3 24 24)">
      <path d="M24 8q2 0 3.2 2.2l14.2 24.4q1.4 2.4 0 4.4-1.4 2-4.2 2H10.8q-2.8 0-4.2-2-1.4-2 0-4.4L20.8 10.2Q22 8 24 8Z" fill={F.honey} {...O} />
      <circle cx="19.4" cy="26" r="1.6" fill={F.cocoa} />
      <circle cx="28.6" cy="26" r="1.6" fill={F.cocoa} />
      <circle cx="24" cy="33" r="1.9" fill={F.cocoa} />
    </g>
  </Bud>
);

/* ============================================================
   KATEGORI PRODUK — keluarga ikon WELP (Buddy tier).
   Setiap kategori punya bentuk asli sendiri (bukan kotak
   generik): konstruksi sama dengan ikon fitur — grid 48,
   outline 3 currentColor, flat fill 2-3 tone, sudut bulat,
   wajah hanya pada objek, aksen flame/honey yang sengaja.
   ============================================================ */

/* MAKANAN — burger berlapis, biji sesame, senyum di top bun */
export const KatMakanan = (p) => (
  <Bud {...p}>
    <path d="M10 23q0-9.5 14-9.5T38 23q0 2.4-2.4 2.4H12.4Q10 25.4 10 23Z" fill={F.honey} {...O} />
    <circle cx="19" cy="19" r="1.1" fill={F.cream} /><circle cx="25" cy="17.8" r="1.1" fill={F.cream} /><circle cx="30.5" cy="20" r="1.1" fill={F.cream} />
    <path d="M12 27.5q6-2.8 12 0t12 0v2q0 1.6-1.6 1.6H13.6Q12 31.1 12 29.5Z" fill={F.leaf} {...O} />
    <path d="M11 32.5h26v3.5q0 3.5-3.5 3.5h-19Q11 39.5 11 36Z" fill={F.flame} {...O} />
    <circle cx="19.5" cy="36" r="1.3" fill={F.cocoa} /><circle cx="28.5" cy="36" r="1.3" fill={F.cocoa} />
  </Bud>
);

/* MINUMAN — gelas minuman dingin, sedotan miring, gelembung */
export const KatMinuman = (p) => (
  <Bud {...p}>
    <path d="M16.5 8.5 26 12" stroke={F.cocoa} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M12.5 14h23l-2.6 22.5q-.5 4-4.4 4H19.5q-3.9 0-4.4-4Z" fill={F.peach} {...O} />
    <path d="M13.7 22h20.6l-1.4 12.5q-.4 3-3.4 3H18.5q-3 0-3.4-3Z" fill={F.flame} opacity=".9" />
    <circle cx="20" cy="28.5" r="1.7" fill={F.cream} /><circle cx="27.5" cy="31" r="2.2" fill={F.cream} /><circle cx="23.5" cy="35" r="1.4" fill={F.cream} />
    <path d="M15 14.8l1.6 13.4" stroke={F.cream} strokeWidth="2.6" strokeLinecap="round" opacity=".85" />
  </Bud>
);

/* FASHION — kaos berkerah dengan label harga kecil */
export const KatFashion = (p) => (
  <Bud {...p}>
    <path d="M18 9.5 24 12l6-2.5 9.5 5.5-2.8 6.5-3.7-1.5V38q0 1.5-1.5 1.5h-15Q15 39.5 15 38V20l-3.7 1.5L8.5 15Z" fill={F.flame} {...O} />
    <path d="M18 9.5q1.8 3.4 6 3.4t6-3.4" fill="none" stroke={F.cream} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M20 22h8" stroke={F.cream} strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
    <circle cx="34.5" cy="33" r="4.5" fill={F.honey} {...O} />
    <path d="M33 33h3M34.5 31.5v3" stroke={F.cocoa} strokeWidth="1.6" strokeLinecap="round" />
  </Bud>
);

/* JASA — kunci pas yang bekerja + percikan hasil */
export const KatJasa = (p) => (
  <Bud {...p}>
    <Spark x={37} y={10} s={3} />
    <path d="M14.5 9a7.5 7.5 0 0 0-3.6 10.4l16.8 16.8a4.4 4.4 0 0 0 6.2-6.2L17.1 13.2A7.4 7.4 0 0 0 14.5 9Z" fill={F.honey} {...O} />
    <path d="M12.4 12.6 21 21.2" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" opacity=".5" />
    <path d="M30.5 27.5 39 36a4.6 4.6 0 0 1-6.5 6.5L24 34" fill={F.flame} {...O} />
    <circle cx="35.2" cy="39.2" r="1.5" fill={F.cream} />
  </Bud>
);

/* GROCERIES — keranjang belanja berisi roti & sayur */
export const KatGroceries = (p) => (
  <Bud {...p}>
    <path d="M20.5 13.5q4-3.4 7 0" stroke={F.leaf} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <ellipse cx="24" cy="17.5" rx="7.5" ry="4.5" fill={F.honey} {...O} />
    <path d="M11.5 22h25l-2.6 12.8q-.6 3.2-3.9 3.2H18q-3.3 0-3.9-3.2Z" fill={F.flame} {...O} />
    <path d="M17 25.5l1.4 9M24 25.5v9M31 25.5l-1.4 9" stroke={F.cream} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M13.5 22 9 12.5M34.5 22 39 12.5" stroke={F.cocoa} strokeWidth="2.4" strokeLinecap="round" />
  </Bud>
);

/* ELEKTRONIK — ponsel mengisi daya, layar tersenyum */
export const KatElektronik = (p) => (
  <Bud {...p}>
    <rect x="14" y="6.5" width="20" height="35" rx="5" fill={F.cream} {...O} />
    <path d="M21.5 9.5h5" stroke={F.blush} strokeWidth="2" strokeLinecap="round" />
    <path d="M26 20.5h-5l3 5.5h-5" stroke={F.honey} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M23.9 27.8v3.2" stroke={F.honey} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="24" cy="36.5" r="1.9" fill={F.cocoa} />
  </Bud>
);

/* OTOMOTIF — mobil kecil gembira, roda bulat */
export const KatOtomotif = (p) => (
  <Bud {...p}>
    <path d="M10.5 28q0-4 4-4.4l3-4.6q1-1.5 2.8-1.5h7.4q1.8 0 2.8 1.5l3 4.6q4 .4 4 4.4v4.5q0 1.5-1.5 1.5h-24q-1.5 0-1.5-1.5Z" fill={F.flame} {...O} />
    <path d="M18.5 20h11l2.3 3.8h-15.6Z" fill={F.sky} stroke="none" />
    <circle cx="17" cy="34.5" r="4" fill={F.cocoa} {...O2} /><circle cx="31" cy="34.5" r="4" fill={F.cocoa} {...O2} />
    <circle cx="17" cy="34.5" r="1.4" fill={F.cream} /><circle cx="31" cy="34.5" r="1.4" fill={F.cream} />
  </Bud>
);

/* RUMAH TANGGA — rumah dengan hati hangat */
export const KatRumahTangga = (p) => (
  <Bud {...p}>
    <path d="M9.5 23.5 24 11l14.5 12.5" stroke={F.flame} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M13 22.5V37q0 2 2 2h18q2 0 2-2V22.5" fill={F.peach} {...O} />
    <path d="M24 33.2c-3.2-2.4-5-4.2-5-6.3 0-1.7 1.3-2.9 2.9-2.9 1 0 1.7.5 2.1 1.2.4-.7 1.1-1.2 2.1-1.2 1.6 0 2.9 1.2 2.9 2.9 0 2.1-1.8 3.9-5 6.3Z" fill={F.flame} stroke="none" />
  </Bud>
);

/* KESEHATAN — kapsul plus apotek */
export const KatKesehatan = (p) => (
  <Bud {...p}>
    <g transform="rotate(-38 24 24)">
      <rect x="16" y="9" width="16" height="30" rx="8" fill={F.cream} {...O} />
      <path d="M16 24v-7a8 8 0 0 1 16 0v7Z" fill={F.flame} {...O} />
    </g>
    <path d="M33 10.5v7M29.5 14h7" stroke={F.leaf} strokeWidth="2.8" strokeLinecap="round" />
  </Bud>
);

/* HOBI — controller game beraksi */
export const KatHobi = (p) => (
  <Bud {...p}>
    <path d="M14.5 15.5h19q6.5 0 7.5 7l1 9q.4 4.5-3.4 4.5-2.4 0-3.6-2l-2-3.5H15l-2 3.5q-1.2 2-3.6 2-3.8 0-3.4-4.5l1-9q1-7 7.5-7Z" fill={F.honey} {...O} />
    <path d="M14.5 21.5v6M11.5 24.5h6" stroke={F.cocoa} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="31.5" cy="22.5" r="1.7" fill={F.flame} /><circle cx="35.5" cy="26.5" r="1.7" fill={F.flame} />
  </Bud>
);

/* BUKU — buku terbuka, halaman berkibar */
export const KatBuku = (p) => (
  <Bud {...p}>
    <path d="M24 13.5q-4.5-3-11.5-3-1.5 0-1.5 1.5V33q0 1.5 1.5 1.5 7 0 11.5 3Z" fill={F.peach} {...O} />
    <path d="M24 13.5q4.5-3 11.5-3 1.5 0 1.5 1.5V33q0 1.5-1.5 1.5-7 0-11.5 3Z" fill={F.cream} {...O} />
    <path d="M14.5 17.5q3.5.2 6.5 1.5M14.5 22.5q3.5.2 6.5 1.5M27 19q3-1.3 6.5-1.5M27 24q3-1.3 6.5-1.5" stroke={F.blush} strokeWidth="2" strokeLinecap="round" fill="none" />
  </Bud>
);

/* IBU & BAYI — botol susu dengan takaran */
export const KatIbuBayi = (p) => (
  <Bud {...p}>
    <path d="M20 7.5h8v4h-8Z" fill={F.honey} {...O} />
    <path d="M18.5 11.5h11l1 5h-13Z" fill={F.cream} {...O} />
    <rect x="16.5" y="16.5" width="15" height="24" rx="6.5" fill={F.peach} {...O} />
    <path d="M16.9 24h14.2v6H16.9Z" fill={F.flame} opacity=".85" />
    <path d="M21 20v17M27 20v17" stroke={F.cream} strokeWidth="1.8" strokeLinecap="round" opacity=".8" />
  </Bud>
);

/* HEWAN — jejak kaki sahabat */
export const KatHewan = (p) => (
  <Bud {...p}>
    <ellipse cx="16.5" cy="17" rx="3.4" ry="4.4" fill={F.honey} {...O} />
    <ellipse cx="24" cy="14.5" rx="3.4" ry="4.6" fill={F.honey} {...O} />
    <ellipse cx="31.5" cy="17" rx="3.4" ry="4.4" fill={F.honey} {...O} />
    <path d="M35.5 27.5q0 3-3 3h-17q-3 0-3-3 0-6 5.6-8.2a11.7 11.7 0 0 1 11.8 0q5.6 2.2 5.6 8.2Z" fill={F.flame} {...O} />
    <circle cx="20" cy="27" r="1.3" fill={F.cream} /><circle cx="28" cy="27" r="1.3" fill={F.cream} />
  </Bud>
);

/* MAINAN — bola mainan bergaris + balok kayu */
export const KatMainan = (p) => (
  <Bud {...p}>
    <circle cx="21.5" cy="20" r="10.5" fill={F.cream} {...O} />
    <path d="M21.5 9.5a10.5 10.5 0 0 1 0 21q6-5.2 6-10.5t-6-10.5Z" fill={F.flame} {...O} />
    <path d="M13.4 13.9q8.1 2.6 16.2 0" stroke={F.honey} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <rect x="27.5" y="30.5" width="11" height="11" rx="2.5" fill={F.honey} {...O} />
    <path d="M33 33.5v5M30.5 36h5" stroke={F.cocoa} strokeWidth="1.8" strokeLinecap="round" />
  </Bud>
);

/* HADIAH — kado dengan pita melompat */
export const KatHadiah = (p) => (
  <Bud {...p}>
    <path d="M22.5 13.5q-4.5-6 1-6.8 3.4-.4 5.2 4.4M26 13.5q4.5-6-1-6.8" stroke={F.flame} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <rect x="9.5" y="17" width="29" height="8" rx="2.5" fill={F.flame} {...O} />
    <rect x="12.5" y="25" width="23" height="16" rx="3.5" fill={F.honey} {...O} />
    <path d="M24 17v24" stroke={F.cream} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M12.5 29.5h23" stroke={F.cream} strokeWidth="2" strokeLinecap="round" opacity=".55" />
  </Bud>
);

/* LAINNYA — label serbaguna dengan bintang WELP */
export const KatLainnya = (p) => (
  <Bud {...p}>
    <path d="M25.5 8.5h9q2 0 3.5 1.5t1.5 3.5v9q0 2-1.4 3.4L24.4 39.6q-1.8 1.8-3.9-.3L8.7 27.5q-2.1-2.1-.3-3.9Z" fill={F.peach} {...O} />
    <circle cx="32.5" cy="15.5" r="2.6" fill={F.cream} {...O2} />
    <Spark x={21} y={27} s={3.4} />
  </Bud>
);

/* Peta nama kategori -> ikon. Fallback selalu Lainnya. */
const CATEGORY_MAP = [
  [/(makan|food|snack|kue|roti|bakery|burger|masakan)/i, KatMakanan],
  [/(minuman|drink|beverage|tea|kopi|coffee|juice|susu)/i, KatMinuman],
  [/(fashion|pakaian|clothing|apparel|baju|celana)/i, KatFashion],
  [/(jasa|layanan|servis|service)/i, KatJasa],
  [/(grocer|sembako|kebutuhan pokok)/i, KatGroceries],
  [/(elektronik|electronic|gadget|phone)/i, KatElektronik],
  [/(otomotif|automotive|motor|mobil|kendaraan|sparepart)/i, KatOtomotif],
  [/(rumah ?tangga|household|perlengkapan rumah)/i, KatRumahTangga],
  [/(kesehatan|health|obat|farmasi|pharmacy)/i, KatKesehatan],
  [/(hobi|hobby|olahraga|sport|game)/i, KatHobi],
  [/(buku|book|stationery|alat tulis|atk)/i, KatBuku],
  [/(ibu.?&.?bayi|baby|anak)/i, KatIbuBayi],
  [/(hewan|pet|animal)/i, KatHewan],
  [/(mainan|toy)/i, KatMainan],
  [/(hadiah|gift|parcel)/i, KatHadiah],
];

export const CategoryIcon = ({ name, className = 'w-5 h-5', ...rest }) => {
  const s = String(name || '');
  for (const [rx, Icon] of CATEGORY_MAP) {
    if (rx.test(s)) return <Icon className={className} {...rest} />;
  }
  return <KatLainnya className={className} {...rest} />;
};

/* __WELPIE__ */
/* ============================================================
   TIER B — UTILITY ICONS (24 grid, stroke 2.4, currentColor)
   Aksi & kontrol: sengaja polos agar buddy icons menonjol.
   ============================================================ */
const U = ({ className = 'w-5 h-5', children, ...rest }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>{children}</svg>
);

export const X = (p) => <U {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></U>;
export const Check = (p) => <U {...p}><path d="M5 12.8 10 17.5 19 7" /></U>;
export const Plus = (p) => <U {...p}><path d="M12 5.5v13M5.5 12h13" /></U>;
export const Minus = (p) => <U {...p}><path d="M5.5 12h13" /></U>;
export const MinusCircle = (p) => <U {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12h7" /></U>;
export const Trash2 = (p) => <U {...p}><path d="M4.5 6.5h15M9.5 6V4.8q0-1.3 1.3-1.3h2.4q1.3 0 1.3 1.3V6.5M6.5 6.5l.9 12q.1 1.5 1.6 1.5h6q1.5 0 1.6-1.5l.9-12M10 10.5v5.5M14 10.5v5.5" /></U>;
export const Edit3 = (p) => <U {...p}><path d="M14.5 5.2 18.8 9.5 8.6 19.7l-4.9 1.2 1.2-4.9ZM13 6.7l4.3 4.3" /></U>;
export const Save = (p) => <U {...p}><path d="M5.5 3.5h10L19.5 8v10.5a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" transform="translate(1.5 0) scale(.92)" /><path d="M8 3.5V9h7V3.5M8 20.5v-6h8v6" /></U>;
export const FolderOpen = (p) => <U {...p}><path d="M3.5 7.5V6a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v1M3.5 7.5h17l-2 10a2 2 0 0 1-2 1.5H6a2 2 0 0 1-2-1.5Z" /></U>;
export const RotateCcw = (p) => <U {...p}><path d="M4 5v5h5M4.5 10a8 8 0 1 1-.4 4.5" /></U>;
export const RefreshCw = (p) => <U {...p}><path d="M20 5v5h-5M20 10a8 8 0 1 0-.5 4.5M4 19v-5h5M4 14a8 8 0 0 0 13.4 3.4" /></U>;
export const Image = (p) => <U {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M4.5 17.5 10 12l4 4 2.5-2.5 3 3" /></U>;
export const Layers = (p) => <U {...p}><path d="M12 3.5 21 8l-9 4.5L3 8Z" /><path d="M4.5 12.5 12 16.2l7.5-3.7M4.5 17 12 20.7 19.5 17" /></U>;
export const FileSpreadsheet = (p) => <U {...p}><path d="M6 2.5h8L19 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5ZM14 2.5v5h5M9 12h6M9 16h6M12 12v4" transform="translate(0 0)" /></U>;
export const Printer = (p) => <U {...p}><path d="M7 8V3.5h10V8M5 8h14a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 1-1.5 1.5h-2M7 17.5H5A1.5 1.5 0 0 1 3.5 16V9.5A1.5 1.5 0 0 1 5 8" /><rect x="7" y="14" width="10" height="6.5" rx="1" /></U>;
export const Crown = (p) => <U {...p}><path d="M4 17.5 3 7l5 4 4-6.5L16 11l5-4-1 10.5q-8 2.5-16 0Z" /></U>;
export const Briefcase = (p) => <U {...p}><rect x="3.5" y="7.5" width="17" height="12" rx="2.5" /><path d="M9 7.5V5.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3.5 12.5h17" /></U>;
export const Shield = (p) => <U {...p}><path d="M12 3 5 5.8v5.4q0 5.6 7 9.3 7-3.7 7-9.3V5.8Z" /></U>;
export const ShieldCheck = (p) => <U {...p}><path d="M12 3 5 5.8v5.4q0 5.6 7 9.3 7-3.7 7-9.3V5.8Z" /><path d="M9 11.8 11.3 14l4-4.5" /></U>;
export const Search = (p) => <U {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 20.5 20.5" /></U>;
export const Clock = (p) => <U {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.4 2" /></U>;
export const User = (p) => <U {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5q1-5.5 7.5-5.5t7.5 5.5" /></U>;
export const Users = (p) => <U {...p}><circle cx="9" cy="8.5" r="3.5" /><path d="M2.8 19.5q.9-4.8 6.2-4.8t6.2 4.8M15.5 5.4a3.5 3.5 0 0 1 0 6.2M17.5 15.2q3 .7 3.7 4.3" /></U>;
export const Copy = (p) => <U {...p}><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></U>;
export const Key = (p) => <U {...p}><circle cx="8" cy="15.5" r="4.5" /><path d="M11.5 12 20 3.5M16 7.5l3 3M13.5 10l2.5 2.5" /></U>;
export const Lock = (p) => <U {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 15v2.5" /></U>;
export const Unlock = (p) => <U {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 7.8-1M12 15v2.5" /></U>;
export const Camera = (p) => <U {...p}><path d="M8.5 6.5 10 4h4l1.5 2.5H19A2 2 0 0 1 21 8.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" transform="translate(0 .5)" /><circle cx="12" cy="13" r="3.5" /></U>;
export const ScanLine = (p) => <U {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" /></U>;
export const Bluetooth = (p) => <U {...p}><path d="M6.5 7.5 17 16.5l-5 4V3.5l5 4L6.5 16.5" /></U>;
export const Wifi = (p) => <U {...p}><path d="M3 9.5q9-8 18 0M6.2 13q5.8-5 11.6 0M9.4 16.3q2.6-2.2 5.2 0" /><circle cx="12" cy="19.3" r="1.1" fill="currentColor" stroke="none" /></U>;
export const Download = (p) => <U {...p}><path d="M12 3.5V15M12 15l-4.5-4.5M12 15l4.5-4.5M4 20.5h16" /></U>;
export const Upload = (p) => <U {...p}><path d="M12 15V3.5M12 3.5 7.5 8M12 3.5 16.5 8M4 20.5h16" /></U>;
export const Languages = (p) => <U {...p}><path d="M4 5.5h9M8.5 3v2.5M11 5.5q-1 5-5.5 8M6 8.5q1.5 3.5 5 5M12.5 20.5l4-9.5 4 9.5M14 17.5h5" /></U>;
export const Box = (p) => <U {...p}><path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7Z" transform="translate(0 -.2)" /><path d="M3.7 7.2 12 11.5l8.3-4.3M12 11.5v9.5" /></U>;
export const Package = (p) => <U {...p}><path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7Z" transform="translate(0 -.2)" /><path d="M3.7 7.2 12 11.5l8.3-4.3M12 11.5v9.5M7.8 5l8.4 4.3" /></U>;
export const Boxes = (p) => <U {...p}><rect x="3" y="12.5" width="8" height="8" rx="1.2" /><rect x="13" y="12.5" width="8" height="8" rx="1.2" /><rect x="8" y="3.5" width="8" height="8" rx="1.2" /><path d="M8 3.5h8v8H8z" opacity="0" /></U>;
export const ClipboardList = (p) => <U {...p}><rect x="5" y="4.5" width="14" height="17" rx="2.5" /><path d="M9 4.5V3h6v1.5" transform="translate(0 1)" /><path d="M9 10.5h6M9 14h6M9 17.5h3.5" /></U>;
export const Terminal = (p) => <U {...p}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="M7 9.5 10 12l-3 2.5M12.5 15H17" /></U>;
export const Receipt = (p) => <U {...p}><path d="M6 3.5h12q1 0 1 1V21l-2.4-1.7L14.2 21l-2.2-1.7L9.8 21l-2.4-1.7L5 21V4.5q0-1 1-1Z" transform="translate(0 -.5)" /><path d="M9 8.5h6M9 12h6M9 15.5h3.5" /></U>;
export const Banknote = (p) => <U {...p}><rect x="2.5" y="6.5" width="19" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M5.8 9.8v.01M18.2 14.2v.01" /></U>;
export const QrCode = (p) => <U {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><path d="M13.5 13.5h3v3h-3zM17.5 17.5h3v3h-3zM20.5 13.5v1M13.5 20.5h1" /></U>;
export const Wallet = (p) => <U {...p}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" /><path d="M15 12h5.5M15 12q0 1.6 1.4 1.6h4.1V10.4h-4.1Q15 10.4 15 12Z" /></U>;
export const CreditCard = (p) => <U {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></U>;
export const Coins = (p) => <U {...p}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v4q0 3 6 3t6-3V7M3 11v4q0 3 6 3t6-3v-4" /><path d="M18 9.5q3 .4 3 2.5 0 1.8-2.5 2.4" /></U>;
export const Zap = (p) => <U {...p}><path d="M13 2.5 5 13.5h6L11 21.5l8-11h-6Z" /></U>;
export const Rocket = (p) => <U {...p}><path d="M9.5 14.5q-3-6.5 4.5-11 7.5-1 7.5-1t-1 7.5q-4.5 7.5-11 4.5Z" transform="translate(-1.5 -1)"/><path d="M9.5 14.5 5.5 18.5M12 17.5l-2 2q-2.5 2.5-6 2 .5-3.5 3-6l2-2" transform="translate(-1.5 -1)" /><circle cx="15.5" cy="8.5" r="1.8" transform="translate(-1.5 -1)" /></U>;
export const Delete = (p) => <U {...p}><path d="M8 5.5h11A1.8 1.8 0 0 1 20.8 7.3v9.4a1.8 1.8 0 0 1-1.8 1.8H8L2.8 12Z" /><path d="M11.5 9.5l5 5M16.5 9.5l-5 5" /></U>;
export const Award = (p) => <U {...p}><circle cx="12" cy="9" r="5.5" /><path d="M8.8 13.5 7 21.5l5-2.5 5 2.5-1.8-8" /></U>;
export const AlertTriangle = (p) => <U {...p}><path d="M10.3 4.6 2.9 17.4q-1 1.9.9 3h14.4q1.9-1.1.9-3L13.7 4.6q-1.7-2.6-3.4 0Z" transform="translate(0 .5)" /><path d="M12 9v4.5M12 17v.01" /></U>;
export const AlertCircle = (p) => <U {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 16v.01" /></U>;
export const HelpCircle = (p) => <U {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1q0 1.9-2.7 2.6M12 16.5v.01" /></U>;
export const TrendingUp = (p) => <U {...p}><path d="M3.5 17.5 9.5 11.5l4 4L20.5 8M20.5 8h-5M20.5 8v5" /></U>;
export const MonitorSmartphone = (p) => <U {...p}><path d="M4 16.5q-1.5 0-1.5-1.5v-9Q2.5 4.5 4 4.5h13q1.5 0 1.5 1.5V8" /><rect x="13" y="10.5" width="8.5" height="10" rx="2" /><path d="M8 16.5h2.5M2.5 16.5H8" opacity="0" /></U>;
export const Smartphone = (p) => <U {...p}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></U>;
export const DatabaseBackup = (p) => <U {...p}><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6q0 3 7.5 3t7.5-3V6M4.5 12v6q0 3 7.5 3 .8 0 1.5-.05" /><path d="M18.5 15.5v5M18.5 20.5l2-2M18.5 20.5l-2-2" /></U>;
export const LayoutGrid = (p) => <U {...p}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.8" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.8" /><rect x="13" y="13" width="7.5" height="7.5" rx="1.8" /></U>;
export const BadgeCheck = (p) => <U {...p}><path d="M12 2.5l2.2 1.8 2.8-.4 1 2.7 2.7 1-.4 2.8L21.5 12l-1.2 2.1.4 2.8-2.7 1-1 2.7-2.8-.4L12 21.5l-2.2-1.3-2.8.4-1-2.7-2.7-1 .4-2.8L2.5 12l1.2-2.1-.4-2.8 2.7-1 1-2.7 2.8.4Z" /><path d="M8.8 12.2l2.2 2.2 4.2-4.6" /></U>;
export const History = (p) => <U {...p}><path d="M4 6.5v-3M4 6.5h16M20 6.5v-3M4 6.5q0 13.5 8 13.5t8-13.5M9.5 12l2.5 2.5L14.5 12" opacity="0" /><path d="M4.5 10a8 8 0 1 1-.4 4" /><path d="M4.5 4.5V10H10M12 8v4.5l3 1.8" /></U>;
export const ArrowUpCircle = (p) => <U {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 16V8M12 8l-3.5 3.5M12 8l3.5 3.5" /></U>;
export const ArrowDownCircle = (p) => <U {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M12 16l-3.5-3.5M12 16l3.5-3.5" /></U>;
export const Store = (p) => <U {...p}><path d="M4.5 10.5V20q0 1 1 1h13q1 0 1-1v-9.5M3 6.8 4.4 4q.3-.6 1-.6h13.2q.7 0 1 .6L21 6.8q.7 1.4-.4 2.5a2.7 2.7 0 0 1-4.4-.4 2.7 2.7 0 0 1-4.2 0 2.7 2.7 0 0 1-4.2 0 2.7 2.7 0 0 1-4.4.4Q2.3 8.2 3 6.8ZM9.5 21v-5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V21" /></U>;
export const Percent = (p) => <U {...p}><path d="M19 5 5 19" /><circle cx="7.5" cy="7.5" r="2.6" /><circle cx="16.5" cy="16.5" r="2.6" /></U>;
export const BarChart3 = (p) => <U {...p}><path d="M4 20.5h16" /><path d="M6.5 20.5v-6M12 20.5V9M17.5 20.5V4.5" /></U>;
export const ChevronDown = (p) => <U {...p}><path d="M6 9.5l6 6 6-6" /></U>;
export const ChevronUp = (p) => <U {...p}><path d="M6 14.5l6-6 6 6" /></U>;
export const ChevronRight = (p) => <U {...p}><path d="M9.5 6l6 6-6 6" /></U>;
export const ChevronLeft = (p) => <U {...p}><path d="M14.5 6l-6 6 6 6" /></U>;
export const ArrowLeft = (p) => <U {...p}><path d="M20 12H4M4 12l6-6M4 12l6 6" /></U>;
export const ArrowRight = (p) => <U {...p}><path d="M4 12h16M20 12l-6-6M20 12l-6 6" /></U>;
export const Menu = (p) => <U {...p}><path d="M4 7h16M4 12h16M4 17h10" /></U>;
export const LogOut = (p) => <U {...p}><path d="M9 4.5H6A1.8 1.8 0 0 0 4.2 6.3v11.4A1.8 1.8 0 0 0 6 19.5h3M15.5 8 19.5 12l-4 4M19.5 12H9" /></U>;
export const Sun = Terang;
export const Moon = Gelap;

/* ============================================================
   TIER A+ — BUDDY ICONS GENERASI 2 (v8)
   Semua ikon FITUR wajib Buddy (permintaan user, tanpa kecuali):
   biaya variabel, bahan baku, saran harga jual, cek kompetitor,
   lisensi, mode retail/F&B, omzet, laba kotor, absensi, gaji,
   cabang, tim, QRIS dinamis, perangkat, monitoring pusat, dst.
   Kontrol mikro (X, chevron, stepper) tetap Utility (bukan ikon
   fitur). Bahasa konstruksi sama: 48-grid, rounded, flat 2-3
   tone, maksimal satu wajah per objek.
   ============================================================ */

/* Sidik jari (dipakai keluarga absensi) */
const Fingerprint = ({ x = 24, y = 25 }) => (
  <g {...O2} fill="none">
    <path d={`M${x - 11} ${y - 3}q0-9 11-9t11 9`} />
    <path d={`M${x - 7} ${y + 5}q-1-12 7-12t7 12`} />
    <path d={`M${x - 3} ${y + 8}q0-8 3-8t3 8`} />
    <path d={`M${x - 11} ${y - 3}v5M${x + 11} ${y - 3}v5`} />
  </g>
);

/* BIAYA VARIABEL — label harga + persen + koin */
export const BiayaVariabel = (p) => (
  <Bud {...p}>
    <path d="M12 10h17q2 0 3.4 1.4l6 6q1.6 1.6 0 3.2l-12 12q-1.4 1.4-3.2 0l-6-6Q15.8 25.2 15.8 23V12q0-2-2-2Z" fill={F.cream} transform="translate(-2 -2)" {...O} />
    <circle cx="17" cy="15" r="2" fill={F.flame} />
    <path d="M29.5 23.5 19 34" {...O2} />
    <circle cx="18.5" cy="25.5" r="2.2" {...O2} />
    <circle cx="29" cy="32.5" r="2.2" {...O2} />
    <circle cx="38" cy="38" r="4.4" fill={F.honey} {...O} />
    <path d="M38 36.2v3.6M36.6 37.1h2.8M36.6 39h2.8" stroke={F.cocoa} strokeWidth="1.6" strokeLinecap="round" />
  </Bud>
);

/* BAHAN BAKU — karung tepung tersenyum */
export const BahanBaku = (p) => (
  <Bud {...p}>
    <path d="M16 13c-4.5 7-6 22-1 26.5q1 1 2.4 1h13.2q1.4 0 2.4-1c5-4.5 3.5-19.5-1-26.5" fill={F.cream} {...O} />
    <path d="M16 13c3.5-4.5 12.5-4.5 16 0M14.5 20.5h19" {...O} />
    <Face x={24} y={29} />
    <Blush x={24} y={33} />
  </Bud>
);

/* SARAN HARGA JUAL — tag + bintang + panah naik */
export const HargaJual = (p) => (
  <Bud {...p}>
    <path d="M8 22V11q0-2 2-2h11q1.6 0 2.8 1.2l13 13q1.4 1.4 0 2.8l-11 11q-1.4 1.4-2.8 0l-13-13Q8 23.6 8 22Z" fill={F.flame} {...O} />
    <circle cx="15" cy="16" r="2.4" fill={F.cream} />
    <Spark x={27} y={27} s={3.6} fill={F.cream} />
    <path d="M36 40v-6M36 34l-3 3M36 34l3 3" {...O2} stroke={F.leaf} />
  </Bud>
);

/* CEK KOMPETITOR — teropong mengamati */
export const Kompetitor = (p) => (
  <Bud {...p}>
    <path d="M14 8h6q2 0 2 2v8h-10v-8q0-2 2-2ZM28 8h6q2 0 2 2v8H26v-8q0-2 2-2Z" fill={F.cocoa} {...O} />
    <path d="M20 18h8" {...O} />
    <circle cx="16" cy="30" r="8" fill={F.cream} {...O} />
    <circle cx="32" cy="30" r="8" fill={F.cream} {...O} />
    <circle cx="16" cy="30" r="3" fill={F.flame} opacity=".35" />
    <circle cx="32" cy="30" r="3" fill={F.flame} opacity=".35" />
    <Face x={24} y={41.5} s={1.2} w={1.8} />
  </Bud>
);

/* LISENSI — sertifikat + segel pita */
export const Lisensi = (p) => (
  <Bud {...p}>
    <rect x="7" y="7" width="30" height="24" rx="4" fill={F.cream} {...O} />
    <path d="M13 15h14M13 20h10" {...O2} />
    <circle cx="33" cy="33" r="7" fill={F.honey} {...O} />
    <path d="M30.5 33l2 2 3.5-4" {...O} stroke={F.cocoa} />
    <path d="M29 39l-2 6 4-2 2 2 1-6" fill={F.flame} {...O} />
  </Bud>
);

/* MODE RETAIL — rak toko berisi barang */
export const ModeRetail = (p) => (
  <Bud {...p}>
    <path d="M8 20v17q0 2 2 2h28q2 0 2-2V20" fill={F.cream} {...O} />
    <path d="M6 10.5 8 6q.4-1 1.5-1h29Q39.6 5 40 6l2 4.5q1 2.4-.6 4.2a3.6 3.6 0 0 1-5.8-.5 3.6 3.6 0 0 1-5.6 0 3.6 3.6 0 0 1-5.6 0 3.6 3.6 0 0 1-5.6 0 3.6 3.6 0 0 1-5.8.5Q5 12.9 6 10.5Z" fill={F.flame} {...O} />
    <rect x="14" y="26" width="7" height="7" rx="1.6" fill={F.honey} {...O2} />
    <rect x="26" y="26" width="7" height="7" rx="1.6" fill={F.peach} {...O2} />
  </Bud>
);

/* MODE F&B — burger + minuman (logo makanan) */
export const ModeFnb = (p) => (
  <Bud {...p}>
    <path d="M9 20q0-9 12-9t12 9Z" fill={F.honey} {...O} />
    <path d="M9 22.5h24q1 3-2 3.5H11q-3-.5-2-3.5Z" fill={F.leaf} {...O} stroke={F.cocoa} />
    <path d="M9 28h24v5q0 3-3 3H12q-3 0-3-3Z" fill={F.honey} {...O} />
    <Face x={18} y={31.5} s={1.1} w={1.7} />
    <path d="M39 14v22q0 2-2 2h-2q-2 0-2-2V14" fill={F.flame} {...O} />
    <path d="M33.5 17.5h5M36.5 8v4.5" {...O2} />
  </Bud>
);

/* OMZET — tumpukan koin + panah naik */
export const Omzet = (p) => (
  <Bud {...p}>
    <ellipse cx="17" cy="34" rx="11" ry="4.5" fill={F.honey} {...O} />
    <path d="M6 34v-6q0 4.5 11 4.5T28 28v6" {...O} />
    <path d="M6 28v-6q0 4.5 11 4.5T28 22v6" {...O} />
    <ellipse cx="17" cy="22" rx="11" ry="4.5" fill={F.honey} {...O} />
    <path d="M32 30 39 23M39 23h-6.5M39 23v6.5" {...O} stroke={F.leaf} />
    <Spark x={41} y={9} s={3.2} />
  </Bud>
);

/* LABA KOTOR — kantong uang tersenyum */
export const LabaKotor = (p) => (
  <Bud {...p}>
    <path d="M19 10h10l-2.5 5q7.5 4.5 7.5 14 0 8-10 8t-10-8q0-9.5 7.5-14Z" fill={F.flame} {...O} />
    <path d="M17.5 10.5q6.5-3 13 0" {...O} />
    <Face x={24} y={28} />
    <Blush x={24} y={32} />
    <Spark x={37} y={11} s={3.4} />
  </Bud>
);

/* PENGAJIAN — slip gaji + koin */
export const Penggajian = (p) => (
  <Bud {...p}>
    <path d="M12 6h20q2 0 2 2v32l-3.5-2.5L27 40l-3.5-2.5L20 40l-3.5-2.5L13 40l-3-.5V8q0-2 2-2Z" fill={F.cream} {...O} />
    <path d="M18 14h10M18 19h10M18 24h5" {...O2} />
    <circle cx="37" cy="34" r="6.5" fill={F.honey} {...O} />
    <path d="M34.5 34h5M37 31.4v5.2" stroke={F.cocoa} strokeWidth="1.8" strokeLinecap="round" />
  </Bud>
);

/* ABSENSI — sidik jari terverifikasi */
export const Absensi = (p) => (
  <Bud {...p}>
    <rect x="7" y="7" width="34" height="34" rx="9" fill={F.cream} {...O} />
    <Fingerprint x={23} y={26} />
    <circle cx="36.5" cy="36.5" r="6" fill={F.leaf} {...O} stroke={F.cocoa} />
    <path d="M34 36.6l1.8 1.8 3.2-3.6" stroke="#FFFDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Bud>
);

/* ABSEN MASUK — sidik jari + matahari */
export const AbsenMasuk = (p) => (
  <Bud {...p}>
    <Fingerprint x={21} y={27} />
    <circle cx="36" cy="12" r="5" fill={F.honey} {...O} />
    <path d="M36 3.5v2M36 18.5v2M27.5 12h2M42.5 12h2M30 6l1.4 1.4M40.6 16.6 42 18M42 6l-1.4 1.4M31.4 16.6 30 18" {...O2} />
  </Bud>
);

/* ABSEN PULANG — sidik jari + bulan */
export const AbsenPulang = (p) => (
  <Bud {...p}>
    <Fingerprint x={21} y={27} />
    <path d="M41.5 8.5a6.5 6.5 0 1 0 1 8.5 7.5 7.5 0 0 1-1-8.5Z" fill={F.peach} {...O} />
    <Spark x={30} y={7} s={2.4} />
  </Bud>
);

/* CABANG — toko + pin lokasi */
export const Cabang = (p) => (
  <Bud {...p}>
    <path d="M6 18v18q0 2 2 2h20q2 0 2-2V18" fill={F.cream} {...O} />
    <path d="M4 12 6 8q.4-1 1.5-1h19Q27.6 7 28 8l2 4q1 2.4-.6 4a3.4 3.4 0 0 1-5.4-.4 3.4 3.4 0 0 1-5 0 3.4 3.4 0 0 1-5 0 3.4 3.4 0 0 1-5.4.4Q3 14.4 4 12Z" fill={F.flame} {...O} />
    <rect x="12" y="26" width="9" height="12" rx="2" fill={F.peach} {...O2} />
    <path d="M41 22q0 6-7 12-7-6-7-12a7 7 0 0 1 14 0Z" fill={F.honey} {...O} />
    <circle cx="34" cy="21.5" r="2.6" fill={F.cocoa} />
  </Bud>
);

/* TIM — kartu ID karyawan */
export const Tim = (p) => (
  <Bud {...p}>
    <rect x="16" y="7" width="26" height="34" rx="5" fill={F.cream} {...O} />
    <rect x="8" y="11" width="26" height="34" rx="5" fill={F.peach} {...O} />
    <path d="M17 11V8.5h8V11" {...O} />
    <circle cx="18" cy="24" r="4.5" fill={F.flame} {...O2} />
    <path d="M12 36q1-6 6-6t6 6" {...O2} />
    <path d="M27 23h4M27 28h4" {...O2} />
    <Face x={18} y={23.5} s={1} w={1.6} />
  </Bud>
);

/* BUKTI TRANSFER — uang + foto bukti */
export const BuktiTransfer = (p) => (
  <Bud {...p}>
    <rect x="6" y="8" width="30" height="20" rx="4" fill={F.cream} {...O} transform="rotate(-4 21 18)" />
    <circle cx="21" cy="18" r="4.5" fill={F.honey} {...O2} transform="rotate(-4 21 18)" />
    <rect x="16" y="20" width="26" height="20" rx="4" fill={F.flame} {...O} />
    <circle cx="29" cy="30" r="5" fill={F.cream} {...O2} />
    <path d="M20 36l4-4 3.5 3.5L33 30l5 6" {...O2} stroke={F.cream} />
  </Bud>
);

/* SLIP GAJI — printer mencetak slip */
export const SlipGaji = (p) => (
  <Bud {...p}>
    <path d="M13 6h22v9H13z" fill={F.peach} {...O2} />
    <rect x="7" y="15" width="34" height="15" rx="4" fill={F.cocoa} {...O} />
    <path d="M13 30h22v11l-3.6-2.4L27.8 41l-3.8-2.4L20.2 41l-3.6-2.4L13 41Z" fill={F.cream} {...O} />
    <path d="M17 34h10M17 37.5h6" {...O2} />
    <circle cx="35" cy="22.5" r="2" fill={F.honey} />
  </Bud>
);

/* LOKASI — pin peta tersenyum */
export const Lokasi = (p) => (
  <Bud {...p}>
    <path d="M24 4q10 0 10 10 0 8-8.6 18.4a1.9 1.9 0 0 1-2.8 0Q14 22 14 14 14 4 24 4Z" fill={F.flame} {...O} />
    <circle cx="24" cy="14" r="4.5" fill={F.cream} {...O2} />
    <Face x={24} y={13} s={1} w={1.6} />
    <path d="M14 40q10 4 20 0" {...O2} />
  </Bud>
);

/* KREDENSI — kunci tersenyum (password & PIN cabang) */
export const Kredensial = (p) => (
  <Bud {...p}>
    <circle cx="16" cy="16" r="9" fill={F.honey} {...O} />
    <circle cx="16" cy="16" r="3.2" fill={F.cream} {...O2} />
    <path d="M22 22 38 38M31 31l4-4M35 35l4-4" {...O} />
    <Face x={16} y={15} s={1.1} w={1.7} />
  </Bud>
);

/* QRIS DINAMIS — QR + koin (nominal otomatis) */
export const QrDinamis = (p) => (
  <Bud {...p}>
    <rect x="6" y="6" width="14" height="14" rx="3.5" fill={F.cocoa} {...O} />
    <rect x="28" y="6" width="14" height="14" rx="3.5" fill={F.cocoa} {...O} />
    <rect x="6" y="28" width="14" height="14" rx="3.5" fill={F.cocoa} {...O} />
    <rect x="10.5" y="10.5" width="5" height="5" rx="1.4" fill={F.cream} stroke="none" />
    <rect x="32.5" y="10.5" width="5" height="5" rx="1.4" fill={F.cream} stroke="none" />
    <rect x="10.5" y="32.5" width="5" height="5" rx="1.4" fill={F.cream} stroke="none" />
    <circle cx="34" cy="34" r="7.5" fill={F.honey} {...O} />
    <path d="M31.5 34h5M34 31.4v5.2" stroke={F.cocoa} strokeWidth="1.9" strokeLinecap="round" />
    <Spark x={25} y={25} s={3} />
  </Bud>
);

/* UNGGAH QRIS — QR + panah unggah */
export const UnggahQris = (p) => (
  <Bud {...p}>
    <rect x="6" y="6" width="14" height="14" rx="3.5" fill={F.cocoa} {...O} />
    <rect x="6" y="28" width="14" height="14" rx="3.5" fill={F.cocoa} {...O} />
    <rect x="28" y="6" width="14" height="14" rx="3.5" fill={F.cocoa} {...O} />
    <rect x="10.5" y="10.5" width="5" height="5" rx="1.4" fill={F.cream} stroke="none" />
    <rect x="10.5" y="32.5" width="5" height="5" rx="1.4" fill={F.cream} stroke="none" />
    <rect x="32.5" y="10.5" width="5" height="5" rx="1.4" fill={F.cream} stroke="none" />
    <circle cx="35" cy="35" r="8" fill={F.flame} {...O} />
    <path d="M35 39.5v-9M35 30.5l-3.6 3.6M35 30.5l3.6 3.6" stroke="#FFFDF8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Bud>
);

/* PERANGKAT TERIKAT — HP + centang (1 device per sesi meja) */
export const Perangkat = (p) => (
  <Bud {...p}>
    <rect x="10" y="4" width="22" height="40" rx="6" fill={F.cream} {...O} />
    <path d="M18 8h6" {...O2} />
    <circle cx="35" cy="34" r="8" fill={F.leaf} {...O} stroke={F.cocoa} />
    <path d="M31.5 34l2.5 2.5 4.5-5" stroke="#FFFDF8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Bud>
);

/* WAKTU REALTIME — jam + denyut */
export const WaktuReal = (p) => (
  <Bud {...p}>
    <circle cx="24" cy="25" r="17" fill={F.cream} {...O} />
    <path d="M24 15v10l7 4" {...O} />
    <Face x={24} y={24} s={1.1} w={1.7} />
    <path d="M6 9q3-3 6 0M36 41q3-3 6 0" {...O2} stroke={F.blush} />
  </Bud>
);

/* MONITOR PUSAT — layar memantau dua cabang */
export const MonitorPusat = (p) => (
  <Bud {...p}>
    <rect x="4" y="6" width="40" height="27" rx="5" fill={F.cocoa} {...O} />
    <rect x="8.5" y="10.5" width="31" height="18" rx="3" fill={F.cream} stroke="none" />
    <path d="M14 16v9M10.5 25h7q0-4.5-3.5-4.5T10.5 25Z" fill={F.flame} stroke="none" />
    <path d="M30 16v9M26.5 25h7q0-4.5-3.5-4.5T26.5 25Z" fill={F.honey} stroke="none" />
    <path d="M20 25h8" {...O2} stroke={F.blush} />
    <path d="M24 33v6M17 42q7-3 14 0" {...O} />
  </Bud>
);

/* PAKET — kotak (harga grosir) */
export const PaketBuddy = (p) => (
  <Bud {...p}>
    <path d="M8 17 24 9l16 8v15l-16 8-16-8Z" fill={F.peach} {...O} />
    <path d="M8 17l16 8 16-8M24 25v15" {...O2} />
    <path d="M16 13l16 8" {...O2} />
    <Face x={24} y={33} s={1.2} w={1.8} />
  </Bud>
);

/* ORANG — pelanggan (harga ecer) */
export const OrangBuddy = (p) => (
  <Bud {...p}>
    <circle cx="24" cy="16" r="9" fill={F.peach} {...O} />
    <path d="M9 40q1.5-11 15-11t15 11q-7.5 4-15 4t-15-4Z" fill={F.flame} {...O} />
    <Face x={24} y={15.5} />
    <Blush x={24} y={19.5} />
  </Bud>
);

/* ROKET — harga app online (ojol) */
export const RoketBuddy = (p) => (
  <Bud {...p}>
    <path d="M20 30q-6-12 4-21 12-2 12-2t-2 12q-9 10-14 11Z" fill={F.cream} {...O} />
    <circle cx="29" cy="15" r="3.4" fill={F.sky} {...O2} />
    <Face x={29} y={14.5} s={.9} w={1.5} />
    <path d="M20 30l-5 5M24 33l-3 6q-4 3-8 2 .8-4.5 4-7l3-3" {...O} />
    <path d="M36 28q2 4-1 7" {...O2} stroke={F.flame} />
  </Bud>
);

/* STRUK CETAK — struk bergigi tersenyum */
export const StrukCetak = (p) => (
  <Bud {...p}>
    <path d="M12 5h24q2 0 2 2v33l-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6V7q0-2 2-2Z" fill={F.cream} {...O} />
    <path d="M17 13h14M17 18.5h14M17 24h8" {...O2} />
    <Face x={28} y={31} s={1.2} w={1.8} />
  </Bud>
);

/* KAMERA — kamera tersenyum */
export const KameraBuddy = (p) => (
  <Bud {...p}>
    <path d="M16 12l2.5-4h11L32 12h6q3 0 3 3v20q0 3-3 3H10q-3 0-3-3V15q0-3 3-3Z" fill={F.cocoa} {...O} />
    <circle cx="24" cy="25" r="8" fill={F.cream} {...O2} />
    <circle cx="24" cy="25" r="4" fill={F.sky} stroke="none" />
    <Face x={24} y={24.5} s={1.1} w={1.7} />
    <circle cx="37" cy="17" r="1.6" fill={F.honey} />
  </Bud>
);

/* UNDUH — tray + panah turun */
export const UnduhBuddy = (p) => (
  <Bud {...p}>
    <path d="M8 30v6q0 3 3 3h26q3 0 3-3v-6" fill={F.cream} {...O} />
    <path d="M24 6v20M24 26l-7-7M24 26l7-7" {...O} stroke={F.flame} />
    <Face x={24} y={35.5} s={1.1} w={1.7} />
  </Bud>
);

/* UNGGAH — tray + panah naik */
export const UnggahBuddy = (p) => (
  <Bud {...p}>
    <path d="M8 30v6q0 3 3 3h26q3 0 3-3v-6" fill={F.cream} {...O} />
    <path d="M24 26V6M24 6l-7 7M24 6l7 7" {...O} stroke={F.leaf} />
    <Face x={24} y={35.5} s={1.1} w={1.7} />
  </Bud>
);

/* KOIN — koin berlapis tersenyum */
export const KoinBuddy = (p) => (
  <Bud {...p}>
    <circle cx="19" cy="24" r="13" fill={F.honey} {...O} />
    <path d="M15.5 24h7M19 20.5v7" stroke={F.cocoa} strokeWidth="2" strokeLinecap="round" />
    <Face x={19} y={23.5} s={1.1} w={1.7} />
    <path d="M32 12q7 1 7 8" {...O2} stroke={F.blush} />
    <circle cx="38" cy="36" r="5" fill={F.honey} {...O2} />
  </Bud>
);

/* GRAFIK NAIK — bar chart + tren naik */
export const GrafikNaik = (p) => (
  <Bud {...p}>
    <rect x="7" y="26" width="8" height="15" rx="2.5" fill={F.peach} {...O2} />
    <rect x="20" y="18" width="8" height="23" rx="2.5" fill={F.honey} {...O2} />
    <rect x="33" y="10" width="8" height="31" rx="2.5" fill={F.flame} {...O2} />
    <path d="M9 16 18 9l5 4 9-8" {...O} />
    <path d="M32 5h5.5v5.5" {...O2} />
  </Bud>
);

/* JARINGAN — database + sinkron */
export const JaringanBuddy = (p) => (
  <Bud {...p}>
    <ellipse cx="22" cy="9" rx="14" ry="5" fill={F.cocoa} {...O} />
    <path d="M8 9v12q0 5 14 5t14-5V9M8 21v12q0 5 14 5 2.5 0 4.5-.4" {...O} />
    <Face x={22} y={20} s={1.2} w={1.8} />
    <path d="M38 30v10M38 40l3.5-3.5M38 40l-3.5-3.5" {...O2} stroke={F.leaf} />
  </Bud>
);

/* LAYAR — monitor + HP */
export const LayarBuddy = (p) => (
  <Bud {...p}>
    <path d="M4 10q0-3 3-3h22q3 0 3 3v14H4Z" fill={F.cocoa} {...O} />
    <rect x="8" y="11" width="20" height="9" rx="2" fill={F.cream} stroke="none" />
    <Face x={18} y={15} s={.9} w={1.5} />
    <path d="M14 32q0-4 4-4h4M4 24h28v4" {...O2} />
    <rect x="26" y="18" width="16" height="24" rx="4" fill={F.flame} {...O} />
    <circle cx="34" cy="37" r="1.8" fill={F.cream} />
    <path d="M30 23h8" {...O2} stroke={F.cream} />
  </Bud>
);

/* MEDALI — terlaris / terbaik */
export const MedaliBuddy = (p) => (
  <Bud {...p}>
    <path d="M14 5l5 10M34 5l-5 10" {...O} stroke={F.flame} />
    <circle cx="24" cy="28" r="13" fill={F.honey} {...O} />
    <Spark x={24} y={28} s={6.5} fill={F.cream} />
    <Spark x={24} y={28} s={3.6} fill={F.honey} />
  </Bud>
);

/* BAHAYA — peringatan khawatir */
export const BahayaBuddy = (p) => (
  <Bud {...p}>
    <path d="M20.5 9 6.5 33q-1.6 3 1.4 4.8h28.2q3-1.8 1.4-4.8l-14-24q-1.7-2.8-3.5 0Z" fill={F.honey} {...O} />
    <Face x={24} y={29} s={1.3} w={2} />
  </Bud>
);

/* FILE EXCEL — spreadsheet */
export const FileExcelBuddy = (p) => (
  <Bud {...p}>
    <path d="M11 5h17l9 9v27q0 2-2 2H11q-2 0-2-2V7q0-2 2-2Z" fill={F.cream} {...O} />
    <path d="M28 5v9h9" {...O2} />
    <rect x="15" y="21" width="18" height="14" rx="2.5" fill={F.leaf} {...O2} stroke={F.cocoa} />
    <path d="M15 28h18M24 21v14" stroke="#FFFDF8" strokeWidth="2" />
  </Bud>
);

/* GEMBOK — keamanan tersenyum */
export const GembokBuddy = (p) => (
  <Bud {...p}>
    <rect x="10" y="20" width="28" height="22" rx="6" fill={F.flame} {...O} />
    <path d="M16 20v-6a8 8 0 0 1 16 0v6" {...O} />
    <Face x={24} y={30.5} />
    <Blush x={24} y={34.5} />
  </Bud>
);

/* GEMBOK TERBUKA — akses dibuka */
export const GembokBuka = (p) => (
  <Bud {...p}>
    <rect x="10" y="20" width="28" height="22" rx="6" fill={F.leaf} {...O} />
    <path d="M16 20v-6a8 8 0 0 1 15.4-3" {...O} />
    <circle cx="24" cy="30" r="2.6" fill={F.cream} />
    <path d="M24 32.5V36" {...O2} stroke={F.cream} />
  </Bud>
);

/* PERISAI — PIN/akses terverifikasi */
export const PerisaiBuddy = (p) => (
  <Bud {...p}>
    <path d="M24 4q10 4 16 4 0 20-16 34Q8 28 8 8q6 0 16-4Z" fill={F.flame} {...O} />
    <path d="M17 23l5 5 9-11" {...O} stroke={F.cream} />
  </Bud>
);

/* HAPUS — backspace tersenyum (keypad PIN) */
export const HapusBuddy = (p) => (
  <Bud {...p}>
    <path d="M17 8h19q3 0 3 3v26q0 3-3 3H17L4 24Z" fill={F.cream} {...O} />
    <path d="M20 18.5 29 29.5M29 18.5 20 29.5" {...O2} stroke={F.flame} />
    <Face x={33} y={24} s={1.1} w={1.7} />
  </Bud>
);

/* STOK MASUK — barang masuk gudang */
export const StokMasuk = (p) => (
  <Bud {...p}>
    <path d="M8 24h10v10q0 2 2 2h8q2 0 2-2V24h10v14q0 3-3 3H11q-3 0-3-3Z" fill={F.peach} {...O} />
    <path d="M24 4v16M24 20l-6-6M24 20l6-6" {...O} stroke={F.leaf} />
  </Bud>
);

/* STOK KELUAR — barang keluar gudang */
export const StokKeluar = (p) => (
  <Bud {...p}>
    <path d="M8 24h10v10q0 2 2 2h8q2 0 2-2V24h10v14q0 3-3 3H11q-3 0-3-3Z" fill={F.peach} {...O} />
    <path d="M24 20V4M24 4l-6 6M24 4l6 6" {...O} stroke={F.flame} />
  </Bud>
);

/* WIFI — sinyal tersenyum */
export const WifiBuddy = (p) => (
  <Bud {...p}>
    <path d="M5 18q19-17 38 0M11 25q13-11 26 0M17 32q7-6 14 0" {...O2} />
    <circle cx="24" cy="39" r="3.5" fill={F.flame} {...O2} />
    <Face x={24} y={38.5} s={.9} w={1.5} />
  </Bud>
);

/* BLUETOOTH — koneksi printer */
export const BluetoothBuddy = (p) => (
  <Bud {...p}>
    <rect x="7" y="7" width="34" height="34" rx="9" fill={F.sky} {...O} />
    <path d="M18 16.5 30 31l-6 5V12l6 5-12 14.5" {...O} stroke={F.cocoa} />
  </Bud>
);

/* __WELPIE__ */
