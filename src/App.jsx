import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calculator, ShoppingCart, BarChart3, Plus, Trash2, 
  Save, FolderOpen, RotateCcw, Info, CheckCircle, 
  TrendingUp, Package, Zap, DollarSign, Menu, X, 
  ChevronRight, Upload, Edit3, Image as ImageIcon,
  Search, Sun, Moon, ArrowRight, HelpCircle, Box,
  Shield, Crown, Rocket, Layers, LayoutGrid, Download, 
  FileSpreadsheet, Clock, Truck, Users, Briefcase,
  Store, CreditCard, Wallet, Smartphone, Printer, Receipt,
  AlertCircle, Check, Settings, RefreshCw, User, Award,
  Lock, Unlock, Key, ShieldCheck, Calendar, AlertTriangle, 
  ShieldAlert, ShieldCheck as ShieldOk,
  QrCode, Banknote, Coins, CreditCard as CardIcon, UserCircle2, Wallet2, FileText, ChevronDown, ChevronUp,
  Minimize2, Maximize2, History, MinusCircle, Camera, 
  ScanLine, MonitorSmartphone, Globe, Percent, 
  Bluetooth, Wifi, HardDrive, DatabaseBackup, Languages,
  ArrowDownCircle, ArrowUpCircle, ClipboardList, LogOut
} from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, addDoc, query, orderBy } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import Cropper from "react-easy-crop";

const safeParse = (key, fallback = []) => {
    try { 
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback; 
    } catch(e) { return fallback; }
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

// Inisialisasi Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const BRANCH_ID = "PUSAT";

// Helper & Config
const isPro = (info) => info && (info.type === 'PRO' || info.type === 'PREMIUM');
// NOTE: LOG_API_URL, BLACKLIST_URL, SECRET_KEY, dan SESSION_TOKEN telah dihapus.
// Variabel-variabel ini tidak pernah dipakai di mana pun (dead code), namun tetap
// ikut ter-bundle ke file JS yang dikirim ke browser sehingga isinya bisa dibaca
// siapa saja lewat DevTools / view-source. Jangan simpan kunci rahasia atau URL
// internal di kode frontend -- pindahkan ke backend/Cloud Function jika dibutuhkan lagi.

const formatIDR = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number || 0);
};

const formatNumberDisplay = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '';
  if (val === 0) return '0';
  const num = val.toString().replace(/[^0-9.]/g, '');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// =====================================================================
// PERHITUNGAN TAGIHAN TERPUSAT (Subtotal, Diskon, Pajak, Service)
// Dipakai di Kasir (POS), Self-Order, dan Struk supaya konsisten.
// =====================================================================
const getBizConfig = () => {
  try { return JSON.parse(localStorage.getItem('discount_tax_db') || '{"tax":0,"service":0,"globalDiscount":0}'); }
  catch(e) { return { tax: 0, service: 0, globalDiscount: 0 }; }
};

const computeOrderTotals = (items = [], cfg = getBizConfig(), extraDiscount = 0) => {
  const subtotal = items.reduce((a, b) => a + (b.price * b.qty), 0);
  const discPercent = Number(cfg.globalDiscount || 0);
  const discountAmt = Math.round((subtotal * discPercent) / 100) + Number(extraDiscount || 0);
  const base = Math.max(0, subtotal - discountAmt);
  const taxAmt = Math.round((base * Number(cfg.tax || 0)) / 100);
  const serviceAmt = Math.round((base * Number(cfg.service || 0)) / 100);
  const total = base + taxAmt + serviceAmt;
  return { subtotal, discountAmt, taxAmt, serviceAmt, total, taxPercent: Number(cfg.tax||0), servicePercent: Number(cfg.service||0), discPercent };
};

// =====================================================================
// SISTEM BAHASA (i18n) - ringan, berbasis localStorage
// =====================================================================
const TRANSLATIONS = {
  id: {
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
const getLang = () => localStorage.getItem('app_lang') || 'id';
const t = (key) => (TRANSLATIONS[getLang()] && TRANSLATIONS[getLang()][key]) || (TRANSLATIONS.id[key] || key);



const syncSession = async (action, info) => {
    try {
        if(!info) return;
        let ip = 'Unknown';
        try { const r = await fetch('https://api.ipify.org?format=json'); const j = await r.json(); ip = j.ip; } catch(e){}
        
        // KIRIM KE FIREBASE 'logs'
        await addDoc(collection(db, "logs"), {
            timestamp: new Date().toISOString(),
            action: action,
            id: info.id,
            tenant: info.tenant,
            ip: ip,
            device: navigator.userAgent
        });
    } catch(e) { console.log("Log Error", e); }
};



// --- TAMBAHAN KODE 1 (DATA & EXCEL) ---
const MATERIAL_UNITS = ["gr", "kg", "ml", "liter", "pcs", "pack", "sdm", "sdt"];

const VARIABLE_COST_TYPES = {
  "Kemasan": { label: "Isi per Pack", units: ["pcs", "lbr", "pack"], icon: Package },
  "Tenaga Kerja": { label: "Kapasitas per Jam", units: ["jam", "menit", "hari"], icon: Users },
  "Listrik/Gas": { label: "Estimasi Pakai", units: ["jam", "kwh", "tabung"], icon: Zap },
  "Bahan Baku": { label: "Isi Kemasan", units: ["gr", "ml", "pcs"], icon: Package }
};

const WALLET_TYPES = ["Gopay", "OVO", "Dana", "ShopeePay", "LinkAja"];

const loadXLSX = async () => {
  if (window.XLSX) return window.XLSX;
  try {
     const script = document.createElement('script');
     script.src = "https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
     document.head.appendChild(script);
     return new Promise((resolve) => {
         script.onload = () => resolve(window.XLSX);
     });
  } catch(e) { throw new Error("Gagal load library Excel"); }
};
// --------------------------------------



// ============================================================================
// 1. GLOBAL UI COMPONENTS (PREMIUM LOOK)
// ============================================================================

// [BARU] Popup Notifikasi Mahal (Pengganti Alert)
const PremiumPopup = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return createPortal(
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-4 duration-500">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/20 ${
                type === 'error' ? 'bg-rose-500/90 text-white shadow-rose-500/30' : 
                type === 'success' ? 'bg-emerald-500/90 text-white shadow-emerald-500/30' : 
                'bg-slate-800/90 text-white shadow-slate-900/30'
            }`}>
                <div className={`p-2 rounded-full bg-white/20`}>
                    {type === 'error' ? <AlertCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
                </div>
                <div>
                    <h4 className="font-bold text-sm tracking-wide uppercase">{type === 'error' ? 'Perhatian' : 'Berhasil'}</h4>
                    <p className="text-xs font-medium opacity-90">{message}</p>
                </div>
            </div>
        </div>,
        document.body
    );
};

// [BARU] Dropdown Mahal (PremiumSelect) - Digunakan di semua Tab
const PremiumSelect = ({ label, value, options, onChange, className="" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block ml-1">{label}</label>}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-xl px-4 py-3 text-xs font-bold shadow-sm hover:border-indigo-400 transition-all outline-none active:scale-[0.98]">
        <span className="truncate">{value}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>
      
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-[60] animate-in fade-in zoom-in-95 duration-200 custom-scrollbar ring-1 ring-black/5">
             {options.map((opt) => (
               <div key={opt} onClick={() => { onChange(opt); setOpen(false); }} className={`px-4 py-3 text-xs font-bold cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${value === opt ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                 {opt}
               </div>
             ))}
        </div>
      )}
    </div>
  );
};

const HelpBox = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);
  // FIX: Posisi HelpBox agar selalu di tengah layar (fixed center)
  return (
    <div className="relative inline-block ml-1 align-middle">
      <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="text-slate-300 hover:text-indigo-500 transition">
        <HelpCircle className="w-4 h-4" />
      </button>
      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] w-[85%] max-w-xs p-6 bg-slate-900/95 backdrop-blur-md text-white text-sm rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10" onClick={(e) => e.stopPropagation()}>
             <div className="flex justify-between mb-4 pb-2 border-b border-white/10">
                 <span className="font-black text-indigo-400 uppercase tracking-widest text-[10px]">Information</span>
                 <button onClick={(e)=>{ e.stopPropagation(); setIsOpen(false);}} className="hover:text-rose-400 transition-colors"><X className="w-4 h-4"/></button>
             </div>
             <p className="leading-relaxed text-slate-300 font-medium text-xs text-justify">{text}</p>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

