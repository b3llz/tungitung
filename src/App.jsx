import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, ShoppingCart, BarChart3, Plus, Trash2, 
  Save, FolderOpen, RotateCcw, CheckCircle, 
  TrendingUp, Package, Zap, DollarSign, X, 
  Edit3, Image as ImageIcon, Search, Sun, Moon, 
  ArrowRight, HelpCircle, Shield, Crown, Layers, 
  Download, FileSpreadsheet
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
// 1. UTILITIES & UI COMPONENTS
// ============================================================================

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
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 bg-slate-800 text-white text-xs rounded-xl shadow-xl animate-fade-in-up border border-slate-700">
          <div className="flex justify-between mb-2 pb-2 border-b border-slate-700">
            <span className="font-bold text-indigo-400">Panduan Kilat</span>
            <X className="w-3 h-3 cursor-pointer hover:text-red-400" onClick={(e)=>{ e.stopPropagation(); setIsOpen(false);}}/>
          </div>
          <p className="leading-relaxed text-slate-300">{text}</p>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 border-r border-b border-slate-700 rotate-45"></div>
        </div>
      )}
    </div>
  );
};

const NumericInput = ({ value, onChange, placeholder, className, prefix, suffix, label }) => {
  const [displayValue, setDisplayValue] = useState('');
  useEffect(() => {
    setDisplayValue(formatNumberDisplay(value));
  }, [value]);

  const handleChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '' || /^[0-9]*\.?[0-9]*$/.test(rawValue)) {
      setDisplayValue(formatNumberDisplay(rawValue));
      onChange(rawValue === '' ? 0 : parseFloat(rawValue));
    }
  };

  const getFontSize = (len) => {
    if (len > 12) return 'text-xs';
    if (len > 9) return 'text-sm';
    return 'text-base';
  };

  return (
    <div className="w-full">
      {label && <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1.5 block whitespace-nowrap">{label}</label>}
      <div className="relative group">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium z-10 pointer-events-none">{prefix}</span>
        )}
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl py-2.5 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 ${prefix ? 'pl-9' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'} ${className} ${getFontSize(displayValue.length)}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
};

