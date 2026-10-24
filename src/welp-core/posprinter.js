// ============================================================
// WELP CORE, PRINTER & CASH DRAWER (v21.3)
// ------------------------------------------------------------
// Sesi printer ESC/POS yang DIBAGIKAN antar halaman: Hardware
// (Alat Tambahan) menghubungkan printer sekali, lalu POS memakai
// koneksi yang sama untuk struk & BUKA LACI (cash drawer) otomatis
// saat transaksi tunai. Semua metode aman dipanggil tanpa printer:
// gagal = diam (tidak pernah mengganggu alur kasir).
//
// Perintah kick drawer standar ESC/POS: ESC p 0 25 250
//   0x1B 0x70 0x00 0x19 0xFA  (pulse pin 2, 25ms on / 250ms off)
// Beberapa printer pakai pin 5 (0x01). Keduanya dikirim berurutan
// agar semua merek umum (Xprinter, Rongta, EPSON TM, Gprinter)
// ikut membuka.
// ============================================================

let _char = null;          // BluetoothRemoteGATTCharacteristic (write)
let _deviceName = '';
let _status = 'disconnected';   // disconnected | connecting | connected | error
const _listeners = new Set();

export const printerStatus = () => _status;
export const printerName = () => _deviceName;
export const printerConnected = () => _status === 'connected' && !!_char;

export const onPrinterChange = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};
const emit = () => { try { _listeners.forEach(fn => fn(_status, _deviceName)); } catch (e) { } };

const setStatus = (s, name) => { _status = s; if (name !== undefined) _deviceName = name; emit(); };

// Tulis byte ke printer (chunked, khas Web Bluetooth MTU kecil).
export const writeBytes = async (bytes) => {
  if (!_char) throw new Error('Printer belum terhubung');
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.slice(i, i + CHUNK);
    if (_char.properties.writeWithoutResponse) await _char.writeValueWithoutResponse(slice);
    else await _char.writeValue(slice);
    await new Promise(r => setTimeout(r, 18));
  }
};

// Hubungkan printer Bluetooth (dipanggil dari Alat Tambahan / kasir).
export const connectPrinter = async () => {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Browser tidak mendukung Web Bluetooth. Gunakan Chrome di Android/Desktop.');
  }
  setStatus('connecting');
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      ],
    });
    device.addEventListener('gattserverdisconnected', () => { _char = null; setStatus('disconnected', ''); });
    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    let writeChar = null;
    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      for (const c of chars) { if (c.properties.write || c.properties.writeWithoutResponse) { writeChar = c; break; } }
      if (writeChar) break;
    }
    if (!writeChar) throw new Error('Karakteristik tulis tidak ditemukan di printer');
    _char = writeChar;
    setStatus('connected', device.name || 'Bluetooth Printer');
    return device.name || 'Bluetooth Printer';
  } catch (e) {
    setStatus('error');
    throw e;
  }
};

export const disconnectPrinter = () => {
  try { _char = null; } catch (e) { }
  setStatus('disconnected', '');
};

// BUKA LACI KAS (cash drawer) via printer thermal yang terhubung.
// return: 'opened' | 'no-printer' (tidak menggagalkan alur kasir).
export const kickCashDrawer = async () => {
  if (!printerConnected()) return 'no-printer';
  try {
    const pin0 = [0x1B, 0x70, 0x00, 0x19, 0xFA];   // ESC p 0 (pin 2)
    const pin1 = [0x1B, 0x70, 0x01, 0x19, 0xFA];   // ESC p 1 (pin 5)
    await writeBytes(new Uint8Array(pin0));
    await writeBytes(new Uint8Array(pin1));
    return 'opened';
  } catch (e) {
    return 'no-printer';
  }
};

// Buka laci otomatis saat penjualan TUNAI bila pengaturan aktif.
export const autoKickDrawer = async () => {
  try { if (localStorage.getItem('cash_drawer_auto') !== '1') return 'off'; } catch (e) { return 'off'; }
  return await kickCashDrawer();
};

// Getar singkat sebagai umpan balik sentuh kasir (aman di semua device).
export const haptic = (ms = 12) => {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
};