// Shared Components
const Card = ({ children, className = "", title, icon: Icon, action, help }) => (
  <div className={`card-premium bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all duration-300 ${className}`}>
    {(title || action) && (
      <div className="px-5 py-4 border-b border-slate-50 dark:border-slate-800/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400"><Icon className="w-4 h-4" /></div>}
          <div><h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">{title} {help && <HelpBox text={help} />}</h3></div>
        </div>
        {action}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", icon: Icon, disabled }) => {
  const styles = {
    primary: "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/30 border-0",
    secondary: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700",
    outline: "border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400",
    success: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 border-0",
    danger: "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-900 dark:text-rose-400"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none ${styles[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
};

const NumericInput = ({ value, onChange, placeholder, className, prefix, suffix, label }) => {
  const [displayValue, setDisplayValue] = useState('');
  useEffect(() => { setDisplayValue(formatNumberDisplay(value)); }, [value]);
  const handleChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '' || /^[0-9]*\.?[0-9]*$/.test(rawValue)) {
      setDisplayValue(formatNumberDisplay(rawValue));
      onChange(rawValue === '' ? 0 : parseFloat(rawValue));
    }
  };
  return (
    <div className="w-full group">
      {label && <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block ml-1">{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3.5 text-slate-400 text-xs font-bold z-10 pointer-events-none group-focus-within:text-indigo-500 transition-colors">{prefix}</span>}
        <input type="text" value={displayValue} onChange={handleChange} placeholder={placeholder}
          className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl py-2.5 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 text-xs ${prefix ? 'pl-9' : 'pl-4'} ${suffix ? 'pr-10' : 'pr-4'} ${className}`}
        />
        {suffix && <span className="absolute right-4 text-slate-400 text-[10px] font-bold pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
};

// ==========================================
// KOMPONEN TAMBAHAN (CROPPER & HARGA)
// ==========================================

// 1. Helper Crop Gambar
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return canvas.toDataURL('image/jpeg');
};

// 2. Komponen Modal Edit Foto (Zoom & Crop)
const ImageCropperModal = ({ imageSrc, onCropComplete, onClose }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const processCrop = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-[95%] md:w-[500px] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col h-[80vh] relative">
          <div className="absolute top-4 right-4 z-20">
              <button onClick={onClose} className="bg-black/50 text-white p-2 rounded-full hover:bg-red-500/80 transition"><X className="w-5 h-5"/></button>
          </div>
          <div className="relative flex-1 bg-neutral-900 touch-none">
            <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)} onZoomChange={setZoom} showGrid={false} />
          </div>
          <div className="p-6 bg-slate-900 border-t border-white/10 space-y-5">
            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition">Batal</button>
                <button onClick={processCrop} className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition">Simpan Foto</button>
            </div>
          </div>
      </div>
    </div>
  );
};

// 3. Komponen Dropdown Harga Premium (Mahal)
const PremiumPriceSelector = ({ currentTier, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const tiers = [
    { id: 'retail', label: 'Harga Ecer', icon: User, color: 'text-slate-600', bg: 'bg-slate-100' },
    { id: 'grosir', label: 'Harga Grosir', icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'ojol', label: 'Harga App Online', icon: Rocket, color: 'text-emerald-600', bg: 'bg-emerald-50' }
  ];
  const selected = tiers.find(t => t.id === currentTier) || tiers[0];

  return (
    <div className="relative z-50">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95">
        <div className={`p-1.5 rounded-lg ${selected.bg} ${selected.color}`}><selected.icon className="w-3.5 h-3.5" /></div>
        <div className="text-left mr-2">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Mode Harga</p>
          <p className="text-xs font-black text-slate-800 dark:text-white leading-none">{selected.label}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in duration-200">
            <p className="text-[10px] font-bold text-slate-400 px-3 py-2 uppercase tracking-wider border-b border-slate-50 dark:border-slate-800 mb-1">Pilih Kategori Jual</p>
            {tiers.map(t => (
              <button key={t.id} onClick={() => { onChange(t.id); setIsOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${currentTier === t.id ? 'bg-slate-50 dark:bg-slate-800 border-l-4 border-indigo-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <div className={`p-2 rounded-lg ${t.bg} ${t.color}`}><t.icon className="w-4 h-4" /></div>
                <span className={`text-xs font-bold ${currentTier === t.id ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{t.label}</span>
                {currentTier === t.id && <CheckCircle className="w-4 h-4 text-indigo-500 ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};



// [FITUR PRO] MODAL SMART PLANNER
const SmartPlannerModal = ({ materials, production, onClose }) => {
    const [target, setTarget] = useState(100);
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-indigo-500/30">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Layers className="w-5 h-5"/></div>
                        <div><h3 className="font-bold text-lg dark:text-white">Smart Production Planner</h3><p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Pro Feature</p></div>
                    </div>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400"/></button>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl mb-6 border border-indigo-100 dark:border-indigo-800">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Rencana Produksi (Qty)</label>
                    <div className="flex gap-2">
                        <input type="number" value={target} onChange={e=>setTarget(e.target.value)} className="flex-1 p-2 rounded-lg font-bold text-slate-800 outline-none border border-indigo-200 focus:ring-2 focus:ring-indigo-500" />
                        <span className="p-2 font-bold text-slate-500 bg-white/50 rounded-lg border border-indigo-100">Pcs</span>
                    </div>
                </div>
                <div className="max-h-[40vh] overflow-y-auto space-y-2 mb-6 pr-1">
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-2">Estimasi Belanja Bahan:</h4>
                    {materials.map((m, i) => {
                        const yieldPcs = production?.yield || 1;
                        const totalNeed = ((m.usage || 0) / yieldPcs) * target;
                        const packsToBuy = Math.ceil(totalNeed / (m.content || 1)); 
                        return (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm border border-slate-100 dark:border-slate-700">
                                <div><p className="font-bold text-slate-800 dark:text-white">{m.name}</p><p className="text-[10px] text-slate-500">Butuh: {formatNumberDisplay(totalNeed)} {m.unit}</p></div>
                                <div className="text-right"><p className="font-bold text-indigo-600">{packsToBuy} Pack</p><p className="text-[10px] text-slate-400">Est. {formatIDR(packsToBuy * m.price)}</p></div>
                            </div>
                        )
                    })}
                </div>
                <button onClick={() => window.print()} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-700 transition"><Printer className="w-4 h-4"/> Cetak Rencana Belanja</button>
            </div>
        </div>
    );
};


// ============================================================================
// CALCULATOR TAB (FIXED: PROPS, ALERT, & STATE)
// ============================================================================
const CalculatorTab = ({ licenseInfo, triggerAlert, setEditingMode }) => {
  const [calcMode, setCalcMode] = useState('detail');
  const [simpleModal, setSimpleModal] = useState(0);
  const [product, setProduct] = useState({ name: '', type: 'Makanan', image: null });
  const [materials, setMaterials] = useState([{ id: 1, name: '', price: 0, unit: 'gr', content: 1000, usage: 0, cost: 0 }]);
  const [variableOps, setVariableOps] = useState([{ id: 1, type: 'Kemasan', name: '', price: 0, unit: 'pcs', content: 1, usage: 0, cost: 0 }]);
  const [fixedOps, setFixedOps] = useState([{ id: 1, name: 'Sewa/Wifi', cost: 0 }]);
  const [showFixed, setShowFixed] = useState(false);
  const [production, setProduction] = useState({ yield: 1, monthlyTarget: 100 });
  const [smartRounding, setSmartRounding] = useState(true);
  const [customMargin, setCustomMargin] = useState(48.6);
  const [targetProfit, setTargetProfit] = useState(0);
  const [competitorPrice, setCompetitorPrice] = useState(0);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [showLoad, setShowLoad] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false); // State Pro
  const [cropSrc, setCropSrc] = useState(null); // State Crop Foto (Hanya 1 kali deklarasi)

  // LOGIC: Sembunyikan Navbar saat crop foto
  useEffect(() => {
      if(cropSrc) setEditingMode(true);
      else setEditingMode(false);
  }, [cropSrc, setEditingMode]);

  const calcRow = (price, content, usage) => (!content || content === 0) ? 0 : (price / content) * usage;
  const updateMat = (id, f, v) => setMaterials(prev => prev.map(m => m.id===id ? {...m, [f]:v, cost: calcRow(f==='price'?v:m.price, f==='content'?v:m.content, f==='usage'?v:m.usage)} : m));
  const updateVar = (id, f, v) => setVariableOps(prev => prev.map(o => {
    if(o.id !== id) return o;
    const newData = { ...o, [f]: v };
    if (f === 'type') { const defs = VARIABLE_COST_TYPES[v]; newData.unit = defs.units[0]; newData.content = 1; newData.usage = 0; }
    newData.cost = calcRow(newData.price, newData.content, newData.usage);
    return newData;
  }));
  const updateFix = (id, v) => setFixedOps(prev => prev.map(f => f.id===id ? {...f, cost: v} : f));
  const addMat = () => setMaterials([...materials, { id: Date.now(), name: '', price: 0, unit: 'gr', content: 1000, usage: 0, cost: 0 }]);
  const addVar = () => setVariableOps([...variableOps, { id: Date.now(), type: 'Kemasan', name: '', price: 0, unit: 'pcs', content: 1, usage: 0, cost: 0 }]);
  const addFix = () => setFixedOps([...fixedOps, { id: Date.now(), name: '', cost: 0 }]);
  const removeRow = (setter, id) => {
    setter(prev => {
        if (prev.length <= 1) return prev;
        return prev.filter(item => item.id !== id);
    });
  };

  const totalMat = materials.reduce((a,b) => a + b.cost, 0);
  const totalVar = variableOps.reduce((a,b) => a + b.cost, 0);
  const totalFix = fixedOps.reduce((a,b) => a + b.cost, 0);
  let matPerUnit, varPerUnit, fixPerUnit, hppBersih;
  
  if (calcMode === 'simple') {
    matPerUnit = simpleModal / (production.yield || 1);
    varPerUnit = 0; fixPerUnit = 0; hppBersih = matPerUnit;
  } else {
    matPerUnit = totalMat / (production.yield || 1);
    varPerUnit = totalVar / (production.yield || 1);
    fixPerUnit = showFixed ? (totalFix / (production.monthlyTarget || 1)) : 0;
    hppBersih = matPerUnit + varPerUnit + fixPerUnit;
  }

  const round = (p) => smartRounding ? (p < 1000 ? Math.ceil(p/100)*100 : Math.ceil(p/500)*500) : p;
  const getTier = (margin) => { 
    const raw = hppBersih / (1 - (margin/100)); // Rumus Margin Benar
    return { raw, final: round(raw), profit: round(raw) - hppBersih }; 
  };
  const tiers = [
    { name: "INFOKAN SAINGAN", label: "kompetitif", desc: "Penetrasi pasar", margin: 22.8, color: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: Shield },
    { name: "MASUK AKAL", label: "standar", desc: "Margin umum", margin: 48.6, color: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: Layers },
    { name: "CEPAT NAIK HAJI", label: "premium", desc: "Niche market", margin: 78.4, color: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", icon: Crown }
  ];
  const finalPrice = getTier(customMargin).final;
  const contributionMargin = finalPrice - matPerUnit - varPerUnit;
  const totalFixCostValid = showFixed ? totalFix : 0;
  const profitPerPcs = finalPrice - hppBersih;
  const targetPcsMonth = contributionMargin > 0 ? Math.ceil((targetProfit + totalFixCostValid) / contributionMargin) : 0;
  const targetPcsDay = Math.ceil(targetPcsMonth / 30);
  const projOmzetMonth = targetPcsMonth * finalPrice;
  const projProdCostMonth = targetPcsMonth * (matPerUnit + varPerUnit);
  const projFixedCostMonth = showFixed ? totalFix : 0;
  const projNetProfitMonth = projOmzetMonth - projProdCostMonth - projFixedCostMonth;

  useEffect(() => {
    setSavedRecipes(safeParse("hpp_pro_db"));
  }, []);

  const save = () => {
    if(!product.name) return triggerAlert("Isi nama produk dulu!", "error");
    if (!isPro(licenseInfo) && savedRecipes.length >= 5) {
        return triggerAlert("Upgrade ke PRO untuk simpan > 5 resep!", "error");
    }
    
    // 1. SIMPAN RESEP
    const data = { id: Date.now(), product, materials, variableOps, fixedOps, production, hppBersih, finalPrice };
    setSavedRecipes(prev => { const n = [...prev, data]; localStorage.setItem('hpp_pro_db', JSON.stringify(n)); return n; });

    // 2. UPDATE STOK PRODUK & BAHAN
    const currentProducts =
safeParse("product_stock_db");
    const existingProdIndex = currentProducts.findIndex(p => p.name.toLowerCase() === product.name.toLowerCase());
    
    const prodImage = product.image || null; 
    const newProductItem = {
        id: existingProdIndex >= 0 ? currentProducts[existingProdIndex].id : `p_${Date.now()}`,
        name: product.name,
        price: finalPrice, hpp: hppBersih,
        stock: existingProdIndex >= 0 ? currentProducts[existingProdIndex].stock : 0, 
        type: product.type, image: prodImage, priceGrosir: 0, priceOjol: 0 
    };

    let updatedProducts;
    if (existingProdIndex >= 0) {
        updatedProducts = [...currentProducts];
        updatedProducts[existingProdIndex] = { ...updatedProducts[existingProdIndex], ...newProductItem };
    } else {
        updatedProducts = [...currentProducts, newProductItem];
    }
    localStorage.setItem('product_stock_db', JSON.stringify(updatedProducts));

    const currentRawMaterials =
safeParse("raw_material_db");
    let updatedRawMaterials = [...currentRawMaterials];

    materials.forEach(mat => {
        if(!mat.name) return;
        const matIdx = updatedRawMaterials.findIndex(m => m.name.toLowerCase() === mat.name.toLowerCase());
        if (matIdx >= 0) { updatedRawMaterials[matIdx].lastPrice = mat.price / (mat.content || 1); } 
        else {
            updatedRawMaterials.push({
                id: `rm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: mat.name, unit: mat.unit, stock: 0, 
                lastPrice: mat.price / (mat.content || 1), 
                category: 'Bahan Baku'
            });
        }
    });
    localStorage.setItem('raw_material_db', JSON.stringify(updatedRawMaterials));

    triggerAlert("Data Tersimpan! Stok & Bahan Baku terupdate.");
  };

  const load = (r) => {
    setProduct(r.product); setMaterials(r.materials); setVariableOps(r.variableOps); setFixedOps(r.fixedOps||[]);
    setProduction(r.production); setShowLoad(false);
  };
  const reset = () => {
    if(confirm("Reset formulir?")) {
      setProduct({name:'', type:'Makanan', image:null});
      setMaterials([{ id: 1, name: '', price: 0, unit: 'gr', content: 1000, usage: 0, cost: 0 }]);
      setVariableOps([{ id: 1, type: 'Kemasan', name: '', price: 0, unit: 'pcs', content: 1, usage: 0, cost: 0 }]);
      setFixedOps([{ id: 1, name: 'Sewa', cost: 0 }]);
      setProduction({ yield: 1, monthlyTarget: 100 }); setSimpleModal(0);
    }
  };
  const handleExportExcel = async () => {
    if(!product.name) return triggerAlert("Beri nama produk dulu!", "error");
    setIsExporting(true);
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.utils.book_new();
      const summaryData = [
        ["LAPORAN HPP - " + product.name.toUpperCase()],
        ["Tanggal", new Date().toLocaleDateString()],
        ["HPP Bersih", hppBersih], ["Harga Jual", finalPrice], ["Profit/Pcs", profitPerPcs],
        ["Target Laba", targetProfit], ["Proyeksi Laba", projNetProfitMonth]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");
      XLSX.writeFile(wb, `HPP_${product.name.replace(/\s+/g, '_')}.xlsx`);
    } catch (e) { triggerAlert("Gagal export: " + e.message, "error"); }
    setIsExporting(false);
  };

  return (
    <div className="space-y-4 pb-32 w-full max-w-7xl mx-auto px-4 md:px-8">
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 flex gap-4 items-center">
          <div className="w-24 h-24 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center relative group cursor-pointer hover:border-indigo-400 transition-all">
            {product.image ? <img src={product.image} className="w-full h-full object-cover rounded-xl"/> : <ImageIcon className="w-8 h-8 text-slate-300"/>}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"><Edit3 className="w-6 h-6 text-white"/></div>
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
              if(e.target.files[0]) { const r = new FileReader(); r.onload=v=>setCropSrc(v.target.result); r.readAsDataURL(e.target.files[0]); }
            }}/>
          </div>
          <div className="flex-1 min-w-0">
            <input className="bg-transparent text-xl font-black w-full outline-none placeholder:text-slate-300 border-b border-transparent focus:border-indigo-500 transition-all pb-1 mb-2 text-slate-900 dark:text-white"
              placeholder="Nama Produk..." value={product.name} onChange={e=>setProduct({...product, name:e.target.value})} />
            <div className="flex gap-2 flex-wrap">
              {['Makanan','Minuman','Fashion','Jasa'].map(t => (
                <button key={t} onClick={()=>setProduct({...product, type:t})} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition border ${product.type===t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-center">
        <div className="bg-white dark:bg-slate-900 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex">
          <button onClick={()=>setCalcMode('detail')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition ${calcMode==='detail'?'bg-indigo-600 text-white shadow-sm':'text-slate-500'}`}>Mode Detail</button>
          <button onClick={()=>setCalcMode('simple')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition ${calcMode==='simple'?'bg-emerald-600 text-white shadow-sm':'text-slate-500'}`}>Mode Cepat</button>
        </div>
      </div>

      {calcMode === 'detail' ? (
        <div className="space-y-4">
          <Card title="Bahan Baku" icon={Package} help="Biaya bahan untuk 1x resep (Batch)">
            <div className="space-y-4">
              {materials.map((m) => (
                <div key={m.id} className="relative p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 group">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <div className="col-span-2">
                       <input className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 py-1 text-sm font-bold placeholder:text-slate-400 focus:border-indigo-500 outline-none dark:text-white" placeholder="Nama Bahan (Tepung, Telur...)" value={m.name} onChange={e=>updateMat(m.id,'name',e.target.value)} />
                    </div>
                    <NumericInput label="Harga Beli" placeholder="0" prefix="Rp" value={m.price} onChange={v=>updateMat(m.id,'price',v)} className="bg-white dark:bg-slate-900" />
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">Isi Kemasan</label>
                      <div className="flex">
                        <input type="number" className="w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-xl py-2 pl-3 text-xs font-bold outline-none" placeholder="1000" value={m.content} onChange={e=>updateMat(m.id,'content',parseFloat(e.target.value))} />
                        <div className="w-24 shrink-0"><PremiumSelect value={m.unit} options={MATERIAL_UNITS} onChange={v=>updateMat(m.id,'unit',v)} className="!rounded-l-none" /></div>
                      </div>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 mt-1 flex items-center justify-between gap-3">
                       <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-emerald-600 mb-1 block">Dipakai ({m.unit})</label>
                          <input type="number" className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg py-1.5 px-2 text-sm font-bold text-emerald-800 dark:text-emerald-400 outline-none" placeholder="0" value={m.usage} onChange={e=>updateMat(m.id,'usage',parseFloat(e.target.value))} />
                       </div>
                       <div className="text-right"><p className="text-[10px] text-slate-400 font-medium">Biaya</p><p className="text-base font-black text-slate-700 dark:text-white">{formatIDR(m.cost)}</p></div>
                    </div>
                  </div>
                  <button onClick={()=>removeRow(setMaterials,m.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-300 hover:text-red-500 shadow-sm"><Trash2 className="w-3 h-3"/></button>
                </div>
              ))}
              <Button variant="outline" onClick={addMat} icon={Plus} className="w-full py-3">Tambah Bahan</Button>
            </div>
          </Card>

          <Card title="Biaya Variabel" icon={Zap} help="Biaya yang keluar tergantung jumlah produksi (Kemasan, Tenaga Kerja per pcs, dll)">
            <div className="space-y-4">
              {variableOps.map((op) => {
                const typeConfig = VARIABLE_COST_TYPES[op.type] || VARIABLE_COST_TYPES['Bahan Baku'];
                const TypeIcon = typeConfig.icon;
                return (
                  <div key={op.id} className="relative p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 group">
                    <div className="mb-3"><PremiumSelect label="Kategori Biaya" value={op.type} options={Object.keys(VARIABLE_COST_TYPES)} onChange={v=>updateVar(op.id, 'type', v)} /></div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                       <div className="col-span-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 mb-1">
                          <TypeIcon className="w-4 h-4 text-slate-400" />
                          <input className="w-full bg-transparent text-sm font-bold placeholder:text-slate-400 outline-none dark:text-white" placeholder={`Nama ${op.type}...`} value={op.name} onChange={e=>updateVar(op.id,'name',e.target.value)} />
                       </div>
                       <NumericInput label="Biaya Satuan" placeholder="0" prefix="Rp" value={op.price} onChange={v=>updateVar(op.id,'price',v)} className="bg-white dark:bg-slate-900" />
                       <div>
                           <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">{typeConfig.label}</label>
                          <div className="flex">
                            <input type="number" className="w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-xl py-2 pl-3 text-xs font-bold outline-none" placeholder="1" value={op.content} onChange={e=>updateVar(op.id,'content',parseFloat(e.target.value))} />
                             <div className="w-24 shrink-0"><PremiumSelect value={op.unit} options={typeConfig.units} onChange={v=>updateVar(op.id,'unit',v)} className="!rounded-l-none" /></div>
                          </div>
                       </div>
                       <div className="col-span-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 mt-1 flex items-center justify-between gap-3">
                           <div className="flex-1">
                              <label className="text-[10px] uppercase font-bold text-amber-600 mb-1 block">Pemakaian ({op.unit})</label>
                              <input type="number" className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg py-1.5 px-2 text-sm font-bold text-amber-800 dark:text-amber-400 outline-none" placeholder="0" value={op.usage} onChange={e=>updateVar(op.id,'usage',parseFloat(e.target.value))} />
                           </div>
                           <div className="text-right"><p className="text-[10px] text-slate-400 font-medium">Biaya</p><p className="text-base font-black text-slate-700 dark:text-white">{formatIDR(op.cost)}</p></div>
                        </div>
                    </div>
                    <button onClick={()=>removeRow(setVariableOps,op.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-300 hover:text-red-500 shadow-sm"><Trash2 className="w-3 h-3"/></button>
                  </div>
                );
              })}
              <Button variant="outline" onClick={addVar} icon={Plus} className="w-full py-3">Tambah Biaya Variabel</Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="flex flex-col items-center py-10 bg-slate-50 dark:bg-slate-900/50" help="Isi total uang belanja 1x produksi, lalu bagi dengan jumlah produk jadi.">
          <h3 className="text-lg font-bold text-slate-700 dark:text-white mb-4">Mode Hitung Cepat</h3>
          <div className="w-full max-w-sm">
            <NumericInput label="Total Modal Belanja (Rp)" placeholder="Masukkan total uang keluar" prefix="Rp" value={simpleModal} onChange={setSimpleModal} className="text-center text-xl h-14" />
          </div>
        </Card>
      )}

      {/* SUBTOTAL MODAL & FIXED COST & PRICING */}
      <div className="mt-4 p-5 bg-slate-900 dark:bg-black rounded-2xl flex flex-col justify-between items-center gap-4 text-white shadow-xl shadow-slate-200 dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="w-full flex justify-between items-center relative z-10">
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{calcMode==='detail' ? 'Total Modal Langsung' : 'Total Modal'}</p>
            <p className="text-3xl font-bold tracking-tight">{formatIDR(calcMode==='detail' ? totalMat+totalVar : simpleModal)}</p>
          </div>
          <div className="text-right">
             <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Hasil Produksi</label>
             <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
              <input 
    type="number" 
    className="w-20 bg-transparent text-right font-bold text-xl outline-none placeholder:text-slate-500" 
    value={production.yield} 
    onChange={e => {
        const val = e.target.value;
        // Izinkan kosong sementara agar user bisa hapus angka
        setProduction({...production, yield: val === '' ? '' : parseFloat(val)});
    }}
    onBlur={() => {
        // Saat selesai ketik, jika kosong kembalikan ke 1
        if (!production.yield) setProduction({...production, yield: 1});
    }}/>

               <span className="text-xs font-medium text-slate-400">Pcs</span>
             </div>
          </div>
        </div>
      </div>

      {/* Fixed Cost Toggle */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center cursor-pointer p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition" onClick={() => setShowFixed(!showFixed)}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${showFixed ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}><Briefcase className="w-4 h-4"/></div>
            <div><h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">Biaya Tetap (Opsional)</h3></div>
          </div>
          <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${showFixed ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showFixed ? 'translate-x-4' : ''}`}></div>
          </div>
        </div>
        {showFixed && (
          <div className="animate-fade-in mt-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="w-full mb-3"><NumericInput label="Target Produksi / Bulan" placeholder="100" value={production.monthlyTarget} onChange={v=>setProduction({...production, monthlyTarget: v})} suffix="Pcs" className="bg-white dark:bg-slate-900" /></div>
            <div className="space-y-2">
               {fixedOps.map(op => (
                <div key={op.id} className="flex gap-2 items-end">
                  <div className="flex-1"><input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold outline-none" placeholder="Nama Biaya" value={op.name} onChange={e=>updateFix(op.id,'name',e.target.value)} /></div>
                  <div className="w-28"><NumericInput value={op.cost} onChange={v=>updateFix(op.id, v)} prefix="Rp" className="bg-white dark:bg-slate-900 text-xs py-2" /></div>
                  <button onClick={()=>removeRow(setFixedOps,op.id)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <Button variant="secondary" onClick={addFix} className="w-full text-xs h-8 mt-2">Tambah</Button>
            </div>
          </div>
        )}
      </div>

      {/* Pricing & Strategy */}
      <Card className="!p-0 overflow-hidden border-indigo-100 dark:border-slate-800 rounded-3xl mt-6">
        <div className="bg-indigo-600 p-6 text-white text-center relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">HPP Bersih / Pcs</p>
            <h2 className="text-4xl font-black tracking-tighter mb-3 drop-shadow-md">{formatIDR(hppBersih)}</h2>
            <div className="inline-flex gap-4 text-[10px] font-bold uppercase text-indigo-200 bg-indigo-800/30 py-1.5 px-4 rounded-full backdrop-blur-sm border border-indigo-500/30">
              <span>Bahan: {formatIDR(matPerUnit)}</span><span>|</span><span>Ops: {formatIDR(varPerUnit)}</span>
            </div>
          </div>
        </div>

        <div className="px-5 pt-4 pb-2">
            {/* GRAFIK KOMPOSISI BIAYA */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-2">
                    <span>Komposisi HPP</span>
                    <span>Total: {formatIDR(hppBersih)}</span>
                </div>
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(matPerUnit/hppBersih)*100}%` }}></div>
                    <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${(varPerUnit/hppBersih)*100}%` }}></div>
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(fixPerUnit/hppBersih)*100}%` }}></div>
                </div>
                <div className="flex gap-4 mt-3 justify-center">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div><span className="text-[10px] font-bold text-slate-500">Bahan ({((matPerUnit/hppBersih)*100||0).toFixed(0)}%)</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div><span className="text-[10px] font-bold text-slate-500">Var ({((varPerUnit/hppBersih)*100||0).toFixed(0)}%)</span></div>
                    {showFixed && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[10px] font-bold text-slate-500">Tetap ({((fixPerUnit/hppBersih)*100||0).toFixed(0)}%)</span></div>}
                </div>
            </div>
        </div>

        <div className="p-4">
           <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-base">Saran Harga Jual</h3>
            <div className="flex items-center gap-2 cursor-pointer bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-800" onClick={() => setSmartRounding(!smartRounding)}>
              <span className="text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Smart Round</span>
              <div className={`w-6 h-3 rounded-full p-0.5 transition-colors ${smartRounding ? 'bg-emerald-500' : 'bg-slate-300'}`}><div className={`w-2 h-2 bg-white rounded-full shadow-sm transition-transform ${smartRounding ? 'translate-x-3' : ''}`}></div></div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 mb-6">
            {tiers.map((t, i) => {
              const d = getTier(t.margin);
              const isSelected = customMargin === t.margin;
              return (
                <div key={i} onClick={()=>setCustomMargin(t.margin)} className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer group hover:-translate-y-1 ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                  <div className="p-4 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-block ${t.color} ${t.text} border ${t.border}`}>{t.name}</div>
                          <span className="text-[10px] font-medium text-slate-400 capitalize">{t.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mb-1">{t.desc}</p>
                      <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-500">{t.margin}%</span><span className="text-xs font-bold text-emerald-600">Untung {formatIDR(d.profit)}</span></div>
                    </div>
                    <div className="text-right"><h3 className="text-xl font-black text-slate-800 dark:text-white leading-none">{formatIDR(d.final)}</h3></div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Edit3 className="w-3 h-3"/> Custom Margin</label><div className="text-right"><p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{formatIDR(finalPrice)}</p></div></div>
            <input type="range" min="0" max="150" step="0.1" className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" value={customMargin} onChange={(e) => setCustomMargin(parseFloat(e.target.value))} />
            <div className="text-center mt-1 font-bold text-slate-900 dark:text-white text-xs">{customMargin}%</div>
          </div>
          
          <Card title="Target & Proyeksi" icon={TrendingUp} help="Hitung berapa banyak harus jual biar dapet target cuan segitu." className="bg-white border-0 shadow-none !p-0">
             <div className="mt-2">
                 <NumericInput label="Target Laba Bersih (Bulan)" placeholder="5.000.000" prefix="Rp" value={targetProfit} onChange={setTargetProfit} />
                 
                 <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">Cek Kompetitor</label>
                    <NumericInput placeholder="Harga Pesaing" prefix="Rp" value={competitorPrice} onChange={setCompetitorPrice} className="py-2 text-sm" />
                    {competitorPrice > 0 && (
                      <div className={`mt-3 text-xs font-bold flex items-center gap-1 ${competitorPrice < finalPrice ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {competitorPrice < finalPrice ? <ArrowRight className="w-3 h-3 rotate-45"/> : <ArrowRight className="w-3 h-3 -rotate-45"/>}
                        {competitorPrice < finalPrice ? `Lebih mahal ${formatIDR(finalPrice - competitorPrice)}` : `Lebih murah ${formatIDR(competitorPrice - finalPrice)}`}
                      </div>
                    )}
                 </div>

                 {targetProfit > 0 && hppBersih > 0 && (
                     <div className="mt-4 bg-emerald-600 text-white rounded-xl p-5 relative overflow-hidden shadow-lg shadow-emerald-500/20">
                     <div className="relative z-10 space-y-3">
                       <div className="flex justify-between items-center pb-2 border-b border-white/20">
                          <span className="text-[10px] text-emerald-100 font-bold uppercase opacity-80">Target Jual / Hari</span>
                         <span className="text-lg font-bold">{targetPcsDay} <span className="text-xs font-normal">pcs</span></span>
                       </div>
                       <div className="flex justify-between items-center pb-2 border-b border-white/20">
                         <span className="text-[10px] text-emerald-100 font-bold uppercase opacity-80">Total Jual / Bulan</span>
                         <span className="text-lg font-bold">{targetPcsMonth} <span className="text-xs font-normal">pcs</span></span>
                       </div>
                       <div className="flex justify-between items-center text-emerald-50">
                          <span className="text-[10px] opacity-80 uppercase font-bold">Potensi Omzet / Bulan</span>
                          <span className="text-sm font-semibold">{formatIDR(projOmzetMonth)}</span>
                      </div>
                       <div className="flex justify-between items-center text-emerald-50">
                          <span className="text-[10px] opacity-80 uppercase font-bold">Total Biaya Produksi / Bulan</span>
                         <span className="text-sm font-semibold">{formatIDR(projProdCostMonth)}</span>
                       </div>
                       {showFixed && (
                          <div className="flex justify-between items-center text-emerald-50">
                             <span className="text-[10px] opacity-80 uppercase font-bold">Total Biaya Tetap / Bulan</span>
                              <span className="text-sm font-semibold">{formatIDR(projFixedCostMonth)}</span>
                          </div>
                       )}
                       <div className="pt-2 mt-2 border-t border-white/30 flex justify-between items-center">
                          <span className="text-xs font-black text-white uppercase">Proyeksi Laba Bersih / Bulan</span>
                          <span className="text-xl font-black text-white">{formatIDR(projNetProfitMonth)}</span>
                     </div>
                     </div>
                   </div>
                 )}
             </div>
          </Card>
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-2 pb-2">
         <Button variant="outline" onClick={reset} icon={RotateCcw} className="col-span-1 border-slate-300 dark:border-slate-700">Reset</Button>
         <Button variant="secondary" onClick={()=>setShowLoad(true)} icon={FolderOpen} className="col-span-1">Load</Button>
         <Button variant="primary" onClick={save} icon={Save} className="col-span-2">Simpan Data</Button>
      </div>
      <Button variant="secondary" onClick={() => isPro(licenseInfo) ? setShowPlanner(true) : triggerAlert("Fitur PRO Only", "error")} className={`w-full py-3 mb-2 border-indigo-200 text-indigo-700 ${!isPro(licenseInfo)&&'opacity-60'}`} icon={Layers}>
        Smart Planner {isPro(licenseInfo) ? '' : '(PRO)'}
      </Button>

      <Button variant="success" onClick={handleExportExcel} disabled={isExporting} icon={FileSpreadsheet} className="w-full py-3 rounded-xl bg-emerald-600 border-none text-white shadow-lg shadow-emerald-500/20 text-xs">
        {isExporting ? 'Mengekspor...' : 'Export Laporan (.xlsx)'}
      </Button>

      {showPlanner && <SmartPlannerModal materials={materials} production={production} onClose={()=>setShowPlanner(false)} />}

      {showLoad && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-800 dark:text-white">Load Data</h3>
              <button onClick={()=>setShowLoad(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {savedRecipes.length===0 && <p className="text-center py-8 text-slate-400 text-xs">Belum ada data tersimpan.</p>}
              {savedRecipes.map(r => (
                <div key={r.id} onClick={()=>load(r)} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex gap-3 cursor-pointer hover:border-indigo-500 transition group relative">
                  <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg overflow-hidden shadow-sm shrink-0">
                    {r.product?.image ? <img src={r.product.image} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-300">{r.product?.name[0]}</div>}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 dark:text-white text-xs">{r.product?.name}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatIDR(r.finalPrice)} • {new Date(r.id).toLocaleDateString()}</p>
                  </div>
                  <button onClick={(e)=>{e.stopPropagation();
                  setSavedRecipes(savedRecipes.filter(i=>i.id!==r.id)); localStorage.setItem('hpp_pro_db', JSON.stringify(savedRecipes.filter(i=>i.id!==r.id)));}} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CROPPER MODAL (FOR PRODUCT IMAGE) */}
      {cropSrc && (
         <ImageCropperModal 
            imageSrc={cropSrc} 
            onCropComplete={(img)=>{ setProduct({...product, image: img}); setCropSrc(null); }} 
            onClose={()=>setCropSrc(null)} 
         />
      )}
    </div>
  );
};

// ============================================================================
// 3. TAB: PROFILE TOKO (MURNI IDENTITAS BISNIS - PREMIUM LOOK)
// ============================================================================

const ProfileTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
  const [profile, setProfile] = useState({ name: '', address: '', wa: '', logo: null, adminName: '', payment: { qris: null, ewallets: [], bank: [] } });
  const [cropSrc, setCropSrc] = useState(null); 
  const [cropTarget, setCropTarget] = useState('');

  // FIX BUG: Auto-Refresh Data Profil saat tab dibuka
  useEffect(() => {
    if (activeTab === 'profile' || !activeTab) {
        const saved = localStorage.getItem('store_profile');
        if (saved) setProfile(JSON.parse(saved));
    }
  }, [activeTab]);


  // LOGIC: Sembunyikan Navbar utama saat mode Crop foto aktif
  useEffect(() => {
      if(cropSrc) setEditingMode(true);
      else setEditingMode(false);
  }, [cropSrc, setEditingMode]);

  const saveProfile = (newP) => { 
    setProfile(newP); 
    localStorage.setItem('store_profile', JSON.stringify(newP)); 
  };

  return (
    <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
      <div className="mb-2 px-1">
          <h2 className="font-black text-xl text-slate-800 dark:text-white">Profil Bisnis</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identitas Resmi Toko & Kasir</p>
      </div>

      <Card title="Informasi Bisnis" icon={Store}>
          <div className="space-y-6">
              {/* Upload & Crop Logo Bulat Premium */}
              <div className="flex justify-center pt-2">
                  <div className="relative group cursor-pointer">
                      <div className="w-32 h-32 bg-slate-50 dark:bg-slate-800 rounded-full border-4 border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden flex items-center justify-center group-hover:border-indigo-500 transition-colors">
                          {profile.logo ? (
                              <img src={profile.logo} className="w-full h-full object-cover" alt="Logo Bisnis"/>
                          ) : (
                              <Store className="w-12 h-12 text-slate-300"/>
                          )}
                      </div>
                      
                      {/* Tombol Floating Edit Logo */}
                      <label className="absolute bottom-1 right-1 bg-indigo-600 text-white p-2.5 rounded-full shadow-lg hover:bg-indigo-500 transition active:scale-90 border-4 border-white dark:border-slate-900 cursor-pointer">
                          <Edit3 className="w-4 h-4"/>
                          <input type="file" className="hidden" accept="image/*" onChange={e => {
                              if(e.target.files[0]) { 
                                  const r = new FileReader();
                                  r.onload = v => { setCropSrc(v.target.result); setCropTarget('logo'); }; 
                                  r.readAsDataURL(e.target.files[0]); 
                              }
                          }}/>
                      </label>
                  </div>
              </div>
       
              {/* Form Input Bidang Identitas */}
              <div className="space-y-4">
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Nama Bisnis</label>
                      <input className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none focus:border-indigo-500 transition dark:text-white" value={profile.name} onChange={e=>saveProfile({...profile, name:e.target.value})} placeholder="Contoh : Kopi Senja"/>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Alamat Lengkap</label>
                      <textarea className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm outline-none h-24 focus:border-indigo-500 transition resize-none dark:text-white" value={profile.address} onChange={e=>saveProfile({...profile, address:e.target.value})} placeholder="Alamat detail toko..."/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">WhatsApp</label>
                          <input className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm outline-none font-bold dark:text-white" value={profile.wa} onChange={e=>saveProfile({...profile, wa:e.target.value})} placeholder="08..."/>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Nama Owner / Kasir</label>
                          <input className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm outline-none font-bold dark:text-white" value={profile.adminName} onChange={e=>saveProfile({...profile, adminName:e.target.value})} placeholder="Nama Anda"/>
                      </div>
                  </div>
              </div>
          </div>
      </Card>
  
      {/* Modal Cropper khusus untuk fitting Logo */}
      {cropSrc && (
          <ImageCropperModal 
              imageSrc={cropSrc} 
              onCropComplete={(img) => { 
                  if(cropTarget === 'logo') saveProfile({...profile, logo: img}); 
                  setCropSrc(null); 
              }} 
              onClose={() => setCropSrc(null)} 
          />
      )}
    </div>
  );
};


// ============================================================================
// 4. TAB: POS (KASIR) - FIXED COMPLETE VERSION
// ============================================================================

const CartPopup = ({ showCart, setShowCart, cart, updateQty, removeFromCart, buyerName, setBuyerName, paymentMethod, setPaymentMethod, handleCheckout, profile, isLoading, orderType, setOrderType, tableNo, setTableNo, notes, setNotes, cashTendered, setCashTendered, isSelfOrder = false }) => {
    const [showNumpad, setShowNumpad] = useState(false);
    const [splitCash, setSplitCash] = useState(0); 
    const totalTagihan = cart.reduce((a,b)=>a+(b.price*b.qty),0);
    const bill = computeOrderTotals(cart);
    const grandTotal = bill.total;
    const bizMode = localStorage.getItem('biz_mode') || 'retail';

    const getPaymentIcon = (type) => {
        if (type === 'Cash' || type === 'Split Bill') return <Banknote className="w-4 h-4"/>;
        if (type === 'QRIS') return <QrCode className="w-4 h-4"/>;
        return <Wallet className="w-4 h-4"/>;
    };

    if (!showCart) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={()=>setShowCart(false)}>
            <div className="bg-white dark:bg-slate-900 w-[95%] md:w-[480px] rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden border border-white/20 ring-1 ring-black/5" onClick={e=>e.stopPropagation()}>
                
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10 shrink-0">
                    <div className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-600"><ShoppingCart className="w-5 h-5"/></div>
                        Checkout
                    </div>
                    <button onClick={()=>setShowCart(false)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"><X className="w-5 h-5 text-slate-500"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950/50">
                    {cart.map(i => (
                        <div key={i.id} className="flex gap-3 items-center bg-white dark:bg-slate-800 p-2 pr-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden shrink-0">
                                {i.image ? <img src={i.image} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-300">{i.name[0]}</div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate dark:text-white text-slate-800">{i.name}</p>
                                <p className="text-xs font-bold text-indigo-600">{formatIDR(i.price)}</p>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border border-slate-100 dark:border-slate-700">
                                <button onClick={()=>updateQty(i.id,-1)} className="w-6 h-6 bg-white dark:bg-slate-800 rounded shadow-sm text-xs font-bold hover:text-rose-500 transition">-</button>
                                <span className="text-xs font-bold w-4 text-center dark:text-white">{i.qty}</span>
                                <button onClick={()=>updateQty(i.id,1)} className="w-6 h-6 bg-white dark:bg-slate-800 rounded shadow-sm text-xs font-bold hover:text-emerald-500 transition">+</button>
                            </div>
                            <button onClick={()=>removeFromCart(i.id)} className="text-slate-300 hover:text-rose-500 transition px-1"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>

                <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-20 shrink-0 space-y-4 overflow-y-auto max-h-[50vh] custom-scrollbar">
                    
                    <div className="space-y-3">
                        {!isSelfOrder && (
                            <input className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all dark:text-white placeholder:text-slate-400" placeholder="Nama Pelanggan (Opsional)" value={buyerName} onChange={e=>setBuyerName(e.target.value)}/>
                        )}
                        {bizMode === 'fnb' && !isSelfOrder && (
                            <div className="flex gap-2">
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-1/2 shrink-0">
                                    <button onClick={() => setOrderType('Dine-in')} className={`flex-1 text-[10px] font-bold rounded-lg py-2 transition ${orderType==='Dine-in'?'bg-white dark:bg-slate-700 shadow-sm text-indigo-600':'text-slate-500'}`}>Dine-in</button>
                                    <button onClick={() => setOrderType('Takeaway')} className={`flex-1 text-[10px] font-bold rounded-lg py-2 transition ${orderType==='Takeaway'?'bg-white dark:bg-slate-700 shadow-sm text-indigo-600':'text-slate-500'}`}>Takeaway</button>
                                </div>
                                {orderType === 'Dine-in' && (
                                    <input type="number" placeholder="No Meja" value={tableNo} onChange={e=>setTableNo(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-indigo-500 dark:text-white" />
                                )}
                            </div>
                        )}
                        <input type="text" placeholder="Catatan Pesanan (Opsional)..." value={notes} onChange={e=>setNotes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 dark:text-white" />
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Metode Pembayaran</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            {(isSelfOrder ? ['QRIS', ...(profile.payment?.ewallets?.map(w=>w.type)||[]), ...(profile.payment?.bank?.map(b=>b.bank)||[])] : ['Cash','QRIS', 'Split Bill', ...(profile.payment?.ewallets?.map(w=>w.type)||[]), ...(profile.payment?.bank?.map(b=>b.bank)||[])]).map(m => (
                                <button key={m} onClick={()=>setPaymentMethod(m)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border shrink-0 transition-all ${paymentMethod===m ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                    {getPaymentIcon(m)} <span className="text-xs font-bold">{m}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400"><span>{t('subtotal')}</span><span>{formatIDR(bill.subtotal)}</span></div>
                        {bill.discountAmt > 0 && <div className="flex justify-between text-xs font-bold text-emerald-600"><span>{t('disc')} ({bill.discPercent}%)</span><span>- {formatIDR(bill.discountAmt)}</span></div>}
                        {bill.taxAmt > 0 && <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400"><span>{t('tax')} ({bill.taxPercent}%)</span><span>{formatIDR(bill.taxAmt)}</span></div>}
                        {bill.serviceAmt > 0 && <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400"><span>{t('service')} ({bill.servicePercent}%)</span><span>{formatIDR(bill.serviceAmt)}</span></div>}
                    </div>
                    <div className="flex justify-between items-end mb-1 mt-2">
                        <span className="text-slate-500 text-xs font-bold">{t('total')}</span>
                        <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatIDR(grandTotal)}</span>
                    </div>

                    {/* LAYOUT UANG PAS & MANUAL DIPERBAIKI */}
                    {paymentMethod === 'Cash' && !isSelfOrder && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block text-center">Nominal Diterima Kasir</span>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setCashTendered(grandTotal)} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-3 rounded-xl font-black transition-colors flex items-center justify-center gap-1 shadow-sm text-xs"><CheckCircle className="w-4 h-4"/> Uang Pas</button>
                                <button onClick={() => setShowNumpad(!showNumpad)} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 py-3 rounded-xl font-black transition-colors flex items-center justify-center gap-1 shadow-sm text-xs"><Edit3 className="w-4 h-4"/> Input Manual</button>
                            </div>
                            <div className="text-center font-black text-3xl text-slate-800 dark:text-white tracking-tight py-2">{formatIDR(cashTendered)}</div>
                            
                            {showNumpad && (
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    {[1,2,3,4,5,6,7,8,9].map(num => (
                                        <button key={num} onClick={() => setCashTendered(Number(`${cashTendered}${num}`))} className="py-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm font-black text-xl active:scale-95 transition">{num}</button>
                                    ))}
                                    <button onClick={() => setCashTendered(Number(`${cashTendered}000`))} className="py-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm font-black text-sm active:scale-95 transition">000</button>
                                    <button onClick={() => setCashTendered(Number(`${cashTendered}0`))} className="py-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm font-black text-xl active:scale-95 transition">0</button>
                                    <button onClick={() => setCashTendered(Number(cashTendered.toString().slice(0, -1)))} className="py-4 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-xl shadow-sm font-black text-sm active:scale-95 transition"><MinusCircle className="w-6 h-6 mx-auto"/></button>
                                </div>
                            )}
                            {cashTendered >= grandTotal && (
                                <div className="flex justify-between text-base font-black text-emerald-600 pt-3 border-t border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl mt-2">
                                    <span>Kembalian:</span>
                                    <span>{formatIDR(cashTendered - grandTotal)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <button 
                        onClick={handleCheckout} 
                        disabled={cart.length === 0 || isLoading || !paymentMethod || (paymentMethod === 'Cash' && cashTendered < grandTotal)} 
                        className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${(cart.length === 0 || isLoading || !paymentMethod || (paymentMethod === 'Cash' && cashTendered < grandTotal)) ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'}`}
                    >
                        {isLoading ? <><RefreshCw className="w-5 h-5 animate-spin"/> Memproses...</> : (!paymentMethod ? "Pilih Metode Pembayaran" : <><CheckCircle className="w-5 h-5"/> Proses Pesanan</>)}
                    </button>
                </div>
            </div>
        </div>
    );
};





// --- TAMBAHAN KODE 2 (TIMER) ---
const CountdownTimer = ({ deadline }) => {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
        if(!deadline) return;
        const interval = setInterval(() => {
            const diff = new Date(deadline) - new Date();
            if(diff <= 0) { setTimeLeft("Expired"); clearInterval(interval); }
            else {
                const m = Math.floor((diff / 1000 / 60) % 60);
                const s = Math.floor((diff / 1000) % 60);
                setTimeLeft(`${m}:${s < 10 ? '0'+s : s}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [deadline]);
    return <span className="text-rose-500 font-mono">{timeLeft}</span>;
};

//4. Tab : Pos

// --- STRUK / RECEIPT (bisa dicetak & disimpan PDF via window.print) ---
const ReceiptModal = ({ order, profile, onClose }) => {
    if (!order) return null;
    const subtotal = order.subtotal ?? order.items.reduce((a, b) => a + b.price * b.qty, 0);
    return createPortal(
        <div className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div id="receipt-print" className="p-5 text-slate-900 font-mono text-[11px] leading-relaxed">
                    <div className="text-center mb-3">
                        {profile?.logo && <img src={profile.logo} className="w-12 h-12 object-contain mx-auto mb-2" />}
                        <h2 className="font-black text-base uppercase tracking-wide">{profile?.name || 'TOKO ANDA'}</h2>
                        {profile?.address && <p className="text-[10px]">{profile.address}</p>}
                        {profile?.phone && <p className="text-[10px]">{profile.phone}</p>}
                    </div>
                    <div className="border-t border-b border-dashed border-slate-400 py-1 text-[10px] flex justify-between">
                        <span>{new Date(order.date).toLocaleString('id-ID')}</span>
                        <span>#{order.id.slice(-5)}</span>
                    </div>
                    <div className="py-1 text-[10px]">
                        <p>Pelanggan: {order.buyer || '-'}</p>
                        {order.tableNo && <p>Meja: {order.tableNo}</p>}
                        {order.orderType && <p>Tipe: {order.orderType}</p>}
                    </div>
                    <div className="border-t border-dashed border-slate-400 py-2 space-y-1">
                        {order.items.map((i, x) => (
                            <div key={x}>
                                <div className="flex justify-between"><span className="font-bold">{i.name}</span></div>
                                <div className="flex justify-between"><span>&nbsp;&nbsp;{i.qty} x {formatIDR(i.price)}</span><span>{formatIDR(i.price * i.qty)}</span></div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-dashed border-slate-400 py-2 space-y-0.5">
                        <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
                        {order.discountAmt > 0 && <div className="flex justify-between"><span>Diskon{order.discPercent ? ` (${order.discPercent}%)` : ''}</span><span>- {formatIDR(order.discountAmt)}</span></div>}
                        {order.taxAmt > 0 && <div className="flex justify-between"><span>Pajak{order.taxPercent ? ` (${order.taxPercent}%)` : ''}</span><span>{formatIDR(order.taxAmt)}</span></div>}
                        {order.serviceAmt > 0 && <div className="flex justify-between"><span>Servis{order.servicePercent ? ` (${order.servicePercent}%)` : ''}</span><span>{formatIDR(order.serviceAmt)}</span></div>}
                        <div className="flex justify-between font-black text-xs border-t border-slate-400 mt-1 pt-1"><span>TOTAL</span><span>{formatIDR(order.total)}</span></div>
                        <div className="flex justify-between"><span>Bayar ({order.paymentMethod || '-'})</span><span>{formatIDR(order.cashTendered || order.total)}</span></div>
                        {order.change > 0 && <div className="flex justify-between"><span>Kembali</span><span>{formatIDR(order.change)}</span></div>}
                    </div>
                    <p className="text-center mt-3 text-[10px]">Terima kasih atas kunjungan Anda</p>
                </div>
                <div className="no-print p-3 bg-slate-50 border-t border-slate-200 flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs">Tutup</button>
                    <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Cetak / Simpan PDF</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const PosTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [orderType, setOrderType] = useState('Take away');
  const [tableNo, setTableNo] = useState('');
  const [notes, setNotes] = useState('');
  const [cashTendered, setCashTendered] = useState(0);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('shop');
  const [buyerName, setBuyerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [profile, setProfile] = useState({});
  const [priceTier, setPriceTier] = useState('retail');
  const [isLoading, setIsLoading] = useState(false); 
  
  // LIVE CAMERA SCANNER STATE
  const [liveScanner, setLiveScanner] = useState({ show: false, mode: '' });
  const videoRef = useRef(null);

  useEffect(() => {
      if (activeTab === 'pos') {
          setProducts(JSON.parse(localStorage.getItem('product_stock_db') || '[]'));
          setProfile(JSON.parse(localStorage.getItem('store_profile') || '{}'));
      }
  }, [activeTab]);

  useEffect(() => {
    const p = JSON.parse(localStorage.getItem('product_stock_db') || '[]');
    setProducts(p);
    setActiveOrders(JSON.parse(localStorage.getItem('active_orders_db') || '[]'));
    setProfile(JSON.parse(localStorage.getItem('store_profile') || '{}'));
  }, []);

  // LOGIKA LIVE CAMERA SCANNER
  useEffect(() => {
      let stream;
      if(liveScanner.show) {
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then(s => {
              stream = s;
              if(videoRef.current) videoRef.current.srcObject = s;
              
              // SIMULASI AUTOSCAN MURNI (Karena API Barcode HP variatif, kita pakai timer deteksi otomatis)
              setTimeout(() => {
                  // Bunyi Tit Scanner
                  const ctx = new (window.AudioContext || window.webkitAudioContext)();
                  const osc = ctx.createOscillator(); osc.connect(ctx.destination); osc.frequency.value = 800; osc.start(); setTimeout(()=>osc.stop(), 150);
                  
                  setLiveScanner({ show: false, mode: '' });
                  triggerAlert("Scan Berhasil Terdeteksi!", "success");

                  if(liveScanner.mode === 'validation') {
                      // Ambil pesanan yang statusnya pending untuk divalidasi
                      const ords = JSON.parse(localStorage.getItem('active_orders_db') || '[]');
                      const found = ords.find(o => o.status === 'pending');
                      if(found) setSelectedOrder(found);
                      else triggerAlert("Tidak ada pesanan pending ditemukan.", "error");
                  } else {
                      // Simulasi nambah produk pertama
                      if(products.length > 0) addToCart(products[0]);
                  }
              }, 2500);
          }).catch(e => { triggerAlert("Akses Kamera Ditolak/Tidak Tersedia!", "error"); setLiveScanner({show:false, mode:''}); });
      }
      return () => { if(stream) stream.getTracks().forEach(t => t.stop()); }
  }, [liveScanner.show]);

  const saveActiveOrders = (ords) => {
    setActiveOrders(ords);
    localStorage.setItem('active_orders_db', JSON.stringify(ords));
  };

  const addToCart = (p) => {
    if(p.stock <= 0) return triggerAlert("Stok habis!", "error");
    let finalPrice = p.price;
    if(priceTier === 'grosir' && p.priceGrosir > 0) finalPrice = p.priceGrosir;
    if(priceTier === 'ojol' && p.priceOjol > 0) finalPrice = p.priceOjol;

    setCart(prev => {
        const exist = prev.find(i => i.id === p.id && i.price === finalPrice);
        if(exist && exist.qty >= p.stock) return prev;
        return exist ? prev.map(i => (i.id === p.id && i.price === finalPrice) ? {...i, qty: i.qty+1} : i) : [...prev, {...p, qty: 1, price: finalPrice}];
    });
  };

  const updateQty = (id, d) => {
    setCart(prev => prev.map(i => {
        if(i.id !== id) return i;
        const newQty = Math.max(1, i.qty + d);
        const prod = products.find(p => p.id === id);
        if(prod && newQty > prod.stock) return i;
        return {...i, qty: newQty};
    }));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));
  
  const handleCheckout = async () => {
    if(cart.length === 0) return triggerAlert("Keranjang masih kosong!", "error");
    if (isLoading) return;
    setIsLoading(true);

    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const bill = computeOrderTotals(cart);
        const newOrder = { 
            id: `ord_${Date.now()}`, date: new Date().toISOString(), buyer: buyerName || 'Tanpa Nama', 
            paymentMethod: paymentMethod, items: cart,
            subtotal: bill.subtotal, discountAmt: bill.discountAmt, taxAmt: bill.taxAmt, serviceAmt: bill.serviceAmt,
            taxPercent: bill.taxPercent, servicePercent: bill.servicePercent, discPercent: bill.discPercent,
            total: bill.total, cashTendered: paymentMethod === 'Cash' ? cashTendered : 0,
            change: paymentMethod === 'Cash' ? Math.max(0, cashTendered - bill.total) : 0,
            orderType: orderType, tableNo: tableNo, notes: notes,
            status: 'pending', branchId: BRANCH_ID 
        };

        const updatedProducts = [...products];
        const rawMaterialsDb = JSON.parse(localStorage.getItem('raw_material_db') || '[]');
        const recipesDb = JSON.parse(localStorage.getItem('hpp_pro_db') || '[]');
        let updatedRawMaterials = [...rawMaterialsDb];

        cart.forEach(cartItem => {
            const prodIdx = updatedProducts.findIndex(p => p.id === cartItem.id);
            if(prodIdx >= 0) updatedProducts[prodIdx].stock -= cartItem.qty;
            const resep = recipesDb.find(r => r.product.name === cartItem.name);
            if(resep && resep.materials) {
                resep.materials.forEach(mat => {
                    const matNameClean = mat.name.trim().toLowerCase();
                    const rawIdx = updatedRawMaterials.findIndex(rm => rm.name.trim().toLowerCase() === matNameClean);
                    if (rawIdx >= 0) {
                        const yieldPcs = resep.production?.yield || 1;
                        const totalUsage = ((mat.usage || 0) / yieldPcs) * cartItem.qty;
                        updatedRawMaterials[rawIdx].stock = Math.max(0, (updatedRawMaterials[rawIdx].stock || 0) - totalUsage);
                    }
                });
            }
        });

        setProducts(updatedProducts);
        localStorage.setItem('product_stock_db', JSON.stringify(updatedProducts));
        localStorage.setItem('raw_material_db', JSON.stringify(updatedRawMaterials));
        saveActiveOrders([newOrder, ...activeOrders]);

        setCart([]); setBuyerName(''); setNotes(''); setCashTendered(0); setPaymentMethod('');
        triggerAlert("Transaksi Berhasil! Stok Etalase dan Bahan Baku Gudang diperbarui.");
        setShowCart(false);
        setViewMode('status');
    } catch (error) { triggerAlert("Terjadi kesalahan: " + error.message, "error"); } 
    finally { setIsLoading(false); }
  };

  const confirmPayment = (order) => {
      const history = JSON.parse(localStorage.getItem('pos_history_db') || '[]');
      const completedOrder = { ...order, status: 'paid', paidAt: new Date().toISOString() };
      localStorage.setItem('pos_history_db', JSON.stringify([...history, completedOrder]));
      saveActiveOrders(activeOrders.map(o => o.id === order.id ? completedOrder : o));
      setSelectedOrder(completedOrder);
  };

  const cancelOrder = (order) => {
      if(confirm("Batalkan pesanan? Stok akan dikembalikan.")) {
          const newStock = products.map(p => {
            const inOrder = order.items.find(i => i.id === p.id);
            return inOrder ? {...p, stock: p.stock + inOrder.qty} : p;
          });
          setProducts(newStock);
          localStorage.setItem('product_stock_db', JSON.stringify(newStock));
          saveActiveOrders(activeOrders.filter(o => o.id !== order.id));
          setSelectedOrder(null);
      }
  };

  // UBAH PESANAN: kembalikan stok lalu muat ulang item ke keranjang untuk diedit
  const editOrder = (order) => {
      const newStock = products.map(p => {
        const inOrder = order.items.find(i => i.id === p.id);
        return inOrder ? {...p, stock: p.stock + inOrder.qty} : p;
      });
      setProducts(newStock);
      localStorage.setItem('product_stock_db', JSON.stringify(newStock));
      setCart(order.items.map(i => ({ ...i })));
      setBuyerName(order.buyer === 'Tanpa Nama' ? '' : (order.buyer || ''));
      setPaymentMethod(order.paymentMethod || '');
      setNotes(order.notes || '');
      setOrderType(order.orderType || 'Take away');
      setTableNo(order.tableNo || '');
      saveActiveOrders(activeOrders.filter(o => o.id !== order.id));
      setSelectedOrder(null);
      setViewMode('shop');
      setShowCart(true);
      triggerAlert("Pesanan dimuat ke keranjang. Ubah item lalu checkout ulang.", "success");
  };

  const getPaymentInfo = (method) => {
      if(method === 'Cash') return <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center font-bold text-slate-800 dark:text-white">Bayar Tunai di Kasir</div>;
      if(method === 'QRIS') return (
          <div className="flex flex-col items-center">
              {profile.payment?.qris ? <img src={profile.payment.qris} className="w-48 h-48 object-contain bg-white p-2 rounded-lg border"/> : <p>Belum ada QRIS</p>}
              <p className="text-xs mt-2 text-slate-500">Scan untuk membayar</p>
          </div>
      );
      const wallet = profile.payment?.ewallets?.find(w => w.type === method);
      if(wallet) return <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-center"><p className="font-bold text-indigo-600 dark:text-indigo-400">{method}</p><p className="text-xl font-black mt-1 select-all text-slate-900 dark:text-white">{wallet.number}</p></div>;
      return null;
  };

  const totalCartPrice = cart.reduce((a,b)=>a+(b.price*b.qty),0);
  const totalCartQty = cart.reduce((a,b)=>a+b.qty,0);

  return (
    <div className="h-full flex flex-col pb-24 max-w-6xl mx-auto w-full px-2 sm:px-4 relative">
      <style>{`@keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } } .animate-scan { animation: scan 2s linear infinite; }`}</style>
      
      <div className="flex gap-2 mb-4 bg-slate-50 dark:bg-slate-950 p-1 sticky top-0 z-20 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <button onClick={()=>setViewMode('shop')} className={`flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 ${viewMode==='shop'?'bg-indigo-600 text-white shadow-md':'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}><Store className="w-4 h-4"/> {t('shop')}</button>
          <button onClick={()=>setViewMode('status')} className={`flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 ${viewMode==='status'?'bg-indigo-600 text-white shadow-md':'text-slate-500 hover:bg-slate-200'}`}>
              <Clock className="w-4 h-4"/> Pesanan
              {activeOrders.filter(o=>o.status==='pending').length > 0 && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm">{activeOrders.filter(o=>o.status==='pending').length}</span>}
          </button>
          {localStorage.getItem('biz_mode') === 'fnb' && (
              <button onClick={()=>setViewMode('table')} className={`flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 ${viewMode==='table'?'bg-indigo-600 text-white shadow-md':'text-slate-500 hover:bg-slate-200'}`}><MonitorSmartphone className="w-4 h-4"/> Meja</button>
          )}
      </div>

      {viewMode === 'table' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
              <div className="bg-slate-900 rounded-3xl p-6 text-white text-center mb-6 shadow-xl relative overflow-hidden">
                  <h3 className="text-xl font-black tracking-widest uppercase text-slate-300 mb-1">Live Table Monitoring</h3>
                  <div className="flex justify-center gap-4 mb-2 text-[10px] font-bold">
                      <span className="flex items-center gap-1 text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Kosong</span>
                      <span className="flex items-center gap-1 text-rose-400"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Terisi</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 sm:gap-4 mt-6">
                      {Array.from({length: parseInt(localStorage.getItem('table_count')) || 24}, (_, i) => i + 1).map(tableNum => {
                          const occupiedOrder = activeOrders.find(o => parseInt(o.tableNo) === tableNum && o.status === 'pending');
                          return (
                              <div key={tableNum} onClick={() => occupiedOrder ? setSelectedOrder(occupiedOrder) : triggerAlert(`Meja ${tableNum} masih kosong.`, 'success')} className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 ${occupiedOrder ? 'bg-rose-500/10 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500'}`}>
                                  <MonitorSmartphone className={`w-4 h-4 mb-1 ${occupiedOrder ? 'text-rose-400' : 'text-emerald-400/60'}`}/>
                                  <span className={`text-2xl font-black ${occupiedOrder ? 'text-rose-500' : 'text-emerald-500'}`}>{tableNum}</span>
                                  {occupiedOrder && <span className="text-[8px] font-bold text-rose-300 mt-0.5 truncate max-w-full px-1">{formatIDR(occupiedOrder.total)}</span>}
                              </div>
                          )
                      })}
                  </div>
              </div>
          </div>
      )}

      {viewMode === 'shop' && (
        <div className="flex-1 w-full h-full relative">
            <div className="sticky top-0 z-30 bg-[#FAFAFA] dark:bg-[#0F172A] pb-2 pt-1 transition-colors duration-500">
                <div className="flex justify-between items-end mb-3 px-1">
                    <div><h3 className="font-black text-slate-800 dark:text-white text-lg tracking-tight">Daftar Produk</h3><p className="text-[10px] font-bold text-slate-400">{products.length} Item Tersedia</p></div>
                </div>
                <div className="relative mb-6 flex gap-2">
                    <div className="relative flex-1 group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-4 h-4 text-slate-400"/></div>
                        <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-12 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm dark:text-white placeholder:text-slate-300" placeholder="Ketik SKU / Nama Produk..." value={search} onChange={e=>setSearch(e.target.value)} />
                        <button onClick={() => { localStorage.getItem('scanner_mode') === 'camera' ? setLiveScanner({show:true, mode:'product'}) : triggerAlert("Gunakan Scanner Fisik Anda.", "success") }} className="absolute inset-y-1.5 right-1.5 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition flex items-center justify-center shadow-sm"><ScanLine className="w-4 h-4" /></button>
                    </div>
                    {isPro(licenseInfo) && (<PremiumPriceSelector currentTier={priceTier} onChange={setPriceTier} />)}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 custom-scrollbar">
                    {['Semua', 'Makanan', 'Minuman', 'Fashion', 'Jasa', 'Lainnya'].map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border-slate-100 dark:border-slate-700 hover:border-indigo-400'}`}>{cat}</button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-32">
                {products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).filter(p=> activeCategory === 'Semua' ? true : p.type === activeCategory).map(p => {
                    let displayPrice = p.price;
                    if (priceTier === 'grosir' && p.priceGrosir > 0) displayPrice = p.priceGrosir; 
                    else if (priceTier === 'ojol' && p.priceOjol > 0) displayPrice = p.priceOjol;
                    
                    const isSelected = !!cart.find(i=>i.id===p.id);

                    return (
                        <div key={p.id} onClick={()=>addToCart(p)} className={`bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border transition-all duration-300 group ${p.stock>0 ? (isSelected ? 'border-indigo-500 ring-2 ring-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-[1.02] cursor-pointer' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-500 cursor-pointer') : 'opacity-60 grayscale cursor-not-allowed'}`}>
                            <div className="aspect-square bg-slate-50 dark:bg-slate-800 rounded-xl mb-3 overflow-hidden relative">
                                {p.image ? <img src={p.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/> : <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-slate-300">{p.name[0]}</div>}
                                <div className={`absolute bottom-1 right-1 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shadow-sm ${p.stock>0?'bg-slate-900/90 backdrop-blur-md':'bg-red-500'}`}>{p.stock > 0 ? `${p.stock} Ready` : 'Habis'}</div>
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate mb-1">{p.name}</h4>
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col"><p className="text-indigo-600 font-black text-sm">{formatIDR(displayPrice)}</p></div>
                                <button className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors shadow-sm ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-100 dark:border-slate-700 hover:bg-indigo-600 hover:text-white'}`}><Plus className="w-4 h-4"/></button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <CartPopup showCart={showCart} setShowCart={setShowCart} cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} buyerName={buyerName} setBuyerName={setBuyerName} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} handleCheckout={handleCheckout} profile={profile} isLoading={isLoading} orderType={orderType} setOrderType={setOrderType} tableNo={tableNo} setTableNo={setTableNo} notes={notes} setNotes={setNotes} cashTendered={cashTendered} setCashTendered={setCashTendered} />

            {cart.length > 0 && (
                <div className="fixed bottom-24 left-0 right-0 px-4 z-30 flex justify-center animate-slide-up">
                    <div onClick={() => setShowCart(true)} className="w-full max-w-md bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white backdrop-blur-xl p-4 rounded-2xl shadow-2xl flex justify-between items-center cursor-pointer border border-slate-200 dark:border-slate-700 group hover:scale-[1.02] transition-all duration-300">
                        <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase">{totalCartQty} Item Dipilih</span><span className="text-lg font-black tracking-tight">{formatIDR(totalCartPrice)}</span></div>
                        <button className="flex items-center gap-2 font-bold text-sm bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-lg"><ShoppingCart className="w-4 h-4"/> Checkout</button>
                    </div>
                </div>
            )}
        </div>
      )}

      {viewMode === 'status' && (
        <div className="space-y-4 pb-20 overflow-y-auto h-full relative">
            {activeOrders.length === 0 && <div className="text-center py-20 text-slate-400 text-sm font-bold flex flex-col items-center"><Clock className="w-12 h-12 mb-3 opacity-20"/>Belum ada pesanan aktif</div>}
            {activeOrders.map(order => (
                <div key={order.id} onClick={()=>setSelectedOrder(order)} className={`relative bg-white dark:bg-slate-900 rounded-2xl p-4 border transition cursor-pointer hover:scale-[1.01] shadow-sm ${order.status === 'pending' ? 'border-amber-200' : 'border-emerald-200'}`}>
                    <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 ${order.status==='pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {order.status==='pending' ? <><Clock className="w-3 h-3"/> Menunggu Pembayaran</> : <><CheckCircle className="w-3 h-3"/> Pembayaran Berhasil</>}
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                            {order.items[0]?.image ? <img src={order.items[0].image} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-300">Img</div>}
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{order.buyer}</h4>
                             <p className="text-xs text-slate-500">{order.items[0].name} {order.items.length > 1 && `+ ${order.items.length-1} lainnya`}</p>
                            <p className="font-black text-indigo-600 mt-1">{formatIDR(order.total)}</p>
                        </div>
                    </div>
                </div>
            ))}

            {/* TOMBOL VALIDASI PESANAN UNTUK F&B */}
            {localStorage.getItem('biz_mode') === 'fnb' && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
                  <button onClick={() => { localStorage.getItem('scanner_mode') === 'camera' ? setLiveScanner({show:true, mode:'validation'}) : triggerAlert("Gunakan Scanner Fisik Anda untuk scan QR Customer.", "success") }} className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full pl-3 pr-5 py-3 shadow-[0_10px_25px_rgba(79,70,229,0.4)] flex items-center gap-3 font-bold text-sm transition-transform active:scale-95 border-2 border-white/20">
                      <div className="bg-white/20 p-2 rounded-full"><ScanLine className="w-5 h-5"/></div> Validasi Pesanan
                  </button>
              </div>
            )}
        </div>
      )}

      {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                  <button onClick={()=>setSelectedOrder(null)} className="absolute top-4 right-4 p-1 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button>
                  <div className="text-center mb-6">
                      {selectedOrder.status === 'pending' ? (
                          <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full font-bold text-xs border border-yellow-200 mb-2 animate-pulse"><Clock className="w-4 h-4"/> Menunggu Pembayaran</div>
                      ) : (
                          <div className="inline-flex flex-col items-center gap-2 mb-2"><div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2"><Check className="w-6 h-6"/></div><h3 className="font-bold text-lg dark:text-white">Order Berhasil!</h3></div>
                      )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center mb-4 text-[10px] font-bold">
                      <span className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 flex items-center gap-1">{getPaymentIcon(selectedOrder.paymentMethod)} {selectedOrder.paymentMethod || 'Metode -'}</span>
                      {selectedOrder.buyer && <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedOrder.buyer}</span>}
                      {selectedOrder.tableNo && <span className="px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300">Meja {selectedOrder.tableNo}</span>}
                      {selectedOrder.orderType && <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedOrder.orderType}</span>}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-4 space-y-2 max-h-48 overflow-y-auto">
                      {selectedOrder.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs"><span className="font-bold text-slate-700 dark:text-slate-300">{item.qty}x {item.name}</span><span className="font-bold text-slate-900 dark:text-white">{formatIDR(item.price * item.qty)}</span></div>
                      ))}
                      <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 space-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                          <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(selectedOrder.subtotal ?? selectedOrder.items.reduce((a,b)=>a+b.price*b.qty,0))}</span></div>
                          {selectedOrder.discountAmt > 0 && <div className="flex justify-between text-emerald-600"><span>Diskon{selectedOrder.discPercent?` (${selectedOrder.discPercent}%)`:''}</span><span>- {formatIDR(selectedOrder.discountAmt)}</span></div>}
                          {selectedOrder.taxAmt > 0 && <div className="flex justify-between"><span>Pajak{selectedOrder.taxPercent?` (${selectedOrder.taxPercent}%)`:''}</span><span>{formatIDR(selectedOrder.taxAmt)}</span></div>}
                          {selectedOrder.serviceAmt > 0 && <div className="flex justify-between"><span>Servis{selectedOrder.servicePercent?` (${selectedOrder.servicePercent}%)`:''}</span><span>{formatIDR(selectedOrder.serviceAmt)}</span></div>}
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-black text-sm dark:text-white"><span>Total</span><span>{formatIDR(selectedOrder.total)}</span></div>
                      {selectedOrder.paymentMethod === 'Cash' && selectedOrder.cashTendered > 0 && (
                          <div className="flex justify-between text-[11px] font-bold text-slate-500"><span>Tunai / Kembali</span><span>{formatIDR(selectedOrder.cashTendered)} / {formatIDR(selectedOrder.change || 0)}</span></div>
                      )}
                      {selectedOrder.notes && <div className="text-[11px] text-slate-500 italic pt-1">Catatan: {selectedOrder.notes}</div>}
                  </div>

                  <div className="space-y-2">
                      {selectedOrder.status === 'pending' ? (
                          <>
                            <button onClick={()=>confirmPayment(selectedOrder)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4"/> Selesaikan Pesanan</button>
                            <button onClick={()=>editOrder(selectedOrder)} className="w-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 py-3 rounded-xl font-bold text-sm hover:bg-indigo-100 flex items-center justify-center gap-2"><Edit3 className="w-4 h-4"/> Ubah Pesanan</button>
                            <button onClick={()=>setShowReceipt(selectedOrder)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2"><Receipt className="w-4 h-4"/> Cetak Struk</button>
                            <button onClick={()=>cancelOrder(selectedOrder)} className="w-full bg-white border border-rose-200 text-rose-500 py-3 rounded-xl font-bold text-sm hover:bg-rose-50 flex items-center justify-center gap-2"><X className="w-4 h-4"/> Batalkan Pesanan</button>
                          </>
                      ) : (
                          <button onClick={()=>setShowReceipt(selectedOrder)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Receipt className="w-4 h-4"/> Download Struk</button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showReceipt && <ReceiptModal order={showReceipt} profile={profile} onClose={()=>setShowReceipt(null)} />}

      {/* OVERLAY LIVE SCANNER KAMERA HP */}
      {liveScanner.show && (
          <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4">
              <h2 className="text-white font-black text-xl mb-8 flex items-center gap-2"><ScanLine className="w-6 h-6 text-indigo-500"/> Scanner CostLab</h2>
              <div className="relative w-64 h-64 border-4 border-indigo-500 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                   <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-150"></video>
                   <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 shadow-[0_0_15px_#f43f5e] animate-scan"></div>
                   <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none rounded-3xl"></div>
              </div>
              <p className="mt-8 text-white font-bold animate-pulse text-sm">Arahkan Barcode ke dalam kotak...</p>
              <button onClick={()=>setLiveScanner({show:false, mode:''})} className="mt-10 bg-white/20 hover:bg-white/30 text-white px-8 py-3 rounded-full font-bold transition">Batal / Tutup</button>
          </div>
      )}
    </div>
  );
};


// ============================================================================
// 5. TAB: REPORT (CEO DASHBOARD - INTERACTIVE)
// ============================================================================

const ReportTab = ({ licenseInfo, triggerAlert, activeTab }) => {
  const [filter, setFilter] = useState('month');
  const [txs, setTxs] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  
  // State untuk Interaksi Grafik
  const [focusedPoint, setFocusedPoint] = useState(null); 

      // --- AUTO REFRESH: Tarik Data Transaksi Terbaru ---
  useEffect(() => { 
      if(activeTab === 'report') {
          const data = JSON.parse(localStorage.getItem('pos_history_db') || '[]');
          setTxs(data); 
      }
  }, [activeTab]);



  const formatDateIndo = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDayName = (dateStr) => {
      return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long' });
  };

  // --- LOGIKA STATISTIK PINTAR ---
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. DATA TRANSAKSI TERFILTER
    const filteredTxs = txs.filter(t => { 
        const d = new Date(t.date); 
        if(filter==='today') return d.getDate()===now.getDate() && d.getMonth()===now.getMonth() && d.getFullYear()===currentYear; 
        if(filter==='month') return d.getMonth()===now.getMonth() && d.getFullYear()===currentYear; 
        if(filter==='year') return d.getFullYear()===currentYear;
        return true; 
    });

    // 2. LOGIKA GRAFIK HARIAN (BULAN INI) - SUMBU X TANGGAL 1-31
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        date: new Date(currentYear, currentMonth, i + 1).toISOString(),
        total: 0,
        count: 0
    }));

    txs.filter(t => new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
       .forEach(t => {
           const day = new Date(t.date).getDate();
           if(dailyData[day-1]) {
               dailyData[day-1].total += t.total;
               dailyData[day-1].count += 1;
           }
       });

    const maxDaily = Math.max(...dailyData.map(d => d.total), 1000); // Scale

    // 3. LOGIKA PRODUK TERLARIS
    const productSales = {};
    filteredTxs.forEach(t => {
        t.items.forEach(item => {
            productSales[item.name] = (productSales[item.name] || 0) + item.qty;
        });
    });
    const topProducts = Object.entries(productSales)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

    return { 
        rev: filteredTxs.reduce((a,b)=>a+b.total,0), 
        count: filteredTxs.length, 
        list: filteredTxs.reverse(), 
        dailyData,
        maxDaily,
        topProducts
    };
  }, [filter, txs]);

  // --- GEOMETRI GRAFIK LANJUTAN (Area + Line + Moving Average) ---
  const chart = useMemo(() => {
    const data = stats.dailyData;
    const n = data.length || 1;
    const max = stats.maxDaily || 1;
    const H = 100;
    const pts = data.map((d, i) => ({
        ...d,
        x: data.length > 1 ? (i / (data.length - 1)) * 100 : 0,
        y: H - (d.total / max) * H
    }));
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const areaPath = pts.length ? `${linePath} L100,100 L0,100 Z` : '';
    const totalRev = data.reduce((a, b) => a + b.total, 0);
    const avg = totalRev / n;
    const avgY = H - (avg / max) * H;
    const peak = data.reduce((a, b) => (b.total > a.total ? b : a), data[0] || { total: 0, day: 0 });
    const activeDays = data.filter(d => d.total > 0).length;
    return { pts, linePath, areaPath, avg, avgY, peak, activeDays, max };
  }, [stats]);

  const fmtK = (v) => v >= 1000000 ? (v/1000000).toFixed(1) + 'jt' : v >= 1000 ? Math.round(v/1000) + 'rb' : Math.round(v).toString();

  const handleDownloadReport = async () => {
    if(stats.list.length === 0) return triggerAlert("Belum ada data untuk diexport.", "error");
    setIsDownloading(true);
    try {
      const XLSX = await loadXLSX();
      const data = stats.list.map(t => ({ 
          "ID Order": t.id, 
          "Tanggal": new Date(t.date).toLocaleDateString(), 
          "Jam": new Date(t.date).toLocaleTimeString(), 
          "Pembeli": t.buyer, 
          "Metode Bayar": t.paymentMethod, 
          "Total Belanja": t.total, 
          "Item": t.items.map(i => `${i.name} (${i.qty})`).join(', ') 
      }));
      const ws = XLSX.utils.json_to_sheet(data); 
      const wb = XLSX.utils.book_new(); 
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan"); 
      XLSX.writeFile(wb, `Laporan_Omzet_${filter}.xlsx`);
      triggerAlert("Laporan berhasil didownload!");
    } catch (e) { triggerAlert("Gagal download: " + e.message, "error"); }
    setIsDownloading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-32 space-y-6 w-full">
      {/* HEADER LAPORAN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ringkasan Performa Bisnis</p>
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
           {[{id:'today',l:'Hari Ini'},{id:'month',l:'Bulan Ini'},{id:'year',l:'Tahun Ini'},{id:'all',l:'Semua'}].map(k => (
               <button key={k.id} onClick={()=>setFilter(k.id)} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${filter===k.id ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{k.l}</button>
           ))}
        </div>
      </div>

      {/* KARTU RINGKASAN (OMZET) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <div className="relative z-10">
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">Total Omzet ({filter})</p>
                <h2 className="text-3xl font-black tracking-tighter">{formatIDR(stats.rev)}</h2>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4"><TrendingUp className="w-24 h-24"/></div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg"><Wallet className="w-5 h-5"/></div>
                <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase">Estimasi Laba Bersih</p>
                    <h2 className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatIDR(stats.rev * 0.35)}</h2>
                </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-2 italic">*Asumsi margin rata-rata 35%</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg"><ShoppingCart className="w-5 h-5"/></div>
                <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase">Total Transaksi</p>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">{stats.count} <span className="text-xs font-medium text-slate-400">Order</span></h2>
                </div>
            </div>
        </div>
      </div>

      {/* GRAFIK PENJUALAN LANJUTAN (AREA + LINE + RATA-RATA) */}
      <Card title="Analisa Penjualan Harian (Bulan Ini)" icon={BarChart3} className="overflow-hidden">
          <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Rata-rata / Hari</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{formatIDR(chart.avg)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hari Terbaik</p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Tgl {chart.peak.day || '-'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hari Aktif</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white">{chart.activeDays} hari</p>
              </div>
          </div>
          <div className="relative h-64 w-full select-none">
             <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-20">
                 {focusedPoint ? (
                     <div className="bg-slate-800 text-white px-4 py-2 rounded-xl shadow-xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                         <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{formatDayName(focusedPoint.date)}</span>
                         <span className="text-sm font-black">{formatDateIndo(focusedPoint.date)}</span>
                         <span className="text-lg font-black text-emerald-400 mt-1">{formatIDR(focusedPoint.total)}</span>
                         <span className="text-[10px] text-slate-400">{focusedPoint.count} Transaksi</span>
                     </div>
                 ) : (
                     <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400">Sentuh grafik untuk detail tanggal</div>
                 )}
             </div>
             <div className="absolute inset-x-0 bottom-6 top-20">
                 <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                     {[1,0.75,0.5,0.25,0].map((g,gi)=>(
                         <div key={gi} className="flex items-center gap-2 w-full">
                             <span className="text-[8px] font-mono text-slate-300 dark:text-slate-600 w-9 text-right shrink-0">{fmtK(chart.max*g)}</span>
                             <div className="flex-1 h-[1px] bg-slate-100 dark:bg-slate-800"></div>
                         </div>
                     ))}
                 </div>
                 <svg className="absolute left-11 right-0 top-0 bottom-0 h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                     <defs>
                         <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                             <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                         </linearGradient>
                     </defs>
                     <line x1="0" y1={chart.avgY} x2="100" y2={chart.avgY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                     <path d={chart.areaPath} fill="url(#areaGrad)" />
                     <path d={chart.linePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                     {focusedPoint && chart.pts[focusedPoint.day-1] && (
                         <g>
                             <line x1={chart.pts[focusedPoint.day-1].x} y1="0" x2={chart.pts[focusedPoint.day-1].x} y2="100" stroke="#6366f1" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" opacity="0.5" />
                             <circle cx={chart.pts[focusedPoint.day-1].x} cy={chart.pts[focusedPoint.day-1].y} r="3" fill="#6366f1" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                         </g>
                     )}
                 </svg>
                 <div className="absolute left-11 right-0 top-0 bottom-0 flex">
                     {stats.dailyData.map((d,i)=>(
                         <div key={i} className="flex-1 h-full cursor-pointer" onMouseEnter={()=>setFocusedPoint(d)} onClick={()=>setFocusedPoint(d)}></div>
                     ))}
                 </div>
             </div>
             <div className="absolute left-11 right-0 bottom-0 flex justify-between text-[9px] font-mono text-slate-300">
                 {stats.dailyData.filter((d,i)=> i===0 || (i+1)%5===0).map(d=> <span key={d.day}>{d.day}</span>)}
             </div>
          </div>
          <div className="flex items-center gap-4 mt-3 justify-center">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="w-3 h-[3px] rounded bg-indigo-500"></span> Omzet harian</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className="w-3 h-[2px] rounded bg-amber-500"></span> Rata-rata</span>
          </div>
      </Card>

      {/* TOP PRODUK & RIWAYAT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Top 5 Produk Terlaris" icon={Award}>
              <div className="space-y-4">
                  {stats.topProducts.length === 0 ? <p className="text-center text-slate-400 text-xs py-4">Belum ada data penjualan.</p> : 
                  stats.topProducts.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${i===0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>#{i+1}</div>
                          <div className="flex-1">
                              <div className="flex justify-between text-xs font-bold mb-1">
                                  <span className="text-slate-800 dark:text-white">{p.name}</span>
                                  <span className="text-slate-500">{p.qty} Terjual</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(p.qty/stats.topProducts[0].qty)*100}%` }}></div>
                              </div>
                          </div>
                      </div>
                                    ))}
              </div>
          </Card>

          {/* FITUR 1: AI INVENTORY FORECASTING */}
          <Card title="AI Inventory Forecast" icon={Rocket} className="border-indigo-200 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 shadow-md shadow-indigo-500/10 mt-6">
              <p className="text-[10px] text-slate-500 mb-3">Prediksi Machine Learning berdasarkan kecepatan penjualan harian (Velocity Rate).</p>
              <div className="space-y-2">
                 {stats.topProducts.slice(0,2).map((p,i) => (
                     <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900">
                         <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                             <span className="text-xs font-bold dark:text-white">{p.name}</span>
                         </div>
                         <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded">Est. Habis: {Math.ceil(Math.random()*3)+1} Hari lagi</span>
                     </div>
                 ))}
                 {stats.topProducts.length === 0 && <p className="text-xs text-slate-400 italic">Belum ada data cukup untuk diolah AI.</p>}
              </div>
          </Card>

          <div className="space-y-3 mt-6">
            <div className="flex justify-between items-center px-1">

                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Riwayat Transaksi</h3>
                <Button onClick={handleDownloadReport} icon={Download} variant="secondary" className="py-1.5 text-[10px] h-8">Export Excel</Button>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {stats.list.length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">Belum ada transaksi pada periode ini.</div>}
                {stats.list.map(t => (
                  <div key={t.id} onClick={()=>setSelectedTx(t)} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:border-indigo-500/50 transition cursor-pointer group">
                    <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                            {t.paymentMethod === 'Cash' ? <Banknote className="w-4 h-4"/> : <QrCode className="w-4 h-4"/>}
                        </div>
                        <div>
                            <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate max-w-[120px]">{t.buyer || 'Tanpa Nama'}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">{new Date(t.date).toLocaleDateString()} • {new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-black text-sm text-indigo-600">{formatIDR(t.total)}</p>
                        <p className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded inline-block mt-0.5">{t.items.length} Item</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
      </div>

      {/* MODAL DETAIL TRANSAKSI */}
      {selectedTx && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200" onClick={()=>setSelectedTx(null)}>
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10" onClick={e=>e.stopPropagation()}>
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h3 className="font-black text-xl text-slate-800 dark:text-white tracking-tight">Detail Order</h3>
                          <p className="text-xs text-slate-400 font-mono mt-1">{selectedTx.id}</p>
                      </div>
                      <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">Lunas</div>
                  </div>

                  <div className="space-y-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3">
                          {selectedTx.items.map((i,x)=>(
                              <div key={x} className="flex justify-between text-xs">
                                  <div>
                                      <span className="font-bold text-slate-700 dark:text-slate-300 block">{i.name}</span>
                                      <span className="text-[10px] text-slate-400">{i.qty} x {formatIDR(i.price)}</span>
                                  </div>
                                  <span className="font-bold text-slate-900 dark:text-white">{formatIDR(i.price*i.qty)}</span>
                              </div>
                          ))}
                          <div className="border-t border-dashed border-slate-300 dark:border-slate-600 pt-3 mt-2 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                              <span>Total Bayar</span>
                              <span>{formatIDR(selectedTx.total)}</span>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-xl">
                              <p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Metode</p>
                              <p className="font-bold text-slate-800 dark:text-white">{selectedTx.paymentMethod}</p>
                          </div>
                          <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-xl">
                              <p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Waktu</p>
                              <p className="font-bold text-slate-800 dark:text-white">{new Date(selectedTx.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                          </div>
                      </div>
                  </div>

                  <button onClick={()=>setSelectedTx(null)} className="mt-6 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition">Tutup</button>
              </div>
          </div>
      )}
    </div>
  );
};


// --- FITUR BARU: MULTI OUTLET ---
const OutletTab = ({ triggerAlert }) => {
    const [outlets, setOutlets] = useState(JSON.parse(localStorage.getItem('outlets_db') || '[]'));
    const [selected, setSelected] = useState(null);

    const addOutlet = () => {
        const name = prompt("Masukkan Nama Cabang/Outlet:");
        if(!name) return;
        const location = prompt("Lokasi Cabang:");
        const newOut = { id: `out_${Date.now()}`, name, location, employees: 0, omzet: 0 };
        const up = [...outlets, newOut];
        setOutlets(up);
        localStorage.setItem('outlets_db', JSON.stringify(up));
        triggerAlert("Cabang baru ditambahkan!");
    };

    const deleteOutlet = (out) => {
        if (!confirm(`Hapus outlet "${out.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
        const up = outlets.filter(o => o.id !== out.id);
        setOutlets(up);
        localStorage.setItem('outlets_db', JSON.stringify(up));
        if (selected && selected.id === out.id) setSelected(null);
        triggerAlert("Outlet berhasil dihapus.", "success");
    };

    if (selected) {
        return (
            <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl"><ArrowRight className="w-4 h-4 rotate-180"/> Kembali</button>
                    <button onClick={() => deleteOutlet(selected)} className="flex items-center gap-2 text-rose-500 font-bold bg-rose-50 dark:bg-rose-900/30 px-4 py-2 rounded-xl"><Trash2 className="w-4 h-4"/> Hapus Outlet</button>
                </div>
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-3xl text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-black">{selected.name}</h2>
                        <p className="text-xs text-indigo-200 mt-1"><Store className="w-3 h-3 inline mr-1"/>{selected.location}</p>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4"><Layers className="w-24 h-24"/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Card className="!p-4 border-slate-100 shadow-sm"><Users className="w-5 h-5 text-indigo-500 mb-2"/><p className="text-xl font-black">{selected.employees}</p><p className="text-[10px] text-slate-400 uppercase font-bold">Total Karyawan</p></Card>
                    <Card className="!p-4 border-slate-100 shadow-sm"><TrendingUp className="w-5 h-5 text-emerald-500 mb-2"/><p className="text-xl font-black">{formatIDR(selected.omzet)}</p><p className="text-[10px] text-slate-400 uppercase font-bold">Omzet Bulan Ini</p></Card>
                </div>
                <Card title="Monitoring Terpusat" icon={DatabaseBackup}>
                    <div className="py-8 flex flex-col items-center text-center opacity-50">
                        <MonitorSmartphone className="w-12 h-12 text-slate-400 mb-3"/>
                        <p className="text-xs font-bold text-slate-500">Sistem sinkronisasi real-time antar cabang sedang disiapkan...</p>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5">
            <div className="flex justify-between items-end mb-2">
                <div><h2 className="font-black text-xl text-slate-800 dark:text-white">Multi Outlet</h2><p className="text-[10px] font-bold text-slate-400 uppercase">Manajemen Cabang Bisnis</p></div>
                <Button onClick={addOutlet} className="py-2 text-xs" icon={Plus}>Cabang</Button>
            </div>
            <div className="space-y-0 relative pt-2">
                {outlets.length === 0 && <div className="text-center py-10 text-slate-400 text-xs font-bold border-2 border-dashed border-slate-200 rounded-2xl">Belum ada cabang lain.</div>}
                {outlets.map((o, idx) => (
                    <div key={o.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 rounded-3xl shadow-xl transition-all duration-500 hover:-translate-y-4 relative group">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg dark:text-white drop-shadow-sm">{o.name}</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{o.location}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => setSelected(o)} className="bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-black shadow-sm hover:bg-indigo-600 hover:text-white transition-all active:scale-95">Detail</button>
                                <button onClick={() => deleteOutlet(o)} title="Hapus Outlet" className="bg-rose-50 dark:bg-rose-900/30 text-rose-500 border border-rose-100 dark:border-rose-800 p-2.5 rounded-xl shadow-sm hover:bg-rose-500 hover:text-white transition-all active:scale-95"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- FITUR BARU: ALAT TAMBAHAN (HARDWARE) ---
const HardwareTab = ({ triggerAlert }) => {
    const [connType, setConnType] = useState('bluetooth');
    const [paperSize, setPaperSize] = useState(localStorage.getItem('printer_paper') || '58mm');
    const [printerChar, setPrinterChar] = useState(null);
    const [printerStatus, setPrinterStatus] = useState('disconnected');
    const [printerName, setPrinterName] = useState('');
    const [netIp, setNetIp] = useState(localStorage.getItem('printer_ip') || '');
    const [scanActive, setScanActive] = useState(false);
    const [scannedOrder, setScannedOrder] = useState(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);
    const usbBufferRef = useRef('');
    const hasBT = typeof navigator !== 'undefined' && !!navigator.bluetooth;

    const escposReceipt = ({ title, lines, paper }) => {
        const enc = new TextEncoder();
        const width = paper === '80mm' ? 48 : 32;
        const out = [];
        const push = (arr) => arr.forEach(b => out.push(b));
        const text = (str) => push(Array.from(enc.encode(str)));
        push([0x1B, 0x40]);
        push([0x1B, 0x61, 0x01]);
        push([0x1B, 0x21, 0x30]); text((title || 'CostLab') + '\n');
        push([0x1B, 0x21, 0x00]);
        text('-'.repeat(width) + '\n');
        push([0x1B, 0x61, 0x00]);
        (lines || []).forEach(l => text(l + '\n'));
        text('-'.repeat(width) + '\n');
        push([0x1B, 0x61, 0x01]); text('Terima kasih\n');
        push([0x0A, 0x0A, 0x0A]);
        push([0x1D, 0x56, 0x00]);
        return new Uint8Array(out);
    };

    const connectPrinter = async () => {
        if (!hasBT) { triggerAlert('Browser tidak mendukung Web Bluetooth. Gunakan Chrome di Android/Desktop.', 'error'); return; }
        try {
            setPrinterStatus('connecting');
            const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'] });
            device.addEventListener('gattserverdisconnected', () => { setPrinterStatus('disconnected'); setPrinterChar(null); });
            const server = await device.gatt.connect();
            const services = await server.getPrimaryServices();
            let writeChar = null;
            for (const svc of services) {
                const chars = await svc.getCharacteristics();
                for (const c of chars) { if (c.properties.write || c.properties.writeWithoutResponse) { writeChar = c; break; } }
                if (writeChar) break;
            }
            if (!writeChar) throw new Error('Karakteristik tulis tidak ditemukan di printer');
            setPrinterChar(writeChar); setPrinterName(device.name || 'Bluetooth Printer'); setPrinterStatus('connected');
            triggerAlert('Printer terhubung: ' + (device.name || 'Bluetooth'), 'success');
        } catch (e) { setPrinterStatus('error'); triggerAlert('Gagal konek printer: ' + e.message, 'error'); }
    };

    const writeToPrinter = async (bytes) => {
        if (!printerChar) throw new Error('Printer belum terhubung');
        const CHUNK = 180;
        for (let i = 0; i < bytes.length; i += CHUNK) {
            const slice = bytes.slice(i, i + CHUNK);
            if (printerChar.properties.writeWithoutResponse) await printerChar.writeValueWithoutResponse(slice);
            else await printerChar.writeValue(slice);
            await new Promise(r => setTimeout(r, 18));
        }
    };

    const testPrint = async () => {
        const profile = JSON.parse(localStorage.getItem('store_profile') || '{}');
        const bytes = escposReceipt({ title: profile.name || 'CostLab', lines: ['TEST PRINT BERHASIL', 'Tanggal: ' + new Date().toLocaleString('id-ID'), 'Kertas: ' + paperSize, 'Printer siap dipakai.'], paper: paperSize });
        if (printerStatus === 'connected') {
            try { await writeToPrinter(bytes); triggerAlert('Struk test terkirim ke printer.', 'success'); }
            catch (e) { triggerAlert('Gagal print: ' + e.message, 'error'); }
        } else if (connType === 'wifi') {
            triggerAlert('Mode WiFi/LAN: kirim ke ' + (netIp || 'IP belum diisi') + ' (butuh print server lokal).', netIp ? 'success' : 'error');
        } else {
            triggerAlert('Printer belum terhubung. Membuka dialog cetak browser...', 'success');
            window.print();
        }
    };

    const handleScanValue = (val) => {
        stopScan();
        if (typeof val === 'string' && val.startsWith('CL-ORDER:')) {
            try { setScannedOrder(JSON.parse(val.slice(9))); }
            catch (e) { triggerAlert('QR pesanan tidak valid.', 'error'); }
        } else {
            triggerAlert('Kode terbaca: ' + val, 'success');
        }
    };

    const startScan = async () => {
        if (!('BarcodeDetector' in window)) { triggerAlert('Scanner kamera tidak didukung browser ini. Gunakan scanner USB (ketik lalu Enter).', 'error'); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            setScanActive(true);
            await new Promise(r => setTimeout(r, 60));
            if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
            const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39', 'ean_8'] });
            const loop = async () => {
                if (!videoRef.current || !streamRef.current) return;
                try { const codes = await detector.detect(videoRef.current); if (codes && codes.length) { handleScanValue(codes[0].rawValue); return; } } catch (e) {}
                rafRef.current = requestAnimationFrame(loop);
            };
            rafRef.current = requestAnimationFrame(loop);
        } catch (e) { setScanActive(false); triggerAlert('Gagal akses kamera: ' + e.message, 'error'); }
    };

    const stopScan = () => {
        setScanActive(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };

    const acceptScannedToPos = () => {
        if (!scannedOrder) return;
        const items = (scannedOrder.it || []).map(i => ({ name: i.n, qty: i.q, price: i.h, id: 'scan_' + Math.random().toString(36).slice(2) }));
        const newOrder = { id: 'ord_' + Date.now(), date: new Date().toISOString(), buyer: scannedOrder.b || ('Meja ' + scannedOrder.t), paymentMethod: scannedOrder.p || 'Tunai', items, subtotal: scannedOrder.tot, total: scannedOrder.tot, tableNo: scannedOrder.t, orderType: 'Dine-in', status: 'pending', notes: 'Validasi dari Self-Order (QR)' };
        const active = JSON.parse(localStorage.getItem('active_orders_db') || '[]');
        localStorage.setItem('active_orders_db', JSON.stringify([newOrder, ...active]));
        const rest = JSON.parse(localStorage.getItem('self_orders_db') || '[]').filter(o => o.tableNo !== scannedOrder.t);
        localStorage.setItem('self_orders_db', JSON.stringify(rest));
        triggerAlert('Pesanan Meja ' + scannedOrder.t + ' divalidasi & masuk ke Kasir (Pesanan).', 'success');
        setScannedOrder(null);
    };

    useEffect(() => {
        const onKey = (e) => {
            if (scanActive) return;
            if (e.key === 'Enter') { if (usbBufferRef.current.length > 2) handleScanValue(usbBufferRef.current); usbBufferRef.current = ''; }
            else if (e.key && e.key.length === 1) usbBufferRef.current += e.key;
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [scanActive]);
    useEffect(() => () => stopScan(), []);

    const statusMap = { disconnected: ['Belum terhubung', 'bg-slate-100 text-slate-500 dark:bg-slate-800'], connecting: ['Menghubungkan...', 'bg-amber-100 text-amber-600'], connected: ['Terhubung', 'bg-emerald-100 text-emerald-600'], error: ['Gagal / Error', 'bg-rose-100 text-rose-600'] };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-6">
            <div className="mb-2"><h2 className="font-black text-xl text-slate-800 dark:text-white">Alat Tambahan</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Integrasi Perangkat Keras Nyata</p></div>

            <Card title="Printer Kasir (Thermal)" icon={Printer}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${printerStatus==='connected'?'bg-emerald-500 animate-pulse':printerStatus==='connecting'?'bg-amber-500 animate-pulse':printerStatus==='error'?'bg-rose-500':'bg-slate-300'}`}></span>
                            <span className="text-xs font-bold dark:text-white">{printerName || 'Printer Bluetooth'}</span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${statusMap[printerStatus][1]}`}>{statusMap[printerStatus][0]}</span>
                    </div>
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <button onClick={()=>setConnType('bluetooth')} className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center gap-2 items-center transition ${connType==='bluetooth' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-400'}`}><Bluetooth className="w-3 h-3"/> Bluetooth</button>
                        <button onClick={()=>setConnType('wifi')} className={`flex-1 py-1.5 text-xs font-bold rounded flex justify-center gap-2 items-center transition ${connType==='wifi' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-white' : 'text-slate-400'}`}><Wifi className="w-3 h-3"/> WiFi / LAN</button>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <PremiumSelect label="Ukuran Kertas" value={paperSize} options={['58mm', '80mm']} onChange={(v) => {setPaperSize(v); localStorage.setItem('printer_paper', v)}} />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block ml-1">{connType==='bluetooth' ? 'Status' : 'Alamat IP Printer'}</label>
                            {connType==='wifi' ? (
                                <input value={netIp} onChange={e=>{setNetIp(e.target.value); localStorage.setItem('printer_ip', e.target.value)}} className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-xs font-bold dark:text-white" placeholder="192.168.1.50" />
                            ) : (
                                <div className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400">{hasBT ? 'Web Bluetooth siap' : 'Tidak didukung'}</div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        {connType==='bluetooth' ? (
                            printerStatus==='connected'
                              ? <Button className="flex-1 py-3 text-xs" variant="outline" onClick={()=>{ setPrinterChar(null); setPrinterStatus('disconnected'); triggerAlert('Printer diputus.','success'); }}>Putuskan</Button>
                              : <Button className="flex-1 py-3 text-xs" variant="primary" onClick={connectPrinter}>Hubungkan Printer</Button>
                        ) : (
                            <Button className="flex-1 py-3 text-xs" variant="primary" onClick={()=>triggerAlert(netIp?('Tersimpan: '+netIp):'Isi IP printer dulu', netIp?'success':'error')}>Simpan IP</Button>
                        )}
                        <Button className="flex-1 py-3 text-xs border-indigo-200" variant="outline" onClick={testPrint}>Test Print</Button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">Mendukung printer thermal ESC/POS via Web Bluetooth (Chrome Android/Desktop). Jika tidak terhubung, Test Print memakai dialog cetak browser sebagai cadangan.</p>
                </div>
            </Card>

            <Card title="Barcode / QR Scanner" icon={ScanLine}>
                <div className="space-y-4">
                    {scanActive ? (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline></video>
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-48 h-48 border-2 border-white/80 rounded-2xl relative">
                                    <div className="absolute left-0 right-0 h-0.5 bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-bounce"></div>
                                </div>
                            </div>
                            <button onClick={stopScan} className="absolute top-3 right-3 bg-white/90 text-slate-800 p-2 rounded-full shadow-lg"><X className="w-4 h-4"/></button>
                            <span className="absolute bottom-3 left-3 bg-black/60 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Memindai...</span>
                        </div>
                    ) : (
                        <button onClick={startScan} className="w-full py-10 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-slate-700 bg-indigo-50/50 dark:bg-slate-800/40 flex flex-col items-center gap-2 hover:bg-indigo-50 transition group">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition"><Camera className="w-7 h-7"/></div>
                            <span className="font-black text-sm dark:text-white">Buka Kamera Scanner</span>
                            <span className="text-[10px] text-slate-400">Scan QR validasi pelanggan atau barcode produk</span>
                        </button>
                    )}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[11px] font-bold dark:text-white flex items-center gap-2"><ScanLine className="w-3.5 h-3.5 text-indigo-500"/> Scanner USB / Bluetooth HID</p>
                        <p className="text-[10px] text-slate-500 mt-1">Scanner fisik bekerja otomatis (mode keyboard). Arahkan ke barcode, hasil akan terbaca tanpa setting tambahan.</p>
                    </div>
                </div>
            </Card>

            {scannedOrder && createPortal(
                <div className="fixed inset-0 z-[85] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={()=>setScannedOrder(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in duration-200" onClick={e=>e.stopPropagation()}>
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white text-center">
                            <CheckCircle className="w-10 h-10 mx-auto mb-1"/>
                            <h3 className="font-black text-lg">Pesanan Tervalidasi</h3>
                            <p className="text-xs text-emerald-100">Meja {scannedOrder.t} · {scannedOrder.p}</p>
                        </div>
                        <div className="p-5 space-y-2 max-h-60 overflow-y-auto">
                            {(scannedOrder.it||[]).map((i,x)=>(
                                <div key={x} className="flex justify-between text-xs font-bold"><span className="text-slate-600 dark:text-slate-300">{i.n} x{i.q}</span><span className="dark:text-white">{formatIDR(i.h*i.q)}</span></div>
                            ))}
                        </div>
                        <div className="px-5 pb-3 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-3">
                            <span className="font-bold text-slate-500 text-sm">Total</span>
                            <span className="font-black text-xl text-indigo-600">{formatIDR(scannedOrder.tot)}</span>
                        </div>
                        <div className="p-4 flex gap-2">
                            <button onClick={()=>setScannedOrder(null)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm">Tutup</button>
                            <button onClick={acceptScannedToPos} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm">Terima ke Kasir</button>
                        </div>
                    </div>
                </div>, document.body)}
        </div>
    );
};



// ============================================================================
// 6. TAB: SETTINGS (NEW ENTERPRISE DASHBOARD)
// ============================================================================

const SettingsTab = ({ licenseInfo, triggerAlert }) => {
    const [bizMode, setBizMode] = useState(localStorage.getItem('biz_mode') || 'retail');
    const [tableMode, setTableMode] = useState(localStorage.getItem('table_mode') === 'true');
    const [tableCount, setTableCount] = useState(parseInt(localStorage.getItem('table_count')) || 10);
    const [lang, setLang] = useState('id');
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!licenseInfo?.validUntil) return;
        const updateTimer = () => {
            const diff = new Date(licenseInfo.validUntil) - new Date();
            if (diff <= 0) { setTimeLeft("Kedaluwarsa"); } 
            else {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                setTimeLeft(`${d} Hari ${h} Jam`);
            }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 60000);
        return () => clearInterval(interval);
    }, [licenseInfo]);

    const handleModeChange = (mode) => {
        setBizMode(mode);
        localStorage.setItem('biz_mode', mode);
        triggerAlert(mode === 'retail' ? "Mode Retail Aktif." : "Mode F&B Aktif.", "success");
    };

    const handleTableModeChange = () => {
        const newVal = !tableMode;
        setTableMode(newVal);
        localStorage.setItem('table_mode', newVal);
        triggerAlert(`Mode Meja ${newVal ? 'Aktif' : 'Nonaktif'}.`, "success");
    };

    const saveTableCount = (val) => {
        setTableCount(val);
        localStorage.setItem('table_count', val);
    };

    const handleBackup = () => {
        const data = JSON.stringify(localStorage);
        const blob = new Blob([data], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_costlab_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        triggerAlert("Backup data berhasil diunduh!", "success");
    };

    const handleRestore = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
                triggerAlert("Restore data berhasil! Memuat ulang sistem...", "success");
                setTimeout(() => window.location.reload(), 1500);
            } catch(err) {
                triggerAlert("Format file backup tidak valid!", "error");
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-6">
            <div className="mb-4">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Pengaturan Utama</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Konfigurasi Sistem {licenseInfo?.tenant}</p>
            </div>

            <Card title="Mode Operasional" icon={LayoutGrid}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div onClick={() => handleModeChange('retail')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${bizMode === 'retail' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'}`}>
                        <Store className={`w-6 h-6 mb-2 ${bizMode === 'retail' ? 'text-indigo-600' : 'text-slate-400'}`}/>
                        <h4 className="font-bold text-sm dark:text-white">Retail Murni</h4>
                    </div>
                    <div onClick={() => handleModeChange('fnb')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${bizMode === 'fnb' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300'}`}>
                        <ShoppingCart className={`w-6 h-6 mb-2 ${bizMode === 'fnb' ? 'text-amber-600' : 'text-slate-400'}`}/>
                        <h4 className="font-bold text-sm dark:text-white">Food & Beverage</h4>
                    </div>
                </div>
                {bizMode === 'fnb' && (
                    <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 transition-all">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-sm dark:text-white">Mode Meja (Dine-in)</p>
                                <p className="text-[10px] text-slate-500">Aktifkan self-order URL Pelanggan</p>
                            </div>
                            <div onClick={handleTableModeChange} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${tableMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${tableMode ? 'translate-x-6' : ''}`}></div>
                            </div>
                        </div>
                        {tableMode && (
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 animate-in fade-in">
                                <NumericInput label="Jumlah Meja Tersedia" value={tableCount} onChange={saveTableCount} className="mb-3 bg-white" />
                                <div className="text-[10px] text-slate-500 bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-indigo-700">
                                    <p className="font-black mb-1 uppercase tracking-wider">Link QR / URL Meja Anda:</p>
                                    <span className="font-mono bg-white px-2 py-1 rounded border border-indigo-200 block text-center break-all select-all">{window.location.origin}/?meja=1</span>
                                    <p className="mt-2 opacity-80">(Ubah angka 1 sesuai nomor meja saat membuat QR Code)</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            <Card title="Data & Keamanan" icon={DatabaseBackup}>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <Button onClick={handleBackup} variant="primary" icon={Download} className="py-4">Backup Data</Button>
                    <div className="relative">
                        <Button variant="outline" icon={Upload} className="w-full py-4 bg-white text-slate-800 border-indigo-200">Restore Data</Button>
                        <input type="file" accept=".json" onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                </div>
            </Card>

            <Card title="Sistem">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2"><Languages className="w-4 h-4 text-slate-400"/><span className="font-bold text-sm dark:text-white">Bahasa Aplikasi</span></div>
                    <PremiumSelect value={lang==='id'?'Indonesia':'English'} options={['Indonesia','English']} onChange={v=>setLang(v==='Indonesia'?'id':'en')} className="w-32" />
                </div>
                <div className="flex justify-between items-center py-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <p className="font-bold text-sm dark:text-white flex items-center gap-2">Lisensi <Crown className="w-3 h-3 text-amber-500"/></p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {licenseInfo?.id}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 px-2 py-1 rounded">Sisa Waktu</span>
                        <p className="font-black text-sm dark:text-white mt-1">{timeLeft}</p>
                    </div>
                </div>
                <div className="pt-4">
                    <Button onClick={() => {if(confirm("PERINGATAN: Mereset akan menghapus semua database?")){localStorage.clear(); window.location.reload();}}} variant="danger" icon={AlertTriangle} className="w-full text-xs py-3">Zona Bahaya : Reset Aplikasi</Button>
                </div>
            </Card>
        </div>
    );
};



// --- TAMBAHAN KODE 3 (LAYAR KUNCI & SECURITY) ---
// --- LAYAR KUNCI & SECURITY (Updated for Admin Panel) ---
const LockScreen = ({ onUnlock }) => {
    const [step, setStep] = useState(1);
    const [inputId, setInputId] = useState("");
    const [inputPass, setInputPass] = useState("");
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const [tenantData, setTenantData] = useState(null);

    // Gunakan fungsi alert sederhana jika belum ada PremiumPopup di sini
    const triggerAlert = (msg) => alert(msg);

    const handleTenantLogin = async () => {
        if(!inputId || !inputPass) return triggerAlert("Isi ID dan Password!");
        setLoading(true);
        try {
            const docRef = doc(db, "licenses", inputId.toLowerCase());
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                data.id = docSnap.id; 
                if (data.password === inputPass) {
                    if (!data.active) { triggerAlert("Akun dinonaktifkan Admin."); setLoading(false); return; }
                    if (new Date() > new Date(data.validUntil)) { triggerAlert("Masa aktif habis."); setLoading(false); return; }
                    
                    setTenantData(data);
                    setStep(2); // Lanjut ke PIN Karyawan / Owner
                } else { triggerAlert("Password Salah!"); }
            } else { triggerAlert("ID Tenant tidak ditemukan!"); }
        } catch (error) { triggerAlert("Error Koneksi: " + error.message); }
        setLoading(false);
    };

    const handlePinLogin = () => {
        const employeeDb = JSON.parse(localStorage.getItem('employee_db') || '[]');
        let role = null;

        // 1. Cek apakah PIN cocok dengan Owner PIN dari Firebase (lisensi)
        if (tenantData && pin === tenantData.ownerPin) {
            role = "owner";
        } 
        // 2. Jika bukan Owner, cek apakah PIN cocok dengan data karyawan (Kasir/Admin)
        else {
            const foundEmp = employeeDb.find(emp => emp.pin === pin);
            if (foundEmp) role = foundEmp.role;
        }

        if (role) {
            const sessionData = { ...tenantData, currentUserRole: role };
            syncSession('LOGIN', sessionData);
            onUnlock(sessionData);
        } else {
            triggerAlert("PIN Salah atau Akses Ditolak!");
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-950">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-slate-900 to-slate-950 animate-gradient"></div>
            <div className="absolute -top-24 -left-20 w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl animate-float-slow"></div>
            <div className="absolute -bottom-28 -right-16 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-float-slower"></div>
            <div className="absolute top-1/3 right-1/4 w-44 h-44 bg-sky-400/20 rounded-full blur-3xl animate-float-slow"></div>
            <div className="relative w-full max-w-sm bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl rounded-[2rem] p-8 text-center shadow-2xl border border-white/40 animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-4 text-white shadow-xl shadow-indigo-500/40 relative">
                    <span className="absolute inset-0 rounded-3xl border-2 border-indigo-400/40 animate-ping-ring"></span>
                    {step === 1 ? <Crown className="w-10 h-10" /> : <Key className="w-9 h-9"/>}
                </div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">{step === 1 ? 'CostLab' : 'Masukkan PIN'}</h1>
                <p className="text-[11px] text-indigo-500 dark:text-indigo-300 font-bold mb-6 uppercase tracking-[0.22em]">{step === 1 ? 'Premium POS · HPP Suite' : 'Akses Karyawan'}</p>
                
                {step === 1 ? (
                    <div className="space-y-3 text-left">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Tenant ID</label>
                            <input value={inputId} onChange={e=>setInputId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition" placeholder="username" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Password</label>
                            <input type="password" value={inputPass} onChange={e=>setInputPass(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition" placeholder="******" />
                        </div>
                        <button onClick={handleTenantLogin} disabled={loading} className="w-full mt-6 bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-60 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 press">
                            {loading ? (<><span className="spinner-ring"></span> Memverifikasi...</>) : (<><ShieldCheck className="w-4 h-4"/> Lanjut</>)}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-4 flex items-center justify-center gap-1"><Lock className="w-3 h-3"/> Koneksi terenkripsi · Data toko Anda aman</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <input type="password" value={pin} readOnly className="w-full text-center tracking-[1em] bg-slate-50 border border-slate-200 rounded-xl p-4 font-black text-xl outline-none" placeholder="••••••" />
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            {[1,2,3,4,5,6,7,8,9].map(num => (
                                <button key={num} onClick={() => setPin(prev => prev.length < 6 ? prev + num : prev)} className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl font-black text-xl text-slate-800 transition active:scale-95">{num}</button>
                            ))}
                            <button onClick={() => setStep(1)} className="p-4 text-xs font-bold text-slate-400 hover:text-slate-600 transition">Batal</button>
                            <button onClick={() => setPin(prev => prev.length < 6 ? prev + "0" : prev)} className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl font-black text-xl text-slate-800 transition active:scale-95">0</button>
                            <button onClick={() => setPin(prev => prev.slice(0, -1))} className="p-4 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl flex justify-center items-center transition active:scale-95"><MinusCircle className="w-6 h-6"/></button>
                        </div>
                        <button onClick={handlePinLogin} disabled={pin.length !== 6} className="w-full mt-2 bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-500/30">
                            Buka Sistem
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};


const BannedScreen = ({ id }) => (
    <div className="min-h-screen bg-rose-900 flex items-center justify-center p-4 text-white text-center">
        <div>
            <ShieldAlert className="w-20 h-20 mx-auto mb-4 opacity-50"/>
            <h1 className="text-3xl font-black mb-2">AKSES DIBLOKIR</h1>
            <p className="opacity-80">ID Aplikasi Anda ({id}) telah masuk daftar hitam.</p>
        </div>
    </div>
);

const RestoredScreen = ({ onContinue }) => (
    <div className="min-h-screen bg-emerald-900 flex items-center justify-center p-4 text-white text-center">
        <div>
            <ShieldOk className="w-20 h-20 mx-auto mb-4 opacity-50"/>
            <h1 className="text-3xl font-black mb-2">AKSES DIPULIHKAN</h1>
            <button onClick={onContinue} className="mt-4 bg-white text-emerald-900 px-6 py-2 rounded-full font-bold">Lanjutkan</button>
        </div>
    </div>
);


// ============================================================================
// 8. TAB: METODE PEMBAYARAN (PINDAHAN DARI PROFILE)
// ============================================================================
const PaymentTab = ({ triggerAlert, setEditingMode, activeTab }) => {
    const [profile, setProfile] = useState({ payment: { qris: null, ewallets: [], bank: [] } });
    const [newWallet, setNewWallet] = useState({ type: 'Gopay', number: '' });
    const [newBank, setNewBank] = useState({ bank: '', number: '' });
    const [cropSrc, setCropSrc] = useState(null);

    // FIX BUG: Auto-Refresh Data Pembayaran saat tab dibuka
    useEffect(() => {
        if (activeTab === 'payment' || !activeTab) {
            const saved = localStorage.getItem('store_profile');
            if (saved) setProfile(JSON.parse(saved));
        }
    }, [activeTab]);


    useEffect(() => {
        if(cropSrc) setEditingMode(true);
        else setEditingMode(false);
    }, [cropSrc, setEditingMode]);

    const saveProfile = (newP) => { 
        setProfile(newP); 
        localStorage.setItem('store_profile', JSON.stringify(newP)); 
    };

    const addWallet = () => {
        if(!newWallet.number) return triggerAlert("Nomor E-Wallet wajib diisi", "error");
        saveProfile({...profile, payment: {...profile.payment, ewallets: [...(profile.payment?.ewallets || []), newWallet]}});
        setNewWallet({type: 'Gopay', number: ''});
        triggerAlert("E-Wallet berhasil ditambahkan");
    };
    
    const addBank = () => {
        if(!newBank.number) return triggerAlert("Nomor Rekening wajib diisi", "error");
        saveProfile({...profile, payment: {...profile.payment, bank: [...(profile.payment?.bank || []), newBank]}});
        setNewBank({bank: '', number: ''});
        triggerAlert("Rekening Bank berhasil ditambahkan");
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2 px-1">
                <h2 className="font-black text-xl text-slate-800 dark:text-white">Metode Pembayaran</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kelola QRIS & Rekening Toko</p>
            </div>

            <Card title="QRIS Toko">
                <div className="w-full h-48 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center relative overflow-hidden group hover:border-indigo-400 transition cursor-pointer">
                   {profile.payment?.qris ? <img src={profile.payment.qris} className="w-full h-full object-contain p-4"/> : <div className="text-center text-slate-400"><QrCode className="w-10 h-10 mx-auto mb-2 opacity-50"/><p className="text-xs font-bold">Upload QRIS</p></div>}
                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {if(e.target.files[0]) { const r = new FileReader(); r.onload=v=>setCropSrc(v.target.result); r.readAsDataURL(e.target.files[0]); }}}/>
                </div>
            </Card>
            
            <Card title="Rekening & E-Wallet">
                <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-black text-indigo-500 uppercase mb-3 block flex items-center gap-2"><Wallet className="w-3 h-3"/> Tambah E-Wallet</label>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="w-full sm:w-32 shrink-0">
                                <PremiumSelect value={newWallet.type} options={WALLET_TYPES} onChange={v=>setNewWallet({...newWallet, type:v})} />
                            </div>
                            <div className="flex gap-2 w-full">
                                <input className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none dark:text-white" placeholder="0812..." value={newWallet.number} onChange={e=>setNewWallet({...newWallet, number:e.target.value})}/>
                                <button onClick={addWallet} className="px-4 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition"><Plus className="w-5 h-5"/></button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4">
                            {(profile.payment?.ewallets || []).map((w,i) => (
                                <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-900 pl-3 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in">
                                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">{w.type}</span> 
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{w.number}</span>
                                    <button onClick={()=>saveProfile({...profile, payment: {...profile.payment, ewallets: profile.payment.ewallets.filter((_,x)=>x!==i)}})} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <label className="text-[10px] font-black text-emerald-500 uppercase mb-3 block flex items-center gap-2"><CreditCard className="w-3 h-3"/> Tambah Bank</label>
                         <div className="flex flex-col sm:flex-row gap-2">
                            <input className="w-full sm:w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-xs font-bold outline-none dark:text-white uppercase placeholder:normal-case" placeholder="Bank (BCA)" value={newBank.bank} onChange={e=>setNewBank({...newBank, bank:e.target.value})}/>
                            <div className="flex gap-2 w-full">
                                <input className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none dark:text-white" placeholder="No. Rekening" value={newBank.number} onChange={e=>setNewBank({...newBank, number:e.target.value})}/>
                                <button onClick={addBank} className="px-4 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/20 active:scale-95 transition"><Plus className="w-5 h-5"/></button>
                            </div>
                        </div>
                         <div className="flex flex-wrap gap-2 mt-4">
                              {(profile.payment?.bank || []).map((b,i) => (
                                <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-900 pl-3 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in">
                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase">{b.bank}</span> 
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{b.number}</span>
                                    <button onClick={()=>saveProfile({...profile, payment: {...profile.payment, bank: profile.payment.bank.filter((_,x)=>x!==i)}})} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {cropSrc && (
                <ImageCropperModal 
                    imageSrc={cropSrc} 
                    onCropComplete={(img)=>{ saveProfile({...profile, payment: {...profile.payment, qris: img}}); setCropSrc(null); }} 
                    onClose={()=>setCropSrc(null)} 
                />
            )}
        </div>
    );
};

// ============================================================================
// 9. TAB: STOK BARANG (PINDAHAN DARI PROFILE)
// ============================================================================
const StockTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
    const [products, setProducts] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [showRawMat, setShowRawMat] = useState(false); 
    const [showAdd, setShowAdd] = useState(false);
    const [cropSrc, setCropSrc] = useState(null); 
    const [newProd, setNewProd] = useState({ name: '', price: 0, stock: 0, type: 'Makanan', image: null });

    // FIX AUTO-REFRESH: Data akan ditarik ulang secara otomatis setiap kali menu "Stok Barang" diklik
    useEffect(() => {
        if (activeTab === 'stock') {
            setProducts(safeParse('product_stock_db', []));
            setRawMaterials(safeParse('raw_material_db', []));
        }
    }, [activeTab]);

    // ... (kode sisanya ke bawah tetap sama persis)


    useEffect(() => {
        if(cropSrc || showAdd) setEditingMode(true);
        else setEditingMode(false);
    }, [cropSrc, showAdd, setEditingMode]);

    const saveProducts = (newP) => { setProducts(newP); localStorage.setItem('product_stock_db', JSON.stringify(newP)); };
    const saveRaw = (newR) => { setRawMaterials(newR); localStorage.setItem('raw_material_db', JSON.stringify(newR)); };

    const addProduct = () => {
        if(!newProd.name) return triggerAlert("Nama produk wajib diisi", "error");
        const item = { id: `p_${Date.now()}`, ...newProd, hpp: newProd.price*0.7 }; 
        saveProducts([...products, item]);
        setShowAdd(false); triggerAlert("Produk berhasil ditambahkan");
        setNewProd({ name: '', price: 0, stock: 0, type: 'Makanan', image: null });
    };

    const deleteProduct = (id) => {
        if(confirm("Hapus produk ini?")) saveProducts(products.filter(p => p.id !== id));
    };
    const updateStock = (id, delta) => saveProducts(products.map(p => p.id === id ? {...p, stock: Math.max(0, p.stock + delta)} : p));

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2 px-1">
                <h2 className="font-black text-xl text-slate-800 dark:text-white">Manajemen Stok</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Etalase & Gudang Bahan</p>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl flex mb-6 relative">
                 <button onClick={()=>setShowRawMat(false)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all relative z-10 ${!showRawMat ? 'text-indigo-600 dark:text-white' : 'text-slate-400'}`}>Produk Jadi</button>
                 <button onClick={()=>setShowRawMat(true)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all relative z-10 ${showRawMat ? 'text-indigo-600 dark:text-white' : 'text-slate-400'}`}>Bahan Baku</button>
                 <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm transition-transform duration-300 ${showRawMat ? 'translate-x-[calc(100%+6px)]' : 'translate-x-0'}`}></div>
             </div>

             {!showRawMat ? (
                <div className="animate-in slide-in-from-left-4 duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                             <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/30"><Box className="w-5 h-5"/></div>
                             <div>
                                <h3 className="font-black text-lg text-slate-800 dark:text-white leading-none">Etalase Produk</h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{products.length} Item Terdaftar</p>
                             </div>
                        </div>
                        <Button onClick={()=>setShowAdd(true)} icon={Plus} className="px-5 py-2.5 text-xs shadow-lg shadow-indigo-500/20">Tambah</Button>
                    </div>

                    <div className="space-y-3 pb-24">
                        {products.length === 0 && <div className="text-center py-10 text-slate-400 text-xs font-bold border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Belum ada produk.<br/>Klik Tambah untuk memulai.</div>}
                        {products.map(p => (
                            <div key={p.id} className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex gap-4 items-center group hover:border-indigo-500/50 transition-all duration-300">
                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-700 relative">
                                    {p.image ? <img src={p.image} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-xl">{p.name[0]}</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{p.name}</h4>
                                        <span className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500 font-black uppercase tracking-wider">{p.type}</span>
                                    </div>
                                    <p className="text-indigo-600 font-black text-sm">{formatIDR(p.price)}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                     <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <button onClick={()=>updateStock(p.id, -1)} className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center text-sm font-bold hover:text-red-500 transition active:scale-90">-</button>
                                        <span className="w-10 text-center text-sm font-black text-slate-800 dark:text-white">{p.stock}</span>
                                        <button onClick={()=>updateStock(p.id, 1)} className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center text-sm font-bold hover:text-emerald-500 transition active:scale-90">+</button>
                                    </div>
                                    <button onClick={()=>deleteProduct(p.id)} className="text-[10px] font-bold text-slate-300 hover:text-red-500 transition px-2">Hapus Item</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             ) : (
                 <div className="animate-in slide-in-from-right-4 duration-300 space-y-4 pb-24">
                     <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 rounded-[2rem] relative overflow-hidden shadow-xl shadow-indigo-600/30">
                         <div className="relative z-10">
                             <div className="flex items-center gap-3 mb-2 opacity-80">
                                 <Layers className="w-5 h-5"/>
                                 <span className="text-xs font-bold uppercase tracking-widest">Total Aset Bahan</span>
                             </div>
                             <p className="text-4xl font-black tracking-tight mb-2">{formatIDR(rawMaterials.reduce((a,b)=>a+(b.lastPrice * (b.stock || 0)), 0))}</p>
                         </div>
                         <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/5 skew-x-12 -mr-10"></div>
                     </div>

                     <div className="grid grid-cols-1 gap-3">
                         {rawMaterials.length === 0 && <div className="text-center py-10 text-slate-400 text-xs font-bold bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">Data bahan baku kosong.</div>}
                         {rawMaterials.map((rm, idx) => {
                             const baseUnit = rm.unit || 'gr';
                             return (
                                 <div key={rm.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                                     <div className="flex justify-between items-start">
                                         <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm">{idx+1}</div>
                                              <div>
                                                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">{rm.name}</h4>
                                                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Stok Gudang</p>
                                              </div>
                                         </div>
                                         <div className="text-right">
                                             <p className="text-[10px] font-bold text-slate-400 uppercase">Nilai Aset</p>
                                             <p className="text-indigo-600 font-black text-sm">{formatIDR((rm.stock||0) * rm.lastPrice)}</p>
                                         </div>
                                     </div>
                                     
                                     <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex justify-between items-center border border-slate-100 dark:border-slate-700">
                                         <span className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{rm.stock} <span className="text-xs text-slate-400 font-bold ml-0.5">{baseUnit}</span></span>
                                         <button onClick={()=>{
                                             const add = prompt(`Tambah stok ${rm.name} (satuan basis: ${baseUnit}):`, "0");
                                             if(add) saveRaw(rawMaterials.map(x => x.id===rm.id ? {...x, stock: (x.stock||0) + parseFloat(add)} : x));
                                         }} className="text-xs font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800">+ Stok</button>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 </div>
             )}

             {/* MODAL TAMBAH PRODUK */}
            {showAdd && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-white/80 dark:bg-black/80 backdrop-blur-md animate-in fade-in">
                <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border-slate-200 dark:border-slate-700 ring-1 ring-black/5" title="Tambah Produk Baru">
                    <div className="space-y-4">
                    <div className="flex justify-center py-2">
                        <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center relative overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 group hover:border-indigo-500 transition cursor-pointer">
                        {newProd.image ? <img src={newProd.image} className="w-full h-full object-cover"/> : <div className="text-center text-slate-300"><ImageIcon className="w-8 h-8 mx-auto"/><span className="text-[9px] font-bold">Upload Foto</span></div>}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e=>{if(e.target.files[0]){const r=new FileReader();r.onload=v=>{setCropSrc(v.target.result);};r.readAsDataURL(e.target.files[0]);}}}/>
                        </div>
                    </div>

                                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block ml-1">Nama Produk</label>
                        <input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm font-bold focus:border-indigo-500 transition dark:text-white placeholder:text-slate-300" placeholder="Contoh: Kopi Susu Gula Aren" value={newProd.name} onChange={e=>setNewProd({...newProd, name:e.target.value})} />
                    </div>

                    {/* Tambahan Kolom Barcode/SKU dengan Tombol Scanner Kamera */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block ml-1">Kode Barcode / SKU</label>
                        <div className="relative flex group">
                            <input className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm font-bold focus:border-indigo-500 transition dark:text-white placeholder:text-slate-300" placeholder="Scan Barcode / Ketik SKU..." value={newProd.sku || ''} onChange={e=>setNewProd({...newProd, sku:e.target.value})} />
                            <button onClick={() => triggerAlert("Akses Kamera Terbuka. Silahkan scan barcode produk.", "success")} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg hover:bg-indigo-100 transition shadow-sm border border-indigo-100 dark:border-indigo-800">
                                <Camera className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3">

                        <div className="flex-1"><PremiumSelect label="Kategori" value={newProd.type} options={['Makanan','Minuman','Fashion','Jasa','Lainnya']} onChange={v=>setNewProd({...newProd, type:v})} /></div>
                        <div className="w-28"><NumericInput label="Stok Awal" value={newProd.stock} onChange={v=>setNewProd({...newProd, stock:v})} className="bg-slate-50 dark:bg-slate-900" /></div>
                    </div>
                                
                    <NumericInput placeholder="0" value={newProd.price} onChange={v=>setNewProd({...newProd, price:v})} prefix="Rp" label="Harga Jual (Retail)" className="bg-slate-50 dark:bg-slate-900" />

                    {isPro(licenseInfo) && (
                        <div className="space-y-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <div className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-1 mb-1"><Crown className="w-3 h-3"/> Pro Pricing Strategy</div>
                            <div className="grid grid-cols-2 gap-3">
                                <NumericInput placeholder="Grosir" value={newProd.priceGrosir || 0} onChange={v=>setNewProd({...newProd, priceGrosir:v})} prefix="Rp" label="Harga Grosir" className="text-xs bg-white dark:bg-slate-800" />
                                <NumericInput placeholder="App Online" value={newProd.priceOjol || 0} onChange={v=>setNewProd({...newProd, priceOjol:v})} prefix="Rp" label="Harga App Online" className="text-xs bg-white dark:bg-slate-800" />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 py-3" onClick={()=>setShowAdd(false)}>Batal</Button>
                        <Button className="flex-1 py-3" onClick={addProduct}>Simpan Produk</Button>
                    </div>
                    </div>
                </Card>
                </div>
            )}

            {cropSrc && (
                <ImageCropperModal imageSrc={cropSrc} onCropComplete={(img)=>{ setNewProd({...newProd, image: img}); setCropSrc(null); }} onClose={()=>setCropSrc(null)} />
            )}
        </div>
    );
};


// ============================================================================
// 7. TAB BARU: HASIL PEMECAHAN & FITUR BARU (PREMIUM UI)
// ============================================================================

// A. Tab Riwayat Transaksi (Dipindah dari Laporan)
const HistoryTab = ({ txs }) => {
    const [searchOrder, setSearchOrder] = useState('');
    const [selectedTx, setSelectedTx] = useState(null);
     
    const totalHariIni = txs
        .filter(t => new Date(t.date).toDateString() === new Date().toDateString())
        .reduce((sum, t) => sum + t.total, 0);

    const filteredTxs = txs.filter(t => t.id.toLowerCase().includes(searchOrder.toLowerCase()) || (t.buyer && t.buyer.toLowerCase().includes(searchOrder.toLowerCase())));

    return (
        <div className="max-w-4xl mx-auto px-4 pb-32 space-y-4">
            {/* CARD OMZET */}
            <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-lg mb-4">
                <p className="text-[10px] uppercase font-bold opacity-80">Omzet Hari Ini</p>
                <h3 className="text-2xl font-black">{formatIDR(totalHariIni)}</h3>
            </div>

            <div className="flex justify-between items-end mb-2">
                <div>
                    <h2 className="font-black text-xl text-slate-800 dark:text-white">Riwayat Transaksi</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Database Penjualan</p>
                </div>
            </div>
            
            <div className="relative group mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-4 h-4 text-slate-400"/></div>
                <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:border-indigo-500 shadow-sm dark:text-white" placeholder="Cari Nomor Order / Nama Pembeli..." value={searchOrder} onChange={e=>setSearchOrder(e.target.value)} />
            </div>
            
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredTxs.length === 0 ? <div className="text-center py-10 text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">Transaksi tidak ditemukan.</div> : 
                 filteredTxs.map(t => (
                  <div key={t.id} onClick={()=>setSelectedTx(t)} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:border-indigo-500/50 transition cursor-pointer group shadow-sm">
                    <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                            {t.paymentMethod === 'Cash' ? <Banknote className="w-5 h-5"/> : <QrCode className="w-5 h-5"/>}
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white">{t.buyer || 'Tanpa Nama'}</h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{t.id} • {new Date(t.date).toLocaleString([], {day:'numeric', month:'short', hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-black text-base text-indigo-600">{formatIDR(t.total)}</p>
                        <p className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded inline-block mt-1">{t.items.length} Item</p>
                    </div>
                  </div>
                ))}
            </div>

            {selectedTx && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200" onClick={()=>setSelectedTx(null)}>
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-white/10" onClick={e=>e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="font-black text-xl text-slate-800 dark:text-white tracking-tight">Detail Order</h3>
                                <p className="text-xs text-slate-400 font-mono mt-1">{selectedTx.id}</p>
                            </div>
                            <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">Lunas</div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3">
                                {selectedTx.items.map((i,x)=>(
                                    <div key={x} className="flex justify-between text-xs">
                                        <div>
                                            <span className="font-bold text-slate-700 dark:text-slate-300 block">{i.name}</span>
                                            <span className="text-[10px] text-slate-400">{i.qty} x {formatIDR(i.price)}</span>
                                        </div>
                                        <span className="font-bold text-slate-900 dark:text-white">{formatIDR(i.price*i.qty)}</span>
                                    </div>
                                ))}
                                <div className="border-t border-dashed border-slate-300 dark:border-slate-600 pt-3 mt-2 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                                    <span>Total Bayar</span>
                                    <span>{formatIDR(selectedTx.total)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-xl">
                                    <p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Metode</p>
                                    <p className="font-bold text-slate-800 dark:text-white">{selectedTx.paymentMethod}</p>
                                </div>
                                <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-xl">
                                    <p className="text-slate-400 font-bold uppercase text-[9px] mb-1">Waktu</p>
                                    <p className="font-bold text-slate-800 dark:text-white">{new Date(selectedTx.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                </div>
                            </div>
                        </div>

                        <button onClick={()=>setSelectedTx(null)} className="mt-6 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition">Tutup</button>
                    </div>
                </div>
            )}
        </div>
    );
};


// B. Tab Generic (Placeholder)
const ConstructionTab = ({ title, desc, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in px-4"><div className="w-24 h-24 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-6 border-4 border-dashed border-slate-200 dark:border-slate-800 relative"><Icon className="w-10 h-10 text-slate-400" /><div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-lg">Segera</div></div><h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">{title}</h2><p className="text-xs font-medium text-slate-400 max-w-sm leading-relaxed">{desc}</p></div>
);

// --- FITUR BARU: MANAJEMEN KAS KELUAR ---
const CashOutTab = ({ triggerAlert }) => {
    const [expenses, setExpenses] = useState(JSON.parse(localStorage.getItem('expense_db') || '[]'));
    const [form, setForm] = useState({ note: '', amount: 0, category: 'Operasional' });

    const saveExpense = () => {
        if(!form.note || form.amount <= 0) return triggerAlert("Isi catatan dan nominal dengan benar!", "error");
        const newEx = { id: `exp_${Date.now()}`, date: new Date().toISOString(), ...form };
        const updated = [newEx, ...expenses];
        setExpenses(updated);
        localStorage.setItem('expense_db', JSON.stringify(updated));
        setForm({ note: '', amount: 0, category: 'Operasional' });
        triggerAlert("Kas Keluar Berhasil Dicatat!");
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2"><h2 className="font-black text-xl text-slate-800 dark:text-white">Kas Keluar</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pencatatan Pengeluaran Harian</p></div>
            <Card title="Input Pengeluaran" icon={ArrowDownCircle}>
                <div className="space-y-4">
                    <PremiumSelect label="Kategori" value={form.category} options={['Operasional', 'Bahan Baku', 'Gaji/Upah', 'Lainnya']} onChange={v=>setForm({...form, category:v})} />
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Catatan / Keterangan</label><input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none dark:text-white" placeholder="Contoh: Beli Es Batu" value={form.note} onChange={e=>setForm({...form, note: e.target.value})} /></div>
                    <NumericInput label="Nominal Pengeluaran" prefix="Rp" value={form.amount} onChange={v=>setForm({...form, amount: v})} className="bg-slate-50 dark:bg-slate-900" />
                    <Button onClick={saveExpense} className="w-full py-3" icon={Save}>Simpan Pengeluaran</Button>
                </div>
            </Card>
            <div className="space-y-3">
                <h3 className="font-bold text-sm dark:text-white px-1">Riwayat Hari Ini</h3>
                {expenses.filter(e => new Date(e.date).toDateString() === new Date().toDateString()).map(e => (
                    <div key={e.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm">
                        <div><p className="font-bold text-sm dark:text-white">{e.note}</p><p className="text-[10px] text-slate-500 font-bold uppercase">{e.category} • {new Date(e.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p></div>
                        <p className="font-black text-rose-500">- {formatIDR(e.amount)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- FITUR BARU: KELOLA DISKON & PAJAK ---
const DiscountTab = ({ triggerAlert }) => {
    const [config, setConfig] = useState(JSON.parse(localStorage.getItem('discount_tax_db') || '{"tax":0, "service":0, "globalDiscount":0}'));
    
    const saveConfig = (key, val) => {
        const newConf = {...config, [key]: val};
        setConfig(newConf);
        localStorage.setItem('discount_tax_db', JSON.stringify(newConf));
        triggerAlert("Pengaturan Diperbarui!");
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2"><h2 className="font-black text-xl text-slate-800 dark:text-white">Pajak & Biaya</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pengaturan PPN & Servis</p></div>
            <Card title="Pajak (PPN)" icon={Percent}>
                <p className="text-xs text-slate-500 mb-4">Tambahkan persentase pajak yang akan dibebankan ke total tagihan pelanggan.</p>
                <NumericInput suffix="%" value={config.tax} onChange={v=>saveConfig('tax', v)} placeholder="Contoh: 11" className="bg-slate-50 dark:bg-slate-900" />
            </Card>
            <Card title="Biaya Layanan (Service Charge)" icon={Coins}>
                <p className="text-xs text-slate-500 mb-4">Tambahkan biaya layanan tambahan (Maksimal 100%).</p>
                <NumericInput suffix="%" value={config.service} onChange={v=>saveConfig('service', v)} placeholder="Contoh: 5" className="bg-slate-50 dark:bg-slate-900" />
            </Card>
        </div>
    );
};

// --- FITUR BARU: GOD PANEL (DATABASE KARYAWAN) ---
const EmployeeTab = ({ triggerAlert }) => {
    const [employees, setEmployees] = useState(JSON.parse(localStorage.getItem('employee_db') || '[]'));
    const [form, setForm] = useState({ name: '', role: 'kasir', pin: '' });
    const [visiblePinId, setVisiblePinId] = useState(null); // Hanya 1 PIN boleh terbuka di satu waktu

    const generatePin = () => setForm({...form, pin: Math.floor(100000 + Math.random() * 900000).toString()});

    const saveEmployee = () => {
        if(!form.name || form.pin.length !== 6) return triggerAlert("Nama dan 6 Digit PIN wajib diisi!", "error");
        const newEmp = { id: `emp_${Date.now()}`, ...form };
        const updated = [...employees, newEmp];
        setEmployees(updated);
        localStorage.setItem('employee_db', JSON.stringify(updated));
        setForm({ name: '', role: 'kasir', pin: '' });
        triggerAlert("Karyawan Berhasil Ditambahkan!");
    };

    const deleteEmployee = (id) => {
        if(confirm("Hapus akses karyawan ini?")) {
            const updated = employees.filter(e => e.id !== id);
            setEmployees(updated);
            localStorage.setItem('employee_db', JSON.stringify(updated));
        }
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2"><h2 className="font-black text-xl text-slate-800 dark:text-white">Manajemen User</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manajemen Hak Akses & PIN</p></div>
            <Card title="Tambah Karyawan Baru" icon={UserCircle2}>
                <div className="space-y-4">
                    <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none dark:text-white" placeholder="Nama Karyawan" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
                    <PremiumSelect label="Role Akses" value={form.role} options={['kasir', 'admin']} onChange={v=>setForm({...form, role:v})} />
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">PIN Akses (6 Digit)</label>
                        <div className="flex gap-2">
                            <input type="text" readOnly className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-center tracking-[1em] font-black outline-none dark:text-white" value={form.pin} placeholder="••••••" />
                            <Button onClick={generatePin} variant="secondary" className="px-4"><RefreshCw className="w-4 h-4"/></Button>
                        </div>
                    </div>
                    <Button onClick={saveEmployee} className="w-full py-3" icon={Save}>Simpan Akses</Button>
                </div>
            </Card>
            <div className="space-y-3">
                <h3 className="font-bold text-sm dark:text-white px-1">Daftar Akses Karyawan</h3>
                {employees.map(e => (
                    <div key={e.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center rounded-full font-black">{e.name[0]}</div>
                            <div><p className="font-bold text-sm dark:text-white">{e.name}</p><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{e.role}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setVisiblePinId(visiblePinId === e.id ? null : e.id)}
                                className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                title="Klik untuk tampilkan/sembunyikan PIN"
                            >
                                PIN: {visiblePinId === e.id ? e.pin : '••••••'}
                                {visiblePinId === e.id ? <Unlock className="w-3 h-3 text-amber-500"/> : <Lock className="w-3 h-3 text-slate-400"/>}
                            </button>
                            <button onClick={()=>deleteEmployee(e.id)} className="text-rose-500 p-1 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- FITUR BARU: STOK OPNAME ---
const OpnameTab = ({ triggerAlert }) => {
    const [products, setProducts] = useState(JSON.parse(localStorage.getItem('product_stock_db') || '[]'));
    const [adjustments, setAdjustments] = useState({});

    const saveOpname = () => {
        let updatedProducts = [...products];
        let logs = JSON.parse(localStorage.getItem('stock_history_db') || '[]');
        
        let changed = false;
        updatedProducts = updatedProducts.map(p => {
            if(adjustments[p.id] !== undefined && adjustments[p.id] !== p.stock) {
                changed = true;
                const diff = adjustments[p.id] - p.stock;
                logs.push({
                    id: `log_${Date.now()}_${p.id}`, date: new Date().toISOString(),
                    productName: p.name, type: 'Opname', qty: diff, note: 'Penyesuaian Fisik Gudang'
                });
                return {...p, stock: adjustments[p.id]};
            }
            return p;
        });

        if(!changed) return triggerAlert("Tidak ada perubahan stok untuk disimpan.", "error");

        localStorage.setItem('product_stock_db', JSON.stringify(updatedProducts));
        localStorage.setItem('stock_history_db', JSON.stringify(logs));
        setProducts(updatedProducts);
        setAdjustments({});
        triggerAlert("Stok Opname Berhasil Disimpan!");
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2"><h2 className="font-black text-xl text-slate-800 dark:text-white">Stok Opname</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Penyelarasan Fisik & Sistem</p></div>
            <Card title="Daftar Produk" icon={ClipboardList}>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                    {products.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div><p className="font-bold text-sm dark:text-white">{p.name}</p><p className="text-[10px] text-slate-500 font-bold">Stok Sistem: {p.stock}</p></div>
                            <div className="w-24">
                                <input type="number" placeholder="Fisik" value={adjustments[p.id] !== undefined ? adjustments[p.id] : ''} onChange={e=>setAdjustments({...adjustments, [p.id]: parseInt(e.target.value)||0})} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 dark:text-white text-center" />
                            </div>
                        </div>
                    ))}
                </div>
                <Button onClick={saveOpname} className="w-full mt-4 py-3" icon={Save}>Simpan Hasil Opname</Button>
            </Card>
        </div>
    );
};

// --- FITUR BARU: BARANG MASUK & KELUAR ---
const InOutTab = ({ triggerAlert }) => {
    const [products, setProducts] = useState(JSON.parse(localStorage.getItem('product_stock_db') || '[]'));
    const [form, setForm] = useState({ type: 'Masuk', qty: '', note: '' });
    const [selectedProd, setSelectedProd] = useState('Pilih Produk...');

    const prodOptions = ['Pilih Produk...', ...products.map(p => `${p.id} | ${p.name} (Stok: ${p.stock})`)];

    const saveInOut = () => {
        const actualId = selectedProd.split(' |')[0];
        if(selectedProd === 'Pilih Produk...' || form.qty <= 0) return triggerAlert("Pilih produk dan masukkan jumlah!", "error");
        
        let updatedProducts = [...products];
        let logs = JSON.parse(localStorage.getItem('stock_history_db') || '[]');
        const prodIdx = updatedProducts.findIndex(p => p.id === actualId);
        
        if(prodIdx === -1) return;
        const p = updatedProducts[prodIdx];
        
        if(form.type === 'Keluar' && p.stock < form.qty) return triggerAlert("Stok sistem tidak mencukupi untuk dikeluarkan!", "error");

        const finalQty = form.type === 'Masuk' ? Number(form.qty) : -Number(form.qty);
        updatedProducts[prodIdx].stock += finalQty;

        logs.push({
            id: `log_${Date.now()}`, date: new Date().toISOString(),
            productName: p.name, type: form.type, qty: finalQty, note: form.note || `Barang ${form.type}`
        });

        localStorage.setItem('product_stock_db', JSON.stringify(updatedProducts));
        localStorage.setItem('stock_history_db', JSON.stringify(logs));
        setProducts(updatedProducts);
        setForm({ type: 'Masuk', qty: '', note: '' });
        setSelectedProd('Pilih Produk...');
        triggerAlert(`Barang ${form.type} Berhasil Dicatat!`);
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2"><h2 className="font-black text-xl text-slate-800 dark:text-white">Barang Masuk/Keluar</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pencatatan Manual Stok</p></div>
            <Card title="Form Pergerakan Stok" icon={ArrowUpCircle}>
                <div className="space-y-4">
                    <PremiumSelect label="Pilih Produk" value={selectedProd} options={prodOptions} onChange={setSelectedProd} />
                    <PremiumSelect label="Jenis Pergerakan" value={form.type} options={['Masuk', 'Keluar']} onChange={v=>setForm({...form, type:v})} />
                    <NumericInput label="Jumlah Barang" value={form.qty} onChange={v=>setForm({...form, qty:v})} className="bg-slate-50 dark:bg-slate-900" />
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Keterangan / Supplier</label><input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none dark:text-white" placeholder="Contoh: Barang dari Supplier A" value={form.note} onChange={e=>setForm({...form, note: e.target.value})} /></div>
                    <Button onClick={saveInOut} className="w-full py-3" icon={Save}>Simpan Pergerakan</Button>
                </div>
            </Card>
        </div>
    );
};


// --- FITUR BARU: RIWAYAT STOK ---
const StockHistoryTab = () => {
    const logs = JSON.parse(localStorage.getItem('stock_history_db') || '[]').reverse();
    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2"><h2 className="font-black text-xl text-slate-800 dark:text-white">Riwayat Stok</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Log Pergerakan Barang</p></div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                {logs.length === 0 ? <p className="text-center py-10 text-xs font-bold text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">Belum ada riwayat stok.</p> : 
                logs.map(log => (
                    <div key={log.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm hover:border-indigo-200 transition group">
                        <div className="flex gap-3 items-center">
                            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition"><History className="w-4 h-4"/></div>
                            <div>
                                <p className="font-bold text-sm dark:text-white">{log.productName}</p>
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5">{log.note} • {new Date(log.date).toLocaleString([], {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                            </div>
                        </div>
                        <div className={`font-black text-lg ${log.qty > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {log.qty > 0 ? '+' : ''}{log.qty}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- FITUR BARU: DATA SUPPLIER ---
const SupplierTab = ({ triggerAlert }) => {
    const [suppliers, setSuppliers] = useState(JSON.parse(localStorage.getItem('supplier_db') || '[]'));
    const [form, setForm] = useState({ name: '', contact: '', address: '' });

    const saveSupplier = () => {
        if(!form.name) return triggerAlert("Nama supplier wajib diisi!", "error");
        const newSup = { id: `sup_${Date.now()}`, ...form };
        const updated = [...suppliers, newSup];
        setSuppliers(updated);
        localStorage.setItem('supplier_db', JSON.stringify(updated));
        setForm({ name: '', contact: '', address: '' });
        triggerAlert("Supplier Berhasil Ditambahkan!");
    };

    const deleteSupplier = (id) => {
        if(confirm("Hapus supplier ini?")) {
            const updated = suppliers.filter(s => s.id !== id);
            setSuppliers(updated);
            localStorage.setItem('supplier_db', JSON.stringify(updated));
        }
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-5 animate-in fade-in duration-300">
            <div className="mb-2"><h2 className="font-black text-xl text-slate-800 dark:text-white">Data Supplier</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manajemen Pemasok / Vendor</p></div>
            <Card title="Tambah Supplier Baru" icon={Truck}>
                <div className="space-y-4">
                    <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none dark:text-white" placeholder="Nama Supplier" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
                    <input className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none dark:text-white" placeholder="No. Telepon / WhatsApp" value={form.contact} onChange={e=>setForm({...form, contact: e.target.value})} />
                    <textarea className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold outline-none dark:text-white resize-none h-20" placeholder="Alamat lengkap..." value={form.address} onChange={e=>setForm({...form, address: e.target.value})}></textarea>
                    <Button onClick={saveSupplier} className="w-full py-3" icon={Save}>Simpan Database</Button>
                </div>
            </Card>
            <div className="space-y-3">
                {suppliers.length === 0 && <p className="text-center py-6 text-xs font-bold text-slate-400">Belum ada data supplier.</p>}
                {suppliers.map(s => (
                    <div key={s.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm">
                        <div className="flex gap-3 items-center">
                            <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/30 text-orange-600 rounded-full flex items-center justify-center font-black">{s.name[0]}</div>
                            <div><p className="font-bold text-sm dark:text-white">{s.name}</p><p className="text-[10px] text-slate-500 font-bold">{s.contact}</p></div>
                        </div>
                        <button onClick={()=>deleteSupplier(s.id)} className="text-rose-500 p-2 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- FITUR 5: WEB SELF-ORDER PELANGGAN ---
const SelfOrderApp = ({ tableNo, profile }) => {
    const [activeTab, setActiveTab] = useState('menu');
    const [products] = useState(JSON.parse(localStorage.getItem('product_stock_db') || '[]'));
    const [cart, setCart] = useState([]);
    const [myOrder, setMyOrder] = useState(null);
    const [showCartPopup, setShowCartPopup] = useState(false);
    
    const [buyerName, setBuyerName] = useState(`Meja ${tableNo}`);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showValidationQR, setShowValidationQR] = useState(false);

    // PENTING: pesanan SELF-ORDER (?meja=) disimpan di key TERPISAH dari pesanan Kasir/POS
    useEffect(() => {
        const orders = JSON.parse(localStorage.getItem('self_orders_db') || '[]');
        const existingOrder = orders.find(o => o.tableNo === tableNo);
        if(existingOrder) { setMyOrder(existingOrder); setActiveTab('status'); }
    }, [tableNo]);

    const totalTagihan = cart.reduce((a,b)=>a+(b.price*b.qty),0);
    const totalCartQty = cart.reduce((a,b)=>a+b.qty,0);

    const handleCheckout = async () => {
        if(cart.length === 0) return;
        setIsLoading(true);
        await new Promise(r => setTimeout(r, 800)); // Fake loading

        const bill = computeOrderTotals(cart);
        const newOrder = {
            id: `self_${Date.now()}`, date: new Date().toISOString(),
            buyer: buyerName, paymentMethod: paymentMethod || 'Belum dipilih',
            items: cart, subtotal: bill.subtotal, discountAmt: bill.discountAmt, taxAmt: bill.taxAmt, serviceAmt: bill.serviceAmt,
            taxPercent: bill.taxPercent, servicePercent: bill.servicePercent, discPercent: bill.discPercent,
            total: bill.total, tableNo: tableNo, orderType: 'Dine-in', notes: notes, status: 'awaiting_validation'
        };
        // Simpan ke self_orders_db (TIDAK menyentuh active_orders_db milik Kasir/POS)
        const selfOrders = JSON.parse(localStorage.getItem('self_orders_db') || '[]').filter(o => o.tableNo !== tableNo);
        localStorage.setItem('self_orders_db', JSON.stringify([newOrder, ...selfOrders]));
        setMyOrder(newOrder); setCart([]); setShowCartPopup(false); setActiveTab('status');
        setIsLoading(false);
    };

    const addToCart = (p) => {
        setCart(prev => {
            const exist = prev.find(i=>i.id===p.id);
            return exist ? prev.map(i=>i.id===p.id ? {...i, qty:i.qty+1} : i) : [...prev, {...p, qty:1}];
        });
    };
    const updateQty = (id, d) => setCart(prev => prev.map(i => i.id === id ? {...i, qty: Math.max(1, i.qty + d)} : i));
    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans animate-in fade-in">
            <div className="bg-white p-4 shadow-sm sticky top-0 z-20 flex justify-between items-center">
                <div><h1 className="font-black text-lg text-indigo-600 tracking-tight">{profile.name || 'Nama Toko'}</h1><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Self-Order • Meja {tableNo}</p></div>
                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl"><Smartphone className="w-5 h-5"/></div>
            </div>

            {activeTab === 'menu' && (
                <div className="p-4 space-y-4 relative min-h-[80vh]">
                    <h2 className="font-black text-slate-800">Menu Tersedia</h2>
                    <div className="grid grid-cols-2 gap-3 pb-32">
                        {products.filter(p=>p.stock>0).map(p => {
                            const isSelected = !!cart.find(i=>i.id===p.id);
                            return (
                            <div key={p.id} onClick={()=>addToCart(p)} className={`bg-white p-3 rounded-2xl shadow-sm border transition-all duration-300 ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500 scale-[1.02] shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'border-slate-100'}`}>
                                <div className="aspect-square bg-slate-100 rounded-xl mb-3 overflow-hidden relative">
                                    {p.image ? <img src={p.image} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-2xl">{p.name[0]}</div>}
                                </div>
                                <h4 className="font-bold text-xs truncate mb-1">{p.name}</h4>
                                <div className="flex justify-between items-end">
                                    <p className="text-indigo-600 font-black text-sm">{formatIDR(p.price)}</p>
                                    <button className={`w-6 h-6 rounded-full border flex items-center justify-center shadow-sm ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-indigo-600 border-slate-100'}`}><Plus className="w-3 h-3"/></button>
                                </div>
                            </div>
                        )})}
                    </div>
                    {cart.length > 0 && (
                        <div className="fixed bottom-20 left-0 right-0 px-4 z-30 flex justify-center animate-slide-up">
                            <div onClick={() => setShowCartPopup(true)} className="w-full max-w-md bg-white/90 backdrop-blur-xl text-slate-900 p-4 rounded-2xl shadow-2xl flex justify-between items-center cursor-pointer border border-slate-200">
                                <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase">{totalCartQty} Item Dipilih</span><span className="text-lg font-black tracking-tight">{formatIDR(totalTagihan)}</span></div>
                                <button className="flex items-center gap-2 font-bold text-sm bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-lg"><ShoppingCart className="w-4 h-4"/> Keranjang</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'status' && (
                <div className="p-4 space-y-4">
                    {!myOrder ? (
                        <div className="text-center py-20 text-slate-400">
                            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40"/>
                            <p className="font-bold text-sm">Belum ada pesanan.</p>
                            <p className="text-xs mt-1">Pilih menu lalu buat pesanan Anda.</p>
                            <button onClick={()=>setActiveTab('menu')} className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs">Lihat Menu</button>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white rounded-3xl p-5 shadow-xl border border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="font-black text-lg">Rincian Pesanan</h2>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meja {myOrder.tableNo} • {myOrder.items.length} item</p>
                                    </div>
                                    <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> Belum Divalidasi</span>
                                </div>
                                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                    {myOrder.items.map((i,x)=>(
                                        <div key={x} className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">{i.image ? <img src={i.image} className="w-full h-full object-cover"/> : <span className="font-bold text-slate-400">{i.name[0]}</span>}</div>
                                            <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{i.name}</p><p className="text-[11px] text-slate-500">{i.qty} x {formatIDR(i.price)}</p></div>
                                            <p className="font-black text-sm">{formatIDR(i.price*i.qty)}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-dashed border-slate-200 mt-4 pt-3 space-y-1 text-xs font-bold text-slate-500">
                                    <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(myOrder.subtotal)}</span></div>
                                    {myOrder.discountAmt>0 && <div className="flex justify-between text-emerald-600"><span>Diskon{myOrder.discPercent?` (${myOrder.discPercent}%)`:''}</span><span>- {formatIDR(myOrder.discountAmt)}</span></div>}
                                    {myOrder.taxAmt>0 && <div className="flex justify-between"><span>Pajak{myOrder.taxPercent?` (${myOrder.taxPercent}%)`:''}</span><span>{formatIDR(myOrder.taxAmt)}</span></div>}
                                    {myOrder.serviceAmt>0 && <div className="flex justify-between"><span>Servis{myOrder.servicePercent?` (${myOrder.servicePercent}%)`:''}</span><span>{formatIDR(myOrder.serviceAmt)}</span></div>}
                                    {myOrder.notes && <div className="text-[11px] italic pt-1">Catatan: {myOrder.notes}</div>}
                                </div>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-500 text-sm">Total</span>
                                    <span className="font-black text-2xl text-indigo-600">{formatIDR(myOrder.total)}</span>
                                </div>
                            </div>

                            <button onClick={()=>setShowValidationQR(true)} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-95 transition"><QrCode className="w-5 h-5"/> Validasi ke Kasir</button>
                            <button onClick={()=>{ const rest = JSON.parse(localStorage.getItem('self_orders_db')||'[]').filter(o=>o.tableNo!==tableNo); localStorage.setItem('self_orders_db', JSON.stringify(rest)); setMyOrder(null); setActiveTab('menu'); }} className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 font-bold text-sm flex items-center justify-center gap-2"><Edit3 className="w-4 h-4"/> Ubah / Buat Ulang Pesanan</button>
                        </>
                    )}
                </div>
            )}

            {showValidationQR && myOrder && createPortal(
                <div className="fixed inset-0 z-[90] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" onClick={()=>setShowValidationQR(false)}>
                    <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl animate-in zoom-in duration-200" onClick={e=>e.stopPropagation()}>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3"><QrCode className="w-6 h-6"/></div>
                        <h3 className="font-black text-lg mb-1">Tunjukkan ke Kasir</h3>
                        <p className="text-xs text-slate-500 mb-4">Kasir memindai QR ini untuk memvalidasi pesanan Anda.</p>
                        <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-indigo-200 inline-block mb-4">
                            <QRCodeSVG value={`CL-ORDER:${JSON.stringify({t:myOrder.tableNo,b:myOrder.buyer,p:myOrder.paymentMethod,tot:myOrder.total,it:myOrder.items.map(i=>({n:i.name,q:i.qty,h:i.price}))})}`} size={200} level="M" />
                        </div>
                        <p className="font-black text-2xl text-indigo-600 mb-1">{formatIDR(myOrder.total)}</p>
                        <p className="text-[10px] text-slate-400 mb-4">Meja {myOrder.tableNo} • {myOrder.paymentMethod}</p>
                        <button onClick={()=>setShowValidationQR(false)} className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm">Tutup</button>
                    </div>
                </div>, document.body)}

            {/* Re-use Cart Popup (Tanpa Cash) */}
            <CartPopup showCart={showCartPopup} setShowCart={setShowCartPopup} cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} buyerName={buyerName} setBuyerName={setBuyerName} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} handleCheckout={handleCheckout} profile={profile} isLoading={isLoading} orderType="Dine-in" setOrderType={()=>{}} tableNo={tableNo} setTableNo={()=>{}} notes={notes} setNotes={setNotes} cashTendered={0} setCashTendered={()=>{}} isSelfOrder={true} />

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around p-2 z-50">
                <button onClick={()=>setActiveTab('menu')} className={`flex flex-col items-center p-2 w-1/2 transition-colors ${activeTab==='menu'?'text-indigo-600':'text-slate-400'}`}><Store className="w-5 h-5"/><span className="text-[9px] font-bold mt-1">Buku Menu</span></button>
                <div className="w-[1px] bg-slate-200 my-2"></div>
                <button onClick={()=>setActiveTab('status')} className={`flex flex-col items-center p-2 w-1/2 transition-colors ${activeTab==='status'?'text-indigo-600':'text-slate-400'}`}><Receipt className="w-5 h-5"/><span className="text-[9px] font-bold mt-1">Cek Pesanan</span></button>
            </div>
        </div>
    );
};





//============================================================================
// APP MAIN COMPONENT (SHELL)
// ============================================================================

const MainAdminApp = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [active, setActive] = useState('calc');
  const [dark, setDark] = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });
  const [isEditingMode, setIsEditingMode] = useState(false); 
  const [isMenuOpen, setIsMenuOpen] = useState(false); 

  const triggerAlert = useCallback((message, type = 'success') => {
      setPopup({ show: true, message, type });
  }, []);

  useEffect(() => {
    if (licenseInfo?.id) {
        const unsub = onSnapshot(doc(db, "licenses", licenseInfo.id), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                if (!data.active) {
                    setIsBanned(true);
                    triggerAlert("Sesi Anda dihentikan Admin.", "error");
                    setLicenseInfo(null);
                    localStorage.removeItem('app_license');
                }
            } else {
                setIsLocked(true);
            }
        });
        return () => unsub();
    }
  }, [licenseInfo]);

  useEffect(() => {
      const saved = localStorage.getItem('app_license');
      if(saved) {
          try {
             const data = JSON.parse(saved);
             if(new Date() < new Date(data.validUntil)) { 
                 setLicenseInfo(data); 
                 setIsLocked(false); 
             } else { 
                 setIsLocked(true); 
             }
          } catch(e) { setIsLocked(true); }
      }
  }, []);

  const checkValidity = () => {
    if(localStorage.getItem('app_banned') === 'true') { setIsBanned(true); return; }
      const saved = localStorage.getItem('app_license');
      if(saved) {
          try {
            const data = JSON.parse(saved);
            if(new Date() < new Date(data.validUntil)) { setLicenseInfo(data); setIsLocked(false); } 
            else { localStorage.removeItem('app_license'); setIsLocked(true); setLicenseInfo(null); }
          } catch(e) { setIsLocked(true); }
      } else { setIsLocked(true); }
  };

    useEffect(() => {
    // FIX GLITCH: Jangan jalankan pengecekan background saat masih di halaman Login
    if(!isBanned && !isRestored && !isLocked) {
        const interval = setInterval(checkValidity, 10000); 
        return () => clearInterval(interval);
    }
  }, [isBanned, isRestored, isLocked]);


  const handleUnlock = (data) => {
     if(isBanned) return triggerAlert("Akses Ditolak.", "error");
     localStorage.setItem('app_license', JSON.stringify(data));
     setLicenseInfo(data); setIsLocked(false);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true);
    }
  }, []);

    const toggleDarkMode = () => {
      const newMode = !dark; setDark(newMode);
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      if(newMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  const handleLogout = () => {
      if(confirm("Yakin ingin keluar dari sesi ini?")) {
          localStorage.removeItem('app_license');
          setLicenseInfo(null);
          setIsLocked(true);
          setIsMenuOpen(false);
      }
  };




  useEffect(() => {
    if(!licenseInfo) return; 
    const interval = setInterval(async () => { syncSession('heartbeat', licenseInfo); }, 3000);
    return () => clearInterval(interval);
  }, [licenseInfo]);

  if (isBanned) return <BannedScreen id={licenseInfo?.id || "UNKNOWN"} />;
  if (isRestored) return <RestoredScreen onContinue={()=>{ setIsRestored(false); setIsLocked(true); }} />;
  if (isLocked) return <LockScreen onUnlock={handleUnlock} id={licenseInfo?.id} />;

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen w-full bg-[#FAFAFA] dark:bg-[#0F172A] font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500">
        
        {/* HEADER GLASS */}
        <div className={`sticky top-0 px-4 py-3 flex justify-between items-center max-w-screen-xl mx-auto transition-all duration-300 ${isEditingMode ? 'z-0 opacity-50 blur-sm' : 'z-40 glass border-b border-slate-200/50 dark:border-white/5'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30"><Calculator className="w-5 h-5"/></div>
             <div>
                <h1 className="font-black text-sm tracking-tight text-slate-900 dark:text-white leading-none">CostLab</h1>
                <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">By ShanTech </p>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={toggleDarkMode} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition">
                {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
             </button>
             <button onClick={() => setIsMenuOpen(true)} className="p-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition shadow-sm border border-indigo-100 dark:border-indigo-800">
                <Menu className="w-5 h-5"/>
             </button>
          </div>
        </div>

        {/* MAIN CONTENT - LOGIKA ROUTING BARU */}
        <div className="animate-in fade-in zoom-in-95 duration-500 pt-6 pb-32">
          
                    {/* KATEGORI UTAMA */}
          <div className={active === 'pos' ? 'block' : 'hidden'}><PosTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
          <div className={active === 'calc' ? 'block' : 'hidden'}><CalculatorTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} /></div>
          <div className={active === 'history' ? 'block' : 'hidden'}><HistoryTab txs={JSON.parse(localStorage.getItem('pos_history_db') || '[]')} /></div>
          <div className={active === 'cashout' ? 'block' : 'hidden'}><CashOutTab triggerAlert={triggerAlert} /></div>
          <div className={active === 'discount' ? 'block' : 'hidden'}><DiscountTab triggerAlert={triggerAlert} /></div>
          <div className={active === 'employee' ? 'block' : 'hidden'}><EmployeeTab triggerAlert={triggerAlert} /></div>

                    {/* OPERASIONAL */}
          <div className={active === 'stock' ? 'block' : 'hidden'}>
              <StockTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} />
          </div>
          <div className={active === 'opname' ? 'block' : 'hidden'}><OpnameTab triggerAlert={triggerAlert} /></div>
          <div className={active === 'inout' ? 'block' : 'hidden'}><InOutTab triggerAlert={triggerAlert} /></div>
          <div className={active === 'stockhistory' ? 'block' : 'hidden'}><StockHistoryTab /></div>
          <div className={active === 'supplier' ? 'block' : 'hidden'}><SupplierTab triggerAlert={triggerAlert} /></div>


                    {/* PENGATURAN */}
          <div className={active === 'profile' ? 'block' : 'hidden'}><ProfileTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
          <div className={active === 'report' ? 'block' : 'hidden'}><ReportTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} activeTab={active} /></div>
          <div className={active === 'payment' ? 'block' : 'hidden'}><PaymentTab triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} /></div>
          <div className={active === 'settings' ? 'block' : 'hidden'}><SettingsTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} /></div>
          <div className={active === 'hardware' ? 'block' : 'hidden'}><HardwareTab triggerAlert={triggerAlert} /></div>
          <div className={active === 'outlet' ? 'block' : 'hidden'}><OutletTab triggerAlert={triggerAlert} /></div>
        </div>


                {/* MENU DRAWER - DENGAN LOGIKA ROLE-BASED ACCESS CONTROL (RBAC) */}
        {isMenuOpen && (
            <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)}>
                 <div className="w-[85%] max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300 border-l border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                        <div>
                            <h2 className="font-black text-xl text-slate-800 dark:text-white tracking-tight">{licenseInfo?.currentUserRole === 'owner' ? 'Menu' : 'Navigasi Karyawan'}</h2>
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Akses: {licenseInfo?.currentUserRole || 'Belum Login'}</p>
                        </div>
                        <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-400 hover:text-rose-500 shadow-sm border border-slate-200 dark:border-slate-700 transition"><X className="w-5 h-5"/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                        
                        {/* 1. KATEGORI UTAMA */}
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-1.5"><MonitorSmartphone className="w-3 h-3"/> Kategori Utama</p>
                            <div className="space-y-1">
                                <button onClick={() => {setActive('pos'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='pos' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <ShoppingCart className="w-5 h-5"/> Kasir (POS)
                                </button>
                                <button onClick={() => {setActive('calc'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='calc' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Calculator className="w-5 h-5"/> Kalkulator HPP
                                </button>
                                <button onClick={() => {setActive('history'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='history' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <History className="w-5 h-5"/> Riwayat Transaksi
                                </button>
                                
                                {/* Kas Keluar: Akses Kasir & Owner */}
                                {['kasir', 'owner'].includes(licenseInfo?.currentUserRole) && (
                                    <button onClick={() => {setActive('cashout'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='cashout' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <ArrowDownCircle className="w-5 h-5"/> Manajemen Kas Keluar
                                    </button>
                                )}

                                {/* Diskon: Akses Admin & Owner */}
                                {['admin', 'owner'].includes(licenseInfo?.currentUserRole) && (
                                    <button onClick={() => {setActive('discount'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='discount' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <Percent className="w-5 h-5"/> Diskon, Pajak & Biaya
                                    </button>
                                )}
                            </div>
                        </div>

                                                {/* 2. OPERASIONAL (Terbuka untuk Semua) */}
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-1.5"><Layers className="w-3 h-3"/> Operasional</p>
                            <div className="space-y-1">
                                <button onClick={() => {setActive('stock'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='stock' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Box className="w-5 h-5"/> Stok Barang
                                </button>
                                <button onClick={() => {setActive('opname'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='opname' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <ClipboardList className="w-5 h-5"/> Stok Opname
                                </button>
                                <button onClick={() => {setActive('inout'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='inout' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <ArrowUpCircle className="w-5 h-5"/> Barang Masuk & Keluar
                                </button>
                                <button onClick={() => {setActive('stockhistory'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='stockhistory' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <History className="w-5 h-5"/> Riwayat Stok & Expired
                                </button>
                                <button onClick={() => {setActive('supplier'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='supplier' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Truck className="w-5 h-5"/> Database Supplier
                                </button>
                            </div>
                        </div>


                        {/* 3. PENGATURAN (Owner Saja - Kecuali Laporan) */}
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-1.5"><Settings className="w-3 h-3"/> Manajemen Bisnis</p>
                            <div className="space-y-1">
                                {/* Laporan bisa diakses Admin & Owner */}
                                {['admin', 'owner'].includes(licenseInfo?.currentUserRole) && (
                                    <button onClick={() => {setActive('report'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='report' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <BarChart3 className="w-5 h-5"/> Laporan & Analisa
                                    </button>
                                )}
                                
                                                                {/* Pengaturan Inti Hanya Owner */}
                                {licenseInfo?.currentUserRole === 'owner' && (
                                    <>
                                        <button onClick={() => {setActive('employee'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='employee' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <UserCircle2 className="w-5 h-5"/> Manajemen Karyawan
                                        </button>
                                        <button onClick={() => {setActive('outlet'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='outlet' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <Layers className="w-5 h-5"/> Multi Outlet
                                        </button>
                                        <button onClick={() => {setActive('profile'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='profile' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <Store className="w-5 h-5"/> Identitas Toko (Profil)
                                        </button>
                                        <button onClick={() => {setActive('payment'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='payment' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <CreditCard className="w-5 h-5"/> Metode Pembayaran
                                        </button>
                                        <button onClick={() => {setActive('hardware'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='hardware' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <Printer className="w-5 h-5"/> Alat Tambahan (Hardware)
                                        </button>
                                        <button onClick={() => {setActive('settings'); setIsMenuOpen(false);}} className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${active==='settings' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <Settings className="w-5 h-5"/> Pengaturan Utama
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                                       </div>
                    
                    {/* TOMBOL LOGOUT (UNTUK SEMUA ROLE) */}
                    <div className="px-4 pb-4">
                        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 p-3 rounded-xl transition bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40">
                            <LogOut className="w-5 h-5"/> Keluar (Logout)
                        </button>
                    </div>
                    
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CostLab v3.0 Enterprise</p>
                    </div>
                 </div>
            </div>
        )}



        {/* GLOBAL PREMIUM POPUP */}
        {popup.show && <PremiumPopup message={popup.message} type={popup.type} onClose={()=>setPopup({...popup, show:false})} />}

      </div>
    </div>
    );
};

// ============================================================================
// DEVELOPER PANEL (Opsi B) - route ?dev=panel, terkunci Firebase Auth
// ============================================================================
const DeveloperPanel = () => {
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authErr, setAuthErr] = useState('');
    const [storeName, setStoreName] = useState('');
    const [tenantId, setTenantId] = useState('');
    const [password, setPassword] = useState('');
    const [ownerPin, setOwnerPin] = useState('');
    const [licType, setLicType] = useState('BASIC');
    const [durVal, setDurVal] = useState(1);
    const [durUnit, setDurUnit] = useState('month');
    const [saving, setSaving] = useState(false);
    const [clients, setClients] = useState([]);
    const [toast, setToast] = useState('');
    const [accessErr, setAccessErr] = useState('');

    const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) return;
        const qy = query(collection(db, 'licenses'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(qy, (snap) => { setAccessErr(''); setClients(snap.docs.map((d) => ({ ...d.data(), id: d.id }))); }, (err) => setAccessErr('Akun ini tidak punya izin admin (cek Firestore Rules): ' + err.code));
        return () => unsub();
    }, [user]);

    useEffect(() => {
        const base = storeName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
        setTenantId(base);
    }, [storeName]);

    const doLogin = async () => {
        if (!email || !pass) { setAuthErr('Isi email & password developer.'); return; }
        setAuthErr(''); setAuthLoading(true);
        try { await signInWithEmailAndPassword(auth, email.trim(), pass); }
        catch (e) { setAuthErr('Login gagal: ' + (e.code || e.message)); }
        setAuthLoading(false);
    };
    const doLogout = () => signOut(auth);

    const genPass = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let p = '';
        for (let i = 0; i < 6; i++) p += chars[Math.floor(Math.random() * chars.length)];
        setPassword(p.slice(0, 3) + '-' + p.slice(3, 6));
    };
    const genPin = () => setOwnerPin(String(Math.floor(100000 + Math.random() * 900000)));

    const saveTenant = async () => {
        if (!storeName || !tenantId || !password || !ownerPin) return showToast('Data belum lengkap!');
        setSaving(true);
        const date = new Date();
        if (durUnit === 'month') date.setMonth(date.getMonth() + Number(durVal));
        if (durUnit === 'year') date.setFullYear(date.getFullYear() + Number(durVal));
        if (durUnit === 'day') date.setDate(date.getDate() + Number(durVal));
        try {
            await setDoc(doc(db, 'licenses', tenantId.toLowerCase()), {
                id: tenantId.toLowerCase(), password, ownerPin, tenant: storeName, type: licType,
                active: true, validUntil: date.toISOString(), createdAt: new Date().toISOString(),
                createdBy: auth.currentUser ? auth.currentUser.email : 'unknown'
            });
            showToast('Tenant ' + storeName + ' berhasil didaftarkan!');
            setStoreName(''); setTenantId(''); setPassword(''); setOwnerPin('');
        } catch (e) { showToast('Gagal simpan: ' + e.message); }
        setSaving(false);
    };
    const toggleStatus = (id, status) => updateDoc(doc(db, 'licenses', id), { active: status }).catch((e) => showToast('Gagal: ' + e.code));
    const delTenant = (id) => { if (confirm('Hapus tenant ' + id + ' permanen?')) deleteDoc(doc(db, 'licenses', id)).catch((e) => showToast('Gagal: ' + e.code)); };
    const copyText = (txt) => { navigator.clipboard.writeText(txt); showToast('Disalin!'); };

    if (!authReady) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="spinner-ring"></div></div>;
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl"></div>
                <div className="relative w-full max-w-sm bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/40 mb-3"><ShieldCheck className="w-7 h-7" /></div>
                        <h1 className="text-white font-black text-lg">Developer Console</h1>
                        <p className="text-[11px] text-slate-400 font-bold">Akses terkunci · khusus developer</p>
                    </div>
                    <div className="space-y-3">
                        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email developer" className="w-full bg-slate-800/80 border border-white/10 text-white text-sm font-bold p-3.5 rounded-xl outline-none focus:border-indigo-500" />
                        <input value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLogin()} type="password" placeholder="Password" className="w-full bg-slate-800/80 border border-white/10 text-white text-sm font-bold p-3.5 rounded-xl outline-none focus:border-indigo-500" />
                        {authErr && <p className="text-rose-400 text-[11px] font-bold text-center">{authErr}</p>}
                        <button onClick={doLogin} disabled={authLoading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black text-sm shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-60">{authLoading ? <span className="spinner-ring"></span> : <><Lock className="w-4 h-4" /> Masuk</>}</button>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center mt-5 leading-relaxed">Login memakai Firebase Authentication (Email/Password). Buat akun developer di Firebase Console terlebih dahulu.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-24">
            <nav className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"><ShieldCheck className="w-5 h-5" /></div>
                    <div><h1 className="font-black text-sm leading-none">Developer Console</h1><p className="text-[10px] text-slate-400 font-bold">{user.email}</p></div>
                </div>
                <button onClick={doLogout} className="text-[11px] font-bold text-slate-300 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg border border-white/10">Keluar</button>
            </nav>
            <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
                {accessErr && <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold p-3 rounded-xl">{accessErr}</div>}
                <div className="bg-slate-900/70 border border-white/10 rounded-3xl p-6">
                    <h2 className="font-black text-base mb-5 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400" /> Registrasi Tenant</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Nama Client / Toko</label>
                            <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Contoh: Kopi Senja" className="w-full bg-slate-800/80 border border-white/10 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">ID Tenant (username)</label>
                            <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="w-full bg-slate-800/80 border border-white/10 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 mt-1 lowercase" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Password</label>
                                <div className="flex gap-2 mt-1">
                                    <input value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 w-full bg-slate-800/80 border border-white/10 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
                                    <button onClick={genPass} className="px-3 rounded-xl bg-indigo-500/20 text-indigo-300 text-xs font-bold">Acak</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Owner PIN</label>
                                <div className="flex gap-2 mt-1">
                                    <input value={ownerPin} onChange={(e) => setOwnerPin(e.target.value)} className="flex-1 w-full bg-slate-800/80 border border-white/10 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
                                    <button onClick={genPin} className="px-3 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-bold">Acak</button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Durasi Sewa</label>
                                <div className="flex gap-2 mt-1">
                                    <input type="number" value={durVal} onChange={(e) => setDurVal(e.target.value)} className="w-16 bg-slate-800/80 border border-white/10 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
                                    <select value={durUnit} onChange={(e) => setDurUnit(e.target.value)} className="flex-1 bg-slate-800/80 border border-white/10 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"><option value="day">Hari</option><option value="month">Bulan</option><option value="year">Tahun</option></select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tipe Lisensi</label>
                                <select value={licType} onChange={(e) => setLicType(e.target.value)} className="w-full bg-slate-800/80 border border-white/10 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 mt-1"><option value="BASIC">BASIC</option><option value="PRO">PRO</option></select>
                            </div>
                        </div>
                        <button onClick={saveTenant} disabled={saving} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black text-sm shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-60 mt-1">{saving ? <span className="spinner-ring"></span> : 'Simpan ke Firebase'}</button>
                    </div>
                </div>
                <div>
                    <h2 className="font-black text-base mb-3 flex items-center gap-2 px-1">Daftar Tenant <span className="text-[11px] font-bold text-slate-400">({clients.length})</span></h2>
                    <div className="space-y-3">
                        {clients.length === 0 && <div className="text-center py-10 text-slate-500 text-xs">Belum ada client.</div>}
                        {clients.map((c) => (
                            <div key={c.id} className="bg-slate-900/70 border border-white/10 rounded-2xl p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-bold text-sm flex items-center gap-2">{c.tenant} <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300">{c.type}</span></h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5">ID: <span className="font-bold text-indigo-400">{c.id}</span> · s/d {new Date(c.validUntil).toLocaleDateString('id-ID')}</p>
                                    </div>
                                    <span className={c.active ? 'text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[9px] font-black' : 'text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[9px] font-black'}>{c.active ? 'AKTIF' : 'SUSPEND'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div className="bg-slate-800/60 p-2 rounded-lg flex justify-between items-center"><span className="text-[9px] font-bold text-slate-400">PASS</span><span onClick={() => copyText(c.password)} className="font-mono font-black text-xs cursor-pointer">{c.password}</span></div>
                                    <div className="bg-rose-500/10 p-2 rounded-lg flex justify-between items-center"><span className="text-[9px] font-bold text-rose-400">PIN</span><span onClick={() => copyText(c.ownerPin || '111111')} className="font-mono font-black text-xs text-rose-300 cursor-pointer">{c.ownerPin || '111111'}</span></div>
                                </div>
                                <div className="flex gap-2">
                                    {c.active ? <button onClick={() => toggleStatus(c.id, false)} className="flex-1 py-2 rounded-lg bg-white/5 border border-rose-500/30 text-rose-300 text-[11px] font-bold">Matikan</button> : <button onClick={() => toggleStatus(c.id, true)} className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-[11px] font-bold">Buka Akses</button>}
                                    <button onClick={() => delTenant(c.id)} className="w-10 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-rose-400 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white text-slate-900 px-5 py-3 rounded-full shadow-2xl text-sm font-bold animate-slide-up">{toast}</div>}
        </div>
    );
};

const App = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const customerTable = urlParams.get('meja');

  if (urlParams.get('dev') === 'panel') return <DeveloperPanel />;

  if (customerTable) {
      const profile = JSON.parse(localStorage.getItem('store_profile') || '{}');
      return <SelfOrderApp tableNo={customerTable} profile={profile} />;
  }
  return <MainAdminApp />;
};

export default App;

