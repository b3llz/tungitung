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
  QrCode, Banknote, Coins, CreditCard as CardIcon, 
  UserCircle2, Wallet2, FileText, ChevronDown, ChevronUp,
  Minimize2, Maximize2
} from 'lucide-react';

// --- IMPORT LIBRARY ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, increment, runTransaction, onSnapshot, addDoc } from "firebase/firestore";
import currency from "currency.js";
import Cropper from "react-easy-crop";

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
const BRANCH_ID = "PUSAT";

// Helper & Config
const money = (val) => currency(val, { symbol: '', decimal: ',', separator: '.', precision: 0 });
const LOG_API_URL = "https://script.google.com/macros/s/AKfycbx60xl2xjJCJGjo5MMCdE8tAALzVTY0Z0RoLmwFsm2UndwXRwZ_5wq85usR9ANWcq4dZg/exec"; 
const SESSION_TOKEN = `sess_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
const isPro = (info) => info && (info.type === 'PRO' || info.type === 'PREMIUM');
const BLACKLIST_URL = "https://gist.githubusercontent.com/b3llz/07d95837ff27524b875990b5bd3bbe83/raw/blocklist.json"; 
const SECRET_KEY = "RAHASIA_DAPUR_123"; 

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
      <div className="w-full max-w-md bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col h-[80vh] relative">
          <div className="absolute top-4 right-4 z-20">
              <button onClick={onClose} className="bg-black/50 text-white p-2 rounded-full hover:bg-red-500/80 transition"><X className="w-5 h-5"/></button>
          </div>
          <div className="relative flex-1 bg-neutral-900 touch-none">
            <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)} onZoomChange={setZoom} showGrid={false} />
          </div>
          <div className="p-6 bg-slate-900 border-t border-white/10 space-y-5">
            <div>
                <div className="flex justify-between text-white text-[10px] font-bold uppercase tracking-wider mb-2"><span>Zoom Level</span><span>{zoom.toFixed(1)}x</span></div>
                <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"/>
            </div>
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
const SmartPlannerModal = ({ materials, onClose }) => {
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
                        const totalNeed = (m.usage * target);
                        const packsToBuy = Math.ceil(totalNeed / m.content); 
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
  const removeRow = (setter, list, id) => list.length > 1 && setter(list.filter(i => i.id !== id));
  
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
  const getTier = (margin) => { const raw = hppBersih + (hppBersih * (margin/100));
  return { raw, final: round(raw), profit: round(raw) - hppBersih }; };
  const tiers = [
    { name: "INFOKAN SAINGAN", label: "kompetitif", desc: "Penetrasi pasar", margin: 22.8, color: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: Shield },
    { name: "MASUK AKAL", label: "standar", desc: "Margin umum", margin: 48.6, color: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: Layers },
    { name: "CEPAT NAIK HAJI", label: "premium", desc: "Niche market", margin: 78.4, color: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", icon: Crown }
  ];
  const finalPrice = getTier(customMargin).final;
  const profitPerPcs = finalPrice - hppBersih;
  const targetPcsMonth = profitPerPcs > 0 ? Math.ceil(targetProfit / profitPerPcs) : 0;
  const targetPcsDay = Math.ceil(targetPcsMonth / 30);
  const projOmzetMonth = targetPcsMonth * finalPrice;
  const projProdCostMonth = targetPcsMonth * (matPerUnit + varPerUnit);
  const projFixedCostMonth = showFixed ? totalFix : 0;
  const projNetProfitMonth = projOmzetMonth - projProdCostMonth - projFixedCostMonth;

  useEffect(() => { setSavedRecipes(JSON.parse(localStorage.getItem('hpp_pro_db') || '[]')); }, []);
  
  const save = () => {
    if(!product.name) return triggerAlert("Isi nama produk dulu!", "error");
    if (!isPro(licenseInfo) && savedRecipes.length >= 5) {
        return triggerAlert("Upgrade ke PRO untuk simpan > 5 resep!", "error");
    }
    
    // 1. SIMPAN RESEP
    const data = { id: Date.now(), product, materials, variableOps, fixedOps, production, hppBersih, finalPrice };
    setSavedRecipes(prev => { const n = [...prev, data]; localStorage.setItem('hpp_pro_db', JSON.stringify(n)); return n; });

    // 2. UPDATE STOK PRODUK & BAHAN
    const currentProducts = JSON.parse(localStorage.getItem('product_stock_db') || '[]');
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

    const currentRawMaterials = JSON.parse(localStorage.getItem('raw_material_db') || '[]');
    let updatedRawMaterials = [...currentRawMaterials];

    materials.forEach(mat => {
        if(!mat.name) return;
        const matIdx = updatedRawMaterials.findIndex(m => m.name.toLowerCase() === mat.name.toLowerCase());
        if (matIdx >= 0) { updatedRawMaterials[matIdx].lastPrice = mat.price; } 
        else {
            updatedRawMaterials.push({
                id: `rm_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                name: mat.name, unit: mat.unit, stock: 0, lastPrice: mat.price, category: 'Bahan Baku'
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
    <div className="space-y-4 pb-32 w-full px-2 sm:px-4 md:max-w-xl mx-auto">
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
                  <button onClick={()=>removeRow(setMaterials,materials,m.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-300 hover:text-red-500 shadow-sm"><Trash2 className="w-3 h-3"/></button>
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
                    <button onClick={()=>removeRow(setVariableOps,variableOps,op.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-300 hover:text-red-500 shadow-sm"><Trash2 className="w-3 h-3"/></button>
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
                  <button onClick={()=>removeRow(setFixedOps,fixedOps,op.id)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
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

      {showPlanner && <SmartPlannerModal materials={materials} onClose={()=>setShowPlanner(false)} />}

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
// 3. TAB: PROFILE TOKO (FIXED LAYOUT & Z-INDEX)
// ============================================================================

const ProfileTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
  const [profile, setProfile] = useState({ name: '', address: '', wa: '', logo: null, adminName: '', payment: { qris: null, ewallets: [], bank: [] } });
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  
  // State UI
  const [activeSec, setActiveSec] = useState('info'); 
  const [showAdd, setShowAdd] = useState(false);
  const [showRawMat, setShowRawMat] = useState(false); 
  const [cropSrc, setCropSrc] = useState(null); 
  
  // State Form Baru
  const [newProd, setNewProd] = useState({ name: '', price: 0, stock: 0, type: 'Makanan', image: null });
  const [newWallet, setNewWallet] = useState({ type: 'Gopay', number: '' });
  const [newBank, setNewBank] = useState({ bank: '', number: '' });

  // --- AUTO REFRESH: Cek Stok Terbaru Saat Tab Dibuka ---
  useEffect(() => {
    if (activeTab === 'profile') {
        const savedProd = localStorage.getItem('product_stock_db');
        if (savedProd) setProducts(JSON.parse(savedProd));
        
        const savedRaw = localStorage.getItem('raw_material_db');
        if (savedRaw) setRawMaterials(JSON.parse(savedRaw));
    }
  }, [activeTab]);


  // Load Data
  useEffect(() => {
    const saved = localStorage.getItem('store_profile');
    if (saved) setProfile(JSON.parse(saved));
    const savedProd = localStorage.getItem('product_stock_db');
    if (savedProd) setProducts(JSON.parse(savedProd));
    const savedRaw = localStorage.getItem('raw_material_db');
    if (savedRaw) setRawMaterials(JSON.parse(savedRaw));
  }, []);

  // LOGIC: Sembunyikan Navbar saat mode Crop aktif
  useEffect(() => {
      if(cropSrc || showAdd) setEditingMode(true);
      else setEditingMode(false);
  }, [cropSrc, showAdd, setEditingMode]);

  const saveProfile = (newP) => { setProfile(newP); localStorage.setItem('store_profile', JSON.stringify(newP)); };
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

  const addWallet = () => {
    if(!newWallet.number) return triggerAlert("Nomor E-Wallet wajib diisi", "error");
    saveProfile({...profile, payment: {...profile.payment, ewallets: [...profile.payment.ewallets, newWallet]}});
    setNewWallet({type: 'Gopay', number: ''});
  };
  
  const addBank = () => {
    if(!newBank.number) return triggerAlert("Nomor Rekening wajib diisi", "error");
    saveProfile({...profile, payment: {...profile.payment, bank: [...profile.payment.bank, newBank]}});
    setNewBank({bank: '', number: ''});
  };

  const convertUnit = (val, from, to) => {
      if(from === to) return val;
      if(from === 'gr' && to === 'kg') return val / 1000;
      if(from === 'kg' && to === 'gr') return val * 1000;
      if(from === 'ml' && to === 'liter') return val / 1000;
      if(from === 'liter' && to === 'ml') return val * 1000;
      return val; 
  };

  return (
    <div className="max-w-xl mx-auto px-4 pb-32 space-y-5">
      {/* Tab Navigasi Profile */}
      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
        {[
            {id:'info', l:'Identitas', i:Store}, 
            {id:'payment', l:'Pembayaran', i:CreditCard}, 
            {id:'stock', l:'Stok Barang', i:Box}
        ].map(t => (
            <button key={t.id} onClick={()=>setActiveSec(t.id)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${activeSec===t.id ? 'bg-slate-800 text-white shadow-md dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <t.i className="w-3.5 h-3.5"/> {t.l}
            </button>
        ))}
      </div>

      {/* --- IDENTITAS TOKO --- */}
      {activeSec === 'info' && (
        <Card title="Informasi Bisnis">
            <div className="space-y-6">
                <div className="flex justify-center pt-2">
                    <div className="relative group cursor-pointer">
                        <div className="w-32 h-32 bg-slate-50 dark:bg-slate-800 rounded-full border-4 border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden flex items-center justify-center group-hover:border-indigo-500 transition-colors">
                            {profile.logo ? <img src={profile.logo} className="w-full h-full object-cover"/> : <Store className="w-12 h-12 text-slate-300"/>}
                        </div>
                        {/* Tombol Edit Floating */}
                        <label className="absolute bottom-1 right-1 bg-indigo-600 text-white p-2.5 rounded-full shadow-lg hover:bg-indigo-500 transition active:scale-90 border-4 border-white dark:border-slate-900 cursor-pointer">
                            <Edit3 className="w-4 h-4"/>
                            <input type="file" className="hidden" accept="image/*" onChange={e => {
                                if(e.target.files[0]) { 
                                    const r = new FileReader(); 
                                    r.onload=v=>setCropSrc(v.target.result); 
                                    r.readAsDataURL(e.target.files[0]); 
                                }
                            }}/>
                        </label>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Nama Bisnis</label>
                        <input className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none focus:border-indigo-500 transition dark:text-white" value={profile.name} onChange={e=>saveProfile({...profile, name:e.target.value})} placeholder="Contoh: Kopi Senja"/>
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
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">Nama Owner/Kasir</label>
                            <input className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm outline-none font-bold dark:text-white" value={profile.adminName} onChange={e=>saveProfile({...profile, adminName:e.target.value})} placeholder="Nama Anda"/>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
      )}

      {/* --- PEMBAYARAN (FIXED LAYOUT) --- */}
      {activeSec === 'payment' && (
        <div className="space-y-4">
            <Card title="QRIS Toko">
                <div className="w-full h-48 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center relative overflow-hidden group hover:border-indigo-400 transition cursor-pointer">
                   {profile.payment.qris ? <img src={profile.payment.qris} className="w-full h-full object-contain p-4"/> : <div className="text-center text-slate-400"><QrCode className="w-10 h-10 mx-auto mb-2 opacity-50"/><p className="text-xs font-bold">Upload QRIS</p></div>}
                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {if(e.target.files[0]) { const r = new FileReader(); r.onload=v=>saveProfile({...profile, payment: {...profile.payment, qris:v.target.result}}); r.readAsDataURL(e.target.files[0]); }}}/>
                </div>
            </Card>
            
            <Card title="Rekening & E-Wallet">
                <div className="space-y-6">
                    {/* E-Wallet Section (Layout Fixed) */}
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
                            {profile.payment.ewallets.map((w,i) => (
                                <div key={i} className="flex items-center gap-2 bg-white dark:bg-slate-900 pl-3 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in">
                                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">{w.type}</span> 
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{w.number}</span>
                                    <button onClick={()=>saveProfile({...profile, payment: {...profile.payment, ewallets: profile.payment.ewallets.filter((_,x)=>x!==i)}})} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bank Section (Layout Fixed) */}
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
                              {profile.payment.bank.map((b,i) => (
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
        </div>
      )}

      {/* --- MANAJEMEN STOK --- */}
      {activeSec === 'stock' && (
        <div className="space-y-4">
             <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl flex mb-6 relative">
                 <button onClick={()=>setShowRawMat(false)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all relative z-10 ${!showRawMat ? 'text-indigo-600 dark:text-white' : 'text-slate-400'}`}>
                    Produk Jadi
                 </button>
                 <button onClick={()=>setShowRawMat(true)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all relative z-10 ${showRawMat ? 'text-indigo-600 dark:text-white' : 'text-slate-400'}`}>
                    Bahan Baku
                 </button>
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
                             
                             <div className="flex gap-4 mt-4">
                                 <div>
                                     <p className="text-[10px] opacity-60 font-bold uppercase">Jenis Bahan</p>
                                     <p className="font-bold">{rawMaterials.length}</p>
                                 </div>
                                 <div>
                                     <p className="text-[10px] opacity-60 font-bold uppercase">Status Gudang</p>
                                     {rawMaterials.length === 0 ? (
                                         <p className="font-bold text-slate-300">Data Kosong</p>
                                     ) : rawMaterials.some(m => (m.stock || 0) <= 0) ? (
                                         <p className="font-bold text-rose-300 animate-pulse flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Stok Habis!</p>
                                     ) : rawMaterials.some(m => (m.stock || 0) < 5) ? (
                                         <p className="font-bold text-amber-300">Menipis</p>
                                     ) : (
                                         <p className="font-bold text-emerald-300 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Aman</p>
                                     )}
                                 </div>
                             </div>
                         </div>
                         <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/5 skew-x-12 -mr-10"></div>
                     </div>

                     <div className="grid grid-cols-1 gap-3">
                         {rawMaterials.length === 0 && <div className="text-center py-10 text-slate-400 text-xs font-bold bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">Simpan resep di menu Kalkulator<br/>untuk mengisi data ini otomatis.</div>}
                         
                         {rawMaterials.map((rm, idx) => {
                             const baseUnit = rm.unit || 'gr';
                             return (
                                 <div key={rm.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                                     <div className="flex justify-between items-start">
                                         <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm">
                                                  {idx+1}
                                              </div>
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
                                         <div className="flex items-center gap-3">
                                             <span className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                                 {rm.stock} <span className="text-xs text-slate-400 font-bold ml-0.5">{baseUnit}</span>
                                             </span>
                                         </div>
                                         <button onClick={()=>{
                                             const add = prompt(`Tambah stok ${rm.name} (satuan basis: ${baseUnit}):`, "0");
                                             if(add) {
                                                 const n = rawMaterials.map(x => x.id===rm.id ? {...x, stock: (x.stock||0) + parseFloat(add)} : x);
                                                 saveRaw(n);
                                             }
                                         }} className="text-xs font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                             + Stok
                                         </button>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 </div>
             )}
        </div>
      )}

      {/* --- MODAL TAMBAH PRODUK --- */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-white/80 dark:bg-black/80 backdrop-blur-md animate-in fade-in">
          <Card className="w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border-slate-200 dark:border-slate-700 ring-1 ring-black/5" title="Tambah Produk Baru">
            <div className="space-y-4">
              <div className="flex justify-center py-2">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center relative overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 group hover:border-indigo-500 transition cursor-pointer">
                  {newProd.image ? <img src={newProd.image} className="w-full h-full object-cover"/> : <div className="text-center text-slate-300"><ImageIcon className="w-8 h-8 mx-auto"/><span className="text-[9px] font-bold">Upload Foto</span></div>}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e=>{if(e.target.files[0]){const r=new FileReader();r.onload=v=>setNewProd({...newProd,image:v.target.result});r.readAsDataURL(e.target.files[0]);}}}/>
                </div>
              </div>

              <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block ml-1">Nama Produk</label>
                  <input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm font-bold focus:border-indigo-500 transition dark:text-white placeholder:text-slate-300" placeholder="Contoh: Kopi Susu Gula Aren" value={newProd.name} onChange={e=>setNewProd({...newProd, name:e.target.value})} />
              </div>

              <div className="flex gap-3">
                   <div className="flex-1">
                       <PremiumSelect label="Kategori" value={newProd.type} options={['Makanan','Minuman','Fashion','Jasa','Lainnya']} onChange={v=>setNewProd({...newProd, type:v})} />
                   </div>
                   <div className="w-28">
                       <NumericInput label="Stok Awal" value={newProd.stock} onChange={v=>setNewProd({...newProd, stock:v})} className="bg-slate-50 dark:bg-slate-900" />
                   </div>
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

      {/* --- CROPPER MODAL (FOR IDENTITAS TOKO) --- */}
      {cropSrc && (
         <ImageCropperModal 
            imageSrc={cropSrc} 
            onCropComplete={(img)=>{ saveProfile({...profile, logo: img}); setCropSrc(null); }} 
            onClose={()=>setCropSrc(null)} 
         />
      )}
    </div>
  );
};


// ============================================================================
// 4. TAB: POS (KASIR) - FIXED COMPLETE VERSION
// ============================================================================

// Mengubah konsep Sidebar menjadi Modal Popup agar tidak tertutup Navbar
const CartPopup = ({ showCart, setShowCart, cart, updateQty, removeFromCart, buyerName, setBuyerName, paymentMethod, setPaymentMethod, handleCheckout, profile }) => {
    
    // Helper untuk ikon pembayaran
    const getPaymentIcon = (type) => {
        if (type === 'Cash') return <Banknote className="w-4 h-4"/>;
        if (type === 'QRIS') return <QrCode className="w-4 h-4"/>;
        return <Wallet className="w-4 h-4"/>;
    };

    if (!showCart) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={()=>setShowCart(false)}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden border border-white/20 ring-1 ring-black/5" onClick={e=>e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
                    <div className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-600"><ShoppingCart className="w-5 h-5"/></div>
                        Keranjang
                    </div>
                    <button onClick={()=>setShowCart(false)} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"><X className="w-5 h-5 text-slate-500"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950/50">
                    {cart.length===0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-60">
                            <ShoppingCart className="w-16 h-16 stroke-1"/>
                            <p className="text-sm font-bold">Keranjang Masih Kosong</p>
                        </div>
                    )}
                    {cart.map(i => (
                        <div key={i.id} className="flex gap-3 items-center bg-white dark:bg-slate-800 p-2 pr-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden shrink-0">
                                {i.image && <img src={i.image} className="w-full h-full object-cover"/>}
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

                <div className="p-5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-20">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><User className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                        <input className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all dark:text-white placeholder:text-slate-400" placeholder="Nama Pembeli" value={buyerName} onChange={e=>setBuyerName(e.target.value)}/>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Metode Pembayaran</p>
                            {paymentMethod && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{paymentMethod}</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 max-h-24 overflow-y-auto pr-1">
                            {['Cash','QRIS', ...(profile.payment?.ewallets?.map(w=>w.type)||[]), ...(profile.payment?.bank?.map(b=>b.bank)||[])].map(m => (
                                <button key={m} onClick={()=>setPaymentMethod(m)} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all duration-200 ${paymentMethod===m ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-200 hover:bg-slate-50'}`}>
                                    {getPaymentIcon(m)}
                                    <span className="text-[9px] font-bold truncate w-full text-center">{m}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-slate-500 text-xs font-bold">Total Tagihan</span>
                            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatIDR(cart.reduce((a,b)=>a+(b.price*b.qty),0))}</span>
                        </div>
                        <button onClick={handleCheckout} disabled={cart.length===0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4"/> Proses Pesanan
                        </button>
                    </div>
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

const PosTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('shop');
  const [buyerName, setBuyerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [profile, setProfile] = useState({});
  const [priceTier, setPriceTier] = useState('retail');

  // --- AUTO REFRESH: Cek Produk Baru Saat Tab Dibuka ---
  useEffect(() => {
      if (activeTab === 'pos') {
          const p = JSON.parse(localStorage.getItem('product_stock_db') || '[]');
          setProducts(p);
          // Update profile juga jaga-jaga ada perubahan setting pembayaran
          const prof = JSON.parse(localStorage.getItem('store_profile') || '{}');
          setProfile(prof);
      }
  }, [activeTab]);


  // --- FITUR BARCODE SCANNER (RETAIL MURNI - FIXED) ---
  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = 0;
    const handleKey = (e) => {
        // FIX: Jika user sedang mengetik di Input atau Textarea, jangan jalankan scanner
        if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

        const now = Date.now();
        if (now - lastKeyTime > 100) barcodeBuffer = ""; 
        lastKeyTime = now;
        if (e.key === "Enter") {
            if (barcodeBuffer.length > 2) {
                const found = products.find(p => p.sku === barcodeBuffer || p.name.toLowerCase() === barcodeBuffer.toLowerCase());
                if (found) {
                    addToCart(found);
                    triggerAlert(`Produk ${found.name} Masuk Keranjang!`); // Menggunakan popup premium
                }
                barcodeBuffer = "";
            }
        } else if (e.key.length === 1) { barcodeBuffer += e.key; }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [products, triggerAlert]);


  useEffect(() => {
    const p = JSON.parse(localStorage.getItem('product_stock_db') || '[]');
    setProducts(p);
    const ord = JSON.parse(localStorage.getItem('active_orders_db') || '[]');
    setActiveOrders(ord);
    const prof = JSON.parse(localStorage.getItem('store_profile') || '{}');
    setProfile(prof);
  }, []);

  const saveActiveOrders = (ords) => {
    setActiveOrders(ords);
    localStorage.setItem('active_orders_db', JSON.stringify(ords));
  };

  const addToCart = (p) => {
    if(p.stock <= 0) triggerAlert("Stok habis!");
    
    // LOGIC TIER PRICE
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
    // FIX: Gunakan triggerAlert, bukan alert biasa
    if(!buyerName || cart.length === 0) return triggerAlert("Keranjang kosong / Nama pembeli wajib diisi!", "error");
    
    // 1. Struktur Data Order
    const newOrder = {
        id: `ord_${Date.now()}`,
        date: new Date().toISOString(),
        buyer: buyerName,
        paymentMethod: paymentMethod,
        items: cart,
        total: cart.reduce((a,b)=>a+(b.price*b.qty),0),
        status: 'pending',
        branchId: BRANCH_ID
    };

    // 2. UPDATE STOK OTOMATIS (KEUNGGULAN RETAIL)
    const updatedProducts = [...products];
    
    // Load Database Bahan Baku & Resep
    const rawMaterialsDb = JSON.parse(localStorage.getItem('raw_material_db') || '[]');
    const recipesDb = JSON.parse(localStorage.getItem('hpp_pro_db') || '[]');
    let updatedRawMaterials = [...rawMaterialsDb];

    cart.forEach(cartItem => {
        // A. Kurangi Stok Produk (Etalase)
        const prodIdx = updatedProducts.findIndex(p => p.id === cartItem.id);
        if(prodIdx >= 0) updatedProducts[prodIdx].stock -= cartItem.qty;

        // B. Kurangi Stok Bahan Baku (Gudang) - IMPLEMENTASI FIXED
        const resep = recipesDb.find(r => r.product.name === cartItem.name);
        if(resep && resep.materials) {
            resep.materials.forEach(mat => {
                // Cari bahan di gudang yg namanya sama dengan di resep
                const rawIdx = updatedRawMaterials.findIndex(rm => rm.name.toLowerCase() === mat.name.toLowerCase());
                
                if (rawIdx >= 0) {
                    // Hitung pemakaian: usage per unit * qty beli
                    const totalUsage = (mat.usage || 0) * cartItem.qty;
                    // Kurangi stok
                    updatedRawMaterials[rawIdx].stock = (updatedRawMaterials[rawIdx].stock || 0) - totalUsage;
                }
            });
        }
    });

    // 3. Simpan Perubahan ke Local Storage
    setProducts(updatedProducts);
    localStorage.setItem('product_stock_db', JSON.stringify(updatedProducts));
    
    // SIMPAN UPDATE BAHAN BAKU JUGA
    localStorage.setItem('raw_material_db', JSON.stringify(updatedRawMaterials));
    
    setActiveOrders([newOrder, ...activeOrders]);
    localStorage.setItem('active_orders_db', JSON.stringify([newOrder, ...activeOrders]));

    setCart([]); setBuyerName('');
    triggerAlert("Transaksi Berhasil! Stok Etalase & Bahan Baku Gudang telah diperbarui.");
    setViewMode('status');
  };


  const confirmPayment = (order) => {
      const history = JSON.parse(localStorage.getItem('pos_history_db') || '[]');
      const completedOrder = { ...order, status: 'paid', paidAt: new Date().toISOString() };
      localStorage.setItem('pos_history_db', JSON.stringify([...history, completedOrder]));
      const updated = activeOrders.map(o => o.id === order.id ? completedOrder : o);
      saveActiveOrders(updated);
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

  // --- HELPER COMPONENTS ---
  const getPaymentInfo = (method) => {
      if(method === 'Cash') return <div className="p-3 bg-slate-100 rounded-lg text-center font-bold text-slate-800">Bayar Tunai di Kasir</div>;
      if(method === 'QRIS') return (
          <div className="flex flex-col items-center">
              {profile.payment?.qris ? <img src={profile.payment.qris} className="w-48 h-48 object-contain bg-white p-2 rounded-lg border"/> : <p>Belum ada QRIS</p>}
              <p className="text-xs mt-2 text-slate-500">Scan untuk membayar</p>
          </div>
      );
      const wallet = profile.payment?.ewallets?.find(w => w.type === method);
      if(wallet) return <div className="p-4 bg-slate-100 rounded-lg text-center"><p className="font-bold text-indigo-600">{method}</p><p className="text-xl font-black mt-1 select-all text-slate-900">{wallet.number}</p><p className="text-xs text-slate-400 mt-1">Klik nomor untuk salin</p></div>;
      const bank = profile.payment?.bank?.find(b => b.bank === method);
      if(bank) return <div className="p-4 bg-slate-100 rounded-lg text-center"><p className="font-bold text-emerald-600 uppercase">{method}</p><p className="text-xl font-black mt-1 select-all text-slate-900">{bank.number}</p></div>;
      return null;
  };

  const ReceiptModal = ({ order, onClose }) => (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-white/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-300">
          <div className="bg-white w-full max-w-xs p-6 shadow-2xl relative text-slate-900">
             <div className="text-center border-b-2 border-dashed border-slate-900 pb-4 mb-4">
                {isPro(licenseInfo) ? (
                    <>
                        {profile.logo && <img src={profile.logo} className="h-12 mx-auto mb-2 object-contain grayscale"/>}
                        <h2 className="font-black text-xl uppercase tracking-wider text-slate-900">{profile.name}</h2>
                        <p className="text-xs font-bold text-slate-800 mt-1">{profile.address}</p>
                    </>
                ) : (
                    <>
                        <h2 className="font-black text-xl uppercase tracking-wider text-slate-900">{profile.name}</h2>
                        <p className="text-[9px] text-slate-400 italic mt-1">Powered by CostLab App (Basic)</p>
                    </>
                )}
                <p className="text-xs font-bold text-slate-800">{profile.wa}</p>
                <p className="text-[10px] font-bold text-slate-600 mt-2">{order.id} • {new Date(order.date).toLocaleString()}</p>
            </div>

              <div className="text-xs mb-4 text-slate-900 font-bold">
                  <div className="flex justify-between mb-1"><span>Pembeli:</span><span className="font-black">{order.buyer}</span></div>
                  <div className="flex justify-between"><span>Admin:</span><span>{profile.adminName || 'Admin'}</span></div>
              </div>
              <div className="border-b-2 border-dashed border-slate-900 pb-4 mb-4 space-y-2">
                  {order.items.map((item, idx) => (
                      <div key={idx} className="text-xs text-slate-900">
                          <p className="font-black">{item.name}</p>
                          <div className="flex justify-between font-bold">
                              <span>{item.qty} x {formatIDR(item.price)}</span>
                              <span>{formatIDR(item.qty * item.price)}</span>
                          </div>
                      </div>
                  ))}
              </div>
              <div className="space-y-1 text-sm text-slate-900">
                 <div className="flex justify-between font-black"><span>Total</span><span>{formatIDR(order.total)}</span></div>
                   <div className="flex justify-between text-xs font-bold"><span>Bayar ({order.paymentMethod})</span><span>{formatIDR(order.total)}</span></div>
              </div>
              <div className="mt-6 text-center text-[10px] text-slate-900 font-bold">
                  <p>Terima kasih telah berbelanja</p>
                  <button onClick={onClose} className="mt-6 w-full bg-slate-900 text-white py-2 rounded font-bold text-xs no-print">Tutup</button>
                  <button onClick={()=>window.print()} className="mt-2 w-full border border-slate-900 text-slate-900 py-2 rounded font-bold text-xs no-print flex items-center justify-center gap-2"><Printer className="w-3 h-3"/> Cetak / Simpan PDF</button>
              </div>
          </div>
      </div>
  );

  const totalCartPrice = cart.reduce((a,b)=>a+(b.price*b.qty),0);
  const totalCartQty = cart.reduce((a,b)=>a+b.qty,0);

  return (
    <div className="h-full flex flex-col pb-24 max-w-6xl mx-auto w-full px-2 sm:px-4">
      <div className="flex gap-2 mb-4 bg-slate-50 dark:bg-slate-950 p-1 sticky top-0 z-20">
          <button onClick={()=>setViewMode('shop')} className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 ${viewMode==='shop'?'bg-indigo-600 text-white shadow':'text-slate-500'}`}><Store className="w-4 h-4"/> Produk</button>
          <button onClick={()=>setViewMode('status')} className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 ${viewMode==='status'?'bg-indigo-600 text-white shadow':'text-slate-500'}`}>
              <Clock className="w-4 h-4"/> Status Pesanan
              {activeOrders.filter(o=>o.status==='pending').length > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full">{activeOrders.filter(o=>o.status==='pending').length}</span>}
          </button>
      </div>

      {viewMode === 'shop' && (
        <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-180px)]">
            <div className="flex-1 overflow-y-auto">
                
                                {/* HEADER & SEARCH BAR BARU */}
                <div className="sticky top-0 z-30 bg-[#FAFAFA] dark:bg-[#0F172A] pb-2 pt-1 transition-colors duration-500">
                    <div className="flex justify-between items-end mb-3 px-1">
                        <div>
                            <h3 className="font-black text-slate-800 dark:text-white text-lg tracking-tight">Daftar Produk</h3>
                            <p className="text-[10px] font-bold text-slate-400">{products.length} Item Tersedia</p>
                        </div>
                    </div>

                    <div className="relative mb-6 flex gap-2">
                        <div className="relative flex-1 group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                            </div>
                            <input 
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm dark:text-white placeholder:text-slate-300" 
                                placeholder="Cari nama produk..." 
                                value={search} 
                                onChange={e=>setSearch(e.target.value)} 
                            />
                        </div>
                        {isPro(licenseInfo) && (<PremiumPriceSelector currentTier={priceTier} onChange={setPriceTier} />)}
                    </div>
                </div>


                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-32">
                    {products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p => {
                        // --- PERBAIKAN LOGIKA HARGA DINAMIS ---
                        let displayPrice = p.price;
                        let priceLabel = "Retail";
                        
                        // Cek Tier Harga yang dipilih user
                        if (priceTier === 'grosir' && p.priceGrosir > 0) { 
                            displayPrice = p.priceGrosir; 
                            priceLabel = "Grosir"; 
                        }
                        if (priceTier === 'ojol' && p.priceOjol > 0) { 
                            displayPrice = p.priceOjol; 
                            priceLabel = "App Online"; 
                        }

                        return (
                            <div key={p.id} onClick={()=>addToCart(p)} className={`bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all duration-300 group ${p.stock>0 ? 'cursor-pointer hover:border-indigo-500 hover:shadow-indigo-500/10 hover:-translate-y-1' : 'opacity-60 grayscale cursor-not-allowed'}`}>
                                <div className="aspect-square bg-slate-50 dark:bg-slate-800 rounded-xl mb-3 overflow-hidden relative">
                                    {p.image ? <img src={p.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/> : <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-slate-300">{p.name[0]}</div>}
                                    
                                    {/* Badge Stok Mahal */}
                                    <div className={`absolute bottom-1 right-1 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shadow-sm ${p.stock>0?'bg-slate-900/90 backdrop-blur-md':'bg-red-500'}`}>
                                        {p.stock > 0 ? `${p.stock} Ready` : 'Habis'}
                                    </div>
                                </div>
                                
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate mb-1">{p.name}</h4>
                                
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col">
                                        {/* Label Kategori Harga Aktif */}
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{priceLabel}</span>
                                        <p className="text-indigo-600 font-black text-sm">{formatIDR(displayPrice)}</p>
                                    </div>
                                    <button className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors shadow-sm">
                                        <Plus className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* POPUP CART & FLOATING BUTTON */}
            <CartPopup showCart={showCart} setShowCart={setShowCart} cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} buyerName={buyerName} setBuyerName={setBuyerName} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} handleCheckout={handleCheckout} profile={profile}/>
            
            {cart.length > 0 && (
                <div className="fixed bottom-24 left-0 right-0 px-4 z-30 flex justify-center animate-slide-up">
                    <div 
                        onClick={() => setShowCart(true)} 
                        className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl text-slate-900 dark:text-white p-4 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 flex justify-between items-center cursor-pointer border border-white/50 dark:border-white/10 group hover:scale-[1.02] transition-all duration-300"
                    >
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{totalCartQty} Item Dipilih</span>
                            <span className="text-lg font-black tracking-tight">{formatIDR(totalCartPrice)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                             <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
                             <button className="flex items-center gap-2 font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20 group-hover:shadow-indigo-600/40">
                                <ShoppingCart className="w-4 h-4"/> Checkout
                             </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}

      {viewMode === 'status' && (
        <div className="space-y-4 pb-20 overflow-y-auto h-full">
            {activeOrders.length === 0 && <div className="text-center py-20 text-slate-400 text-sm font-bold flex flex-col items-center"><Clock className="w-12 h-12 mb-3 opacity-20"/>Belum ada pesanan aktif</div>}
            {activeOrders.map(order => (
                <div key={order.id} onClick={()=>setSelectedOrder(order)} className={`relative bg-white dark:bg-slate-900 rounded-2xl p-4 border transition cursor-pointer hover:scale-[1.01] active:scale-[0.99] shadow-sm ${order.status === 'pending' ? 'border-amber-200 dark:border-amber-900' : 'border-emerald-200 dark:border-emerald-900'}`}>
                    <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 ${order.status==='pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
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
        </div>
      )}

      {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                  <button onClick={()=>setSelectedOrder(null)} className="absolute top-4 right-4 p-1 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5"/></button>
                  <div className="text-center mb-6">
                      {selectedOrder.status === 'pending' ? (
                          <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full font-bold text-xs border border-yellow-200 mb-2 animate-pulse">
                              <Clock className="w-4 h-4"/> Menunggu Pembayaran
                          </div>
                      ) : (
                          <div className="inline-flex flex-col items-center gap-2 mb-2">
                              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2"><Check className="w-6 h-6"/></div>
                              <h3 className="font-bold text-lg dark:text-white">Order Berhasil!</h3>
                              <p className="text-xs text-slate-400">Silahkan menunggu pesanan disiapkan.</p>
                          </div>
                      )}
                      {selectedOrder.status === 'pending' && <p className="text-[10px] text-slate-400 font-bold">Batas Waktu: <CountdownTimer deadline={selectedOrder.deadline} /></p>}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-4 space-y-2 max-h-40 overflow-y-auto">
                      {selectedOrder.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{item.qty}x {item.name}</span>
                              <span className="font-bold text-slate-900 dark:text-white">{formatIDR(item.price * item.qty)}</span>
                          </div>
                      ))}
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-black text-sm">
                          <span>Total</span><span>{formatIDR(selectedOrder.total)}</span>
                      </div>
                  </div>

                  {selectedOrder.status === 'pending' && (
                    <div className="mb-6">
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 text-center">Transfer ke:</p>
                          {getPaymentInfo(selectedOrder.paymentMethod)}
                      </div>
                  )}

                  <div className="space-y-2">
                      {selectedOrder.status === 'pending' ? (
                          <>
                            <button onClick={()=>confirmPayment(selectedOrder)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30">Sudah Bayar</button>
                            <button onClick={()=>cancelOrder(selectedOrder)} className="w-full bg-white border border-slate-200 text-rose-500 py-3 rounded-xl font-bold text-sm hover:bg-rose-50">Batalkan Pesanan</button>
                          </>
                      ) : (
                          <button onClick={()=>setShowReceipt(selectedOrder)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Receipt className="w-4 h-4"/> Download Struk</button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showReceipt && <ReceiptModal order={showReceipt} onClose={()=>setShowReceipt(null)} />}
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

      {/* GRAFIK INTERAKTIF SUPER (TITIK DATA BISA DISENTUH) */}
      <Card title="Analisa Harian (Bulan Ini)" icon={BarChart3} className="overflow-hidden">
          <div className="relative h-64 w-full mt-4 select-none">
             
             {/* AREA INFO INTERAKTIF (TOOLTIP STATIS DI ATAS) */}
             <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-10">
                 {focusedPoint ? (
                     <div className="bg-slate-800 text-white px-4 py-2 rounded-xl shadow-xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                         <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{formatDayName(focusedPoint.date)}</span>
                         <span className="text-sm font-black">{formatDateIndo(focusedPoint.date)}</span>
                         <span className="text-lg font-black text-emerald-400 mt-1">{formatIDR(focusedPoint.total)}</span>
                         <span className="text-[10px] text-slate-400">{focusedPoint.count} Transaksi</span>
                     </div>
                 ) : (
                     <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400">
                         Sentuh grafik untuk melihat detail tanggal
                     </div>
                 )}
             </div>

             {/* SVG CHART */}
             <div className="absolute inset-x-0 bottom-6 top-16 flex items-end justify-between px-2 gap-1">
                 {stats.dailyData.map((d, i) => {
                     const heightPercent = stats.maxDaily > 0 ? (d.total / stats.maxDaily) * 100 : 0;
                     const isFocus = focusedPoint?.day === d.day;
                     
                     return (
                         <div 
                            key={i} 
                            className="relative flex-1 h-full flex items-end group cursor-pointer"
                            onMouseEnter={() => setFocusedPoint(d)}
                            onClick={() => setFocusedPoint(d)} // Support Touch
                         >
                             {/* Batang Grafik Invisible untuk Hit Area lebih besar */}
                             <div className="absolute inset-0 bg-transparent z-20"></div>
                             
                             {/* Visual Batang Grafik */}
                             <div 
                                className={`w-full rounded-t-sm transition-all duration-300 ${d.total > 0 ? (isFocus ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]' : 'bg-indigo-300/50 dark:bg-indigo-500/30 hover:bg-indigo-400') : 'bg-slate-100 dark:bg-slate-800/50 h-1'}`}
                                style={{ height: `${Math.max(heightPercent, 2)}%` }}
                             ></div>

                             {/* Label Tanggal di Bawah */}
                             {(i === 0 || i === 4 || i === 9 || i === 14 || i === 19 || i === 24 || i === 29) && (
                                 <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-300 font-mono">
                                     {d.day}
                                 </div>
                             )}
                         </div>
                     )
                 })}
             </div>
             
             {/* Garis Dasar */}
             <div className="absolute bottom-6 left-0 right-0 h-[1px] bg-slate-200 dark:border-slate-700"></div>
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

          <div className="space-y-3">
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


// ============================================================================
// 6. TAB: SETTINGS (RETAIL MODE & NEON LICENSE)
// ============================================================================

const SettingsTab = ({ licenseInfo, triggerAlert }) => {
    // --- STATE & LOGIC ---
    const [retailMode, setRetailMode] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');
    
    // Load Retail Mode
    useEffect(() => {
        setRetailMode(localStorage.getItem('retail_mode') === 'true');
    }, []);

    // Toggle Logic (Fixed Bug & Added Popup)
    const toggleRetail = () => {
        const newValue = !retailMode;
        setRetailMode(newValue);
        localStorage.setItem('retail_mode', newValue ? 'true' : 'false');
        
        if(newValue) {
            triggerAlert("Mode Retail Murni AKTIF (Scanner ON)", "success");
        } else {
            triggerAlert("Mode Retail Non-Aktif", "success");
        }
    };

    // License Timer Logic
    useEffect(() => {
        if (!licenseInfo?.validUntil) return;
        const updateTimer = () => {
            const now = new Date();
            const end = new Date(licenseInfo.validUntil);
            const diff = end - now;
            if (diff <= 0) { setTimeLeft("Kedaluwarsa"); } 
            else {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const m = Math.floor((diff / 1000 / 60) % 60);
                setTimeLeft(`${d} Hari ${h} Jam ${m} Menit`);
            }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Update tiap menit cukup
        return () => clearInterval(interval);
    }, [licenseInfo]);

    const handleResetAll = () => {
        if(confirm("PERINGATAN: Reset data akan menghapus semua simpanan dan lisensi. Lanjutkan?")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="max-w-xl mx-auto px-4 pb-32 space-y-6">
            
            {/* Header */}
            <div className="flex items-center gap-3 mb-2 pt-2">
                <div className="p-3 bg-slate-900 dark:bg-white rounded-2xl shadow-lg">
                    <Settings className="w-6 h-6 text-white dark:text-slate-900" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Pengaturan</h1>
                    <p className="text-xs text-slate-500 font-bold">Konfigurasi Aplikasi</p>
                </div>
            </div>

            {/* --- CARD 1: MODE APLIKASI (RETAIL) --- */}
            <Card title="Mode Operasional" icon={LayoutGrid}>
                <div className="flex justify-between items-center py-1">
                    <div className="pr-4 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white">Retail Murni</h4>
                            {/* HIGHLIGHT BOX MINIMARKET (PENGGANTI KURUNG) */}
                            <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-2 py-0.5 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <Store className="w-3 h-3"/>
                                <span className="text-[9px] font-black uppercase tracking-wider">Minimarket</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                            Aktifkan fitur <span className="text-indigo-500 font-bold">Auto-Scan Barcode</span> & <span className="text-indigo-500 font-bold">Stok Opname Cepat</span> untuk kasir supermarket.
                        </p>
                    </div>

                    {/* TOGGLE SWITCH MAHAL (FIXED BUG) */}
                    <div onClick={toggleRetail} className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-500 flex items-center shadow-inner ${retailMode ? 'bg-indigo-600 shadow-indigo-500/50' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${retailMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                </div>
            </Card>

            {/* --- CARD 2: STATUS LISENSI (NEON STYLE) --- */}
            {licenseInfo && (
                <div className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 relative z-10">
                        
                        {/* 1. MASA AKTIF (PALING ATAS) */}
                        <div className="text-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                             <p className="text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-[0.2em]">Sisa Masa Aktif</p>
                             <p className="text-2xl font-black font-mono text-slate-800 dark:text-white tracking-tight">{timeLeft}</p>
                        </div>

                        {/* 2. USER INFO & BADGE (SEBELAHAN) */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                    <User className="w-5 h-5 text-slate-500"/>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Tenant User</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{licenseInfo.tenant}</p>
                                </div>
                            </div>

                            {/* BADGE STATUS (LOGIKA NEON DARK MODE) */}
                            {isPro(licenseInfo) ? (
                                <div className={`
                                    flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-500
                                    /* Light Mode: Gradient Mewah */
                                    bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-600 text-white shadow-lg shadow-amber-500/30 border border-white/20
                                    /* Dark Mode: Neon Outline (No Gradient) */
                                    dark:bg-transparent dark:from-transparent dark:to-transparent
                                    dark:border-2 dark:border-yellow-400 dark:text-yellow-400
                                    dark:shadow-[0_0_15px_rgba(250,204,21,0.5),inset_0_0_10px_rgba(250,204,21,0.2)]
                                `}>
                                    <Crown className="w-3.5 h-3.5 dark:fill-yellow-400 fill-white/80 animate-pulse"/>
                                    <span className="text-[10px] font-black tracking-widest uppercase">Pro</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400"/>
                                    <span className="text-[10px] font-bold text-slate-500 tracking-wider">BASIC</span>
                                </div>
                            )}
                        </div>

                        {/* ID Aplikasi (Kecil di bawah) */}
                        <div className="mt-4 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800 text-center">
                            <p className="text-[9px] text-slate-300 font-mono">ID: {licenseInfo.id}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CARD 3: ZONA BAHAYA --- */}
            <Card title="Zona Bahaya" icon={AlertCircle} className="border-rose-100 dark:border-rose-900/30 bg-rose-50/30 dark:bg-rose-900/10">
                <div className="flex items-start gap-4">
                    <AlertTriangle className="w-10 h-10 text-rose-500 shrink-0 opacity-80"/>
                    <div>
                        <h4 className="font-bold text-sm text-rose-600 dark:text-rose-400 mb-1">Factory Reset</h4>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                            Menghapus seluruh database lokal browser (Resep, Stok, Riwayat) dan status lisensi. Data tidak bisa dikembalikan.
                        </p>
                        <Button onClick={handleResetAll} variant="danger" icon={RefreshCw} className="w-full py-3 shadow-rose-500/10">
                            Reset Aplikasi Sekarang
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="text-center pb-8 opacity-30">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">CostLab v2.5 Retail</p>
            </div>
        </div>
    );
};

// --- TAMBAHAN KODE 3 (LAYAR KUNCI & SECURITY) ---
// --- LAYAR KUNCI & SECURITY (Updated for Admin Panel) ---
const LockScreen = ({ onUnlock }) => {
    const [inputId, setInputId] = useState("");
    const [inputPass, setInputPass] = useState("");
    const [loading, setLoading] = useState(false);
    
    const handleLogin = async () => {
        if(!inputId || !inputPass) return triggerAlert("Isi ID dan Password!");
        setLoading(true);
        
        try {
            // Cek ke Firebase collection 'licenses'
            const docRef = doc(db, "licenses", inputId.toLowerCase());
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Validasi Password & Status
                if (data.password === inputPass) {
                    if (!data.active) { triggerAlert("Akun dinonaktifkan Admin."); setLoading(false); return; }
                    if (new Date() > new Date(data.validUntil)) { triggerAlert("Masa aktif habis."); setLoading(false); return; }

                    onUnlock(data); // LOGIN SUKSES
                } else {
                    triggerAlert("Password Salah!");
                }
            } else {
                triggerAlert("ID Tenant tidak ditemukan!");
            }
        } catch (error) {
            triggerAlert("Error Koneksi: " + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
            <div className="w-full max-w-sm bg-white rounded-3xl p-8 text-center shadow-2xl">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-lg">
                    <Lock className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-1">CostLab Login</h1>
                <p className="text-xs text-slate-400 font-bold mb-6 uppercase tracking-widest">Enterprise Access</p>
                
                <div className="space-y-3 text-left">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Tenant ID</label>
                        <input value={inputId} onChange={e=>setInputId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition" placeholder="username" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Password</label>
                        <input type="password" value={inputPass} onChange={e=>setInputPass(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition" placeholder="******" />
                    </div>
                </div>

                <button onClick={handleLogin} disabled={loading} className="w-full mt-6 bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-500/30">
                    {loading ? "Memverifikasi..." : "Masuk Aplikasi"}
                </button>
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



//============================================================================
// APP MAIN COMPONENT (SHELL)
// ============================================================================

const App = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [active, setActive] = useState('calc');
  const [dark, setDark] = useState(false);
  
  // STATE BARU: Global Popup & Overlay Logic
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' });
  const [isEditingMode, setIsEditingMode] = useState(false); // Untuk mengatur z-index navbar

  // --- GLOBAL ALERT REPLACEMENT ---
  const triggerAlert = useCallback((message, type = 'success') => {
      setPopup({ show: true, message, type });
  }, []);

  // --- SECURITY LOGIC (REALTIME FIREBASE) ---
  useEffect(() => {
    // 1. Cek User yang sedang login
    if (licenseInfo?.id) {
        // Listener Realtime: Jika admin ubah active=false, langsung logout
        const unsub = onSnapshot(doc(db, "licenses", licenseInfo.id), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                if (!data.active) {
                    setIsBanned(true); // Blokir layar
                    triggerAlert("Sesi Anda dihentikan Admin.", "error");
                    setLicenseInfo(null);
                    localStorage.removeItem('app_license');
                }
            } else {
                // Jika dokumen dihapus admin
                setIsLocked(true);
            }
        });
        return () => unsub();
    }
  }, [licenseInfo]);

  // Cek Lisensi Lokal saat Load Awal
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
    if(!isBanned && !isRestored) {
        checkValidity();
        const interval = setInterval(checkValidity, 10000); 
        return () => clearInterval(interval);
    }
  }, [isBanned, isRestored]);

  const handleUnlock = (data) => {
     if(isBanned) return triggerAlert("Akses Ditolak.", "error");
     localStorage.setItem('app_license', JSON.stringify(data));
     setLicenseInfo(data); setIsLocked(false);
  };

  // --- THEME & AUTO LOGOUT ---
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

  useEffect(() => {
    if(!licenseInfo) return; 
    const interval = setInterval(async () => { syncSession('heartbeat', licenseInfo); }, 3000);
    return () => clearInterval(interval);
  }, [licenseInfo]);

  // --- RENDER BLOCKING SCREENS ---
  if (isBanned) return <BannedScreen id={licenseInfo?.id || "UNKNOWN"} />;
  if (isRestored) return <RestoredScreen onContinue={()=>{ setIsRestored(false); setIsLocked(true); }} />;
  if (isLocked) return <LockScreen onUnlock={handleUnlock} id={licenseInfo?.id} />;

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen w-full bg-[#FAFAFA] dark:bg-[#0F172A] font-sans text-slate-800 dark:text-slate-200 transition-colors duration-500">
        
        {/* HEADER GLASS - Z-Index diatur dinamis: Rendah saat editing, Tinggi saat normal */}
        <div className={`sticky top-0 px-4 py-3 flex justify-between items-center max-w-screen-xl mx-auto transition-all duration-300 ${isEditingMode ? 'z-0 opacity-50 blur-sm' : 'z-40 glass border-b border-slate-200/50 dark:border-white/5'}`}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30"><Calculator className="w-5 h-5"/></div>
             <div>
                <h1 className="font-black text-sm tracking-tight text-slate-900 dark:text-white leading-none">CostLab</h1>
                <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">By ShanTech </p>
             </div>
          </div>
          <div className="flex gap-2">
             <button onClick={toggleDarkMode} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition">
                {dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
             </button>
          </div>
        </div>

                        {/* MAIN CONTENT - LOGIKA AUTO REFRESH */}
        <div className="animate-in fade-in zoom-in-95 duration-500 pt-6 pb-32">
          
          <div className={active === 'calc' ? 'block' : 'hidden'}>
              <CalculatorTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} />
          </div>
          
          <div className={active === 'profile' ? 'block' : 'hidden'}>
              {/* Kirim sinyal activeTab agar Profile tau kapan harus refresh stok */}
              <ProfileTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} />
          </div>

          <div className={active === 'pos' ? 'block' : 'hidden'}>
              {/* Kirim sinyal activeTab agar POS tau kapan harus refresh produk */}
              <PosTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} setEditingMode={setIsEditingMode} activeTab={active} />
          </div>

          <div className={active === 'report' ? 'block' : 'hidden'}>
              {/* Kirim sinyal activeTab agar Report tau kapan harus refresh grafik */}
              <ReportTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} activeTab={active} />
          </div>

          <div className={active === 'settings' ? 'block' : 'hidden'}>
              <SettingsTab licenseInfo={licenseInfo} triggerAlert={triggerAlert} />
          </div>

        </div>



        {/* BOTTOM NAV FLOATING - Z-Index dinamis */}
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 transition-all duration-300 ${isEditingMode ? 'z-0 opacity-0 translate-y-10' : 'z-40'}`}>
            <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-full shadow-2xl shadow-slate-200/50 dark:shadow-black/50 flex gap-1 border border-white/20 ring-1 ring-black/5">
            {[
                { id: 'calc', icon: Calculator, l: 'Hitung' },
                { id: 'pos', icon: ShoppingCart, l: 'Kasir' },
                { id: 'report', icon: BarChart3, l: 'Laporan' },
                { id: 'profile', icon: Store, l: 'Toko' },
                { id: 'settings', icon: Settings, l: 'Setting' }
            ].map(i => (
                <button key={i.id} onClick={()=>setActive(i.id)} className={`relative px-5 py-3 rounded-full transition-all duration-300 flex items-center justify-center gap-2 group ${active===i.id ?
                'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 scale-105' : 
                'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white'}`}>
                
                <i.icon className={`w-5 h-5 transition-transform duration-300 ${active===i.id ? 'scale-110' : 'group-hover:scale-110'}`}/>
                {active===i.id && <span className="text-[10px] font-bold whitespace-nowrap hidden sm:inline animate-in fade-in slide-in-from-left-2 duration-300">{i.l}</span>}
                </button>
            ))}
            </nav>
        </div>

        {/* GLOBAL PREMIUM POPUP */}
        {popup.show && <PremiumPopup message={popup.message} type={popup.type} onClose={()=>setPopup({...popup, show:false})} />}

      </div>
    </div>
  );
};

export default App;
