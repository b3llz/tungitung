import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calculator, ShoppingCart, BarChart3, Plus, Trash2, 
  Save, FolderOpen, RotateCcw, Info, CheckCircle, 
  TrendingUp, Package, Zap, DollarSign, Menu, X, 
  ChevronRight, Upload, Edit3, Image as ImageIcon,
  Search, Sun, Moon, ArrowRight, HelpCircle, Box,
  Shield, Crown, Rocket, Layers, LayoutGrid, Download, 
  FileSpreadsheet, Clock, Truck, Users, Briefcase
} from 'lucide-react';

// ============================================================================
// 0. UTILS: EXCEL HANDLER (Dynamic Import CDN)
// ============================================================================

const loadXLSX = async () => {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Gagal memuat library Excel"));
    document.head.appendChild(script);
  });
};

// ============================================================================
// 1. DATA CONSTANTS & LOGIC
// ============================================================================

const MATERIAL_UNITS = [
  'gr', 'kg', 'pcs', 'ml', 'liter', 'butir', 'sdm', 'sdt', 'pack', 'botol', 'cup'
];

const VARIABLE_COST_TYPES = {
  'Bahan Baku': { label: 'Total Kapasitas', units: ['gram', 'kilogram', 'ml', 'liter', 'pcs'], icon: Package },
  'Kemasan': { label: 'Jumlah Isi', units: ['pcs', 'unit', 'pack', 'box'], icon: Box },
  'Operasional': { label: 'Total Pemakaian', units: ['hari', 'jam', 'unit pemakaian'], icon: Zap },
  'Tenaga Kerja': { label: 'Total Waktu Kerja', units: ['jam', 'hari', 'pcs', 'order'], icon: Users },
  'Distribusi': { label: 'Total Jarak/Order', units: ['order', 'pengiriman', 'km'], icon: Truck },
  'Transaksi': { label: 'Total Transaksi', units: ['order', 'transaksi', 'persen'], icon: DollarSign },
  'Produksi Tambahan': { label: 'Jumlah Pemakaian', units: ['pcs', 'unit'], icon: Layers }
};

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

// ============================================================================
// 2. UI COMPONENTS
// ============================================================================

const HelpBox = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-2 align-middle">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition flex items-center justify-center"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)}></div>
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90%] max-w-xs p-4 bg-slate-800 text-white text-xs rounded-xl shadow-2xl animate-fade-in-up border border-slate-700">
            <div className="flex justify-between mb-2 pb-2 border-b border-slate-700">
              <span className="font-bold text-indigo-400">Panduan</span>
              <X className="w-4 h-4 cursor-pointer hover:text-red-400" onClick={(e)=>{ e.stopPropagation(); setIsOpen(false);}}/>
            </div>
            <p className="leading-relaxed text-slate-300 text-center">{text}</p>
          </div>
        </>
      )}
    </div>
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
    <div className="w-full">
      {label && <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1.5 block whitespace-nowrap overflow-hidden text-ellipsis">{label}</label>}
      <div className="relative group">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium z-10 pointer-events-none">{prefix}</span>}
        <input
          type="text" value={displayValue} onChange={handleChange} placeholder={placeholder}
          className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg py-2 font-bold outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 text-sm ${prefix ? 'pl-8' : 'pl-3'} ${suffix ? 'pr-8' : 'pr-3'} ${className}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
};

