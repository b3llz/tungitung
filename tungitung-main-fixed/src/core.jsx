// ============================================================
// CORE — logika & konfigurasi bersama (logika dipertahankan 100%
// dari versi teraudit; hanya presentasinya yang dibangun ulang).
// ============================================================
import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc,
  onSnapshot, serverTimestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Uang, Qris, Dompet } from './welp-icons.jsx';

export const safeParse = (key, fallback = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) { return fallback; }
};

// --- KONFIGURASI FIREBASE (SESUAIKAN DENGAN MILIKMU) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "costlab-f221c.firebaseapp.com",
  projectId: "costlab-f221c",
  storageBucket: "costlab-f221c.firebasestorage.app",
  messagingSenderId: "64337345213",
  appId: "1:64337345213:web:389610b43797f0e55a15d4"
};

// Robustness: kalau env key tidak ada, jangan crash seluruh app —
// fitur lisensi/login menampilkan pesan koneksi yang jelas.
let app = null, db = null, auth = null;
let firebaseInitError = null;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  firebaseInitError = e;
  console.error("Firebase init gagal (fitur lisensi/login tidak tersedia):", e);
}
export { db, auth, firebaseInitError };

export const BRANCH_ID = "PUSAT";
export const isPro = (info) => info && (info.type === 'PRO' || info.type === 'PREMIUM');

export const formatIDR = (number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR',
  minimumFractionDigits: 0, maximumFractionDigits: 0
}).format(number || 0);

export const formatNumberDisplay = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '';
  if (val === 0) return '0';
  const num = val.toString().replace(/[^0-9.]/g, '');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// ============================================================
// PERHITUNGAN TAGIHAN TERPUSAT (Subtotal, Diskon, Pajak, Service)
// Dipakai di Kasir (POS), Self-Order, dan Struk supaya konsisten.
// ============================================================
export const getBizConfig = () => {
  try { return JSON.parse(localStorage.getItem('discount_tax_db') || '{"tax":0,"service":0,"globalDiscount":0}'); }
  catch (e) { return { tax: 0, service: 0, globalDiscount: 0 }; }
};

export const computeOrderTotals = (items = [], cfg = getBizConfig(), extraDiscount = 0) => {
  const subtotal = items.reduce((a, b) => a + (b.price * b.qty), 0);
  const discPercent = Number(cfg.globalDiscount || 0);
  const discountAmt = Math.round((subtotal * discPercent) / 100) + Number(extraDiscount || 0);
  const base = Math.max(0, subtotal - discountAmt);
  const taxAmt = Math.round((base * Number(cfg.tax || 0)) / 100);
  const serviceAmt = Math.round((base * Number(cfg.service || 0)) / 100);
  const total = base + taxAmt + serviceAmt;
  return { subtotal, discountAmt, taxAmt, serviceAmt, total, taxPercent: Number(cfg.tax || 0), servicePercent: Number(cfg.service || 0), discPercent };
};

