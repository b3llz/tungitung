import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, ShoppingCart, BarChart3, Plus, Trash2, 
  Save, FolderOpen, RotateCcw, Info, CheckCircle, 
  TrendingUp, Package, Zap, DollarSign, Menu, X, 
  ChevronRight, Upload, Edit3, Image as ImageIcon,
  Search, Sun, Moon, ArrowRight, HelpCircle, Box
} from 'lucide-react';

// ============================================================================
// 1. PREMIUM UI COMPONENTS (REUSABLE)
// ============================================================================

// Format Uang (Rp 1.000.000)
const formatIDR = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number);
};

// Format Angka Display (1,000,000)
const formatNumberDisplay = (val) => {
  if (!val && val !== 0) return '';
  const num = val.toString().replace(/[^0-9.]/g, '');
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Input Angka dengan Koma Otomatis & Desain Input Premium
const NumericInput = ({ value, onChange, placeholder, className, prefix, suffix, label, ...props }) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatNumberDisplay(value));
  }, [value]);

  const handleChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (!isNaN(rawValue)) {
      setDisplayValue(formatNumberDisplay(rawValue));
      onChange(parseFloat(rawValue) || 0);
    }
  };

  return (
    <div className="w-full">
      {label && <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1.5 block">{label}</label>}
      <div className="relative group">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium z-10 pointer-events-none group-focus-within:text-indigo-500 transition-colors">
            {prefix}
          </span>
        )}
        <input
          type="text" // Must be text to handle commas
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 ${prefix ? 'pl-8' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'} ${className}`}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

// Card Container Premium
const Card = ({ children, className = "", title, icon: Icon, action, help }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800 transition-all duration-300 ${className}`}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl">
        <div className="flex items-center gap-3">
          {Icon && <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"><Icon className="w-5 h-5" /></div>}
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
              {title}
            </h3>
            {help && <p className="text-[10px] text-slate-400 leading-tight mt-0.5 max-w-xs">{help}</p>}
          </div>
        </div>
        {action}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

// Tombol Premium
const Button = ({ children, onClick, variant = 'primary', className = "", icon: Icon, ...props }) => {
  const styles = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700",
    outline: "border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400",
    ghost: "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
  };
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${styles[variant]} ${className}`} {...props}>
      {Icon && <Icon className="w-4 h-4" />} {children}
    </button>
  );
};

// ============================================================================
// 2. TAB: CALCULATOR (HPP)
// ============================================================================