// Struk ESC/POS generik (dipakai Hardware test print & kasir bila BT aktif).
export const escposReceipt = ({ title, lines, paper }) => {
  const enc = new TextEncoder();
  const width = paper === '80mm' ? 48 : 32;
  const out = [];
  const push = (arr) => arr.forEach(b => out.push(b));
  const text = (str) => push(Array.from(enc.encode(str)));
  push([0x1B, 0x40]);                     // init
  push([0x1B, 0x61, 0x01]);               // center
  push([0x1B, 0x21, 0x30]); text((title || 'WELP') + '\n');  // double strike
  push([0x1B, 0x21, 0x00]);
  text('-'.repeat(width) + '\n');
  push([0x1B, 0x61, 0x00]);               // left
  (lines || []).forEach(l => text(l + '\n'));
  text('-'.repeat(width) + '\n');
  push([0x1B, 0x61, 0x01]); text('Terima kasih\n');
  push([0x0A, 0x0A, 0x0A]);
  push([0x1D, 0x56, 0x00]);               // cut
  return new Uint8Array(out);
};

export const printReceiptBytes = async (bytes) => {
  if (!printerConnected()) return false;
  try { await writeBytes(bytes); return true; } catch (e) { return false; }
};

// ============================================================
// v21.5, LOGO THERMAL OTOMATIS + STRUK & LAPORAN MODERN
// ------------------------------------------------------------
// Masalah klasik: logo perusahaan biasanya JPEG / PNG berlatar
// putih (tidak transparan), sedangkan printer thermal hanya
// mengenal hitam-putih. WELP mengolah logo otomatis:
//   • PNG transparan      -> gambar diambil dari channel alpha,
//                            latar dihilangkan, hasil = bentuk logo.
//   • JPEG / PNG solid    -> DETEKSI TEPI (Sobel) sehingga hasil
//                            = SKETSA OUTLINE logo, latar hilang.
//   • Gagal memuat / tanpa logo -> pemanggil memakai logo WELP.
// Semua fungsi aman: gagal = return null, tidak pernah throw.
// ============================================================

const _logoCache = new Map();

const loadImageEl = (src) => new Promise((resolve) => {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  } catch (e) { resolve(null); }
});

/**
 * Ubah gambar jadi bitmap 1-bit siap raster printer thermal.
 * @returns {Promise<{w:number,h:number,bytes:Uint8Array}|null>}
 */
export const logoRasterBits = async (src, { maxW = 320, mode = 'auto' } = {}) => {
  if (!src || typeof document === 'undefined') return null;
  const key = `${String(src).slice(0, 120)}|${maxW}|${mode}`;
  if (_logoCache.has(key)) return _logoCache.get(key);
  const img = await loadImageEl(src);
  if (!img) { _logoCache.set(key, null); return null; }
  try {
    const ratio = img.naturalHeight / (img.naturalWidth || 1);
    const w = Math.max(8, Math.min(maxW, img.naturalWidth || maxW));
    const h = Math.max(8, Math.round(w * (ratio || 0.4)));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Deteksi latar transparan (sampling alpha).
    let transparent = 0, sampled = 0;
    for (let i = 3; i < data.length; i += 4 * 7) { sampled++; if (data[i] < 200) transparent++; }
    const hasAlpha = sampled > 0 && (transparent / sampled) > 0.08;

    // Gray + alpha mask
    const gray = new Float32Array(w * h);
    const alpha = new Uint8Array(w * h);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      alpha[p] = data[i + 3];
    }

    // bits[p] = 1 berarti TINTA (hitam di kertas).
    let bits;
    if (hasAlpha && mode !== 'sketch') {
      // Logo transparan: tinta = area opaque yang cukup gelap.
      bits = new Uint8Array(w * h);
      for (let p = 0; p < w * h; p++) bits[p] = (alpha[p] > 128 && gray[p] < 190) ? 1 : 0;
    } else {
      // Logo berlatar: sketsa outline via deteksi tepi Sobel.
      bits = new Uint8Array(w * h);
      const at = (x, y) => gray[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const gx =
            (at(x - 1, y - 1) * -1) + (at(x + 1, y - 1)) +
            (at(x - 1, y) * -2) + (at(x + 1, y) * 2) +
            (at(x - 1, y + 1) * -1) + (at(x + 1, y + 1));
          const gy =
            (at(x - 1, y - 1) * -1) + (at(x, y - 1) * -2) + (at(x + 1, y - 1) * -1) +
            (at(x - 1, y + 1)) + (at(x, y + 1) * 2) + (at(x + 1, y + 1));
          const mag = Math.sqrt(gx * gx + gy * gy);
          bits[y * w + x] = mag > 110 ? 1 : 0;
        }
      }
      // Perketat: hilangkan titik soliter (noise) sederhana.
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p = y * w + x;
          if (!bits[p]) continue;
          const n = bits[p - 1] + bits[p + 1] + bits[p - w] + bits[p + w];
          if (n === 0) bits[p] = 0;
        }
      }
    }

    // Pack 1-bit per 8 piksel (MSB dulu) + raster GS v 0.
    const rowBytes = Math.ceil(w / 8);
    const bytes = new Uint8Array(rowBytes * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bits[y * w + x]) bytes[y * rowBytes + (x >> 3)] |= (0x80 >> (x & 7));
      }
    }
    const out = { w, h, bytes, rowBytes };
    _logoCache.set(key, out);
    return out;
  } catch (e) {
    _logoCache.set(key, null);
    return null;
  }
};