// ============================================================
// SISTEM BAHASA (i18n) - ringan, berbasis localStorage
// ============================================================
export const TRANSLATIONS = {
  id: {
    home: 'Beranda',
    cashier: 'Kasir (POS)', hpp: 'Kalkulator HPP', history: 'Riwayat Transaksi', cashout: 'Manajemen Kas Keluar',
    discount: 'Diskon, Pajak & Biaya', mainCat: 'Kategori Utama', operational: 'Operasional', business: 'Manajemen Bisnis',
    stock: 'Stok Barang', opname: 'Stok Opname', inout: 'Barang Masuk & Keluar', stockHistory: 'Riwayat Stok & Expired',
    supplier: 'Database Supplier', report: 'Laporan & Analisa', employee: 'Manajemen Cabang', outlet: 'Multi Outlet',
    karyawan: 'Manajemen Karyawan', absensi: 'Kelola Absensi', payroll: 'Manajemen Penggajian', absenKu: 'Absensi Saya',
    profile: 'Identitas Toko (Profil)', payment: 'Metode Pembayaran', hardware: 'Alat Tambahan (Hardware)', settings: 'Pengaturan Utama',
    logout: 'Keluar (Logout)', menu: 'Menu', staffNav: 'Navigasi Karyawan', access: 'Akses',
    shop: 'Kasir', orders: 'Pesanan', tables: 'Meja', products: 'Daftar Produk', search: 'Ketik SKU / Nama Produk...',
    checkout: 'Checkout', total: 'Total Tagihan', subtotal: 'Subtotal', tax: 'Pajak', service: 'Biaya Layanan', disc: 'Diskon',
    payMethod: 'Metode Pembayaran', lang: 'Bahasa Aplikasi'
  },
  en: {
    home: 'Home',
    cashier: 'Cashier (POS)', hpp: 'COGS Calculator', history: 'Transaction History', cashout: 'Cash-Out Management',
    discount: 'Discount, Tax & Fees', mainCat: 'Main Category', operational: 'Operations', business: 'Business Management',
    stock: 'Inventory', opname: 'Stock Opname', inout: 'Stock In & Out', stockHistory: 'Stock & Expiry History',
    supplier: 'Supplier Database', report: 'Reports & Analytics', employee: 'Branch Management', outlet: 'Multi Outlet',
    karyawan: 'Staff Management', absensi: 'Attendance Control', payroll: 'Payroll Management', absenKu: 'My Attendance',
    profile: 'Store Identity (Profile)', payment: 'Payment Methods', hardware: 'Hardware Devices', settings: 'Main Settings',
    logout: 'Logout', menu: 'Menu', staffNav: 'Staff Navigation', access: 'Access',
    shop: 'Cashier', orders: 'Orders', tables: 'Tables', products: 'Product List', search: 'Type SKU / Product name...',
    checkout: 'Checkout', total: 'Total Bill', subtotal: 'Subtotal', tax: 'Tax', service: 'Service Fee', disc: 'Discount',
    payMethod: 'Payment Method', lang: 'App Language'
  }
};
export const getLang = () => localStorage.getItem('app_lang') || 'id';
export const t = (key) => (TRANSLATIONS[getLang()] && TRANSLATIONS[getLang()][key]) || (TRANSLATIONS.id[key] || key);

export const syncSession = async (action, info) => {
  try {
    if (!info || !db) return;
    let ip = 'Unknown';
    try { const r = await fetch('https://api.ipify.org?format=json'); const j = await r.json(); ip = j.ip; } catch (e) { }
    await addDoc(collection(db, "logs"), {
      timestamp: new Date().toISOString(),
      action: action,
      id: info.id,
      tenant: info.tenant,
      ip: ip,
      device: navigator.userAgent
    });
  } catch (e) { console.log("Log Error", e); }
};

// --- DATA & KONSTANTA ---
export const MATERIAL_UNITS = ["gr", "kg", "ml", "liter", "pcs", "pack", "sdm", "sdt"];

export const VARIABLE_COST_TYPES = {
  "Kemasan": { label: "Isi per Pack", units: ["pcs", "lbr", "pack"], icon: null },
  "Tenaga Kerja": { label: "Kapasitas per Jam", units: ["jam", "menit", "hari"], icon: null },
  "Listrik/Gas": { label: "Estimasi Pakai", units: ["jam", "kwh", "tabung"], icon: null },
  "Bahan Baku": { label: "Isi Kemasan", units: ["gr", "ml", "pcs"], icon: null }
};

export const WALLET_TYPES = ["Gopay", "OVO", "Dana", "ShopeePay", "LinkAja"];

export const loadXLSX = async () => {
  if (window.XLSX) return window.XLSX;
  try {
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
    document.head.appendChild(script);
    return new Promise((resolve) => { script.onload = () => resolve(window.XLSX); });
  } catch (e) { throw new Error("Gagal load library Excel"); }
};

export const loadExcelJS = async () => {
  if (window.ExcelJS) return window.ExcelJS;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  document.head.appendChild(script);
  return new Promise((resolve, reject) => {
    script.onload = () => resolve(window.ExcelJS);
    script.onerror = () => reject(new Error('Gagal memuat library Excel'));
  });
};