const Card = ({ children, className = "", title, icon: Icon, action, help }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-100 dark:border-slate-800 transition-all duration-300 ${className}`}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700"><Icon className="w-5 h-5" /></div>}
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
              {title} {help && <HelpBox text={help} />}
            </h3>
          </div>
        </div>
        {action}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", icon: Icon, disabled }) => {
  const styles = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200",
    outline: "border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
};

// ============================================================================
// 2. TAB: CALCULATOR (HPP)
// ============================================================================

const CalculatorTab = () => {
  const [calcMode, setCalcMode] = useState('detail');
  const [simpleModal, setSimpleModal] = useState(0);

  const [product, setProduct] = useState({ name: '', type: 'Makanan', image: null });
  const [materials, setMaterials] = useState([{ id: 1, name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
  const [variableOps, setVariableOps] = useState([{ id: 1, name: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0 }]);
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
  const updateVar = (id, f, v) => setVariableOps(prev => prev.map(o => o.id===id ? {...o, [f]:v, cost: calcRow(f==='price'?v:o.price, f==='content'?v:o.content, f==='usage'?v:o.usage)} : o));
  const updateFix = (id, v) => setFixedOps(prev => prev.map(f => f.id===id ? {...f, cost: v} : f));
  const addMat = () => setMaterials([...materials, { id: Date.now(), name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
  const addVar = () => setVariableOps([...variableOps, { id: Date.now(), name: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0 }]);
  const addFix = () => setFixedOps([...fixedOps, { id: Date.now(), name: '', cost: 0 }]);
  const removeRow = (setter, list, id) => list.length > 1 && setter(list.filter(i => i.id !== id));
  
  // Totals
  const totalMat = materials.reduce((a,b) => a + b.cost, 0);
  const totalVar = variableOps.reduce((a,b) => a + b.cost, 0);
  const totalFix = fixedOps.reduce((a,b) => a + b.cost, 0);
  
  // HPP Logic Switcher
  let matPerUnit, varPerUnit, fixPerUnit, hppBersih;
  if (calcMode === 'simple') {
    matPerUnit = simpleModal / (production.yield || 1); 
    varPerUnit = 0;
    fixPerUnit = 0;
    hppBersih = matPerUnit;
  } else {
    matPerUnit = totalMat / (production.yield || 1);
    varPerUnit = totalVar / (production.yield || 1);
    fixPerUnit = showFixed ? (totalFix / (production.monthlyTarget || 1)) : 0;
    hppBersih = matPerUnit + varPerUnit + fixPerUnit;
  }

  // Pricing & Tiers Logic (UPDATED REQUEST)
  const round = (p) => smartRounding ? (p < 1000 ? Math.ceil(p/100)*100 : Math.ceil(p/500)*500) : p;
  
  const getTier = (margin) => {
    const raw = hppBersih + (hppBersih * (margin/100));
    return { raw, final: round(raw), profit: round(raw) - hppBersih };
  };

  const tiers = [
    { 
      name: "SIAP TEMPUR", 
      category: "Kompetitif", 
      desc: "Cocok untuk penetrasi pasar baru", 
      margin: 22.8, 
      color: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: Shield 
    },
    { 
      name: "MASUK AKAL", 
      category: "Standar", 
      desc: "Margin standar pasar pada umumnya", 
      margin: 48.6, 
      color: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: Layers 
    },
    { 
      name: "CEPET NAIK HAJI", 
      category: "Premium", 
      desc: "Target pasar sultan / niche market", 
      margin: 78.4, 
      color: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", icon: Crown 
    }
  ];

  // --- LOGIC PROYEKSI LENGKAP ---
  function getPriceTier(margin) { return getTier(margin); }

  const finalPrice = getPriceTier(customMargin).final;
  const profitPerPcs = finalPrice - hppBersih;
  const targetPcsMonth = profitPerPcs > 0 ? Math.ceil(targetProfit / profitPerPcs) : 0;
  
  const projSalesDay = Math.ceil(targetPcsMonth / 30);
  const projOmzetMonth = targetPcsMonth * finalPrice;
  // Total Biaya Produksi (Variable Cost Total)
  const projVarCostMonth = targetPcsMonth * (matPerUnit + varPerUnit);
  // Total Biaya Tetap
  const projFixedCostMonth = showFixed ? totalFix : 0;
  // Net Profit
  const projNetProfitMonth = projOmzetMonth - projVarCostMonth - projFixedCostMonth;

  // Storage Handlers
  useEffect(() => { setSavedRecipes(JSON.parse(localStorage.getItem('hpp_pro_db') || '[]')); }, []);
  const save = () => {
    if(!product.name) return alert("Isi nama produk dulu!");
    const data = { id: Date.now(), product, materials, variableOps, fixedOps, production, hppBersih, finalPrice };
    const newDb = [...savedRecipes, data];
    setSavedRecipes(newDb);
    localStorage.setItem('hpp_pro_db', JSON.stringify(newDb));
    alert("Data Tersimpan!");
  };
  const load = (r) => {
    setProduct(r.product); setMaterials(r.materials); setVariableOps(r.variableOps); setFixedOps(r.fixedOps||[]);
    setProduction(r.production); setShowLoad(false);
  };
  const reset = () => {
    if(confirm("Reset semua?")) {
      setProduct({name:'', type:'Makanan', image:null});
      setMaterials([{ id: 1, name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
      setVariableOps([{ id: 1, name: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0 }]);
      setFixedOps([{ id: 1, name: 'Sewa', cost: 0 }]);
      setProduction({ yield: 1, monthlyTarget: 100 });
      setSimpleModal(0);
    }
  };

  // --- EXPORT TO EXCEL FEATURE ---
  const handleExportExcel = async () => {
    if(!product.name) return alert("Beri nama produk dulu sebelum export!");
    setIsExporting(true);
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.utils.book_new();
      // Sheet 1: Ringkasan
      const summaryData = [
        ["LAPORAN HPP - " + product.name.toUpperCase()],
        ["Tanggal", new Date().toLocaleDateString()],
        [""],
        ["INFO PRODUK"],
        ["Nama", product.name],
        ["Kategori", product.type],
        ["Target Yield", production.yield + " Pcs"],
        [""],
        ["ANALISA BIAYA (Per Unit)"],
        ["Bahan Baku", matPerUnit],
        ["Operasional", varPerUnit],
        ["Tetap", fixPerUnit],
        ["HPP BERSIH", hppBersih],
        [""],
        ["HARGA JUAL"],
        ["Margin", customMargin + "%"],
        ["Harga Final", finalPrice],
        ["Profit/Pcs", profitPerPcs]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

      // Sheet 2: Detail Bahan
      if(calcMode === 'detail') {
        const matHeader = ["Bahan", "Harga Beli", "Isi Kemasan", "Unit", "Dipakai", "Biaya"];
        const matBody = materials.map(m => [m.name, m.price, m.content, m.unit, m.usage, m.cost]);
        const wsMat = XLSX.utils.aoa_to_sheet([matHeader, ...matBody]);
        XLSX.utils.book_append_sheet(wb, wsMat, "Bahan Baku");
        const varHeader = ["Operasional", "Biaya", "Kapasitas", "Unit", "Dipakai", "Biaya"];
        const varBody = variableOps.map(v => [v.name, v.price, v.content, v.unit, v.usage, v.cost]);
        const wsVar = XLSX.utils.aoa_to_sheet([varHeader, ...varBody]);
        XLSX.utils.book_append_sheet(wb, wsVar, "Operasional");
      }

      XLSX.writeFile(wb, `HPP_${product.name.replace(/\s+/g, '_')}.xlsx`);
    } catch (e) {
      alert("Gagal export: " + e.message);
    }
    setIsExporting(false);
  };

  return (
    <div className="space-y-6 pb-32 max-w-5xl mx-auto w-full px-4 sm:px-6">
      
      {/* 1. PRODUCT HEADER */}
      <Card className="overflow-hidden !p-0">
        <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
          <div className="w-24 h-24 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center relative group cursor-pointer hover:border-indigo-400 transition-colors">
            {product.image ? <img src={product.image} className="w-full h-full object-cover rounded-2xl" alt="Product"/> : <ImageIcon className="w-8 h-8 text-slate-300"/>}
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
              if(e.target.files[0]) { const r = new FileReader(); r.onload=v=>setProduct({...product, image:v.target.result}); r.readAsDataURL(e.target.files[0]); }
            }}/>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-2xl transition text-[10px] text-white font-bold">Ubah Foto</div>
          </div>
          <div className="flex-1 w-full text-center sm:text-left">
            <input 
              className="bg-transparent text-3xl font-bold w-full outline-none placeholder:text-slate-500 border-b border-white/10 focus:border-indigo-500 transition-colors pb-2 mb-3 text-slate-900 dark:text-white"
              placeholder="Nama Produk..." value={product.name} onChange={e=>setProduct({...product, name:e.target.value})}
            />
            <div className="flex justify-center sm:justify-start gap-2 flex-wrap">
              {['Makanan','Minuman','Fashion','Jasa'].map(t => (
                <button key={t} onClick={()=>setProduct({...product, type:t})} className={`px-4 py-1 rounded-full text-xs font-semibold transition border ${product.type===t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* MODE TOGGLE */}
      <div className="flex justify-center">
        <div className="bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex relative">
          <button onClick={()=>setCalcMode('detail')} className={`px-6 py-2 rounded-lg text-xs font-bold transition ${calcMode==='detail'?'bg-indigo-600 text-white shadow-md':'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>Mode Detail</button>
          <button onClick={()=>setCalcMode('simple')} className={`px-6 py-2 rounded-lg text-xs font-bold transition ${calcMode==='simple'?'bg-emerald-600 text-white shadow-md':'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}>Mode Cepat</button>
          <div className="absolute -right-8 top-1/2 -translate-y-1/2">
            <HelpBox text="Pilih 'Mode Cepat' kalau cuma mau hitung dari total belanjaan. Pilih 'Mode Detail' untuk breakdown bahan per resep." />
          </div>
        </div>
      </div>

      {/* 2. COST CALCULATION */}
      {calcMode === 'detail' ? (
        <Card title="Komponen Biaya" icon={Calculator} help="Masukkan semua pengeluaran. Bahan baku itu resep, Operasional itu gas/kemasan/upah masak.">
          {/* A. BAHAN BAKU */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl w-full sm:w-fit">
              <div className="p-1.5 bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200 rounded-lg"><Package className="w-4 h-4"/></div>
              <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-wider">Bahan Baku</h4>
            </div>
            
            <div className="space-y-4">
              {materials.map((m) => (
                <div key={m.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 relative group">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="col-span-12 md:col-span-4">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Nama Bahan</label>
                      <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm font-bold outline-none focus:border-indigo-500 dark:text-white" placeholder="Contoh: Tepung" value={m.name} onChange={e=>updateMat(m.id,'name',e.target.value)} />
                    </div>
                    <div className="col-span-6 md:col-span-3"><NumericInput label="Harga Beli" placeholder="0" prefix="Rp" value={m.price} onChange={v=>updateMat(m.id,'price',v)} /></div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Isi Kemasan</label>
                      <div className="flex gap-0">
                        <NumericInput placeholder="1000" value={m.content} onChange={v=>updateMat(m.id,'content',v)} className="rounded-r-none border-r-0 w-full" />
                        <select className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl px-2 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none w-20 cursor-pointer" value={m.unit} onChange={e=>updateMat(m.id,'unit',e.target.value)}>
                          <option value="gram">gr</option><option value="ml">ml</option><option value="pcs">pcs</option><option value="kg">kg</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-2"><NumericInput label="Dipakai" placeholder="0" value={m.usage} onChange={v=>updateMat(m.id,'usage',v)} className="bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" /></div>
                  </div>
                  <button onClick={()=>removeRow(setMaterials,materials,m.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"><Trash2 className="w-3 h-3"/></button>
                </div>
              ))}
              <Button variant="outline" onClick={addMat} icon={Plus} className="w-full">Tambah Bahan</Button>
            </div>
          </div>

          {/* B. OPS VARIABEL */}
          <div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl w-full sm:w-fit">
              <div className="p-1.5 bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200 rounded-lg"><Zap className="w-4 h-4"/></div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 uppercase tracking-wider">Operasional Langsung</h4>
            </div>
            
            <div className="space-y-4">
              {variableOps.map((op) => (
                <div key={op.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 relative group">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="col-span-12 md:col-span-4">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Nama Biaya</label>
                      <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm font-bold outline-none focus:border-indigo-500 dark:text-white" placeholder="Contoh: Gas LPG" value={op.name} onChange={e=>updateVar(op.id,'name',e.target.value)} />
                    </div>
                    <div className="col-span-6 md:col-span-3"><NumericInput label="Biaya" placeholder="0" prefix="Rp" value={op.price} onChange={v=>updateVar(op.id,'price',v)} /></div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Total Kapasitas</label>
                      <div className="flex gap-0">
                        <NumericInput placeholder="1" value={op.content} onChange={v=>updateVar(op.id,'content',v)} className="rounded-r-none border-r-0 w-full" />
                        <select className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl px-2 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none w-20 cursor-pointer" value={op.unit} onChange={e=>updateVar(op.id,'unit',e.target.value)}>
                           <option value="jam">Jam</option><option value="pcs">Pcs</option><option value="kg">Kg</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-2"><NumericInput label="Dipakai" placeholder="0" value={op.usage} onChange={v=>updateVar(op.id,'usage',v)} className="bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" /></div>
                  </div>
                  <button onClick={()=>removeRow(setVariableOps,variableOps,op.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"><Trash2 className="w-3 h-3"/></button>
                </div>
              ))}
              <Button variant="outline" onClick={addVar} icon={Plus} className="w-full">Tambah Operasional</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center py-10 bg-slate-50 dark:bg-slate-900/50" help="Isi total uang belanja 1x produksi, lalu bagi dengan jumlah produk jadi.">
          <h3 className="text-lg font-bold text-slate-700 dark:text-white mb-4">Mode Hitung Cepat</h3>
          <div className="w-full max-w-sm">
            <NumericInput label="Total Modal Belanja (Rp)" placeholder="Masukkan total uang keluar" prefix="Rp" value={simpleModal} onChange={setSimpleModal} className="text-center text-xl h-14" />
          </div>
        </Card>
      )}

      {/* SUBTOTAL MODAL */}
      <div className="mt-8 p-6 bg-slate-900 dark:bg-black rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-6 text-white shadow-xl shadow-slate-200 dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="relative z-10">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{calcMode==='detail' ? 'Total Modal Langsung (Batch)' : 'Total Modal'}</p>
          <p className="text-4xl font-bold tracking-tight">{formatIDR(calcMode==='detail' ? totalMat+totalVar : simpleModal)}</p>
        </div>
        <div className="relative z-10 flex flex-col items-end w-full sm:w-auto">
          <label className="text-[10px] text-slate-400 font-bold uppercase mb-2">Jumlah Produk Jadi</label>
          <div className="flex items-center gap-2 bg-white/10 p-2 rounded-xl border border-white/20 w-full sm:w-auto justify-end">
            <input 
              type="number" 
              className="w-24 bg-transparent text-right font-bold text-3xl outline-none" 
              value={production.yield} 
              onChange={e=>setProduction({...production, yield: parseFloat(e.target.value)||1})} 
            />
            <span className="text-sm font-medium text-slate-400 pr-2">Pcs</span>
          </div>
        </div>
      </div>

      {/* C. BIAYA TETAP (TOGGLE) */}
      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center cursor-pointer p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition" onClick={() => setShowFixed(!showFixed)}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${showFixed ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <Package className="w-5 h-5"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">Biaya Tetap Bulanan (Opsional) <HelpBox text="Biaya bulanan kayak sewa/gaji yang dibagi rata ke target produksi." /></h3>
              <p className="text-xs text-slate-400">Untuk Sewa, Gaji Tetap, Listrik, dll.</p>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full p-1 transition-colors ${showFixed ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showFixed ? 'translate-x-5' : ''}`}></div>
          </div>
        </div>

        {showFixed && (
          <div className="animate-fade-in mt-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="w-full sm:w-1/2 mb-4">
              <NumericInput 
                label="Target Produksi / Bulan" 
                placeholder="100" 
                value={production.monthlyTarget} 
                onChange={v=>setProduction({...production, monthlyTarget: v})} 
                suffix="Pcs"
                className="bg-white dark:bg-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-2">*Biaya tetap akan dibagi jumlah ini.</p>
            </div>
            <div className="space-y-3">
              {fixedOps.map(op => (
                <div key={op.id} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Nama Biaya</label>
                    <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-bold outline-none" placeholder="Nama Biaya" value={op.name} onChange={e=>updateFix(op.id,'name',e.target.value)} />
                  </div>
                  <div className="w-40">
                    <NumericInput label="Biaya" value={op.cost} onChange={v=>updateFix(op.id, v)} prefix="Rp" className="bg-white dark:bg-slate-900" />
                  </div>
                  <button onClick={()=>removeRow(setFixedOps,fixedOps,op.id)} className="p-3 mb-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <Button variant="secondary" onClick={addFix} className="w-full text-xs h-10 mt-2">Tambah Biaya Tetap</Button>
            </div>
          </div>
        )}
      </div>

      {/* 3. HASIL & STRATEGI */}
      <Card className="!p-0 overflow-hidden border-indigo-100 dark:border-slate-800 rounded-3xl">
        <div className="bg-indigo-600 p-8 text-white text-center relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-[0.2em] mb-2">Total HPP Bersih / Pcs</p>
            <h2 className="text-6xl font-black tracking-tighter mb-4 drop-shadow-md">{formatIDR(hppBersih)}</h2>
            <div className="inline-flex gap-6 text-[10px] font-bold uppercase text-indigo-200 bg-indigo-800/30 py-2 px-6 rounded-full backdrop-blur-sm border border-indigo-500/30">
              <span>Bahan: {formatIDR(matPerUnit)}</span><span className="opacity-30">|</span><span>Ops: {formatIDR(varPerUnit)}</span>
              {showFixed && <><span className="opacity-30">|</span><span>Tetap: {formatIDR(fixPerUnit)}</span></>}
            </div>
          </div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">Saran Harga Jual <HelpBox text="Tiga pilihan harga untuk segmentasi pasar yang berbeda." /></h3>
            <div className="flex items-center gap-2 cursor-pointer bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800" onClick={() => setSmartRounding(!smartRounding)}>
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Smart Rounding</span>
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${smartRounding ? 'bg-emerald-500' : 'bg-slate-300'}`}><div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${smartRounding ? 'translate-x-4' : ''}`}></div></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {tiers.map((t, i) => {
              const d = getPriceTier(t.margin);
              const isSelected = customMargin === t.margin;
              return (
                <div key={i} onClick={()=>setCustomMargin(t.margin)} className={`relative overflow-hidden rounded-2xl border-2 transition-all cursor-pointer group hover:-translate-y-1 ${isSelected ? 'border-indigo-600 shadow-xl shadow-indigo-500/10 scale-105 z-10 bg-indigo-50/50' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-200'}`}>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md mb-1 inline-block ${t.color} ${t.text} border ${t.border}`}>{t.name}</div>
                        <p className="text-[10px] text-slate-400 font-medium leading-tight">{t.category}</p>
                      </div>
                      <t.icon className={`w-5 h-5 ${t.text} opacity-50`}/>
                    </div>
                    
                    {/* Price Logic Display */}
                    <div className="min-h-[3rem]">
                      {smartRounding && d.final !== d.raw && (
                        <p className="text-xs text-rose-400 line-through font-semibold mb-0.5">{formatIDR(d.raw)}</p>
                      )}
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{formatIDR(d.final)}</h3>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-2 border-t border-dashed border-slate-200 pt-2 mb-2 line-clamp-2">{t.desc}</p>

                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                      <span className="text-xs text-slate-500 font-medium">Margin {t.margin}%</span>
                      <div className="text-right">
                        <span className="text-[8px] text-emerald-500 block font-bold uppercase tracking-wider">Profit</span>
                        <span className="text-xs font-black text-emerald-600">+{formatIDR(d.profit)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* CUSTOM MARGIN */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-end mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Edit3 className="w-4 h-4"/> Custom Margin</label>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Harga Jual Final</p>
                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{formatIDR(getPriceTier(customMargin).final)}</p>
              </div>
            </div>
            <input 
              type="range" min="0" max="150" step="0.1"
              className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              value={customMargin} onChange={(e) => setCustomMargin(parseFloat(e.target.value))} 
            />
            <div className="text-center mt-2 font-bold text-slate-900 dark:text-white">{customMargin}%</div>
          </div>

          <Card title="Target & Proyeksi" icon={TrendingUp} help="Hitung berapa banyak harus jual biar dapet target cuan segitu." className="bg-white border-0 shadow-none !p-0">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
               <div>
                 <NumericInput label="Target Laba Bersih (Bulan)" placeholder="5.000.000" prefix="Rp" value={targetProfit} onChange={setTargetProfit} />
                 
                 {/* COMPTITIOR CHECK */}
                 <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">Cek Kompetitor</label>
                    <NumericInput placeholder="Harga Pesaing" prefix="Rp" value={competitorPrice} onChange={setCompetitorPrice} className="py-2 text-sm" />
                    {competitorPrice > 0 && (
                      <div className={`mt-3 text-xs font-bold flex items-center gap-1 ${competitorPrice < finalPrice ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {competitorPrice < finalPrice ? <ArrowRight className="w-3 h-3 rotate-45"/> : <ArrowRight className="w-3 h-3 -rotate-45"/>}
                        {competitorPrice < finalPrice ? `Lebih mahal ${formatIDR(finalPrice - competitorPrice)}` : `Lebih murah ${formatIDR(competitorPrice - finalPrice)}`}
                      </div>
                    )}
                 </div>
               </div>
               
               {/* OUTPUT PROYEKSI LENGKAP */}
               {targetProfit > 0 && hppBersih > 0 && (
                 <div className="bg-emerald-600 text-white rounded-2xl p-6 flex flex-col justify-center shadow-lg shadow-emerald-200 dark:shadow-none relative overflow-hidden">
                   <div className="relative z-10 space-y-3">
                     
                     <div className="flex justify-between items-center pb-3 border-b border-white/20">
                       <span className="text-xs text-emerald-100 font-bold uppercase opacity-80">Target Jual / Hari</span>
                       <span className="text-xl font-bold">{projSalesDay} pcs</span>
                     </div>

                     <div className="flex justify-between items-center pb-3 border-b border-white/20">
                       <span className="text-xs text-emerald-100 font-bold uppercase opacity-80">Total Jual / Bulan</span>
                       <span className="text-xl font-bold">{targetPcsMonth} pcs</span>
                     </div>

                     <div className="flex justify-between items-center text-emerald-50">
                       <span className="text-xs opacity-80">Potensi Omzet / Bulan</span>
                       <span className="text-sm font-semibold">{formatIDR(projOmzetMonth)}</span>
                     </div>

                     <div className="flex justify-between items-center text-emerald-50">
                       <span className="text-xs opacity-80">Total Biaya Produksi / Bulan</span>
                       <span className="text-sm font-semibold">{formatIDR(projVarCostMonth)}</span>
                     </div>

                     {showFixed && (
                       <div className="flex justify-between items-center text-emerald-50">
                         <span className="text-xs opacity-80">Total Biaya Tetap / Bulan</span>
                         <span className="text-sm font-semibold">{formatIDR(projFixedCostMonth)}</span>
                       </div>
                     )}

                     <div className="pt-3 mt-1 border-t-2 border-white/30 flex justify-between items-center">
                       <span className="text-sm font-black text-white uppercase">Proyeksi Laba Bersih / Bulan</span>
                       <span className="text-2xl font-black text-white">{formatIDR(projNetProfitMonth)}</span>
                     </div>

                   </div>
                   <TrendingUp className="absolute -right-6 -bottom-6 w-40 h-40 text-emerald-500 opacity-40 rotate-12"/>
                 </div>
               )}
             </div>
          </Card>
        </div>
      </Card>

      {/* 4. CHARTS */}
      <Card className="flex flex-col items-center justify-center py-8">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Breakdown Biaya per Produk</h3>
        {hppBersih > 0 ? (
          <div className="flex flex-col md:flex-row items-center gap-10 w-full justify-center px-4">
            <div className="relative w-48 h-48 shrink-0">
              <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
                <circle cx="16" cy="16" r="16" fill="currentColor" className="text-slate-100 dark:text-slate-800" />
                <circle cx="16" cy="16" r="16" fill="transparent" stroke="#6366f1" strokeWidth="32" strokeDasharray={`${(matPerUnit/hppBersih)*100} 100`} />
                <circle cx="16" cy="16" r="16" fill="transparent" stroke="#f59e0b" strokeWidth="32" strokeDasharray={`${(varPerUnit/hppBersih)*100} 100`} strokeDashoffset={-((matPerUnit/hppBersih)*100)} />
                {showFixed && <circle cx="16" cy="16" r="16" fill="transparent" stroke="#10b981" strokeWidth="32" strokeDasharray={`${(fixPerUnit/hppBersih)*100} 100`} strokeDashoffset={-(((matPerUnit+varPerUnit)/hppBersih)*100)} />}
                <circle cx="16" cy="16" r="12" fill="currentColor" className="text-white dark:text-slate-900" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Total</span>
                <span className="font-black text-slate-800 dark:text-white text-sm">{formatIDR(hppBersih)}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 w-full gap-3">
              {[
                { l: 'Bahan Baku', v: matPerUnit, c: 'bg-indigo-500' },
                { l: 'Operasional', v: varPerUnit, c: 'bg-amber-500' },
                ...(showFixed ? [{ l: 'Biaya Tetap', v: fixPerUnit, c: 'bg-emerald-500' }] : [])
              ].map((d,i) => (
                <div key={i} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${d.c}`}></div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{d.l}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-bold text-slate-800 dark:text-white">{formatIDR(d.v)}</span>
                    <span className="block text-[10px] text-slate-400">{Math.round((d.v/hppBersih)*100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="text-slate-400 text-sm">Hitung dulu biar grafik muncul.</p>}
      </Card>

      {/* BOTTOM ACTIONS */}
      <div className="space-y-3 pb-4">
        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={reset} icon={RotateCcw} className="py-4 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">Reset</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={()=>setShowLoad(true)} icon={FolderOpen} className="flex-1 py-4 rounded-2xl shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">Load</Button>
            <Button variant="primary" onClick={save} icon={Save} className="flex-1 py-4 rounded-2xl shadow-xl shadow-indigo-500/30">Simpan</Button>
          </div>
        </div>
        
        {/* EXPORT BUTTON */}
        <Button 
          variant="success" 
          onClick={handleExportExcel} 
          disabled={isExporting} 
          icon={FileSpreadsheet} 
          className="w-full py-4 rounded-2xl bg-emerald-600 border-none text-white shadow-xl shadow-emerald-500/20"
        >
          {isExporting ? 'Mengekspor...' : 'Export Excel (.xlsx)'}
        </Button>
      </div>

      {/* LOAD MODAL */}
      {showLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Database Resep</h3>
              <button onClick={()=>setShowLoad(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-3">
              {savedRecipes.length===0 && <p className="text-center py-10 text-slate-400 text-sm">Kosong.</p>}
              {savedRecipes.map(r => (
                <div key={r.id} onClick={()=>load(r)} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex gap-4 cursor-pointer hover:border-indigo-500 transition group relative">
                  <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl overflow-hidden shadow-sm shrink-0">
                    {r.product?.image ? <img src={r.product.image} className="w-full h-full object-cover" alt="Product"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">{r.product?.name[0]}</div>}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">{r.product?.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">{formatIDR(r.finalPrice)} • {new Date(r.id).toLocaleDateString()}</p>
                  </div>
                  <button onClick={(e)=>{e.stopPropagation(); setSavedRecipes(savedRecipes.filter(i=>i.id!==r.id)); localStorage.setItem('hpp_pro_db', JSON.stringify(savedRecipes.filter(i=>i.id!==r.id)));}} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
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
// 3. TAB: POS & REPORT
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
    const db = JSON.parse(localStorage.getItem('pos_manual_db') || '[]');
    localStorage.setItem('pos_manual_db', JSON.stringify([...db, item]));
    setProducts(prev => [...prev, item]);
    setShowAdd(false); setNewProd({ name: '', price: 0, stock: 0, image: null });
  };
  const toCart = (p) => setCart(prev => {
    const exist = prev.find(i => i.id === p.id);
    return exist ? prev.map(i => i.id === p.id ? {...i, qty: i.qty+1} : i) : [...prev, {...p, qty: 1}];
  });
  const updateQty = (id, d) => setCart(prev => prev.map(i => i.id === id ? {...i, qty: Math.max(1, i.qty + d)} : i));
  const remove = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const checkout = () => {
    const tx = { id: Date.now(), date: new Date().toISOString(), items: cart, total: cart.reduce((a,b)=>a+(b.price*b.qty),0), profit: cart.reduce((a,b)=>a+((b.price-b.hpp)*b.qty),0) };
    const h = JSON.parse(localStorage.getItem('pos_history_db') || '[]');
    localStorage.setItem('pos_history_db', JSON.stringify([...h, tx]));
    setCart([]); setSuccess(true); setTimeout(()=>setSuccess(false), 2000); setShowCart(false);
  };
  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col md:flex-row pb-24 max-w-7xl mx-auto w-full px-4">
      {/* Catalog */}
      <div className="flex-1 p-2 sm:p-4 overflow-y-auto">
        <div className="flex gap-3 mb-6 sticky top-0 bg-slate-50 dark:bg-slate-950 z-10 py-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/>
            <input className="w-full bg-white dark:bg-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none shadow-sm dark:text-white" placeholder="Cari produk..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <button onClick={()=>setShowAdd(true)} className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-500/30 hover:scale-105 transition"><Plus className="w-5 h-5"/></button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => (
            <div key={p.id} onClick={()=>toCart(p)} className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-indigo-500 transition group">
              <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl mb-3 overflow-hidden relative">
                {p.image ? <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition" alt="Product"/> : <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-slate-300">{p.name[0]}</div>}
                <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm">{p.stock} Stok</div>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{p.name}</h4>
              <p className="text-indigo-600 font-bold text-xs mt-1">{formatIDR(p.price)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Drawer */}
      <div className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm md:static md:bg-transparent md:w-96 transition-all ${showCart ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'}`} onClick={()=>setShowCart(false)}>
        <div className={`absolute right-0 top-0 h-full w-full md:w-96 bg-white dark:bg-slate-900 shadow-2xl md:border-l border-slate-100 dark:border-slate-800 flex flex-col transition-transform duration-300 ${showCart ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`} onClick={e=>e.stopPropagation()}>
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-lg text-slate-800 dark:text-white">Keranjang <HelpBox text="Cek belanjaan customer sebelum bayar." /></h2>
            <button onClick={()=>setShowCart(false)} className="md:hidden"><X className="w-6 h-6"/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length===0 && <div className="h-full flex flex-col items-center justify-center text-slate-300"><ShoppingCart className="w-12 h-12 mb-2"/><p>Kosong</p></div>}
            {cart.map(i => (
              <div key={i.id} className="flex gap-3 items-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shrink-0">
                  {i.image && <img src={i.image} className="w-full h-full object-cover" alt="Item"/>}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{i.name}</p>
                  <p className="text-xs text-slate-500">{formatIDR(i.price)}</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg">
                  <button onClick={()=>updateQty(i.id,-1)} className="w-6 h-6 bg-white dark:bg-slate-700 rounded shadow-sm text-xs font-bold">-</button>
                  <span className="text-xs font-bold dark:text-white">{i.qty}</span>
                  <button onClick={()=>updateQty(i.id,1)} className="w-6 h-6 bg-white dark:bg-slate-700 rounded shadow-sm text-xs font-bold">+</button>
                </div>
                <button onClick={()=>remove(i.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-500 text-sm font-medium">Total</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{formatIDR(cart.reduce((a,b)=>a+(b.price*b.qty),0))}</span>
            </div>
            <button onClick={checkout} disabled={cart.length===0} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:shadow-none hover:scale-[1.02] transition">Bayar Sekarang</button>
          </div>
        </div>
      </div>

      {/* FAB Mobile */}
      <button onClick={()=>setShowCart(true)} className="md:hidden fixed bottom-24 right-4 bg-slate-900 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center z-40">
        <ShoppingCart className="w-6 h-6"/>
        {cart.length>0 && <span className="absolute top-0 right-0 w-5 h-5 bg-rose-500 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-slate-900">{cart.length}</span>}
      </button>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm" title="Tambah Produk Manual">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center relative overflow-hidden border-2 border-dashed border-slate-300">
                  {newProd.image ? <img src={newProd.image} className="w-full h-full object-cover" alt="New Prod"/> : <ImageIcon className="w-8 h-8 text-slate-300"/>}
                  <input type="file" className="absolute inset-0 opacity-0" onChange={e=>{if(e.target.files[0]){const r=new FileReader();r.onload=v=>setNewProd({...newProd,image:v.target.result});r.readAsDataURL(e.target.files[0]);}}}/>
                </div>
              </div>
              <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700" placeholder="Nama Produk" value={newProd.name} onChange={e=>setNewProd({...newProd, name:e.target.value})} />
              <NumericInput placeholder="Harga Jual" value={newProd.price} onChange={v=>setNewProd({...newProd, price:v})} prefix="Rp" />
              <NumericInput placeholder="Stok" value={newProd.stock} onChange={v=>setNewProd({...newProd, stock:v})} />
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={()=>setShowAdd(false)}>Batal</Button>
                <Button className="flex-1" onClick={addManual}>Simpan</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-800 px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center animate-bounce">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-3 text-emerald-600"><CheckCircle className="w-8 h-8"/></div>
            <h2 className="font-bold text-xl text-slate-800 dark:text-white">Pembayaran Sukses!</h2>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. TAB: REPORT
// ============================================================================

const ReportTab = () => {
  const [filter, setFilter] = useState('month');
  const [txs, setTxs] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => { setTxs(JSON.parse(localStorage.getItem('pos_history_db') || '[]')); }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const f = txs.filter(t => {
      const d = new Date(t.date);
      if(filter==='today') return d.getDate()===now.getDate() && d.getMonth()===now.getMonth();
      if(filter==='month') return d.getMonth()===now.getMonth();
      return true;
    });
    return { rev: f.reduce((a,b)=>a+b.total,0), prof: f.reduce((a,b)=>a+b.profit,0), count: f.length, list: f.reverse() };
  }, [filter, txs]);

  const chartData = useMemo(() => {
    if(stats.list.length < 2) return null;
    const data = stats.list.slice(0,10).map(t => t.total).reverse();
    const max = Math.max(...data, 100);
    const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
    return { points };
  }, [stats]);

  // --- DOWNLOAD REPORT TO EXCEL ---
  const handleDownloadReport = async () => {
    if(stats.list.length === 0) return alert("Belum ada data untuk di download.");
    setIsDownloading(true);
    try {
      const XLSX = await loadXLSX();
      const data = stats.list.map(t => ({
        "ID Transaksi": `#${t.id}`,
        "Tanggal": new Date(t.date).toLocaleString(),
        "Total Omzet": t.total,
        "Total Profit": t.profit,
        "Items": t.items.map(i => `${i.name} (${i.qty})`).join(', ')
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan");
      
      XLSX.writeFile(wb, `Laporan_${filter}_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e) {
      alert("Gagal download: " + e.message);
    }
    setIsDownloading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-32 space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Laporan Keuangan</h1><p className="text-sm text-slate-400">Ringkasan performa bisnismu</p></div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 sm:flex-none justify-center">
            {['today','month','all'].map(k => (
              <button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${filter===k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{k==='all'?'Semua':k==='today'?'Hari Ini':'Bulan Ini'}</button>
            ))}
          </div>
          <button 
            onClick={handleDownloadReport} 
            disabled={isDownloading}
            className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 transition"
            title="Download Excel"
          >
            <Download className="w-5 h-5"/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Omzet</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">{formatIDR(stats.rev)}</h2>
          </div>
          <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-100 dark:text-slate-800"/>
        </Card>
        <Card className="relative overflow-hidden border-emerald-500/20">
          <div className="relative z-10">
            <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Laba Bersih</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">{formatIDR(stats.prof)}</h2>
          </div>
          <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500/10"/>
        </Card>
        <Card className="flex items-center justify-between">
          <div><p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Transaksi</p><h2 className="text-3xl font-black text-slate-900 dark:text-white">{stats.count}</h2></div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><ShoppingCart className="w-6 h-6 text-slate-400"/></div>
        </Card>
      </div>

      <Card title="Tren Penjualan (Terakhir)">
        {chartData ? (
          <div className="h-48 w-full relative">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.2"/><stop offset="100%" stopColor="#6366f1" stopOpacity="0"/></linearGradient></defs>
              <polyline fill="none" stroke="#6366f1" strokeWidth="2" points={chartData.points} vectorEffect="non-scaling-stroke" />
              <polygon fill="url(#g)" points={`0,100 ${chartData.points} 100,100`} />
            </svg>
          </div>
        ) : <div className="h-40 flex items-center justify-center text-slate-300 italic text-sm">Belum cukup data.</div>}
      </Card>

      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-white">Riwayat Transaksi</h3>
        {stats.list.length === 0 ? <p className="text-center py-10 text-slate-400 text-sm">Belum ada transaksi.</p> : stats.list.map(t => (
          <div key={t.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:border-indigo-500/30 transition">
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-500">#{t.id.toString().slice(-3)}</div>
              <div><p className="font-bold text-slate-800 dark:text-white">{formatIDR(t.total)}</p><p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleString()}</p></div>
            </div>
            <p className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">+{formatIDR(t.profit)}</p>
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
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
        
        {/* Top Navbar */}
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><Calculator className="w-5 h-5"/></div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">HPP Master Pro</h1>
          </div>
          <button onClick={()=>setDark(!dark)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition">
            {dark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
          </button>
        </div>

        {/* Content */}
        <div className="animate-fade-in pt-6">
          {active==='calc' && <CalculatorTab/>}
          {active==='pos' && <PosTab/>}
          {active==='report' && <ReportTab/>}
        </div>

        {/* Bottom Nav */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-full shadow-2xl shadow-slate-200/50 dark:shadow-black/50 z-40 flex gap-1 border border-white/20 dark:border-white/10">
          {[
            { id: 'calc', icon: Calculator, l: 'Hitung' },
            { id: 'pos', icon: ShoppingCart, l: 'Kasir' },
            { id: 'report', icon: BarChart3, l: 'Laporan' }
          ].map(i => (
            <button key={i.id} onClick={()=>setActive(i.id)} className={`relative px-6 py-3 rounded-full transition-all duration-300 flex items-center justify-center gap-2 ${active===i.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <i.icon className="w-5 h-5"/>
              {active===i.id && <span className="text-xs font-bold whitespace-nowrap">{i.l}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default App;
