// ============================================================
// CORE — logika & konfigurasi bersama (logika dipertahankan 100%
// dari versi teraudit; hanya presentasinya yang dibangun ulang).
// ============================================================
import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc,
  onSnapshot, serverTimestamp, updateDoc, deleteField,
  getDocs, writeBatch
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getStorage, ref as sRef, uploadString, getDownloadURL } from "firebase/storage";
import jsQR from 'jsqr';
import { Uang, Qris, Dompet } from './welp-icons.jsx';

export const safeParse = (key, fallback = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) { return fallback; }
};

// v15 F0 — SANITASI SESI: hapus SEMUA kredensial dari objek sesi
// (dipakai lock.jsx, App.jsx, pos.jsx saat menulis app_license).
// _branchList kini hanya menyimpan metadata: cid, name, role.
export const sanitizeSession = (data) => {
  if (!data || typeof data !== 'object') return data;
  const { password, ownerPin, cred, _branchList, ...rest } = data;
  if (Array.isArray(_branchList)) {
    rest._branchList = _branchList.map(b => ({
      cid: b.cid, name: b.name, role: b.role
    }));
  }
  return rest;
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

// ============================================================
// v15 · F0 — KEAMANAN KREDENSIAL & SESI
// (1) Kredensial (password owner, PIN cabang/station/karyawan,
//     ownerPin) kini disimpan sebagai HASH PBKDF2-SHA256 dgn salt
//     acak per kredensial — plaintext tidak lagi tersimpan di
//     Firestore. Data lama yang masih plaintext tetap sah dan
//     OTOMATIS di-upgrade ke hash pada login sukses berikutnya.
// (2) ensureAuth() — sesi anonymous Firebase dibuka sebelum read
//     Firestore apapun, sebagai prasyarat rules v15
//     (request.auth != null). Bila provider Anonymous belum
//     diaktifkan di Firebase Console, app tetap jalan dgn rules
//     lama (flag anonAuthBlocked untuk peringatan dev panel).
// (3) pinGate — throttle percobaan PIN per perangkat: 5 gagal →
//     lockout 5 menit (pesan jelas ke pengguna).
// ============================================================

const PBKDF2_ITERS = 60000;
const bufToHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
export const randomSalt = (bytes = 16) => bufToHex(crypto.getRandomValues(new Uint8Array(bytes)));

export const hashSecret = async (secret, saltHex, iters = PBKDF2_ITERS) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(String(secret)), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = Uint8Array.from(String(saltHex).match(/.{2}/g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: iters, hash: 'SHA-256' }, key, 256);
  return bufToHex(bits);
};

// Bentuk tersimpan di doc: cred: { alg, iters, salt, hash }
export const makeCred = async (secret) => {
  const salt = randomSalt();
  return { alg: 'pbkdf2-sha256', iters: PBKDF2_ITERS, salt, hash: await hashSecret(secret, salt) };
};

// perbandingan konstan-waktu sederhana (anti timing scan)
const safeEq = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

// Verifikasi input terhadap record: cek cred (hash) dulu, lalu
// fallback field plaintext legacy (pin/password/ownerPin).
// credField: nama field hash — 'cred' (PIN tunggal), 'credPass'/'credPin'
// dipakai record yang punya DUA kredensial (cabang: password + PIN).
export const verifyCred = async (input, rec, legacyField = 'pin', credField = 'cred') => {
  const s = String(input ?? '');
  if (!s || !rec) return false;
  const c = rec[credField];
  if (c && c.hash && c.salt) {
    try { return safeEq(await hashSecret(s, c.salt, c.iters || PBKDF2_ITERS), c.hash); }
    catch (e) { return false; }
  }
  return rec[legacyField] != null && safeEq(String(rec[legacyField]), s);
};

// rec masih plaintext (belum ter-hash)? — untuk auto-upgrade & UI.
export const credIsLegacy = (rec, credField = 'cred') => !!rec && !(rec[credField] && rec[credField].hash && rec[credField].salt);

// Setelah verifikasi legacy sukses: ganti plaintext → hash (hapus
// field plaintext). Best-effort; bila gagal, upgrade dicoba lagi
// pada login sukses berikutnya.
export const upgradeCred = async (pathSegments, input, legacyField, credField = 'cred') => {
  try {
    if (!db || !input) return false;
    const cred = await makeCred(input);
    const patch = { [credField]: cred };
    if (legacyField) patch[legacyField] = deleteField();
    await updateDoc(doc(db, ...pathSegments), patch);
    return true;
  } catch (e) { return false; }
};

// --- AUTH GATE (anonymous) -------------------------------------------
let _anonOk = null;   // null = belum dicoba
export const anonAuthBlocked = () => _anonOk === false;
export const ensureAuth = async () => {
  if (!auth) return false;
  if (auth.currentUser) return true;
  try {
    await signInAnonymously(auth);
    _anonOk = true;
    return true;
  } catch (e) {
    _anonOk = false;
    console.warn('[WELP auth] Sesi anonim tidak tersedia (' + (e.code || '') + '). Publish rules v15 setelah mengaktifkan provider Anonymous.', e.code || e);
    return false;
  }
};

// --- PIN GATE (throttle percobaan per perangkat) ----------------------
const PIN_GATE_KEY = 'welp_pin_gate';
export const PIN_GATE_MAX = 5;
export const PIN_GATE_LOCK_MS = 5 * 60 * 1000;
const pinGateRead = () => { try { return JSON.parse(localStorage.getItem(PIN_GATE_KEY) || '{}'); } catch (e) { return {}; } };
const pinGateWrite = (d) => { try { localStorage.setItem(PIN_GATE_KEY, JSON.stringify(d)); } catch (e) { } };
export const pinGate = {
  status(key) {
    const d = pinGateRead()[key];
    if (!d) return { locked: false, msLeft: 0, fails: 0 };
    const left = (d.lockedUntil || 0) - Date.now();
    return { locked: left > 0, msLeft: Math.max(0, left), fails: d.n || 0 };
  },
  fail(key) {
    const all = pinGateRead();
    const d = all[key] || { n: 0 };
    d.n = (d.n || 0) + 1;
    if (d.n >= PIN_GATE_MAX) { d.lockedUntil = Date.now() + PIN_GATE_LOCK_MS; d.n = 0; }
    all[key] = d; pinGateWrite(all);
    return pinGate.status(key);
  },
  reset(key) { const all = pinGateRead(); delete all[key]; pinGateWrite(all); }
};
export const pinGateMsg = (st) => {
  if (!st.locked) return '';
  const s = Math.ceil(st.msLeft / 1000);
  const m = Math.floor(s / 60), d = s % 60;
  return `Terlalu banyak percobaan salah. Coba lagi dalam ${m > 0 ? m + ' menit ' : ''}${d} detik.`;
};

export const BRANCH_ID = "PUSAT";
export const isPro = (info) => info && (info.type === 'PRO' || info.type === 'PREMIUM');

export const formatIDR = (number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR',
  minimumFractionDigits: 0, maximumFractionDigits: 0
}).format(number || 0);

