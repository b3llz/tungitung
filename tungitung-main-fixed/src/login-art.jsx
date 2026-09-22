// ============================================================
// WELP LOGIN ART v8 — sistem grafis latar halaman login.
// Filosofi: "warm ink print shop" — bahasa cetak/risograph:
//   • Halftone  : titik dgn radius BERVARIASI membentuk bola/
//                 donat (bukan dot-grid seragam generik)
//   • Arch      : gerbang lengkung + inner arch (poster geometry)
//   • QuarterArcs : pita lengkung konsentris dari sudut kanvas
//   • WavyLines : 3 gelombang topografi sejajar
//   • Sticker   : seal bergelombang + wajah Welpie (bahasa ikon)
//   • Burst     : pijar 8 sinar tipis (pengganti sparkle blob)
//   • Receipt   : struk POS gerigi sobek + garis item + stempel
//   • TearLine  : perforasi sobekan struk (titik yang BERMAKNA)
//   • Barcode   : barcode POS bertuliskan WELP·POS
// TIDAK ada: plus melayang, dot-grid seragam, sparkle blob 4
// titik — elemen yang diminta dihapus. Semua currentColor →
// aman light (flame/abu) & dark (apricot/putih-redup).
// ============================================================

/* ---- Halftone: radius titik = fungsi posisi (print halftone) ---- */
export const sphereMask = (u, v) =>
  Math.max(0, 1 - Math.hypot(u - .5, v - .5) * 2.2);

export const ringMask = (u, v) => {
  const d = Math.hypot(u - .5, v - .5);
  return Math.max(0, 1 - Math.abs(d - .4) / .13);
};

export const Halftone = ({
  w = 9, h = 9, gap = 18, rMax = 5.2, rMin = .5,
  mask = sphereMask, className, style,
}) => {
  const W = (w - 1) * gap + 10, H = (h - 1) * gap + 10;
  const dots = [];
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      const x = 5 + j * gap, y = 5 + i * gap;
      const r = rMin + (rMax - rMin) * mask(x / W, y / H);
      if (r > .55) dots.push(<circle key={`${i}-${j}`} cx={x} cy={y} r={+r.toFixed(2)} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} fill="currentColor" className={className} style={style} aria-hidden="true">
      {dots}
    </svg>
  );
};

/* ---- Arch: gerbang lengkung, inner arch putih tembus ---- */
export const Arch = ({ className, style }) => (
  <svg viewBox="0 0 120 160" fill="none" className={className} style={style} aria-hidden="true">
    <path d="M10 160V70a50 50 0 0 1 100 0v90Z" fill="currentColor" />
    <path d="M34 160V76a26 26 0 0 1 52 0v84Z" fill="#FFFDF8" opacity=".26" />
  </svg>
);

/* ---- QuarterArcs: pita konsentris ter-crop dari sudut ---- */
export const QuarterArcs = ({ className, style }) => (
  <svg viewBox="0 0 170 170" fill="none" className={className} style={style} aria-hidden="true">
    {[152, 116, 80, 44].map((r, i) => (
      <circle key={r} cx="0" cy="170" r={r} stroke="currentColor" strokeWidth="30"
        strokeOpacity={[.9, .45, .68, .32][i]} />
    ))}
  </svg>
);

/* ---- WavyLines: trio gelombang (pengganti squiggle tunggal) ---- */
export const WavyLines = ({ className, style }) => (
  <svg viewBox="0 0 150 66" fill="none" className={className} style={style} aria-hidden="true">
    <path d="M6 12C26-2 44 26 66 14s42-16 78 2" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    <path d="M6 36c24 14 42-14 66-2s40 18 72 0" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    <path d="M6 58c20-14 44 12 68-2s36-14 70 4" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
  </svg>
);

/* ---- Sticker: seal 14 gelombang + wajah Welpie (dot-smile) ---- */
const sealPath = (() => {
  const n = 14, cx = 36, cy = 36, R = 30, r = 26.6;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (2 * Math.PI * i) / n - Math.PI / 2;
    const a1 = (2 * Math.PI * (i + 1)) / n - Math.PI / 2;
    const am = (a0 + a1) / 2;
    const x0 = (cx + R * Math.cos(a0)).toFixed(2), y0 = (cy + R * Math.sin(a0)).toFixed(2);
    const xm = (cx + r * Math.cos(am)).toFixed(2), ym = (cy + r * Math.sin(am)).toFixed(2);
    const x1 = (cx + R * Math.cos(a1)).toFixed(2), y1 = (cy + R * Math.sin(a1)).toFixed(2);
    d += (i === 0 ? `M${x0} ${y0}` : '') + `Q${xm} ${ym} ${x1} ${y1}`;
  }
  return d + 'Z';
})();