const CalculatorTab = () => {
  // State Data
  const [product, setProduct] = useState({ name: '', type: 'Makanan', image: null });
  const [materials, setMaterials] = useState([{ id: 1, name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
  const [variableOps, setVariableOps] = useState([{ id: 1, name: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0 }]);
  const [fixedOps, setFixedOps] = useState([{ id: 1, name: 'Sewa/Wifi', cost: 0 }]);
  const [showFixed, setShowFixed] = useState(false);
  const [production, setProduction] = useState({ yield: 1, monthlyTarget: 100 });
  const [smartRounding, setSmartRounding] = useState(true);
  const [customMargin, setCustomMargin] = useState(30);
  const [targetProfit, setTargetProfit] = useState(0);
  const [competitorPrice, setCompetitorPrice] = useState(0);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [showLoad, setShowLoad] = useState(false);

  // Logic
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
  
  const matPerUnit = totalMat / (production.yield || 1);
  const varPerUnit = totalVar / (production.yield || 1);
  const fixPerUnit = showFixed ? (totalFix / (production.monthlyTarget || 1)) : 0;
  const hppBersih = matPerUnit + varPerUnit + fixPerUnit;

  // Pricing
  const round = (p) => smartRounding ? (p < 1000 ? Math.ceil(p/100)*100 : Math.ceil(p/500)*500) : p;
  const getPriceTier = (margin) => {
    const raw = hppBersih + (hppBersih * (margin/100));
    return { raw, final: round(raw), profit: round(raw) - hppBersih };
  };

  const tiers = [
    { name: "Siap Tempur", sub: "Kompetitif", margin: 15, color: "bg-orange-500", text: "text-orange-600" },
    { name: "Akal Sehat", sub: "Standar", margin: 40, color: "bg-blue-500", text: "text-blue-600" },
    { name: "Auto Umroh", sub: "Premium", margin: 75, color: "bg-purple-500", text: "text-purple-600" }
  ];

  // Target
  const finalPrice = getPriceTier(customMargin).final;
  const profitPerPcs = finalPrice - hppBersih;
  const targetPcsMonth = profitPerPcs > 0 ? Math.ceil(targetProfit / profitPerPcs) : 0;

  // Storage
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
      setProduct({name:'', type:'Makanan', image:null}); setMaterials([{ id: 1, name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
      setVariableOps([{ id: 1, name: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0 }]); setFixedOps([{ id: 1, name: 'Sewa', cost: 0 }]);
      setProduction({ yield: 1, monthlyTarget: 100 });
    }
  };

  return (
    <div className="space-y-6 pb-32 max-w-5xl mx-auto">
      
      {/* 1. PRODUCT CARD (RE-DESIGNED) */}
      <Card className="overflow-hidden !p-0">
        <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
          {/* Image Uploader - Smaller & Neater */}
          <div className="w-24 h-24 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center relative group cursor-pointer hover:border-indigo-400 transition-colors">
            {product.image ? <img src={product.image} className="w-full h-full object-cover rounded-2xl"/> : <ImageIcon className="w-8 h-8 text-slate-300"/>}
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
              if(e.target.files[0]) { const r = new FileReader(); r.onload=v=>setProduct({...product, image:v.target.result}); r.readAsDataURL(e.target.files[0]); }
            }}/>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-2xl transition text-[10px] text-white font-bold">Ubah Foto</div>
          </div>

          {/* Product Details - Clean Inputs */}
          <div className="flex-1 w-full space-y-4">
            <div className="w-full">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">Nama Produk</label>
              <input 
                className="w-full text-xl font-bold text-slate-800 dark:text-white bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none pb-1 placeholder:text-slate-300"
                placeholder="Contoh: Basreng Pedas"
                value={product.name}
                onChange={e=>setProduct({...product, name:e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">Kategori</label>
              <div className="flex gap-2 flex-wrap">
                {['Makanan','Minuman','Fashion','Jasa'].map(t => (
                  <button 
                    key={t} 
                    onClick={()=>setProduct({...product, type:t})} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${product.type===t ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. COST CALCULATION */}
      <Card title="Komponen Biaya" icon={Calculator} help="Masukkan detail biaya produksi. Input akan otomatis diformat.">
        {/* A. BAHAN BAKU - FIXED LAYOUT */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">A. Bahan Baku</h4>
            <button className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded-md transition"><Upload className="w-3 h-3"/> Import Excel</button>
          </div>
          
          <div className="space-y-4">
            {materials.map((m) => (
              <div key={m.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 relative group">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  
                  {/* Nama Bahan - Lebar */}
                  <div className="md:col-span-4">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nama Bahan</label>
                    <input 
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-medium outline-none focus:border-indigo-500 dark:text-white" 
                      placeholder="Contoh: Tepung Terigu" 
                      value={m.name} 
                      onChange={e=>updateMat(m.id,'name',e.target.value)} 
                    />
                  </div>

                  {/* Harga Beli - Lebar & Jelas */}
                  <div className="md:col-span-3">
                    <NumericInput 
                      label="Harga Beli"
                      placeholder="0"
                      prefix="Rp"
                      value={m.price} 
                      onChange={v=>updateMat(m.id,'price',v)} 
                    />
                  </div>

                  {/* Isi & Unit - Sejajar */}
                  <div className="md:col-span-3">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Isi Kemasan</label>
                    <div className="flex gap-0">
                      <NumericInput 
                        placeholder="1000"
                        value={m.content} 
                        onChange={v=>updateMat(m.id,'content',v)} 
                        className="rounded-r-none border-r-0"
                      />
                      <select 
                        className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-lg px-2 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none w-20 focus:ring-2 focus:ring-indigo-500/20" 
                        value={m.unit} 
                        onChange={e=>updateMat(m.id,'unit',e.target.value)}
                      >
                        <option value="gram">gram</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                        <option value="kg">kg</option>
                        <option value="l">liter</option>
                      </select>
                    </div>
                  </div>

                  {/* Pemakaian - Highlighted */}
                  <div className="md:col-span-2">
                    <NumericInput 
                      label="Dipakai"
                      placeholder="0"
                      value={m.usage} 
                      onChange={v=>updateMat(m.id,'usage',v)} 
                      className="bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400"
                    />
                  </div>
                </div>
                
                {/* Delete Button - Floating/Absolute */}
                <button onClick={()=>removeRow(setMaterials,materials,m.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3"/></button>
              </div>
            ))}
            <Button variant="outline" onClick={addMat} icon={Plus} className="w-full">Tambah Bahan</Button>
          </div>
        </div>

        {/* B. OPERASIONAL VARIABEL - FIXED LAYOUT */}
        <div>
          <div className="flex justify-between items-end mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">B. Operasional Langsung</h4>
          </div>
          
          <div className="space-y-4">
            {variableOps.map((op) => (
              <div key={op.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 relative group">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  
                  <div className="md:col-span-4">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nama Biaya</label>
                    <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-medium outline-none focus:border-indigo-500 dark:text-white" placeholder="Contoh: Gas LPG" value={op.name} onChange={e=>updateVar(op.id,'name',e.target.value)} />
                  </div>

                  <div className="md:col-span-3">
                    <NumericInput label="Biaya" placeholder="0" prefix="Rp" value={op.price} onChange={v=>updateVar(op.id,'price',v)} />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Kapasitas</label>
                    <div className="flex gap-0">
                      <NumericInput placeholder="1" value={op.content} onChange={v=>updateVar(op.id,'content',v)} className="rounded-r-none border-r-0" />
                      <select className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-lg px-2 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none w-20 focus:ring-2 focus:ring-indigo-500/20" value={op.unit} onChange={e=>updateVar(op.id,'unit',e.target.value)}>
                        <option value="jam">Jam</option><option value="pcs">Pcs</option><option value="kg">Kg</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <NumericInput label="Dipakai" placeholder="0" value={op.usage} onChange={v=>updateVar(op.id,'usage',v)} className="bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" />
                  </div>
                </div>
                <button onClick={()=>removeRow(setVariableOps,variableOps,op.id)} className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3"/></button>
              </div>
            ))}
            <Button variant="outline" onClick={addVar} icon={Plus} className="w-full">Tambah Operasional</Button>
          </div>
        </div>

        {/* SUBTOTAL MODAL */}
        <div className="mt-8 p-6 bg-slate-900 dark:bg-black rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-white shadow-xl shadow-slate-200 dark:shadow-none">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Modal Langsung (Batch)</p>
            <p className="text-3xl font-bold">{formatIDR(totalMat + totalVar)}</p>
          </div>
          <div className="flex flex-col items-end">
            <label className="text-[10px] text-slate-400 font-bold uppercase mb-1">Jumlah Produk Jadi</label>
            <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/20">
              <input 
                type="number" 
                className="w-24 bg-transparent text-center font-bold text-2xl outline-none" 
                value={production.yield} 
                onChange={e=>setProduction({...production, yield: parseFloat(e.target.value)||1})} 
              />
              <span className="text-xs font-medium text-slate-400 pr-2">Pcs</span>
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
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Biaya Tetap Bulanan (Opsional)</h3>
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
              </div>
              <div className="space-y-3">
                {fixedOps.map(op => (
                  <div key={op.id} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <input className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-medium outline-none" placeholder="Nama Biaya" value={op.name} onChange={e=>updateFix(op.id,'name',e.target.value)} />
                    </div>
                    <div className="w-40">
                      <NumericInput value={op.cost} onChange={v=>updateFix(op.id, v)} prefix="Rp" className="bg-white dark:bg-slate-900" />
                    </div>
                    <button onClick={()=>removeRow(setFixedOps,fixedOps,op.id)} className="p-2.5 mb-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
                <Button variant="secondary" onClick={addFix} className="w-full text-xs h-9 mt-2">Tambah Biaya Tetap</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 3. HASIL & STRATEGI */}
      <Card className="!p-0 overflow-hidden border-indigo-100 dark:border-slate-800">
        <div className="bg-indigo-600 p-8 text-white text-center relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-[0.2em] mb-2">Total HPP Bersih / Pcs</p>
            <h2 className="text-6xl font-black tracking-tighter mb-4">{formatIDR(hppBersih)}</h2>
            <div className="inline-flex gap-6 text-[10px] font-bold uppercase text-indigo-200 bg-indigo-800/30 py-2 px-6 rounded-full backdrop-blur-sm border border-indigo-500/30">
              <span>Bahan: {formatIDR(matPerUnit)}</span>
              <span className="opacity-30">|</span>
              <span>Ops: {formatIDR(varPerUnit)}</span>
              {showFixed && (
                <>
                  <span className="opacity-30">|</span>
                  <span>Tetap: {formatIDR(fixPerUnit)}</span>
                </>
              )}
            </div>
          </div>
          {/* Pattern BG */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Saran Harga Jual</h3>
            <div className="flex items-center gap-2 cursor-pointer bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full" onClick={() => setSmartRounding(!smartRounding)}>
              <span className={`text-[10px] font-bold uppercase ${smartRounding ? 'text-indigo-600' : 'text-slate-400'}`}>Rounding</span>
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${smartRounding ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${smartRounding ? 'translate-x-4' : ''}`}></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {tiers.map((t, i) => {
              const d = getPriceTier(t.margin);
              const isSelected = customMargin === t.margin;
              return (
                <div key={i} onClick={()=>setCustomMargin(t.margin)} className={`relative overflow-hidden rounded-2xl border-2 transition-all cursor-pointer group hover:-translate-y-1 ${isSelected ? 'border-indigo-600 shadow-xl shadow-indigo-500/10' : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:border-slate-200'}`}>
                  <div className="relative p-5">
                    <div className="flex justify-between mb-3">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-white dark:bg-slate-700 ${t.text}`}>{t.name}</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1">{formatIDR(d.final)}</h3>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-700 mt-3">
                      <span className="text-xs text-slate-500 font-medium">Margin {t.margin}%</span>
                      <span className="text-xs font-bold text-emerald-600">+{formatIDR(d.profit)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-end mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Edit3 className="w-4 h-4"/> Custom Margin</label>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Harga Jual Final</p>
                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{formatIDR(getPriceTier(customMargin).final)}</p>
              </div>
            </div>
            <input 
              type="range" min="0" max="150" 
              className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              value={customMargin} onChange={(e) => setCustomMargin(parseInt(e.target.value))} 
            />
            <div className="text-center mt-2 font-bold text-slate-900 dark:text-white">{customMargin}%</div>
          </div>

          {/* PROJECTION */}
          <Card title="Target & Proyeksi" icon={TrendingUp} className="bg-white border-0 shadow-none !p-0">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
               <div>
                 <NumericInput label="Target Laba Bersih (Bulan)" placeholder="5.000.000" prefix="Rp" value={targetProfit} onChange={setTargetProfit} />
                 <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 block">Cek Kompetitor</label>
                    <NumericInput placeholder="Harga Pesaing" prefix="Rp" value={competitorPrice} onChange={setCompetitorPrice} className="h-9 py-1 text-xs" />
                    {competitorPrice > 0 && (
                      <div className={`mt-2 text-xs font-bold flex items-center gap-1 ${competitorPrice < finalPrice ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {competitorPrice < finalPrice ? <ArrowRight className="w-3 h-3 rotate-45"/> : <ArrowRight className="w-3 h-3 -rotate-45"/>}
                        {competitorPrice < finalPrice ? `Lebih mahal ${formatIDR(finalPrice - competitorPrice)}` : `Lebih murah ${formatIDR(competitorPrice - finalPrice)}`}
                      </div>
                    )}
                 </div>
               </div>
               
               {targetProfit > 0 && hppBersih > 0 && (
                 <div className="bg-emerald-600 text-white rounded-2xl p-5 flex flex-col justify-center shadow-lg shadow-emerald-200 dark:shadow-none relative overflow-hidden">
                   <div className="relative z-10">
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-xs text-emerald-100 font-bold uppercase opacity-80">Jual Minimal/Bulan</span>
                       <span className="text-2xl font-black">{targetPcsMonth} <span className="text-sm font-medium opacity-70">pcs</span></span>
                     </div>
                     <div className="w-full h-px bg-white/20 mb-2"></div>
                     <div className="flex justify-between items-center">
                       <span className="text-xs text-emerald-100 font-bold uppercase opacity-80">Omzet Harian</span>
                       <span className="text-lg font-bold">{formatIDR((targetPcsMonth/30)*finalPrice)}</span>
                     </div>
                   </div>
                   <TrendingUp className="absolute -right-6 -bottom-6 w-32 h-32 text-emerald-500 opacity-50 rotate-12"/>
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
      <div className="grid grid-cols-2 gap-4 pb-4">
        <Button variant="outline" onClick={resetAll} icon={RotateCcw} className="py-4">Reset</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={()=>setShowLoad(true)} icon={FolderOpen} className="flex-1 py-4">Load</Button>
          <Button variant="primary" onClick={save} icon={Save} className="flex-1 py-4">Simpan</Button>
        </div>
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
                    {r.product?.image ? <img src={r.product.image} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-300">{r.product?.name[0]}</div>}
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
// 3. TAB: POS & REPORT (Minimal Changes for Context)
// ============================================================================
const PosTab = () => <div className="text-center p-10 text-slate-400">Fitur Kasir akan hadir dengan desain baru.</div>;
const ReportTab = () => <div className="text-center p-10 text-slate-400">Fitur Laporan akan hadir dengan desain baru.</div>;

// ============================================================================
// MAIN APP SHELL
// ============================================================================

const App = () => {
  const [activeTab, setActiveTab] = useState('calc');
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
        {/* Top Navbar */}
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><Calculator className="w-5 h-5"/></div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">HPP Master Pro</h1>
          </div>
          <button onClick={()=>setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition">
            {darkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
          </button>
        </div>

        <div className="animate-fade-in pt-6 pb-24 px-4">
          {activeTab === 'calc' && <CalculatorTab />}
          {activeTab === 'pos' && <PosTab />}
          {activeTab === 'report' && <ReportTab />}
        </div>

        {/* Bottom Nav */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-full shadow-2xl shadow-slate-200 dark:shadow-black/50 z-40 flex gap-1 border border-slate-200 dark:border-slate-800">
          {[{id:'calc',i:Calculator,l:'Hitung'},{id:'pos',i:ShoppingCart,l:'Kasir'},{id:'report',i:BarChart3,l:'Laporan'}].map(item => (
            <button key={item.id} onClick={()=>setActiveTab(item.id)} className={`relative px-6 py-3 rounded-full transition-all duration-300 flex items-center justify-center gap-2 ${activeTab===item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <item.i className="w-5 h-5"/>
              {activeTab===item.id && <span className="text-xs font-bold whitespace-nowrap">{item.l}</span>}
            </button>
          ))}
        </nav>
        <style>{`
          @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
          .animate-fade-in { animation: fade-in-up 0.4s ease-out; }
        `}</style>
      </div>
    </div>
  );
};

export default App;