const rasterCmd = ({ w, h, bytes, rowBytes }) => {
  const out = [0x1D, 0x76, 0x30, 0x00, rowBytes & 0xFF, (rowBytes >> 8) & 0xFF, h & 0xFF, (h >> 8) & 0xFF];
  return out.concat(Array.from(bytes));
};

// ---- Util teks struk modern (tanpa pola "- - - -" kuno) ----
const enc = new TextEncoder();
const LINE = { thin: '\u2500', double: '\u2550' };   // \u2500 garis tipis penuh, \u2550 garis ganda

const money = (v) => (Number(v) || 0).toLocaleString('id-ID');

const twoCol = (left, right, width) => {
  const r = String(right);
  const l = String(left);
  const space = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(space) + r;
};

/**
 * Struk ESC/POS modern: logo di atas (medium), garis tipis penuh,
 * total tebal (double strike), watermark "by WELP" kecil di bawah.
 * @param {object} p {title, lines, paper, logoBits, footer, showTotal, total}
 */
export const escposReceiptV2 = ({ title, lines = [], paper = '80mm', logoBits = null, total = null, footer = '' }) => {
  const width = paper === '80mm' ? 48 : 32;
  const out = [];
  const push = (arr) => arr.forEach(b => out.push(b));
  const text = (str) => push(Array.from(enc.encode(str)));
  const center = (on) => push([0x1B, 0x61, on ? 0x01 : 0x00]);
  const bold = (on) => push([0x1B, 0x45, on ? 0x01 : 0x00]);
  const big = (on) => push([0x1D, 0x21, on ? 0x11 : 0x00]);   // ukuran 2x
  const rule = (ch = LINE.thin) => text(ch.repeat(width) + '\n');

  push([0x1B, 0x40]);                       // init
  center(true);
  if (logoBits) { push(rasterCmd(logoBits)); push([0x0A]); }
  if (title) { big(true); bold(true); text(title + '\n'); big(false); bold(false); }
  rule();
  center(false);
  (lines || []).forEach(l => text(l + '\n'));
  if (total != null) {
    rule();
    center(false); bold(true);
    text(twoCol('TOTAL', money(total), width) + '\n');
    bold(false);
  }
  rule(LINE.double);
  center(true);
  text((footer || 'Terima kasih sudah berbelanja') + '\n');
  text('by WELP\n');                        // watermark kecil bawaan
  push([0x0A, 0x0A, 0x0A]);
  push([0x1D, 0x56, 0x00]);                 // potong kertas
  return new Uint8Array(out);
};

/**
 * Laporan shift/settlement ESC/POS (X = sementara, Z = akhir hari).
 * Bagian mengikuti laporan retail: periode & kasir, customer & struk,
 * void, summary penjualan, metode bayar, jenis pesanan, kas & selisih.
 */
