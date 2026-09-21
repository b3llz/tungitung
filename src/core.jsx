// ============================================================
// CORE — logika & konfigurasi bersama (logika dipertahankan 100%
// dari versi teraudit; hanya presentasinya yang dibangun ulang).
// ============================================================
import React from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, addDoc } from "firebase/firestore";
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
    supplier: 'Database Supplier', report: 'Laporan & Analisa', employee: 'Manajemen Karyawan', outlet: 'Multi Outlet',
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
    supplier: 'Supplier Database', report: 'Reports & Analytics', employee: 'Staff Management', outlet: 'Multi Outlet',
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

// Ikon metode pembayaran (buddy WELP, dipakai lintas komponen)
export const getPaymentIcon = (type) => {
  if (type === 'Cash' || type === 'Split Bill') return <Uang className="w-4 h-4" />;
  if (type === 'QRIS') return <Qris className="w-4 h-4" />;
  return <Dompet className="w-4 h-4" />;
};
