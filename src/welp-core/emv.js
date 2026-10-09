// ============================================================
// WELP CORE — EMVCo / QRIS ENGINE (pure, tanpa React/Firebase)
// ------------------------------------------------------------
// Satu sumber kebenaran parsing & pembuatan payload QRIS.
// Dipakai core.jsx (re-export), paymentOps, dan unit test Node.
//   • parseEmv / crc16CCITT / verifyQrisCrc / qrisMeta
//   • buildDynamicQris   — statis → dinamis (tag 01=12, tag 54)
//   • buildIntentQris    — dinamis + paymentReference di tag 62/07
//     (Bill Number) tanpa menghapus sub-tag milik merchant.
// CRC16-CCITT (0xFFFF, poly 0x1021) sesuai spesifikasi EMVCo.
// ============================================================

export const crc16CCITT = (str) => {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

export const parseEmv = (payload) => {
  const out = {}; let i = 0;
  payload = String(payload || '').trim();
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > payload.length) break;
    out[tag] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
};

export const verifyQrisCrc = (payload) => {
  try {
    const p = String(payload || '').trim();
    if (p.length < 8) return false;
    // Payload valid = TLV ... + tag '63' len '04' + CRC(4 char hex).
    // Jadi BODY (payload minus 4 char terakhir) harus berakhir '6304',
    // lalu CRC dihitung atas body tsb. (Sebelumnya mengecek payload
    // penuh berakhir '6304' → validasi selalu false — bug v15 yang
    // membuat badge "CRC tidak valid" muncul untuk QRIS asli.)
    const body = p.slice(0, -4);
    if (!body.endsWith('6304')) return false;
    return crc16CCITT(body) === p.slice(-4).toUpperCase();
  } catch (e) { return false; }
};

export const qrisMeta = (payload) => {
  try {
    const m = parseEmv(payload);
    let mid = '';
    const t26 = m['26'] || '';
    const sub = parseEmv(t26);
    mid = sub['05'] || sub['02'] || '';
    return {
      type: m['01'] === '12' ? 'dinamis' : 'statis',
      merchant: m['59'] || null,
      city: m['60'] || null,
      merchantId: mid || null,
      nmid: sub['05'] || null,
      crcValid: verifyQrisCrc(payload),
      amount: m['54'] ? Number(m['54']) : null,
      country: m['58'] || null,
      currency: m['53'] || null
    };
  } catch (e) { return null; }
};

// statis → dinamis: nominal otomatis terisi saat pelanggan scan.
export const buildDynamicQris = (staticPayload, amount) => {
  try {
    const m = parseEmv(staticPayload);
    if (!m['00'] || !m['01']) return null;
    const amt = Number(amount);
    if (!isFinite(amt) || amt <= 0) return null;
    m['01'] = '12';                 // 11 = statis → 12 = dinamis
    m['54'] = amt.toFixed(2);       // Transaction Amount
    let p = '';
    Object.keys(m).filter(tag => tag !== '63').sort().forEach(tag => {
      const v = String(m[tag]);
      p += tag + String(v.length).padStart(2, '0') + v;
    });
    p += '6304';
    return p + crc16CCITT(p);
  } catch (e) { return null; }
};

// WELP PAYMENT CORE — QR dinamis + paymentReference (spec #16–18):
// reference unik ditanam di tag 62 sub-07 (Bill Number, EMVCo/QRIS)
// TANPA menghapus sub-tag milik merchant, CRC16 dihitung ulang.
export const buildIntentQris = (staticPayload, amount, paymentReference) => {
  if (!staticPayload) return null;
  const dyn = buildDynamicQris(staticPayload, amount);
  if (!dyn || !paymentReference) return dyn;
  try {
    const m = parseEmv(dyn);
    const ref = String(paymentReference).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 25);
    if (!ref) return dyn;
    const inner62 = m['62'] ? parseEmv(m['62']) : {};
    inner62['07'] = ref;                      // sub-tag 07 = Bill Number
    let inner = '';
    Object.keys(inner62).sort().forEach(k => {
      const v = String(inner62[k]);
      inner += k + String(v.length).padStart(2, '0') + v;
    });
    m['62'] = inner;
    let p = '';
    Object.keys(m).filter(tag => tag !== '63').sort().forEach(tag => {
      const v = String(m[tag]);
      p += tag + String(v.length).padStart(2, '0') + v;
    });
    p += '6304';
    return p + crc16CCITT(p);
  } catch (e) { return dyn; }                 // QR dinamis tanpa ref tetap sah
};