const Card = ({ children, className = "", title, icon: Icon, action, help }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800 transition-all duration-300 ${className}`}>
    {(title || action) && (
      <div className="px-5 py-3 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700"><Icon className="w-4 h-4" /></div>}
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
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200",
    outline: "border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20",
    danger: "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />} {children}
    </button>
  );
};

// ============================================================================
// 3. TAB: CALCULATOR (HPP)
// ============================================================================

const CalculatorTab = () => {
  const [calcMode, setCalcMode] = useState('detail'); 
  const [simpleModal, setSimpleModal] = useState(0);
  const [product, setProduct] = useState({ name: '', type: 'Makanan', image: null });
  const [materials, setMaterials] = useState([{ id: 1, name: '', price: 0, unit: 'gr', content: 1000, usage: 0, cost: 0 }]);
  const [variableOps, setVariableOps] = useState([{ id: 1, type: 'Kemasan', name: '', price: 0, unit: 'pcs', content: 1, usage: 0, cost: 0 }]);
  const [fixedOps, setFixedOps] = useState([{ id: 1, name: 'Sewa/Wifi', cost: 0 }]);
  const [showFixed, setShowFixed] = useState(false);
  const [production, setProduction] = useState({ yield: 1, monthlyTarget: 100 });
  const [smartRounding, setSmartRounding] = useState(true);
  const [customMargin, setCustomMargin] = useState(48.6); // Default ke MASUK AKAL
  const [targetProfit, setTargetProfit] = useState(0);
  const [competitorPrice, setCompetitorPrice] = useState(0);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [showLoad, setShowLoad] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Logic Calculations
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

  // HPP Calculation
  const totalMat = materials.reduce((a,b) => a + b.cost, 0);
  const totalVar = variableOps.reduce((a,b) => a + b.cost, 0);
  const totalFix = fixedOps.reduce((a,b) => a + b.cost, 0);
  
  let matPerUnit, varPerUnit, fixPerUnit, hppBersih;
  if (calcMode === 'simple') {
    matPerUnit = simpleModal / (production.yield || 1); varPerUnit = 0; fixPerUnit = 0; hppBersih = matPerUnit;
  } else {
    matPerUnit = totalMat / (production.yield || 1);
    varPerUnit = totalVar / (production.yield || 1);
    fixPerUnit = showFixed ? (totalFix / (production.monthlyTarget || 1)) : 0;
    hppBersih = matPerUnit + varPerUnit + fixPerUnit;
  }

  // Pricing Logic (UPDATED TIERS)
  const round = (p) => smartRounding ? (p < 1000 ? Math.ceil(p/100)*100 : Math.ceil(p/500)*500) : p;
  const getTier = (margin) => {
    const raw = hppBersih + (hppBersih * (margin/100));
    return { raw, final: round(raw), profit: round(raw) - hppBersih };
  };

  const tiers = [
    { name: "SIAP TEMPUR", label: "kompetitif", desc: "Penetrasi pasar", margin: 22.8, color: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: Shield },
    { name: "MASUK AKAL", label: "standar", desc: "Margin umum", margin: 48.6, color: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: Layers },
    { name: "CEPET NAIK HAJI", label: "premium", desc: "Niche market", margin: 78.4, color: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", icon: Crown }
  ];

  function getPriceTier(margin) { return getTier(margin); }

  // Projection Logic (UPDATED)
  const finalPrice = getPriceTier(customMargin).final;
  const profitPerPcs = finalPrice - hppBersih;
  
  // Hitung target Pcs/Bulan berdasarkan Target Laba
  const targetPcsMonth = profitPerPcs > 0 ? Math.ceil(targetProfit / profitPerPcs) : 0;
  const targetPcsDay = Math.ceil(targetPcsMonth / 30);
  const projOmzetMonth = targetPcsMonth * finalPrice;
  // Biaya produksi per bulan (Var + Mat) * qty
  const projProdCostMonth = targetPcsMonth * (matPerUnit + varPerUnit);
  const projFixedCostMonth = showFixed ? totalFix : 0;
  // Laba bersih = Omzet - Prod Cost - Fixed Cost
  const projNetProfitMonth = projOmzetMonth - projProdCostMonth - projFixedCostMonth;


  // Storage & Handlers
  useEffect(() => { setSavedRecipes(JSON.parse(localStorage.getItem('hpp_pro_db') || '[]')); }, []);
  const save = () => {
    if(!product.name) return alert("Isi nama produk dulu!");
    const data = { id: Date.now(), product, materials, variableOps, fixedOps, production, hppBersih, finalPrice };
    setSavedRecipes(prev => { const n = [...prev, data]; localStorage.setItem('hpp_pro_db', JSON.stringify(n)); return n; });
    alert("Data Tersimpan!");
  };
  const load = (r) => {
    setProduct(r.product); setMaterials(r.materials); setVariableOps(r.variableOps); setFixedOps(r.fixedOps||[]);
    setProduction(r.production); setShowLoad(false);
  };
  const reset = () => {
    if(confirm("Reset semua?")) {
      setProduct({name:'', type:'Makanan', image:null}); 
      setMaterials([{ id: 1, name: '', price: 0, unit: 'gr', content: 1000, usage: 0, cost: 0 }]);
      setVariableOps([{ id: 1, type: 'Kemasan', name: '', price: 0, unit: 'pcs', content: 1, usage: 0, cost: 0 }]); 
      setFixedOps([{ id: 1, name: 'Sewa', cost: 0 }]);
      setProduction({ yield: 1, monthlyTarget: 100 });
      setSimpleModal(0);
    }
  };

  const handleExportExcel = async () => {
    if(!product.name) return alert("Beri nama produk dulu!");
    setIsExporting(true);
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.utils.book_new();
      const summaryData = [
        ["LAPORAN HPP - " + product.name.toUpperCase()],
        ["Tanggal", new Date().toLocaleDateString()],
        ["HPP Bersih", hppBersih],
        ["Harga Jual", finalPrice],
        ["Profit/Pcs", profitPerPcs],
        ["Target Laba", targetProfit],
        ["Proyeksi Laba", projNetProfitMonth]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");
      XLSX.writeFile(wb, `HPP_${product.name.replace(/\s+/g, '_')}.xlsx`);
    } catch (e) { alert("Gagal export: " + e.message); }
    setIsExporting(false);
  };

  return (
    <div className="space-y-4 pb-32 w-full px-2 sm:px-4 md:max-w-xl mx-auto">
      
      {/* 1. PRODUCT HEADER */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 flex gap-4 items-center">
          <div className="w-20 h-20 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center relative group cursor-pointer hover:border-indigo-400 transition-colors">
            {product.image ? <img src={product.image} className="w-full h-full object-cover rounded-xl"/> : <ImageIcon className="w-6 h-6 text-slate-300"/>}
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
              if(e.target.files[0]) { const r = new FileReader(); r.onload=v=>setProduct({...product, image:v.target.result}); r.readAsDataURL(e.target.files[0]); }
            }}/>
          </div>
          <div className="flex-1 min-w-0">
            <input 
              className="bg-transparent text-xl font-bold w-full outline-none placeholder:text-slate-500 border-b border-white/10 focus:border-indigo-500 transition-colors pb-1 mb-2 text-slate-900 dark:text-white"
              placeholder="Nama Produk..." value={product.name} onChange={e=>setProduct({...product, name:e.target.value})}
            />
            <div className="flex gap-1 flex-wrap">
              {['Makanan','Minuman','Fashion','Jasa'].map(t => (
                <button key={t} onClick={()=>setProduct({...product, type:t})} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition border ${product.type===t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* MODE TOGGLE */}
      <div className="flex justify-center">
        <div className="bg-white dark:bg-slate-900 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex">
          <button onClick={()=>setCalcMode('detail')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition ${calcMode==='detail'?'bg-indigo-600 text-white shadow-sm':'text-slate-500'}`}>Mode Detail</button>
          <button onClick={()=>setCalcMode('simple')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition ${calcMode==='simple'?'bg-emerald-600 text-white shadow-sm':'text-slate-500'}`}>Mode Cepat</button>
        </div>
      </div>

      {/* 2. COST CALCULATION */}
      {calcMode === 'detail' ? (
        <div className="space-y-4">
          <Card title="Bahan Baku" icon={Package} help="Biaya bahan untuk 1x resep (Batch)">
            <div className="space-y-4">
              {materials.map((m) => (
                <div key={m.id} className="relative p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 group">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <div className="col-span-2">
                       <input className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 py-1 text-sm font-bold placeholder:text-slate-400 focus:border-indigo-500 outline-none dark:text-white" 
                        placeholder="Nama Bahan (Tepung, Telur...)" value={m.name} onChange={e=>updateMat(m.id,'name',e.target.value)} />
                    </div>
                    <NumericInput label="Harga Beli" placeholder="0" prefix="Rp" value={m.price} onChange={v=>updateMat(m.id,'price',v)} className="bg-white dark:bg-slate-900" />
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">Isi Kemasan</label>
                      <div className="flex">
                        <input type="number" className="w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-lg py-2 pl-2 text-sm font-bold outline-none" 
                          placeholder="1000" value={m.content} onChange={e=>updateMat(m.id,'content',parseFloat(e.target.value))} />
                        <select className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-0 rounded-r-lg px-1 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer w-16" 
                          value={m.unit} onChange={e=>updateMat(m.id,'unit',e.target.value)}>
                          {MATERIAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 mt-1 flex items-center justify-between gap-3">
                       <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-emerald-600 mb-1 block">Dipakai ({m.unit})</label>
                          <input type="number" className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg py-1.5 px-2 text-sm font-bold text-emerald-800 dark:text-emerald-400 outline-none"
                            placeholder="0" value={m.usage} onChange={e=>updateMat(m.id,'usage',parseFloat(e.target.value))} />
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-medium">Biaya</p>
                          <p className="text-base font-black text-slate-700 dark:text-white">{formatIDR(m.cost)}</p>
                       </div>
                    </div>
                  </div>
                  <button onClick={()=>removeRow(setMaterials,materials,m.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-300 hover:text-red-500 shadow-sm opacity-100"><Trash2 className="w-3 h-3"/></button>
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
                    <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {Object.keys(VARIABLE_COST_TYPES).map(typeKey => (
                         <button key={typeKey} onClick={()=>updateVar(op.id, 'type', typeKey)} className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold border transition ${op.type === typeKey ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 dark:bg-slate-900 dark:border-slate-700'}`}>{typeKey}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                       <div className="col-span-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 mb-1">
                          <TypeIcon className="w-4 h-4 text-slate-400" />
                          <input className="w-full bg-transparent text-sm font-bold placeholder:text-slate-400 outline-none dark:text-white" placeholder={`Nama ${op.type}...`} value={op.name} onChange={e=>updateVar(op.id,'name',e.target.value)} />
                       </div>
                       <NumericInput label="Biaya Satuan" placeholder="0" prefix="Rp" value={op.price} onChange={v=>updateVar(op.id,'price',v)} className="bg-white dark:bg-slate-900" />
                       <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">{typeConfig.label}</label>
                          <div className="flex">
                            <input type="number" className="w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-l-lg py-2 pl-2 text-sm font-bold outline-none" placeholder="1" value={op.content} onChange={e=>updateVar(op.id,'content',parseFloat(e.target.value))} />
                            <select className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-0 rounded-r-lg px-1 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer w-20" value={op.unit} onChange={e=>updateVar(op.id,'unit',e.target.value)}>{typeConfig.units.map(u => <option key={u} value={u}>{u}</option>)}</select>
                          </div>
                       </div>
                        <div className="col-span-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 mt-1 flex items-center justify-between gap-3">
                           <div className="flex-1">
                              <label className="text-[10px] uppercase font-bold text-amber-600 mb-1 block">Pemakaian ({op.unit})</label>
                              <input type="number" className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg py-1.5 px-2 text-sm font-bold text-amber-800 dark:text-amber-400 outline-none" placeholder="0" value={op.usage} onChange={e=>updateVar(op.id,'usage',parseFloat(e.target.value))} />
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-medium">Biaya</p>
                              <p className="text-base font-black text-slate-700 dark:text-white">{formatIDR(op.cost)}</p>
                           </div>
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

      {/* SUBTOTAL MODAL */}
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
               <input type="number" className="w-16 bg-transparent text-right font-bold text-xl outline-none" value={production.yield} onChange={e=>setProduction({...production, yield: parseFloat(e.target.value)||1})} />
               <span className="text-xs font-medium text-slate-400">Pcs</span>
             </div>
          </div>
        </div>
      </div>

      {/* C. BIAYA TETAP (TOGGLE) */}
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
            <div className="w-full mb-3">
              <NumericInput label="Target Produksi / Bulan" placeholder="100" value={production.monthlyTarget} onChange={v=>setProduction({...production, monthlyTarget: v})} suffix="Pcs" className="bg-white dark:bg-slate-900" />
            </div>
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

      {/* 3. HASIL & STRATEGI (UPDATED) */}
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
              const d = getPriceTier(t.margin);
              const isSelected = customMargin === t.margin;
              return (
                <div key={i} onClick={()=>setCustomMargin(t.margin)} className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer group hover:-translate-y-1 ${isSelected ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                          <div className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-block ${t.color} ${t.text} border ${t.border}`}>{t.name}</div>
                          <span className="text-[10px] font-medium text-slate-400 capitalize">{t.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mb-1">{t.desc}</p>
                      <div className="flex items-center gap-3">
                         <span className="text-xs font-bold text-slate-500">{t.margin}%</span>
                         <span className="text-xs font-bold text-emerald-600">Untung {formatIDR(d.profit)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                       <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none">{formatIDR(d.final)}</h3>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* CUSTOM MARGIN */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Edit3 className="w-3 h-3"/> Custom Margin</label>
              <div className="text-right">
                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{formatIDR(finalPrice)}</p>
              </div>
            </div>
            <input type="range" min="0" max="150" step="0.1" className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" value={customMargin} onChange={(e) => setCustomMargin(parseFloat(e.target.value))} />
            <div className="text-center mt-1 font-bold text-slate-900 dark:text-white text-xs">{customMargin}%</div>
          </div>

          {/* TARGET & PROYEKSI (UPDATED) */}
          <Card title="Target & Proyeksi" icon={TrendingUp} help="Hitung berapa banyak harus jual biar dapet target cuan segitu." className="bg-white border-0 shadow-none !p-0">
             <div className="mt-2">
                 <NumericInput label="Target Laba Bersih (Bulan)" placeholder="5.000.000" prefix="Rp" value={targetProfit} onChange={setTargetProfit} />
                 
                 {/* CEK KOMPETITOR (ADDED BACK) */}
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

      {/* COMPACT BOTTOM ACTIONS */}
      <div className="grid grid-cols-4 gap-2 pb-2">
         <Button variant="outline" onClick={reset} icon={RotateCcw} className="col-span-1 border-slate-300 dark:border-slate-700">Reset</Button>
         <Button variant="secondary" onClick={()=>setShowLoad(true)} icon={FolderOpen} className="col-span-1">Load</Button>
         <Button variant="primary" onClick={save} icon={Save} className="col-span-2">Simpan Data</Button>
      </div>
      <Button variant="success" onClick={handleExportExcel} disabled={isExporting} icon={FileSpreadsheet} className="w-full py-3 rounded-xl bg-emerald-600 border-none text-white shadow-lg shadow-emerald-500/20 text-xs">
          {isExporting ? 'Mengekspor...' : 'Export Laporan (.xlsx)'}
      </Button>

      {/* LOAD MODAL */}
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
                  <button onClick={(e)=>{e.stopPropagation(); setSavedRecipes(savedRecipes.filter(i=>i.id!==r.id)); localStorage.setItem('hpp_pro_db', JSON.stringify(savedRecipes.filter(i=>i.id!==r.id)));}} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. TAB: POS (KASIR)
// ============================================================================

const PosTab = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [search, setSearch] = useState('');
  const [newProd, setNewProd] = useState({ name: '', price: 0, stock: 0, image: null });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const r = JSON.parse(localStorage.getItem('hpp_pro_db') || '[]').map(i => ({ id: i.id, name: i.product.name, price: i.finalPrice, image: i.product.image, stock: 999, hpp: i.hppBersih }));
    const m = JSON.parse(localStorage.getItem('pos_manual_db') || '[]');
    setProducts([...r, ...m]);
  }, []);

  const addManual = () => {
    if(!newProd.name) return;
    const item = { id: `m_${Date.now()}`, ...newProd, hpp: newProd.price*0.7 };
    setProducts(prev => { const n = [...prev, item]; localStorage.setItem('pos_manual_db', JSON.stringify([...JSON.parse(localStorage.getItem('pos_manual_db')||'[]'), item])); return n; });
    setShowAdd(false); setNewProd({ name: '', price: 0, stock: 0, image: null });
  };
  const toCart = (p) => setCart(prev => { const exist = prev.find(i => i.id === p.id); return exist ? prev.map(i => i.id === p.id ? {...i, qty: i.qty+1} : i) : [...prev, {...p, qty: 1}]; });
  const updateQty = (id, d) => setCart(prev => prev.map(i => i.id === id ? {...i, qty: Math.max(1, i.qty + d)} : i));
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const checkout = () => {
    const tx = { id: Date.now(), date: new Date().toISOString(), items: cart, total: cart.reduce((a,b)=>a+(b.price*b.qty),0), profit: cart.reduce((a,b)=>a+((b.price-b.hpp)*b.qty),0) };
    localStorage.setItem('pos_history_db', JSON.stringify([...JSON.parse(localStorage.getItem('pos_history_db')||'[]'), tx]));
    setCart([]); setSuccess(true); setTimeout(()=>setSuccess(false), 2000); setShowCart(false);
  };
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col md:flex-row pb-24 max-w-6xl mx-auto w-full px-2 sm:px-4">
      <div className="flex-1 p-2 sm:p-4 overflow-y-auto">
        <div className="flex gap-2 mb-4 sticky top-0 bg-slate-50 dark:bg-slate-950 z-10 py-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
            <input className="w-full bg-white dark:bg-slate-900 rounded-xl pl-9 pr-4 py-2 text-sm outline-none shadow-sm dark:text-white" placeholder="Cari produk..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <button onClick={()=>setShowAdd(true)} className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-500/30 hover:scale-105 transition"><Plus className="w-5 h-5"/></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(p => (
            <div key={p.id} onClick={()=>toCart(p)} className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-indigo-500 transition group">
              <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl mb-2.5 overflow-hidden relative">
                {p.image ? <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition"/> : <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-slate-300">{p.name[0]}</div>}
                <div className="absolute bottom-1 right-1 bg-slate-900/80 backdrop-blur text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">{p.stock} Stok</div>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate">{p.name}</h4>
              <p className="text-indigo-600 font-bold text-[10px] mt-0.5">{formatIDR(p.price)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm md:static md:bg-transparent md:w-80 transition-all ${showCart ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'}`} onClick={()=>setShowCart(false)}>
        <div className={`absolute right-0 top-0 h-full w-full md:w-80 bg-white dark:bg-slate-900 shadow-2xl md:border-l border-slate-100 dark:border-slate-800 flex flex-col transition-transform duration-300 ${showCart ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`} onClick={e=>e.stopPropagation()}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-base text-slate-800 dark:text-white">Keranjang</h2>
            <button onClick={()=>setShowCart(false)} className="md:hidden"><X className="w-5 h-5"/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length===0 && <div className="h-full flex flex-col items-center justify-center text-slate-300"><ShoppingCart className="w-10 h-10 mb-2 opacity-50"/><p className="text-xs">Kosong</p></div>}
            {cart.map(i => (
              <div key={i.id} className="flex gap-3 items-center">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shrink-0">
                  {i.image && <img src={i.image} className="w-full h-full object-cover"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-slate-800 dark:text-white truncate">{i.name}</p>
                  <p className="text-[10px] text-slate-500">{formatIDR(i.price)}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg">
                  <button onClick={()=>updateQty(i.id,-1)} className="w-5 h-5 bg-white dark:bg-slate-700 rounded shadow-sm text-[10px] font-bold">-</button>
                  <span className="text-[10px] font-bold dark:text-white w-3 text-center">{i.qty}</span>
                  <button onClick={()=>updateQty(i.id,1)} className="w-5 h-5 bg-white dark:bg-slate-700 rounded shadow-sm text-[10px] font-bold">+</button>
                </div>
                <button onClick={()=>remove(i.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <div className="flex justify-between items-center mb-3">
              <span className="text-slate-500 text-xs font-medium">Total</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">{formatIDR(cart.reduce((a,b)=>a+(b.price*b.qty),0))}</span>
            </div>
            <button onClick={checkout} disabled={cart.length===0} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none hover:scale-[1.02] transition text-sm">Bayar</button>
          </div>
        </div>
      </div>
      <button onClick={()=>setShowCart(true)} className="md:hidden fixed bottom-24 right-4 bg-slate-900 text-white w-12 h-12 rounded-full shadow-xl flex items-center justify-center z-40">
        <ShoppingCart className="w-5 h-5"/>
        {cart.length>0 && <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-slate-900">{cart.length}</span>}
      </button>
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-xs" title="Tambah Manual">
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center relative overflow-hidden border-2 border-dashed border-slate-300">
                  {newProd.image ? <img src={newProd.image} className="w-full h-full object-cover"/> : <ImageIcon className="w-6 h-6 text-slate-300"/>}
                  <input type="file" className="absolute inset-0 opacity-0" onChange={e=>{if(e.target.files[0]){const r=new FileReader();r.onload=v=>setNewProd({...newProd,image:v.target.result});r.readAsDataURL(e.target.files[0]);}}}/>
                </div>
              </div>
              <input className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none border border-slate-200 dark:border-slate-700 text-sm" placeholder="Nama Produk" value={newProd.name} onChange={e=>setNewProd({...newProd, name:e.target.value})} />
              <NumericInput placeholder="Harga Jual" value={newProd.price} onChange={v=>setNewProd({...newProd, price:v})} prefix="Rp" />
              <div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={()=>setShowAdd(false)}>Batal</Button><Button className="flex-1" onClick={addManual}>Simpan</Button></div>
            </div>
          </Card>
        </div>
      )}
      {success && <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"><div className="bg-white dark:bg-slate-800 px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center animate-bounce"><div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-2 text-emerald-600"><CheckCircle className="w-6 h-6"/></div><h2 className="font-bold text-base text-slate-800 dark:text-white">Sukses!</h2></div></div>}
    </div>
  );
};

// ============================================================================
// 5. TAB: REPORT
// ============================================================================

const ReportTab = () => {
  const [filter, setFilter] = useState('month');
  const [txs, setTxs] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => { setTxs(JSON.parse(localStorage.getItem('pos_history_db') || '[]')); }, []);
  const resetReport = () => { if(confirm("Hapus semua riwayat transaksi? Data tidak bisa kembali.")) { localStorage.removeItem('pos_history_db'); setTxs([]); }};
  const stats = useMemo(() => {
    const now = new Date();
    const f = txs.filter(t => { const d = new Date(t.date); if(filter==='today') return d.getDate()===now.getDate() && d.getMonth()===now.getMonth(); if(filter==='month') return d.getMonth()===now.getMonth(); return true; });
    return { rev: f.reduce((a,b)=>a+b.total,0), prof: f.reduce((a,b)=>a+b.profit,0), count: f.length, list: f.reverse() };
  }, [filter, txs]);
  const handleDownloadReport = async () => {
    if(stats.list.length === 0) return alert("Belum ada data.");
    setIsDownloading(true);
    try {
      const XLSX = await loadXLSX();
      const data = stats.list.map(t => ({ "ID": `#${t.id}`, "Tanggal": new Date(t.date).toLocaleDateString(), "Waktu": new Date(t.date).toLocaleTimeString(), "Total Omzet": t.total, "Total Profit": t.profit, "Items": t.items.map(i => `${i.name} (${i.qty})`).join(', ') }));
      const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan"); XLSX.writeFile(wb, `Laporan_${filter}.xlsx`);
    } catch (e) { alert("Gagal download: " + e.message); }
    setIsDownloading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-32 space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-xl font-bold text-slate-900 dark:text-white">Laporan</h1><p className="text-xs text-slate-400">Ringkasan performa bisnismu</p></div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 sm:flex-none justify-center">
            {['today','month','all'].map(k => (
              <button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition capitalize ${filter===k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{k==='all'?'Semua':k==='today'?'Hari Ini':'Bulan Ini'}</button>
            ))}
          </div>
          <button onClick={handleDownloadReport} className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 transition"><Download className="w-4 h-4"/></button>
          <button onClick={resetReport} className="bg-rose-50 border border-rose-200 text-rose-600 p-2.5 rounded-xl hover:bg-rose-100 transition"><Trash2 className="w-4 h-4"/></button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="relative overflow-hidden">
          <div className="relative z-10"><p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Omzet</p><h2 className="text-2xl font-black text-slate-900 dark:text-white">{formatIDR(stats.rev)}</h2></div>
          <DollarSign className="absolute -right-4 -bottom-4 w-20 h-20 text-slate-100 dark:text-slate-800"/>
        </Card>
        <Card className="relative overflow-hidden border-emerald-500/20">
          <div className="relative z-10"><p className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">Laba Bersih</p><h2 className="text-2xl font-black text-slate-900 dark:text-white">{formatIDR(stats.prof)}</h2></div>
          <TrendingUp className="absolute -right-4 -bottom-4 w-20 h-20 text-emerald-500/10"/>
        </Card>
        <Card className="flex items-center justify-between">
          <div><p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Transaksi</p><h2 className="text-2xl font-black text-slate-900 dark:text-white">{stats.count}</h2></div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><ShoppingCart className="w-5 h-5 text-slate-400"/></div>
        </Card>
      </div>
      <div className="space-y-3">
        <h3 className="font-bold text-slate-800 dark:text-white text-sm">Riwayat Transaksi Real-time</h3>
        {stats.list.length === 0 ? <p className="text-center py-10 text-slate-400 text-xs">Belum ada transaksi.</p> : stats.list.map(t => (
          <div key={t.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex gap-3 items-center hover:border-indigo-500/30 transition shadow-sm">
            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">{t.items[0]?.image ? <img src={t.items[0].image} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-slate-400 text-[10px]">Img</div>}</div>
            <div className="flex-1 min-w-0">
               <div className="flex justify-between items-start"><h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{t.items[0]?.name} {t.items.length > 1 && `+ ${t.items.length-1} lainnya`}</h4><span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{formatIDR(t.total)}</span></div>
               <div className="flex justify-between items-end mt-1"><div className="flex flex-col"><span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(t.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span><span className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div><span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 font-bold">#{t.id.toString().slice(-4)}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// APP SHELL
// ============================================================================

const App = () => {
  const [active, setActive] = useState('calc');
  const [dark, setDark] = useState(false);

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex justify-between items-center max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><Calculator className="w-4 h-4"/></div>
            <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white">HPP Master Pro</h1>
          </div>
          <button onClick={()=>setDark(!dark)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition">{dark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}</button>
        </div>
        <div className="animate-fade-in pt-4 pb-24">
          {active==='calc' && <CalculatorTab/>}
          {active==='pos' && <PosTab/>}
          {active==='report' && <ReportTab/>}
        </div>
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-full shadow-2xl shadow-slate-200/50 dark:shadow-black/50 z-40 flex gap-1 border border-white/20 dark:border-white/10">
          {[
            { id: 'calc', icon: Calculator, l: 'Hitung' },
            { id: 'pos', icon: ShoppingCart, l: 'Kasir' },
            { id: 'report', icon: BarChart3, l: 'Laporan' }
          ].map(i => (
            <button key={i.id} onClick={()=>setActive(i.id)} className={`relative px-5 py-2.5 rounded-full transition-all duration-300 flex items-center justify-center gap-2 ${active===i.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <i.icon className="w-4 h-4"/>
              {active===i.id && <span className="text-[10px] font-bold whitespace-nowrap">{i.l}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default App;