export const Sticker = ({ className, style, face = '#FFFDF8' }) => (
  <svg viewBox="0 0 72 72" className={className} style={style} aria-hidden="true">
    <path d={sealPath} fill="currentColor" />
    <circle cx="28.5" cy="32" r="2.7" fill={face} />
    <circle cx="43.5" cy="32" r="2.7" fill={face} />
    <path d="M28 40.5Q36 47 44 40.5" fill="none" stroke={face} strokeWidth="3.4" strokeLinecap="round" />
  </svg>
);

/* ---- Burst: pijar 8 sinar (lebih grafis daripada sparkle) ---- */
export const Burst = ({ className, style }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} style={style} aria-hidden="true">
    <path d="M24 5v9M24 34v9M5 24h9M34 24h9M11 11l6.4 6.4M30.6 30.6 37 37M37 11l-6.4 6.4M17.4 30.6 11 37"
      stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
);

/* ---- Receipt: struk POS (gerigi sobek bawah, garis item,
        divider putus, stempel bulat ganda) ---- */
export const Receipt = ({ className, style }) => (
  <svg viewBox="0 0 120 190" fill="none" className={className} style={style} aria-hidden="true">
    <path d="M12 14q0-6 6-6h84q6 0 6 6v136l-8 12-8-12-8 12-8-12-8 12-8-12-8 12-8-12-8 12-8-12-8 12-8-12Z"
      fill="currentColor" />
    <rect x="24" y="28" width="52" height="7" rx="3.5" fill="#FFFDF8" opacity=".5" />
    <rect x="24" y="44" width="72" height="7" rx="3.5" fill="#FFFDF8" opacity=".34" />
    <rect x="24" y="60" width="40" height="7" rx="3.5" fill="#FFFDF8" opacity=".34" />
    <path d="M24 82h72" stroke="#FFFDF8" strokeWidth="2.5" strokeDasharray="3 6" strokeLinecap="round" opacity=".55" />
    <rect x="24" y="94" width="64" height="7" rx="3.5" fill="#FFFDF8" opacity=".34" />
    <rect x="24" y="110" width="30" height="7" rx="3.5" fill="#FFFDF8" opacity=".5" />
    <circle cx="84" cy="118" r="13" stroke="#FFFDF8" strokeWidth="2.6" opacity=".6" />
    <circle cx="84" cy="118" r="5.5" stroke="#FFFDF8" strokeWidth="2.2" opacity=".6" />
  </svg>
);

/* ---- TearLine: lubang perforasi vertikal (sobekan struk) ---- */
export const TearLine = ({ className, style }) => (
  <svg viewBox="0 0 14 240" fill="currentColor" className={className} style={style} aria-hidden="true">
    {Array.from({ length: 10 }).map((_, i) => (
      <circle key={i} cx="7" cy={12 + i * 24} r="4.2" />
    ))}
  </svg>
);

/* ---- Barcode: barcode POS + label WELP·POS ---- */
const barcodeRects = (() => {
  const bars = [2.5, 1, 3, 1.5, 1, 4, 2, 1, 3, 1.5, 1, 2.5, 1, 3.5, 2, 1, 1.5, 3, 1, 2];
  let x = 0;
  const rects = bars.map((bw, i) => {
    const r = { x, w: bw };
    x += bw + (i % 3 === 0 ? 2.4 : 1.4);
    return r;
  });
  const total = x - 1.4;
  const off = (90 - total) / 2;
  return rects.map(r => ({ ...r, x: +(r.x + off).toFixed(2) }));
})();

export const Barcode = ({ className, style }) => (
  <svg viewBox="0 0 90 34" className={className} style={style} aria-hidden="true">
    <g fill="currentColor">
      {barcodeRects.map((r, i) => <rect key={i} x={r.x} y="0" width={r.w} height="21" rx="0.8" />)}
    </g>
    <text x="45" y="32" textAnchor="middle" fontSize="7.5" fontWeight="800"
      letterSpacing="2.5" fill="currentColor" style={{ fontFamily: 'inherit' }}>
      WELP·POS
    </text>
  </svg>
);