// QR di-generate via QuickChart API (tanpa library qrcode tambahan)
export const qrUrl = (text, size = 220) => 'https://quickchart.io/qr?text=' + encodeURIComponent(text) + '&size=' + size + '&margin=1&ecLevel=M';

// ============================================================
// QRIS DINAMIS (EMVCo) — parse payload QRIS statis, sisipkan tag 54
// (nominal), tandai 01="12" (dinamis), hitung ulang CRC16-CCITT.
// Pelanggan scan → nominal langsung terisi otomatis di app bank.
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

// return payload dinamis siap di-render, atau null jika payload tidak valid.
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

// ============================================================
// KEAMANAN SELF-ORDER — sesi meja ber-token + pengikatan perangkat.
// Hanya 1 perangkat (yang memindai QR) yang bisa memesan per sesi;
// mengubah angka meja di URL tidak berpengaruh tanpa token sah.
// ============================================================
export const makeTableToken = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const getDeviceId = () => {
  let d = localStorage.getItem('welp_device_id');
  if (!d) {
    d = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem('welp_device_id', d); } catch (e) { }
  }
  return d;
};

// ============================================================
// SINKRONISASI REALTIME (Firestore tenants/{lic}/{name})
// Sumber kebenaran Firestore (onSnapshot), mirror localStorage
// agar tetap jalan offline. Offline → tulisan tetap tersimpan
// lokal dan SDK mengantre push saat online kembali.
// ============================================================
export const useTenantCol = (licenseInfo, name, localKey) => {
  const [items, setItems] = useState(() => safeParse(localKey, []));
  const [live, setLive] = useState(false);
  const licId = licenseInfo?.id || null;

  useEffect(() => {
    if (!licId || !db) { setLive(false); return; }
    const ref = collection(db, 'tenants', licId, name);
    const unsub = onSnapshot(ref, snap => {
      const rows = snap.docs.map(d => ({ ...d.data(), cid: d.id }));
      // Offline & cache kosong: pertahankan mirror lokal (data terakhir
      // yang diketahui perangkat) — jangan dikosongkan oleh snapshot
      // from-cache yang kosong. Server tetap sumber kebenaran saat online.
      const local = safeParse(localKey, []);
      if (snap.metadata && snap.metadata.fromCache && rows.length === 0 && local.length > 0) {
        setLive(false);
        return;
      }
      setItems(rows); setLive(true);
      try { localStorage.setItem(localKey, JSON.stringify(rows)); } catch (e) { }
    }, err => {
      console.warn('[WELP sync:' + name + ']', err.code || err.message);
      setLive(false);
    });
    return () => unsub();
  }, [licId, name]);

  const pushLocal = (rows) => {
    setItems(rows);
    try { localStorage.setItem(localKey, JSON.stringify(rows)); } catch (e) { }
  };

  // Tambah baris: id klien (cid) dipakai sebagai doc id Firestore →
  // tidak ada duplikasi lokal vs server. serverAt = serverTimestamp
  // (waktu terverifikasi server, tidak bisa dimanipulasi dari klien).
  const addRow = (row) => {
    const id = `${name.slice(0, 3)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const rec = { ...row, cid: id, createdAt: Date.now() };
    pushLocal([rec, ...safeParse(localKey, []).filter(r => r.cid !== id)]);
    if (licId && db) {
      setDoc(doc(db, 'tenants', licId, name, id), { ...rec, serverAt: serverTimestamp() })
        .catch(e => console.warn('[WELP write:' + name + ']', e.code || e.message));
    }
    return id;
  };

  const updateRow = (id, patch) => {
    const next = safeParse(localKey, []).map(r => r.cid === id ? { ...r, ...patch } : r);
    pushLocal(next);
    if (licId && db) {
      setDoc(doc(db, 'tenants', licId, name, id), { ...patch, serverAt: serverTimestamp() }, { merge: true })
        .catch(e => console.warn('[WELP update:' + name + ']', e.code || e.message));
    }
  };

  const removeRow = (id) => {
    pushLocal(safeParse(localKey, []).filter(r => r.cid !== id));
    if (licId && db) {
      deleteDoc(doc(db, 'tenants', licId, name, id))
        .catch(e => console.warn('[WELP del:' + name + ']', e.code || e.message));
    }
  };

  return { items, live, addRow, updateRow, removeRow };
};

// Ambil waktu server (Firestore Timestamp) atau fallback waktu lokal.
// return {ms, source: 'server'|'device'}
export const trustedTime = (rec) => {
  const s = rec?.serverAt;
  if (s && typeof s.toDate === 'function') return { ms: s.toDate().getTime(), source: 'server' };
  if (s && s.seconds) return { ms: s.seconds * 1000, source: 'server' };
  return { ms: rec?.createdAt || Date.now(), source: 'device' };
};

// Geolocation berjanji (dipakai absensi & titik lokasi cabang).
export const getLocation = (timeout = 12000) => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error('Geolocation tidak didukung browser ini'));
  navigator.geolocation.getCurrentPosition(
    pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0) }),
    err => reject(err), { enableHighAccuracy: true, timeout, maximumAge: 0 }
  );
});

// Jarak meter antar dua titik (haversine) — cek absen dekat cabang.
export const distanceMeters = (a, b) => {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
};

// Kompres gambar → dataURL (untuk bukti transfer & QRIS upload).
export const fileToDataUrl = (file, maxSide = 900, quality = 0.72) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = () => reject(new Error('Gagal membaca file'));
  r.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('Bukan gambar yang valid'));
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', quality));
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
});

// Decode QR dari gambar (upload QRIS) via BarcodeDetector bila ada.
export const decodeQrFromImage = async (dataUrl) => {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    const det = new window.BarcodeDetector({ formats: ['qr_code'] });
    const codes = await det.detect(cv);
    return codes?.[0]?.rawValue || null;
  } catch (e) { return null; }
};

// Tab hari ini (YYYY-MM-DD) lokal.
export const todayKey = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

// Tab tanggal dari timestamp ms tertentu (untuk grouping per hari).
export const dateKeyOf = (ms) => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

// ============================================================
// ATURAN ABSENSI (rules) — disimpan per cabang di Manajemen Cabang:
//   aturan: { jamMasuk: 'HH:MM', toleransi: menit, radius: meter }
// Dipakai halaman absensi karyawan & monitoring owner utk kategori.
// ============================================================
export const DEFAULT_ATURAN = { jamMasuk: '09:00', toleransi: 15, radius: 150 };
export const getAturan = (branch) => ({
  ...DEFAULT_ATURAN,
  ...(branch?.aturan || {}),
  toleransi: Number(branch?.aturan?.toleransi ?? DEFAULT_ATURAN.toleransi) || 0,
  radius: Number(branch?.aturan?.radius ?? DEFAULT_ATURAN.radius) || DEFAULT_ATURAN.radius,
});

// Kategori keterlambatan relatif jam masuk + toleransi.
// return { telatMin, status: 'tepat'|'telat' }
export const lateInfo = (ms, aturan) => {
  const a = getAturan({ aturan });
  const [h, m] = String(a.jamMasuk || '09:00').split(':').map(n => parseInt(n, 10) || 0);
  const d = new Date(ms);
  const batas = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m + a.toleransi, 0, 0);
  const telatMin = Math.round((d.getTime() - batas.getTime()) / 60000);
  return { telatMin: Math.max(0, telatMin), status: telatMin > 0 ? 'telat' : 'tepat' };
};

// Label hari lengkap Bahasa Indonesia: "Senin, 22 September 2025"
export const dayLabel = (ms) => new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const dayLabelShort = (ms) => new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });

// Ikon metode pembayaran (buddy WELP, dipakai lintas komponen)
export const getPaymentIcon = (type) => {
  if (type === 'Cash' || type === 'Split Bill') return <Uang className="w-4 h-4" />;
  if (type === 'QRIS') return <Qris className="w-4 h-4" />;
  return <Dompet className="w-4 h-4" />;
};