// v15 F4-H3 — format ribuan gaya Indonesia (TITIK) selaras formatIDR.
// Input longgar: terima "150.5" (desimal titik) & "150,5" (desimal koma).
export const formatNumberDisplay = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '';
  if (Number(val) === 0) return '0';
  const raw = String(val).trim().replace(/\./g, '').replace(',', '.');
  const num = Number(raw);
  if (!isFinite(num)) return '';
  const [int, dec] = String(num).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + dec : '');
};
// parse balik teks ribuan id-ID → Number (untuk NumericInput dkk).
export const parseNumberID = (txt) => {
  const n = Number(String(txt ?? '').trim().replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
};

// ============================================================
// v15 · F1 — DATA KOMERSIAL KE FIRESTORE (menutup split-brain B1)
// Data komersial kini tersimpan di Firestore tenants/{lic}/<koleksi>
// dan tetap di-mirror ke localStorage agar offline & kompatibel dengan
// seluruh pembaca lama.
//   • hydrateDb(lic)  : sekali setelah login — bila Firestore kosong &
//     lokal ada data → IMPORT SEKALI; selain itu isi Firestore menang
//     dan ditulis ke mirror.
//   • dbSet(lic, key, rows) : tulis lokal + diff per-record ke Firestore
//     (setDoc merge / deleteDoc) — komponen tetap memakai pola array lama.
//   • dbSetDoc / profil & bizconfig : dokumen objek di koleksi pengaturan.
// Setiap perubahan memancarkan event 'welp_db_sync' agar tab lain
// (keep-alive) ikut membaca ulang mirror.
// ============================================================
export const DB_MAP = {
  product_stock_db: 'produk',
  raw_material_db: 'bahan',
  hpp_pro_db: 'resep',
  active_orders_db: 'orders',
  pos_history_db: 'pos_history',
  expense_db: 'kas_keluar',
  supplier_db: 'supplier',
  stock_history_db: 'riwayat_stok',
  self_orders_db: 'self_orders'
};
// Dokumen OBJEK (bukan koleksi): key lokal → id doc di koleksi 'pengaturan'
export const DB_DOC_MAP = {
  store_profile: 'toko_profile',
  discount_tax_db: 'bizconfig'
};

const _dbSnap = {};
const DB_SYNC_EVT = 'welp_db_sync';
const fireDbSync = () => { try { window.dispatchEvent(new Event(DB_SYNC_EVT)); } catch (e) { } };
const idOf = (r, i) => String(r.id ?? r.cid ?? ('r' + i));
const stripCloud = (r) => { const c = { ...r }; delete c.cid; delete c.serverAt; return c; };

export const hydrateDb = async (licId) => {
  if (!licId || !db) return false;
  let touched = false;
  for (const [key, col] of Object.entries(DB_MAP)) {
    try {
      const snap = await getDocs(collection(db, 'tenants', licId, col));
      const cloud = snap.docs.map(d => ({ ...d.data(), cid: d.id }));
      const local = safeParse(key, []);
      if (snap.empty && local.length > 0) {
        // IMPORT SEKALI — data komersial lokal dipindah ke Firestore
        const batch = writeBatch(db);
        local.slice(0, 450).forEach((r, i) => batch.set(doc(db, 'tenants', licId, col, idOf(r, i)), { ...stripCloud(r) }));
        await batch.commit();
        _dbSnap[key] = Object.fromEntries(local.map((r, i) => [idOf(r, i), JSON.stringify(stripCloud(r))]));
      } else if (!snap.empty) {
        const cloudRows = cloud.map(stripCloud);
        try { localStorage.setItem(key, JSON.stringify(cloudRows)); } catch (e) { }
        _dbSnap[key] = Object.fromEntries(cloudRows.map((r, i) => [idOf(r, i), JSON.stringify(r)]));
        touched = true;
      } else {
        _dbSnap[key] = {};
      }
    } catch (e) { console.warn('[WELP f1:' + col + ']', e.code || e.message); }
  }
  for (const [key, docId] of Object.entries(DB_DOC_MAP)) {
    try {
      const ref = doc(db, 'tenants', licId, 'pengaturan', docId);
      const ds = await getDoc(ref);
      const local = safeParse(key, null);
      if (!ds.exists()) {
        if (local && (typeof local !== 'object' || Object.keys(local).length > 0)) {
          await setDoc(ref, { ...stripCloud(local) });
          _dbSnap[key] = JSON.stringify(stripCloud(local));
        } else _dbSnap[key] = null;
      } else {
        const data = stripCloud(ds.data());
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { }
        _dbSnap[key] = JSON.stringify(data);
        touched = true;
      }
    } catch (e) { console.warn('[WELP f1:' + key + ']', e.code || e.message); }
  }
  if (touched) fireDbSync();
  return true;
};

// Tulis array komersial: mirror lokal + diff ke Firestore.
export const dbSet = (licId, key, rows) => {
  const arr = Array.isArray(rows) ? rows : [];
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { }
  fireDbSync();
  if (!licId || !db || !DB_MAP[key]) return;
  const col = DB_MAP[key];
  const prev = _dbSnap[key] || {};
  const next = {};
  arr.forEach((r, i) => {
    const id = idOf(r, i);
    const clean = stripCloud(r);
    const json = JSON.stringify(clean);
    next[id] = json;
    if (prev[id] !== json) {
      setDoc(doc(db, 'tenants', licId, col, id), { ...clean, serverAt: serverTimestamp() }, { merge: true })
        .catch(e => console.warn('[WELP f1w:' + col + ']', e.code || e.message));
    }
  });
  Object.keys(prev).forEach(id => {
    if (!next[id]) deleteDoc(doc(db, 'tenants', licId, col, id)).catch(() => { });
  });
  _dbSnap[key] = next;
};

// Tulis dokumen objek (store_profile, bizconfig): mirror + merge Firestore.
export const dbSetDoc = (licId, key, obj) => {
  const val = obj && typeof obj === 'object' ? obj : {};
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
  fireDbSync();
  if (!licId || !db || !DB_DOC_MAP[key]) return;
  const clean = stripCloud(val);
  const json = JSON.stringify(clean);
  if (_dbSnap[key] === json) return;
  _dbSnap[key] = json;
  setDoc(doc(db, 'tenants', licId, 'pengaturan', DB_DOC_MAP[key]), { ...clean, serverAt: serverTimestamp() }, { merge: true })
    .catch(e => console.warn('[WELP f1d:' + key + ']', e.code || e.message));
};

// Hook re-read mirror saat ada sinkronisasi (tab keep-alive ikut segar)
export const useDbSync = (rebind) => {
  useEffect(() => {
    const h = () => rebind();
    window.addEventListener(DB_SYNC_EVT, h);
    return () => window.removeEventListener(DB_SYNC_EVT, h);
  });
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
    perusahaan: 'Manajemen Perusahaan',
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
    perusahaan: 'Company Management',
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

// v15 F5/G2 — VALIDASI & METADATA QRIS: verifikasi CRC-16 tag 63,
// bedakan statis/dinamis, dan baca metadata merchant (tag 26 sub-05,
// 59 nama merchant, 60 kota). Dipakai saat upload QRIS di Pengaturan.
export const verifyQrisCrc = (payload) => {
  try {
    const p = String(payload || '').trim();
    if (!p.endsWith('6304') || p.length < 8) return false;
    const body = p.slice(0, -4);
    return crc16CCITT(body) === p.slice(-4).toUpperCase();
  } catch (e) { return false; }
};
export const qrisMeta = (payload) => {
  try {
    const m = parseEmv(payload);
    // tag 26 berisi sub-TLV: cari ID penempat (mis. IDCO.../936...) →
    // sub-tag 05 = ID merchant; tag 51= kripto; fallback: pola QRID/ID
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

// v15 F5/F2 — REVERSE GEOCODING (alamat manusiawi dari koordinat).
// Nominatim/OpenStreetMap dipakai langsung (tanpa key, volume rendah:
// hanya saat absen submit). Koordinat & akurasi ASLI tetap disimpan —
// alamat hanya pelengkap agar monitoring owner mudah dibaca.
export const reverseGeocode = async (lat, lng) => {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=id`,
      { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.display_name ? String(j.display_name) : null;
  } catch (e) { return null; }
};

// v15 F5/J3 — MEDIA BESAR KE FIREBASE STORAGE (graceful).
// Mengunggah dataURL ke tenants/{lic}/<path> dan mengembalikan URL.
// Bila Storage belum dikonfigurasi / rules menolak → null (pemanggil
// fallback ke base64 inline seperti sebelumnya). Batas 900KB.
export const uploadMedia = async (licId, path, dataUrl) => {
  try {
    if (!licId || !dataUrl || !app) return null;
    if (dataUrl.length > 900 * 1024 * 1.37) return null;   // ~900KB biner
    const st = getStorage(app);
    const r = sRef(st, `tenants/${licId}/${path}`);
    await uploadString(r, dataUrl, 'data_url');
    return await getDownloadURL(r);
  } catch (e) {
    console.warn('[WELP storage]', e.code || e.message);
    return null;
  }
};

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

// v15 F5/G1/G3 — Decode QR dari gambar (upload QRIS):
// BarcodeDetector (Chrome/Edge) dulu, lalu FALLBACK jsQR (bundled, tanpa
// CDN) sehingga Safari iOS & Firefox ikut terbaca. Decode pada resolusi
// asli (tanpa kompresi ulang) agar angka keberhasilan tinggi.
export const decodeQrFromImage = async (dataUrl) => {
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // 1) BarcodeDetector bila tersedia
    if ('BarcodeDetector' in window) {
      try {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        const codes = await det.detect(cv);
        if (codes?.[0]?.rawValue) return codes[0].rawValue;
      } catch (e) { /* lanjut ke jsQR */ }
    }
    // 2) fallback jsQR (WASM-free, bundled)
    const data = ctx.getImageData(0, 0, cv.width, cv.height);
    const res = jsQR(data.data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
    return res?.data || null;
  } catch (e) { return null; }
};

// v15 F4-H10 — buka dokumen dataURL via Blob URL. Chrome modern memblokir
// navigasi top-frame ke URL data:, sehingga "Buka di tab baru" yang memakai
// <a href={dataURL}> bisa mati diam-diam. Blob URL selalu sah.
export const openDataUrl = (dataUrl, filename = 'dokumen') => {
  try {
    const [meta, b64] = String(dataUrl).split(',');
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64 || '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    window.open(dataUrl, '_blank');   // fallback lama bila format tak terbaca
  }
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
export const DEFAULT_ATURAN = { jamMasuk: '09:00', toleransi: 15, radius: 150, hkBulan: 26 };
export const getAturan = (branch) => ({
  ...DEFAULT_ATURAN,
  ...(branch?.aturan || {}),
  toleransi: Number(branch?.aturan?.toleransi ?? DEFAULT_ATURAN.toleransi) || 0,
  radius: Number(branch?.aturan?.radius ?? DEFAULT_ATURAN.radius) || DEFAULT_ATURAN.radius,
  // Target hari kerja per bulan (v13): 0 = tanpa target. Dipakai
  // pembanding di rekap HK, payroll, slip gaji & aplikasi karyawan.
  hkBulan: Math.min(31, Math.max(0, Number(branch?.aturan?.hkBulan ?? DEFAULT_ATURAN.hkBulan) || 0)),
});

// Target HK efektif satu karyawan (v13): override per karyawan
// menang bila >= 1, selain itu ikuti aturan cabang.
export const hkTargetOf = (aturan, employee) => {
  const own = Number(employee?.hkBulan);
  const t = (Number.isFinite(own) && own > 0) ? own : Number(aturan?.hkBulan);
  return Math.min(31, Math.max(0, t || 0));
};

// v15 F2 — RELASI KARYAWAN↔CABANG: branchIds[] (multi-cabang) +
// branchId (primer, data lama). Urutan: primer dulu, tanpa duplikat.
export const empBranchIds = (e) => {
  const ids = [e?.branchId, ...(Array.isArray(e?.branchIds) ? e.branchIds : [])].filter(Boolean);
  return [...new Set(ids)];
};

// ============================================================
// v15 · F3 — PERMISSION GRANULAR & ROLE
// Permission disimpan per tenant di pengaturan/roles (doc 'roles'):
//   { matrix: { owner: [...], manager: [...], ... } }
// Role bawaan = preset; owner bisa menyesuaikan per role dari UI
// Manajemen Karyawan → Role & Hak Akses. Menu & guard komponen
// membaca permsOf(); rules Firestore memvalidasi sesi (F0).
// ============================================================
export const PERMISSIONS = [
  { key: 'dashboard.view',   label: 'Beranda & ringkasan bisnis' },
  { key: 'pos.use',          label: 'Operasional kasir (POS)' },
  { key: 'product.manage',   label: 'Kelola produk, harga & HPP' },
  { key: 'inventory.manage', label: 'Kelola stok & gudang' },
  { key: 'purchasing.manage',label: 'Barang masuk/keluar & supplier' },
  { key: 'report.financial', label: 'Laporan & riwayat keuangan' },
  { key: 'attendance.manage',label: 'Kelola absensi & persetujuan cuti' },
  { key: 'payroll.view',     label: 'Lihat data penggajian' },
  { key: 'payroll.manage',   label: 'Kelola & bayar penggajian' },
  { key: 'employee.manage',  label: 'Kelola karyawan & PIN' },
  { key: 'branch.manage',    label: 'Kelola cabang, station & outlet' },
  { key: 'settings.manage',  label: 'Pengaturan, profil & perusahaan' },
  { key: 'role.manage',      label: 'Atur role & hak akses' },
  { key: 'refund.perform',   label: 'Batalkan / refund transaksi' },
];

export const ROLE_META = {
  owner:      { label: 'Owner',      atasan: true  },
  direktur:   { label: 'Direktur',   atasan: true  },
  manager:    { label: 'Manager',    atasan: true  },
  supervisor: { label: 'Supervisor', atasan: true  },
  admin:      { label: 'Admin',      atasan: true  },
  hr:         { label: 'HR',         atasan: true  },
  finance:    { label: 'Finance',    atasan: false },
  inventory:  { label: 'Inventory',  atasan: false },
  kasir:      { label: 'Kasir',      atasan: false },
};
export const roleLabelOfV15 = (r) => (ROLE_META[r] || ROLE_META.kasir).label;
export const isAtasanRole = (r) => !!(ROLE_META[r] || ROLE_META.kasir).atasan;

const P = PERMISSIONS.map(p => p.key);
export const ROLE_PRESETS = {
  owner:      P,
  direktur:   P.filter(k => k !== 'role.manage'),
  manager:    ['dashboard.view','pos.use','product.manage','inventory.manage','purchasing.manage','report.financial','attendance.manage','payroll.view','employee.manage','branch.manage','refund.perform'],
  supervisor: ['dashboard.view','pos.use','inventory.manage','report.financial','attendance.manage','refund.perform'],
  admin:      P.filter(k => k !== 'role.manage'),
  hr:         ['dashboard.view','attendance.manage','payroll.view','payroll.manage','employee.manage','report.financial'],
  finance:    ['dashboard.view','report.financial','payroll.view','payroll.manage'],
  inventory:  ['dashboard.view','inventory.manage','purchasing.manage','product.manage'],
  kasir:      ['dashboard.view','pos.use'],
};

// Preset lama dgn field 'roles' di NAV (array role string) tetap
// dipertahankan sbg fallback ketika tenant belum mengatur matrix.
export const getRolesMatrix = (settingsRows) => {
  const rec = (settingsRows || []).find(s => s.key === 'roles');
  const base = (rec && rec.matrix && typeof rec.matrix === 'object') ? rec.matrix : {};
  return { ...ROLE_PRESETS, ...base };
};
export const permsOf = (role, matrix) => {
  const m = matrix || ROLE_PRESETS;
  return new Set(m[role] || m.kasir || []);
};
export const canDo = (perms, key) => !!(perms && perms.has && perms.has(key));

// Peta menu → permission (untuk shell/nav). null = semua boleh.
export const NAV_PERMS = {
  home: 'dashboard.view',
  pos: 'pos.use',
  calc: 'product.manage',
  history: 'report.financial',
  cashout: 'report.financial',
  discount: 'pos.use',
  stock: 'inventory.manage',
  opname: 'inventory.manage',
  inout: 'purchasing.manage',
  stockhistory: 'inventory.manage',
  supplier: 'purchasing.manage',
  report: 'report.financial',
  employee: 'branch.manage',
  karyawan: 'employee.manage',
  absensi: 'attendance.manage',
  payroll: 'payroll.manage',
  perusahaan: 'settings.manage',
  outlet: 'branch.manage',
  profile: 'settings.manage',
  payment: 'settings.manage',
  hardware: 'settings.manage',
  settings: 'settings.manage',
};

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

// ============================================================
// WELP v11 — HELPER BERSAMA BARU
// ============================================================

// --- Durasi keterlambatan "00j 15m 00d" (jam · menit · detik) ---
export const fmtDurJMD = (ms) => {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), d = s % 60;
  return `${String(h).padStart(2, '0')}j ${String(m).padStart(2, '0')}m ${String(d).padStart(2, '0')}d`;
};

// lateInfo versi presisi milidetik (dipakai badge & watermark).
export const lateInfoMs = (ms, aturan) => {
  const a = getAturan({ aturan });
  const [h, m] = String(a.jamMasuk || '09:00').split(':').map(n => parseInt(n, 10) || 0);
  const d = new Date(ms);
  const batas = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m + a.toleransi, 0, 0);
  const lateMs = Math.max(0, d.getTime() - batas.getTime());
  return { lateMs, telatMin: Math.round(lateMs / 60000), status: lateMs > 0 ? 'telat' : 'tepat' };
};

// --- WAKTU TERPERCAYA ------------------------------------------------
// Offset jam server diambil dari header Date host (respons HEAD),
// dikoreksi setengah RTT. Firestore serverTimestamp tetap sumber
// resmi pada record; offset ini dipakai untuk watermark foto yang
// dibuat SEBELUM data terkirim.
let _timeOffset = null;
export const syncTrustedTime = async () => {
  try {
    const t0 = Date.now();
    const r = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
    const hdr = r.headers.get('date');
    if (hdr) {
      const serverMs = new Date(hdr).getTime();
      const rtt = Date.now() - t0;
      if (isFinite(serverMs)) _timeOffset = serverMs + Math.round(rtt / 2) - Date.now();
    }
  } catch (e) { /* offline: pertahankan offset terakhir */ }
  return _timeOffset;
};
export const trustedNow = () => Date.now() + (_timeOffset || 0);
export const trustedSourceLabel = () => (_timeOffset != null ? 'server' : 'perangkat');

// --- WATERMARK FOTO ABSENSI ------------------------------------------
// Foto absensi diberi stempel dari data sistem (bukan input manual):
// logo & nama WELP, nama perusahaan + cabang, tanggal & jam (waktu
// terpercaya), koordinat GPS bila tersedia, nama karyawan & jenis absen.
export const stampAbsenPhoto = ({ dataUrl, company, branchName, employeeName, type, atMs, geo, trusted, logo }) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);          // gagal render → foto polos tetap dipakai
    img.onload = async () => {
      try {
        // v15 F5/E1: logo dimuat DULU (bila ada) supaya pasti ikut terstempel
        let logoImg = null;
        if (logo) {
          logoImg = await new Promise((res) => {
            const x = new Image();
            x.onload = () => res(x); x.onerror = () => res(null); x.src = logo;
          });
        }
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const W = cv.width, bandH = Math.round(cv.height * 0.245);
        const y0 = cv.height - bandH;
        // gradasi gelap agar teks terbaca di semua kondisi cahaya
        const grad = ctx.createLinearGradient(0, y0 - bandH * 0.55, 0, cv.height);
        grad.addColorStop(0, 'rgba(13,15,18,0)');
        grad.addColorStop(0.42, 'rgba(13,15,18,0.82)');
        grad.addColorStop(1, 'rgba(13,15,18,0.94)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y0 - bandH * 0.55, W, bandH * 1.55);

        const u = W / 360;                            // unit skala
        const pad = Math.round(14 * u);
        const brandC = brandAccentHex('#F4622E');     // ikut warna custom brand

        // v15 F5/E1: LOGO PERUSAHAAN sebagai watermark image — opacity,
        // aspect ratio dipertahankan, safe-area dari tepi kanan-atas.
        if (logoImg) {
          const maxW = Math.round(W * 0.34), maxH = Math.round(cv.height * 0.13);
          const ratio = Math.min(maxW / (logoImg.naturalWidth || 1), maxH / (logoImg.naturalHeight || 1), 1);
          const lw = Math.round((logoImg.naturalWidth || 1) * ratio);
          const lh = Math.round((logoImg.naturalHeight || 1) * ratio);
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.drawImage(logoImg, W - pad - lw, pad, lw, lh);
          ctx.restore();
        }

        // logo WELP: kotak flame rounded + huruf W + titik
        const bx = pad, by = y0 + Math.round(10 * u), bs = Math.round(26 * u);
        ctx.fillStyle = brandC;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bs, bs, bs * 0.32); ctx.fill(); }
        else ctx.fillRect(bx, by, bs, bs);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 ${Math.round(16 * u)}px Arial, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('W', bx + bs / 2, by + bs / 2 + 1);

        // nama perusahaan + cabang (baris brand)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `800 ${Math.round(13 * u)}px Arial, sans-serif`;
        ctx.fillText('WELP', bx + bs + Math.round(8 * u), by + bs * 0.32);
        const comp = String(company || '').slice(0, 26);
        const br = branchName ? ' · ' + String(branchName).slice(0, 22) : '';
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.font = `700 ${Math.round(10 * u)}px Arial, sans-serif`;
        ctx.fillText(comp + br, bx + bs + Math.round(8 * u), by + bs * 0.78);

        // chip MASUK/PULANG di kanan atas band
        const chip = type === 'out' ? 'PULANG' : 'MASUK';
        ctx.font = `900 ${Math.round(10 * u)}px Arial, sans-serif`;
        const cw = ctx.measureText(chip).width + Math.round(14 * u);
        const chx = W - pad - cw, chy = y0 + Math.round(8 * u), chh = Math.round(20 * u);
        ctx.fillStyle = type === 'out' ? '#D9A23B' : '#2FA46B';
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(chx, chy, cw, chh, chh / 2); ctx.fill(); }
        else ctx.fillRect(chx, chy, cw, chh);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(chip, chx + Math.round(7 * u), chy + chh / 2 + 1);

        // karyawan (kanan, di bawah chip)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `800 ${Math.round(11.5 * u)}px Arial, sans-serif`;
        ctx.fillText(String(employeeName || '').slice(0, 24), W - pad, chy + chh + Math.round(14 * u));

        // baris data: tanggal · jam · GPS
        const d = new Date(atMs || Date.now());
        const tgl = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const gps = (geo && geo.lat != null)
          ? `${Number(geo.lat).toFixed(5)}, ${Number(geo.lng).toFixed(5)} ±${geo.acc || 0}m`
          : 'Lokasi GPS tidak tersedia';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.font = `700 ${Math.round(11 * u)}px Arial, sans-serif`;
        ctx.fillText(`${tgl} · ${jam} WIB`, pad, cv.height - Math.round(26 * u));
        ctx.fillStyle = 'rgba(255,255,255,.62)';
        ctx.font = `600 ${Math.round(9 * u)}px Arial, sans-serif`;
        ctx.fillText(gps + (trusted ? '  ·  waktu terverifikasi' : ''), pad, cv.height - Math.round(10 * u));

        resolve(cv.toDataURL('image/jpeg', 0.72));
      } catch (e) { resolve(dataUrl); }
    };
    img.src = dataUrl;
  });
};

// --- AUDIT LOG --------------------------------------------------------
// Jejak aktivitas penting: aktor (nama/role), cabang, station,
// aksi, target, dan waktu (serverTimestamp). Fire-and-forget —
// tidak pernah mengganggu alur utama bila offline.
export const auditLog = (licenseInfo, action, detail = {}, extra = {}) => {
  try {
    if (!licenseInfo?.id || !db) return;
    const id = 'aud_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    setDoc(doc(db, 'tenants', licenseInfo.id, 'audit_log', id), {
      action, ...detail,
      actor: extra.actor || licenseInfo.employeeName || licenseInfo.tenant || '-',
      actorRole: extra.actorRole || licenseInfo.currentUserRole || 'owner',
      branchId: extra.branchId || licenseInfo.branchId || 'PUSAT',
      stationCode: extra.stationCode || licenseInfo.stationCode || null,
      createdAt: Date.now(), serverAt: serverTimestamp()
    }).catch(() => { });
  } catch (e) { }
};

// --- EMPLOYEE ID OTOMATIS --------------------------------------------
// Format PREFIX-001 (prefix dari nama cabang, PUSAT → PST).
// Selalu unik terhadap daftar ID yang sudah ada.
export const makeEmpId = (branchName, existingIds = []) => {
  const used = new Set((existingIds || []).filter(Boolean));
  const base = (branchName && branchName !== 'PUSAT')
    ? String(branchName).replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
    : 'PST';
  const pfx = base || 'EMP';
  let n = 1;
  while (used.has(`${pfx}-${String(n).padStart(3, '0')}`) && n < 999) n++;
  return `${pfx}-${String(n).padStart(3, '0')}`;
};

// --- WORKFLOW PENGGAJIAN ---------------------------------------------
// Alur nyata (bukan sekadar "tandai terbayar"):
// DRAFT → DIAJUKAN → DISETUJUI → DIBAYAR → SELESAI; DITOLAK → revisi.
export const PAYROLL_FLOW = {
  DRAFT: { label: 'Draft', tone: 'neutral', desc: 'Belum diajukan' },
  DIAJUKAN: { label: 'Menunggu Persetujuan', tone: 'gold', desc: 'Menunggu review Owner' },
  DITOLAK: { label: 'Ditolak', tone: 'red', desc: 'Perlu revisi lalu ajukan ulang' },
  DISETUJUI: { label: 'Disetujui', tone: 'teal', desc: 'Siap dibayarkan' },
  DIBAYAR: { label: 'Dibayar', tone: 'green', desc: 'Dana sudah diterima karyawan' },
  SELESAI: { label: 'Selesai', tone: 'grey', desc: 'Siklus penggajian tuntas' },
};
export const payrollPushHistory = (rec, from, to, actor, role, note = '') => {
  const arr = Array.isArray(rec?.history) ? [...rec.history] : [];
  arr.push({ from, to, by: actor || '-', role: role || '-', at: Date.now(), note: String(note || '').slice(0, 200) });
  return arr;
};

// --- PENGAJUAN KETIDAKHADIRAN / CUTI ---------------------------------
export const CUTI_TYPES = [
  { id: 'sakit', label: 'Sakit', needLetter: true },
  { id: 'izin', label: 'Izin Pribadi', needLetter: false },
  { id: 'cuti', label: 'Cuti', needLetter: false },
  { id: 'lain', label: 'Kebutuhan Lain', needLetter: false },
];
export const CUTI_FLOW = {
  DIAJUKAN: { label: 'Diajukan', tone: 'neutral', desc: 'Menunggu ditinjau' },
  DITINJAU: { label: 'Ditinjau', tone: 'gold', desc: 'Sedang diperiksa Admin/Owner' },
  DISETUJUI: { label: 'Disetujui', tone: 'green', desc: 'Disetujui' },
  DITOLAK: { label: 'Ditolak', tone: 'red', desc: 'Ditolak — lihat alasan' },
};
export const daysBetween = (a, b) => {
  const t1 = new Date(a).setHours(0, 0, 0, 0), t2 = new Date(b).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((t2 - t1) / 864e5) + 1);
};

// ============================================================
// SHIFT & JAM KERJA (v12, target HK v13) — definisi shift per
// cabang, penugasan karyawan, dan rekap HK (hari kerja) + total
// jam dari absensi dibandingkan target HK yang diatur atasan.
// Definisi shift disimpan di doc cabang (shifts: [..]) dan untuk
// Cabang Pusat di koleksi pengaturan (key 'shift_pusat') — semua
// tetap di Firestore sebagai sumber kebenaran.
// ============================================================

// Normalisasi daftar shift mentah dari Firestore → bentuk aman.
export const normShifts = (raw) => (Array.isArray(raw) ? raw : [])
  .filter(s => s && s.mulai && s.selesai)
  .map((s, i) => ({
    id: s.id || ('sh' + (i + 1)),
    nama: s.nama || ('Shift ' + (i + 1)),
    mulai: s.mulai, selesai: s.selesai,
    aktif: s.aktif !== false
  }));

// '08:30' → 510 menit
export const hhmmToMin = (s) => {
  const [h, m] = String(s || '0:0').split(':').map(n => parseInt(n, 10) || 0);
  return h * 60 + (m || 0);
};

// Durasi shift; mendukung lintas tengah malam (22:00 → 06:00 = 8 jam).
export const shiftDurMin = (s) => {
  const a = hhmmToMin(s.mulai), b = hhmmToMin(s.selesai);
  return b > a ? b - a : (24 * 60 - a + b);
};

export const fmtShiftRange = (s) => `${s.mulai}–${s.selesai}`;

// Apakah menit-dalam-hari tertentu berada di dalam jam shift.
export const shiftCoversMin = (s, min) => {
  const a = hhmmToMin(s.mulai), b = hhmmToMin(s.selesai);
  const m = ((min % 1440) + 1440) % 1440;
  return a < b ? (m >= a && m < b) : (m >= a || m < b);
};

export const minutesOfDay = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };

// Shift yang sedang berjalan pada waktu ms (hanya shift aktif).
export const shiftOfMs = (shifts, ms) =>
  (shifts || []).find(s => s.aktif !== false && shiftCoversMin(s, minutesOfDay(ms))) || null;

export const shiftById = (shifts, id) => (id ? (shifts || []).find(s => s.id === id) : null) || null;

// Shift milik sebuah branchId: doc cabang, atau pengaturan Pusat.
// pusatShifts = hasil normShifts dari doc pengaturan 'shift_pusat'.
export const shiftsForBranch = (branchId, branches, pusatShifts = []) => {
  if (branchId === 'PUSAT') return pusatShifts;
  return normShifts((branches || []).find(b => b.cid === branchId)?.shifts);
};

// Format durasi singkat: 480 → "8j", 495 → "8j 15m", 45 → "45m"
export const fmtJam = (min) => {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60), r = m % 60;
  if (!m) return '0m';
  return h ? (r ? `${h}j ${r}m` : `${h}j`) : `${r}m`;
};

// Pasangkan absensi masuk/pulang per hari milik SATU karyawan
// (rows sudah terfilter miliknya) → HK (hari kerja) + total menit.
// Hari tanpa absen pulang dihitung "berjalan" untuk hari ini saja.
export const pairWorkMinutes = (rows, nowMs = Date.now()) => {
  const byDate = {};
  (rows || []).forEach(a => {
    const t = trustedTime(a);
    const d = dateKeyOf(t.ms);
    if (!byDate[d]) byDate[d] = { date: d };
    if (a.type === 'in') { if (!byDate[d].inMs || t.ms < byDate[d].inMs) byDate[d].inMs = t.ms; }
    else if (a.type === 'out') { if (!byDate[d].outMs || t.ms > byDate[d].outMs) byDate[d].outMs = t.ms; }
  });
  const days = Object.values(byDate).filter(d => d.inMs);
  let hk = 0, totalMin = 0;
  const tk = todayKey();
  days.forEach(d => {
    hk++;
    if (d.outMs && d.outMs > d.inMs) d.min = Math.round((d.outMs - d.inMs) / 60000);
    else if (d.date === tk) { d.min = Math.max(0, Math.round((nowMs - d.inMs) / 60000)); d.running = true; }
    else d.min = 0;
    if (d.min) totalMin += d.min;
  });
  days.sort((a, b) => b.inMs - a.inMs);
  return { hk, totalMin, days };
};

// ============================================================
// WELP v14 — STATUS KONTRAK, CUTI TAHUNAN, HARI KERJA &
// CUSTOM BRANDING (white-label). Semua tetap disimpan di
// Firestore tenants/{lic}/... lewat useTenantCol yang sama.
// ============================================================

// --- STATUS KONTRAK / JENIS KETERKERJAAN -----------------------------
// harian = daily worker: upah dihitung per hari masuk (upah x HK).
// pkwt / tetap = gaji tetap per periode. Data lama tanpa field ini
// diperlakukan 'tetap' supaya perilaku payroll tidak berubah.
export const JENIS_KONTRAK = {
  harian: { label: 'Daily Worker (Harian)', short: 'Harian', payMode: 'harian', desc: 'Upah dihitung dari jumlah hari masuk' },
  pkwt: { label: 'PKWT (Kontrak Waktu Tertentu)', short: 'PKWT', payMode: 'tetap', desc: 'Gaji tetap sesuai kontrak' },
  tetap: { label: 'Karyawan Tetap', short: 'Tetap', payMode: 'tetap', desc: 'Gaji tetap tiap periode' },
};
export const kontrakOf = (e) => JENIS_KONTRAK[e?.jenisKontrak] || JENIS_KONTRAK.tetap;

// --- HAK CUTI TAHUNAN (UU Ketenagakerjaan: minimal 12 hari) ----------
// Policy perusahaan disimpan di pengaturan key 'cuti_policy';
// karyawan tertentu bisa dioverride lewat field hakCuti.
export const DEFAULT_CUTI_POLICY = { hakTahunan: 12 };
export const cutiPolicyOf = (settings) => {
  const rec = (settings || []).find(s => s.key === 'cuti_policy');
  const n = parseInt(rec?.hakTahunan, 10);
  return { hakTahunan: (Number.isFinite(n) && n > 0) ? Math.min(365, n) : DEFAULT_CUTI_POLICY.hakTahunan };
};
export const hakCutiOf = (policy, employee) => {
  const own = parseInt(employee?.hakCuti, 10);
  const base = policy?.hakTahunan || DEFAULT_CUTI_POLICY.hakTahunan;
  return (Number.isFinite(own) && own > 0) ? Math.min(365, own) : base;
};
// Hari cuti yang sudah terpakai tahun berjalan (jenis 'cuti' saja —
// sakit & izin tidak memotong kuota cuti tahunan).
export const usedCutiDays = (pengajuan, employeeCid, year = new Date().getFullYear()) =>
  (pengajuan || []).filter(p => p.employeeCid === employeeCid
    && p.type === 'cuti' && p.status === 'DISETUJUI'
    && String(p.startDate || '').startsWith(String(year)))
    .reduce((a, p) => a + (parseInt(p.days, 10) || 0), 0);

// --- HARI KERJA & OFF DAY PERUSAHAAN ----------------------------------
// Disimpan di pengaturan key 'hari_kerja': { hari: ['Sen',..], off: ['Min'] }
export const HARI_MINGGUAN = [
  { id: 'Sen', label: 'Senin' }, { id: 'Sel', label: 'Selasa' }, { id: 'Rab', label: 'Rabu' },
  { id: 'Kam', label: 'Kamis' }, { id: 'Jum', label: 'Jumat' }, { id: 'Sab', label: 'Sabtu' }, { id: 'Min', label: 'Minggu' },
];
export const hariKerjaOf = (rows) => {
  const rec = (rows || []).find(s => s.key === 'hari_kerja');
  const hari = (Array.isArray(rec?.hari) && rec.hari.length) ? rec.hari : ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const off = Array.isArray(rec?.off) ? rec.off : [];
  return { hari, off };
};
export const hariLabelOf = (ids) => (ids || [])
  .map(id => (HARI_MINGGUAN.find(h => h.id === id)?.label) || id).join(', ');

// --- CUSTOM BRANDING / WHITE-LABEL (fitur Custom Aplikasi) ------------
// Developer menyalakan toggle di Developer Console → logo & warna
// perusahaan menggantikan brand WELP, endorsement jadi "by WELP".
// Konfigurasi disimpan di pengaturan key 'branding', lalu mirror
// localStorage + event 'welp_branding' agar semua komponen brand
// ikut berganti tanpa rebuild.
export const BRAND_KEY = 'welp_branding';
export const FLAME_DEFAULT = {
  50: '255 244 235', 100: '255 229 209', 200: '254 201 164', 300: '253 166 113',
  400: '251 129 66', 500: '244 98 46', 600: '216 67 18', 700: '178 53 8',
  800: '143 44 12', 900: '116 39 14', 950: '65 21 10',
};

export const hexToTriplet = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

// Bangun 11 tingkatan shade dari satu warna dasar (campuran putih/
// hitam ala Tailwind). Dipakai untuk warna kustom pilihan perusahaan.
export const buildBrandShades = (hex) => {
  const t = hexToTriplet(hex);
  if (!t) return null;
  const [r, g, b] = t.split(' ').map(Number);
  const mix = (target, k) => Math.round(r + (target.r - r) * k) + ' '
    + Math.round(g + (target.g - g) * k) + ' ' + Math.round(b + (target.b - b) * k);
  const W = { r: 255, g: 255, b: 255 }, B = { r: 12, g: 10, b: 9 };
  return {
    50: mix(W, 0.93), 100: mix(W, 0.84), 200: mix(W, 0.68), 300: mix(W, 0.50),
    400: mix(W, 0.26), 500: `${r} ${g} ${b}`,
    600: mix(B, 0.16), 700: mix(B, 0.32), 800: mix(B, 0.45), 900: mix(B, 0.55), 950: mix(B, 0.72),
  };
};

// Preset warna siap pakai (merah / biru / hijau = palet Tailwind asli).
export const BRAND_PRESETS = {
  oren: { label: 'Oren WELP', base: '#F4622E', shades: FLAME_DEFAULT },
  merah: {
    label: 'Merah', base: '#EF4444', shades: {
      50: '254 242 242', 100: '254 226 226', 200: '254 202 202', 300: '252 165 165',
      400: '248 113 113', 500: '239 68 68', 600: '220 38 38', 700: '185 28 28',
      800: '153 27 27', 900: '127 29 29', 950: '69 10 10',
    }
  },
  biru: {
    label: 'Biru', base: '#3B82F6', shades: {
      50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253',
      400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216',
      800: '30 64 175', 900: '30 58 138', 950: '23 37 84',
    }
  },
  hijau: {
    label: 'Hijau', base: '#10B981', shades: {
      50: '236 253 245', 100: '209 250 229', 200: '167 243 208', 300: '110 231 183',
      400: '52 211 153', 500: '16 185 129', 600: '5 150 105', 700: '4 120 87',
      800: '6 95 70', 900: '6 78 59', 950: '2 44 34',
    }
  },
};

// Terapkan branding ke <html>: timpa var --fl-* / --ap-* dan set
// atribut data-custom-brand untuk pemicu gaya khusus.
export const applyBranding = (branding) => {
  try {
    const el = document.documentElement;
    const on = !!(branding && branding.aktif);
    let shades = null;
    if (on) {
      if (branding.warna === 'kustom' && branding.warnaHex) shades = buildBrandShades(branding.warnaHex);
      else if (BRAND_PRESETS[branding.warna]) shades = BRAND_PRESETS[branding.warna].shades;
    }
    Object.keys(FLAME_DEFAULT).forEach(n => {
      const v = shades ? shades[n] : null;
      if (v) el.style.setProperty(`--fl-${n}`, v);
      else el.style.removeProperty(`--fl-${n}`);
    });
    if (shades) {
      el.style.setProperty('--ap-base', shades[400]);
      el.style.setProperty('--ap-deep', shades[300]);
      el.style.setProperty('--ap-dim', shades[700]);
    } else {
      el.style.removeProperty('--ap-base');
      el.style.removeProperty('--ap-deep');
      el.style.removeProperty('--ap-dim');
    }
    if (on) el.setAttribute('data-custom-brand', '1');
    else el.removeAttribute('data-custom-brand');
  } catch (e) { /* noop */ }
};

export const readBrandMirror = () => {
  try { const b = JSON.parse(localStorage.getItem(BRAND_KEY)); return (b && b.aktif) ? b : null; }
  catch (e) { return null; }
};
export const writeBrandMirror = (branding) => {
  try { localStorage.setItem(BRAND_KEY, JSON.stringify(branding || null)); } catch (e) { }
  applyBranding(branding || null);
  try { window.dispatchEvent(new CustomEvent('welp_branding', { detail: branding || null })); } catch (e) { }
};
// Seed awal dari mirror supaya logo/warna langsung benar sebelum
// snapshot Firestore datang.
applyBranding(readBrandMirror());

// Warna accent aktif dalam hex — dipakai canvas watermark & slip cetak
// (canvas/HTML cetak tidak bisa membaca CSS class).
export const brandAccentHex = (fallback = '#F4622E') => {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--fl-500').trim();
    const p = raw.split(/\s+/).map(Number);
    if (p.length === 3 && p.every(n => Number.isFinite(n))) {
      return '#' + p.map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { }
  return fallback;
};
export const brandAccentDeepHex = (fallback = '#D84312') => {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--fl-600').trim();
    const p = raw.split(/\s+/).map(Number);
    if (p.length === 3 && p.every(n => Number.isFinite(n))) {
      return '#' + p.map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { }
  return fallback;
};

// Hook ringan: baca konfigurasi branding tenant (pengaturan key
// 'branding') lalu terapkan. Kini dipakai di root app & dev panel.
export const useBranding = (licenseInfo) => {
  const { items: settings } = useTenantCol(licenseInfo, 'pengaturan', 'pengaturan_db');
  useEffect(() => {
    if (!settings || settings.length === 0) return;   // offline: pertahankan mirror
    const rec = (settings || []).find(s => s.key === 'branding');
    writeBrandMirror(rec && rec.aktif ? rec : null);
  }, [settings]);
};

// ============================================================
// SLIP GAJI PREMIUM (v14) — satu template HTML cetak dipakai
// owner (Manajemen Penggajian) & karyawan (Aplikasi Karyawan).
// Ada logo perusahaan (custom brand bila aktif), band warna
// brand, rincian penerimaan & potongan, stempel status, blok
// approval digital, QR verifikasi, dan area tanda tangan.
// ============================================================
export const buildSlipHtml = ({ rec, company = 'Perusahaan', profile = {}, roleLabel = 'Karyawan' }) => {
  const t = trustedTime(rec);
  const brand = readBrandMirror();
  const logo = brand?.logo || null;
  const c = rec.components || { pokok: rec.amount, tunjangan: 0, bonus: 0, lembur: 0, potongan: 0 };
  const st = rec.status || 'DIBAYAR';
  const flow = PAYROLL_FLOW[st] || PAYROLL_FLOW.DIBAYAR;
  const paid = st === 'DIBAYAR' || st === 'SELESAI';
  const appr = (rec.approvals || []).find(a => a.action === 'approve');
  const no = 'SG-' + String(rec.cid || '').slice(-8).toUpperCase();
  const esc = (s) => String(s ?? '').replace(/</g, '&lt;');
  const brandC = brandAccentHex('#F4622E');
  const brandDeep = brandAccentDeepHex('#D84312');
  const isHarian = rec.jenisKontrak === 'harian';
  const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  const penerimaan =
    (isHarian && rec.upahHarian != null
      ? row(`Upah Harian (${formatIDR(rec.upahHarian)} &times; ${rec.hk || 0} hari masuk)`, formatIDR(c.pokok || 0))
      : row('Gaji Pokok', formatIDR(c.pokok || 0)))
    + (c.tunjangan ? row('Tunjangan', formatIDR(c.tunjangan)) : '')
    + (c.bonus ? row('Bonus', formatIDR(c.bonus)) : '')
    + (c.lembur ? row('Lembur', formatIDR(c.lembur)) : '');
  const potongan = c.potongan ? row('Potongan', '- ' + formatIDR(c.potongan)) : '';
  const qr = qrUrl(`WELP-SLIP|${no}|${esc(company)}|${esc(rec.employeeName || '')}|${esc(rec.period || '')}|${formatIDR(rec.amount)}`, 96);
  return '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Slip Gaji ' + esc(rec.employeeName) + ' · ' + esc(rec.period) + '</title><style>'
    + '*{box-sizing:border-box;margin:0;padding:0}body{font-family:Segoe UI,Arial,sans-serif;background:#EDF0F4;padding:22px;color:#1B1F24;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.slip{max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px -20px rgba(13,15,18,.35);position:relative}'
    + '.hd{background:linear-gradient(135deg,' + brandDeep + ',' + brandC + ');color:#fff;padding:22px 24px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px}'
    + '.hd img{max-height:44px;max-width:170px;object-fit:contain;background:#fff;border-radius:9px;padding:5px}'
    + '.brandtx{font-size:24px;font-weight:900;letter-spacing:-.5px}.brandtx span{opacity:.85}'
    + '.slabel{text-align:right}.slabel b{display:block;font-size:15px;letter-spacing:.24em;font-weight:900}'
    + '.slabel small{font-size:9px;opacity:.85;font-weight:700;letter-spacing:.12em;text-transform:uppercase}'
    + '.meta{display:flex;gap:8px;flex-wrap:wrap;padding:14px 24px 0}'
    + '.chip{font-size:9.5px;font-weight:800;letter-spacing:.06em;padding:4px 10px;border-radius:99px;background:' + brandC + '1a;color:' + brandDeep + ';text-transform:uppercase}'
    + '.chip.ok{background:#E7F5EC;color:#23734A}.chip.warn{background:#FDF3E3;color:#9A6B15}.chip.grey{background:#EDF0F4;color:#4E5761}'
    + '.who{padding:14px 24px 4px}.who h1{font-size:19px;letter-spacing:-.2px}.who p{font-size:11px;color:#7C8590;font-weight:700;margin-top:3px}'
    + '.amt{margin:14px 24px;padding:16px 18px;border-radius:14px;background:linear-gradient(135deg,' + brandC + '14,' + brandC + '26);border:1px solid ' + brandC + '33;display:flex;justify-content:space-between;align-items:center}'
    + '.amt small{display:block;font-size:9px;font-weight:800;letter-spacing:.18em;color:#7C8590;text-transform:uppercase;margin-bottom:4px}'
    + '.amt b{font-size:25px;font-weight:900;color:' + brandDeep + ';letter-spacing:-.4px}'
    + '.amt .qr{width:64px;height:64px;border-radius:10px;border:1px solid #E6E8ED;background:#fff}'
    + 'table{width:100%;border-collapse:collapse;margin:6px 24px 0;width:calc(100% - 48px)}'
    + 'td{padding:8px 0;border-bottom:1px dashed #E6E8ED;font-size:12.5px}td:first-child{color:#4E5761;font-weight:600}td:last-child{text-align:right;font-weight:800;font-family:Plus Jakarta Sans,Segoe UI,sans-serif;font-variant-numeric:tabular-nums}'
    + '.tot td{border-bottom:none;border-top:2px solid #1B1F24;font-size:14px;font-weight:900;padding-top:10px}'
    + '.sec{padding:10px 24px 0;font-size:9.5px;font-weight:800;letter-spacing:.2em;color:#7C8590;text-transform:uppercase}'
    + '.info{margin:12px 24px 0;padding:11px 14px;background:#F7F8FA;border-radius:12px;font-size:10.5px;color:#4E5761;font-weight:600;line-height:1.7}'
    + '.appr{margin:12px 24px 0;padding:11px 14px;background:#E7F5EC33;border:1px solid #23734A22;border-radius:12px;font-size:10.5px;color:#23734A;line-height:1.6;font-weight:600}'
    + '.stamp{position:absolute;top:118px;right:18px;transform:rotate(9deg);border:2.5px solid #23734A;color:#23734A;font-size:12px;font-weight:900;letter-spacing:.22em;padding:5px 12px;border-radius:8px;opacity:.82;text-transform:uppercase}'
    + '.ft{margin-top:22px;padding:16px 24px 22px;background:#F7F8FA;display:flex;justify-content:space-between;gap:12px;font-size:10px;color:#4E5761;font-weight:700}'
    + '.sig{border-top:1.5px solid #1B1F24;padding-top:5px;min-width:130px;text-align:center}'
    + '.sig .cursive{font-family:Segoe Script,Comic Sans MS,cursive;font-size:13px;color:#1B1F24}'
    + '.made{padding:0 24px 18px;text-align:center;font-size:8.5px;color:#9AA3AE;font-weight:700;letter-spacing:.14em;text-transform:uppercase}'
    + '@media print{body{background:#fff;padding:0}.slip{box-shadow:none;border-radius:0}@page{margin:10mm}}</style></head><body>'
    + '<div class="slip">'
    + (paid ? '<div class="stamp">Dibayar</div>' : '')
    + '<div class="hd">'
    + (logo ? '<img src="' + logo + '" alt="Logo perusahaan"/>' : '<div class="brandtx">WELP<span>.</span></div>')
    + '<div class="slabel"><b>SLIP GAJI</b><small>' + esc(company) + '</small></div></div>'
    + '<div class="meta">'
    + `<span class="chip ${paid ? 'ok' : 'warn'}">${flow.label}</span>`
    + `<span class="chip grey">${no}</span>`
    + `<span class="chip">${esc(rec.branchName || '-')}</span>`
    + (rec.jenisKontrak ? `<span class="chip grey">${esc((JENIS_KONTRAK[rec.jenisKontrak] || {}).short || rec.jenisKontrak)}</span>` : '')
    + '</div>'
    + '<div class="who"><h1>' + esc(rec.employeeName) + '</h1><p>'
    + esc(rec.empId || '-') + ' · ' + esc(roleLabel)
    + (profile.alamat ? ' · ' + esc(profile.alamat) : '')
    + (profile.telepon ? ' · ' + esc(profile.telepon) : '') + '</p></div>'
    + '<div class="amt"><div><small>Total Diterima · ' + esc(rec.period) + '</small><b>' + formatIDR(rec.amount) + '</b></div>'
    + '<img class="qr" src="' + qr + '" alt="QR verifikasi"/></div>'
    + '<p class="sec">Rincian Penerimaan</p>'
    + '<table>' + penerimaan + (potongan || '')
    + `<tr class="tot"><td>Diterima Bersih</td><td>${formatIDR(rec.amount)}</td></tr></table>`
    + (rec.hk != null ? '<div class="info"><b>Hari Kerja:</b> ' + rec.hk + ' HK' + (rec.hkTarget > 0 ? ' / target ' + rec.hkTarget : '')
      + ' · <b>Total Jam:</b> ' + fmtJam(rec.jamKerja) + (rec.telat > 0 ? ' · <b>Telat:</b> ' + rec.telat + 'x' : '')
      + (rec.note ? '<br/><b>Catatan:</b> ' + esc(rec.note) : '') + '</div>' : (rec.note ? '<div class="info"><b>Catatan:</b> ' + esc(rec.note) + '</div>' : ''))
    + (rec.paidAt
      ? '<div class="info"><b>Dibayarkan:</b> ' + new Date(rec.paidAt).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) + '</div>'
      : '<div class="info"><b>Waktu tercatat:</b> ' + new Date(t.ms).toLocaleString('id-ID') + (t.source === 'server' ? ' (waktu server)' : '') + '</div>')
    + (appr ? `<div class="appr">Disetujui secara digital oleh <b>${esc(appr.by)}</b> (${appr.role === 'admin' ? 'Admin Cabang' : 'Owner'}) pada ${new Date(appr.at).toLocaleString('id-ID')} · metode ${esc(appr.method || 'Akun WELP')} · nomor slip ${no}</div>` : '')
    + '<div class="ft"><div class="sig">Penerima,<br/><span class="cursive">' + esc(rec.employeeName) + '</span></div>'
    + '<div class="sig">' + esc(company) + ',<br/><span class="cursive">' + esc(appr ? appr.by : 'Owner') + '</span></div></div>'
    + '<p class="made">' + (logo ? 'Didukung WELP' : 'Dibuat dengan WELP · We Eventually Love POS') + '</p>'
    + '</div>'
    + '<script>setTimeout(function(){window.print()},450)<\/script></body></html>';
};