export const escposShiftReport = (r, { paper = '80mm', logoBits = null } = {}) => {
  const width = paper === '80mm' ? 48 : 32;
  const out = [];
  const push = (arr) => arr.forEach(b => out.push(b));
  const text = (str) => push(Array.from(enc.encode(str)));
  const center = (on) => push([0x1B, 0x61, on ? 0x01 : 0x00]);
  const bold = (on) => push([0x1B, 0x45, on ? 0x01 : 0x00]);
  const rule = (ch = LINE.thin) => text(ch.repeat(width) + '\n');
  const row = (l, rv, b = false) => { bold(b); text(twoCol(l, typeof rv === 'number' ? money(rv) : rv, width) + '\n'); bold(false); };

  push([0x1B, 0x40]);
  center(true);
  if (logoBits) { push(rasterCmd(logoBits)); push([0x0A]); }
  bold(true); text((r.store?.name || 'LAPORAN SHIFT') + '\n'); bold(false);
  if (r.store?.address) text(r.store.address + '\n');
  if (r.store?.phone) text(r.store.phone + '\n');
  rule();
  bold(true); text(`LAPORAN ${r.kind === 'Z' ? 'AKHIR HARI (Z)' : 'SEMENTARA (X)'}\n`); bold(false);
  text(`No: ${r.reportNo}\n`);
  text(`${r.dateKey}  ${r.startTime || ''}${r.endTime ? ' s.d. ' + r.endTime : ''}\n`);
  text(`Kasir: ${r.cashier || '-'}${r.branchName ? '  ' + r.branchName : ''}\n`);
  rule();

  row('Total Customer', r.customers);
  row('Struk Penjualan', r.receipts);
  rule();

  bold(true); text('VOID\n'); bold(false);
  row('Void Bill', `${r.voidBills.count} x`);
  row('Nilai Void Bill', r.voidBills.amount);
  row('Void Item', `${r.voidItems.count} x`);
  row('Nilai Void Item', r.voidItems.amount);
  rule();

  bold(true); text('RINGKASAN PENJUALAN\n'); bold(false);
  row('Total Omzet', r.sales.gross);
  row('Diskon', r.sales.discount);
  row('Total Qty', r.sales.qty);
  row('Total Item', r.sales.itemLines);
  bold(true); row('Omzet Bersih', r.sales.net, true); bold(false);
  rule();

  bold(true); text('METODE PEMBAYARAN\n'); bold(false);
  r.byMethod.forEach(m => row(`${m.method} (${m.count})`, m.amount));
  if (!r.byMethod.length) text('(tidak ada transaksi)\n');
  rule();

  bold(true); text('JENIS PESANAN\n'); bold(false);
  r.byType.forEach(t2 => row(`${t2.type} (${t2.count})`, t2.amount));
  if (!r.byType.length) text('(tidak ada transaksi)\n');
  rule();

  bold(true); text('SETTLEMENT KAS\n'); bold(false);
  row('Modal Awal', r.cash.opening);
  row('Penjualan Tunai', r.cash.cashSales);
  row('Kas Masuk', r.cash.cashIn);
  row('Kas Keluar', r.cash.cashOut);
  bold(true); row('Kas Seharusnya', r.cash.expected, true); bold(false);
  if (r.cash.counted != null) {
    row('Uang Dihitung', r.cash.counted);
    bold(true);
    text(twoCol('SELISIH', money(r.cash.selisih), width) + '\n');
    bold(false);
  }
  rule(LINE.double);
  center(true);
  text(`Dicetak ${new Date().toLocaleString('id-ID')} oleh kasir\n`);
  text('by WELP\n');
  push([0x0A, 0x0A, 0x0A]);
  push([0x1D, 0x56, 0x00]);
  return new Uint8Array(out);
};

/** Cetak struk kasir versi modern dari data order (dipakai kasir). */
export const printOrderReceipt = async (order, { profile = {}, paper = '80mm' } = {}) => {
  const logoSrc = profile?.logo || null;
  const logoBits = logoSrc ? await logoRasterBits(logoSrc, { maxW: 280 }) : null;
  const lines = [];
  const addr = profile?.address || '';
  if (addr) lines.push(addr);
  if (profile?.wa || profile?.phone) lines.push(profile.wa || profile.phone);
  lines.push(`No: #${String(order.id || '').slice(-8).toUpperCase()}`);
  lines.push(new Date(order.date).toLocaleString('id-ID'));
  lines.push(`Kasir: ${order.cashier || profile?.adminName || '-'}${order.buyer ? '  Pel: ' + order.buyer : ''}`);
  (order.items || []).forEach(i => {
    lines.push(`${i.qty}x ${i.name}`);
    lines.push('   ' + money(i.price * i.qty));
    (i.modifiers || []).forEach(mg => {
      const lbl = (mg.options || []).map(o => o.label).join(', ');
      if (lbl) lines.push('   + ' + lbl);
    });
  });
  if (order.discountAmt > 0) lines.push('Diskon: ' + money(order.discountAmt));
  if (order.taxAmt > 0) lines.push('Pajak: ' + money(order.taxAmt));
  if (order.serviceAmt > 0) lines.push('Servis: ' + money(order.serviceAmt));
  const method = order.paymentMethod || (order.payments?.[0]?.method) || '';
  if (method) lines.push(`Bayar: ${method}${method === 'Cash' && order.change ? '  Kembali: ' + money(order.change) : ''}`);
  if (Number(order.poinEarned || 0) > 0) lines.push(`+${order.poinEarned} poin member`);
  const bytes = escposReceiptV2({
    title: profile?.name || 'WELP',
    lines, paper, logoBits,
    total: order.total,
    footer: 'Terima kasih sudah berbelanja',
  });
  return printReceiptBytes(bytes);
};
