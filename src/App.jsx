import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, ShoppingCart, BarChart3, Plus, Trash2, 
  Save, FolderOpen, RotateCcw, Info, CheckCircle, 
  TrendingUp, Package, Zap, DollarSign, X, 
  Upload, Edit3, Image as ImageIcon,
  Search, Sun, Moon, ArrowRight, HelpCircle
} from 'lucide-react';

// ============================================================================
// 1. PREMIUM UI COMPONENTS & UTILITIES
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

// Input Angka dengan Koma Otomatis
const NumericInput = ({ value, onChange, placeholder, className, prefix, suffix, ...props }) => {
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
    <div className="relative w-full group">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium z-10">
          {prefix}
        </span>
      )}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 ${prefix ? 'pl-9' : 'pl-4'} ${suffix ? 'pr-12' : 'pr-4'} ${className}`}
        {...props}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
          {suffix}
        </span>
      )}
    </div>
  );
};

// Help Box Tooltip
const HelpBox = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button onClick={() => setIsOpen(!isOpen)} className="text-slate-400 hover:text-indigo-500 transition">
        <HelpCircle className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl animate-fade-in-up">
          <div className="flex justify-between mb-1"><span className="font-bold text-indigo-300">Panduan</span><X className="w-3 h-3 cursor-pointer" onClick={()=>setIsOpen(false)}/></div>
          <p className="leading-relaxed text-slate-300">{text}</p>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45"></div>
        </div>
      )}
    </div>
  );
};

// Card Container
const Card = ({ children, className = "", title, icon: Icon, action, help }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800 transition-all duration-300 ${className}`}>
    {(title || action) && (
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {Icon && <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300"><Icon className="w-5 h-5" /></div>}
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center">
            {title} {help && <HelpBox text={help} />}
          </h3>
        </div>
        {action}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

// Button Component
const Button = ({ children, onClick, variant = 'primary', className = "", icon: Icon, ...props }) => {
  const styles = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
    outline: "border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-500 dark:border-slate-700 dark:text-slate-400",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30"
  };
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${styles[variant]} ${className}`} {...props}>
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
  const [fixedOps, setFixedOps] = useState([{ id: 1, name: 'Listrik & Wifi', cost: 0 }]);
  const [showFixed, setShowFixed] = useState(false);
  const [production, setProduction] = useState({ yield: 1, monthlyTarget: 100 });
  const [smartRounding, setSmartRounding] = useState(true);
  const [customMargin, setCustomMargin] = useState(30);
  const [targetProfit, setTargetProfit] = useState(0);
  const [competitorPrice, setCompetitorPrice] = useState(0);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [showLoad, setShowLoad] = useState(false);

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
  
  const matPerUnit = totalMat / (production.yield || 1);
  const varPerUnit = totalVar / (production.yield || 1);
  const fixPerUnit = showFixed ? (totalFix / (production.monthlyTarget || 1)) : 0;
  const hppBersih = matPerUnit + varPerUnit + fixPerUnit;

  // Pricing Logic
  const round = (p) => smartRounding ? (p < 1000 ? Math.ceil(p/100)*100 : Math.ceil(p/500)*500) : p;
  const getTier = (margin) => {
    const raw = hppBersih + (hppBersih * (margin/100));
    return { raw, final: round(raw), profit: round(raw) - hppBersih };
  };

  const tiers = [
    { name: "Siap Tempur", sub: "Kompetitif", margin: 15, color: "bg-orange-500", grad: "from-orange-50 to-orange-100" },
    { name: "Akal Sehat", sub: "Standar", margin: 40, color: "bg-blue-500", grad: "from-blue-50 to-blue-100" },
    { name: "Auto Umroh", sub: "Premium", margin: 75, color: "bg-purple-500", grad: "from-purple-50 to-purple-100" }
  ];

  // Target
  const finalPrice = getPriceTier(customMargin).final;
  const profitPerPcs = finalPrice - hppBersih;
  const targetPcsMonth = profitPerPcs > 0 ? Math.ceil(targetProfit / profitPerPcs) : 0;

  function getPriceTier(margin) { return getTier(margin); }

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
      
      {/* HEADER PRODUK */}
      <Card className="overflow-hidden border-0 !p-0">
        <div className="bg-slate-900 dark:bg-slate-950 p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center text-white relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[80px] opacity-20 -mr-16 -mt-16"></div>
          <div className="relative z-10 w-28 h-28 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 overflow-hidden cursor-pointer hover:bg-white/20 transition group">
            {product.image ? <img src={product.image} className="w-full h-full object-cover"/> : <ImageIcon className="w-10 h-10 text-white/50"/>}
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
              if(e.target.files[0]) { const r = new FileReader(); r.onload=v=>setProduct({...product, image:v.target.result}); r.readAsDataURL(e.target.files[0]); }
            }}/>
            <div className="absolute bottom-0 w-full text-center text-[9px] bg-black/50 py-1 opacity-0 group-hover:opacity-100 transition">Ubah Foto</div>
          </div>
          <div className="flex-1 w-full text-center sm:text-left">
            <input 
              className="bg-transparent text-3xl font-bold w-full outline-none placeholder:text-slate-500 border-b border-white/10 focus:border-indigo-500 transition-colors pb-2 mb-3"
              placeholder="Nama Produk..." value={product.name} onChange={e=>setProduct({...product, name:e.target.value})}
            />
            <div className="flex justify-center sm:justify-start gap-2">
              {['Makanan','Minuman','Fashion','Jasa'].map(t => (
                <button key={t} onClick={()=>setProduct({...product, type:t})} className={`px-4 py-1 rounded-full text-xs font-semibold transition border ${product.type===t ? 'bg-white text-slate-900 border-white' : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500'}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* STEP 1: VARIABEL COST */}
      <Card title="1. Biaya Variabel" icon={Package} help="Biaya yang keluar setiap kali produksi (Bahan Baku & Operasional Langsung). Import harga dari marketplace hanya simulasi.">
        {/* Bahan Baku */}
        <div className="mb-6">
          <div className="flex justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">A. Bahan Baku</h4>
            <button className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:underline"><Upload className="w-3 h-3"/> Import Excel</button>
          </div>
          <div className="space-y-3">
            {materials.map((m) => (
              <div key={m.id} className="grid grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="col-span-12 sm:col-span-4">
                  <span className="text-[10px] text-slate-400 block mb-1 font-bold">Nama Bahan</span>
                  <input className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white" placeholder="Contoh: Tepung" value={m.name} onChange={e=>updateMat(m.id,'name',e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <span className="text-[10px] text-slate-400 block mb-1 font-bold">Harga Beli</span>
                  <NumericInput value={m.price} onChange={v=>updateMat(m.id,'price',v)} className="py-1.5 text-xs h-8" />
                </div>
                <div className="col-span-4 sm:col-span-3 flex gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block mb-1 font-bold">Isi</span>
                    <NumericInput value={m.content} onChange={v=>updateMat(m.id,'content',v)} className="py-1.5 text-xs h-8" />
                  </div>
                  <div className="w-16">
                    <span className="text-[10px] text-slate-400 block mb-1 font-bold">Unit</span>
                    <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-8 px-1 text-xs outline-none dark:text-white" value={m.unit} onChange={e=>updateMat(m.id,'unit',e.target.value)}>
                      <option value="gram">gr</option><option value="ml">ml</option><option value="pcs">pcs</option>
                    </select>
                  </div>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <span className="text-[10px] text-emerald-600 block mb-1 font-bold">Pakai</span>
                  <NumericInput value={m.usage} onChange={v=>updateMat(m.id,'usage',v)} className="py-1.5 text-xs h-8 bg-emerald-50 border-emerald-100 text-emerald-700" />
                </div>
                <div className="col-span-1 flex justify-center pb-1">
                  <button onClick={()=>removeRow(setMaterials,materials,m.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={addMat} icon={Plus} className="w-full border-dashed border-2 bg-transparent">Tambah Bahan</Button>
          </div>
        </div>

        {/* Ops Variabel */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">B. Operasional Langsung</h4>
          <div className="space-y-3">
            {variableOps.map((op) => (
              <div key={op.id} className="grid grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="col-span-12 sm:col-span-4">
                  <span className="text-[10px] text-slate-400 block mb-1 font-bold">Item</span>
                  <input className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white" placeholder="Gas / Kemasan" value={op.name} onChange={e=>updateVar(op.id,'name',e.target.value)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <span className="text-[10px] text-slate-400 block mb-1 font-bold">Biaya</span>
                  <NumericInput value={op.price} onChange={v=>updateVar(op.id,'price',v)} className="py-1.5 text-xs h-8" />
                </div>
                <div className="col-span-4 sm:col-span-3 flex gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block mb-1 font-bold">Total Isi</span>
                    <NumericInput value={op.content} onChange={v=>updateVar(op.id,'content',v)} className="py-1.5 text-xs h-8" />
                  </div>
                  <div className="w-16">
                    <span className="text-[10px] text-slate-400 block mb-1 font-bold">Unit</span>
                    <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-8 px-1 text-xs outline-none dark:text-white" value={op.unit} onChange={e=>updateVar(op.id,'unit',e.target.value)}>
                      <option value="jam">Jam</option><option value="pcs">Pcs</option>
                    </select>
                  </div>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <span className="text-[10px] text-emerald-600 block mb-1 font-bold">Pakai</span>
                  <NumericInput value={op.usage} onChange={v=>updateVar(op.id,'usage',v)} className="py-1.5 text-xs h-8 bg-emerald-50 border-emerald-100 text-emerald-700" />
                </div>
                <div className="col-span-1 flex justify-center pb-1">
                  <button onClick={()=>removeRow(setVariableOps,variableOps,op.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={addVar} icon={Plus} className="w-full border-dashed border-2 bg-transparent">Tambah Ops</Button>
          </div>
        </div>
      </Card>

      {/* STEP 2: YIELD & RESULT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none flex flex-col justify-center relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2">Total Modal Langsung</p>
            <h2 className="text-4xl font-black mb-4">{formatIDR(totalMat + totalVar)}</h2>
            <div className="flex items-center gap-3 bg-white/10 p-2 pr-4 rounded-xl border border-white/10 w-fit">
              <div className="bg-white text-indigo-900 px-3 py-2 rounded-lg text-xs font-bold uppercase">Jumlah Jadi</div>
              <input type="number" className="w-20 bg-transparent text-right font-bold text-xl outline-none" value={production.yield} onChange={e=>setProduction({...production, yield: parseFloat(e.target.value)||1})} />
              <span className="text-sm font-medium text-indigo-200">Pcs</span>
            </div>
          </div>
          <DollarSign className="absolute -right-6 -bottom-6 w-40 h-40 text-indigo-500 opacity-50 rotate-12"/>
        </div>

        <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-6 text-white shadow-xl flex flex-col justify-center relative overflow-hidden border border-slate-800">
          <div className="relative z-10 text-center">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">HPP Bersih / Unit</p>
            <h2 className="text-5xl font-black tracking-tight mb-4 text-emerald-400 drop-shadow-lg">{formatIDR(hppBersih)}</h2>
            <div className="flex justify-center gap-4 text-[10px] font-bold uppercase text-slate-500 bg-slate-800/50 py-2 rounded-full px-4 inline-flex mx-auto">
              <span>Bahan: {formatIDR(matPerUnit)}</span>
              <span className="text-slate-700">•</span>
              <span>Ops: {formatIDR(varPerUnit)}</span>
              {showFixed && (
                <>
                  <span className="text-slate-700">•</span>
                  <span>Tetap: {formatIDR(fixPerUnit)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* STEP 3: FIXED COST */}
      <Card className={showFixed ? "border-indigo-200 ring-4 ring-indigo-50 dark:ring-slate-800" : ""}>
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowFixed(!showFixed)}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${showFixed ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'} transition-colors`}>
              <Zap className="w-5 h-5"/>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">Biaya Tetap Bulanan</h3>
              <p className="text-xs text-slate-400">Opsional untuk sewa tempat, gaji, dll.</p>
            </div>
          </div>
          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${showFixed ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showFixed ? 'translate-x-6' : ''}`}></div>
          </div>
        </div>

        {showFixed && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 animate-fade-in">
            <div className="mb-4">
              <NumericInput 
                label="Target Produksi / Bulan" 
                placeholder="100" 
                value={production.monthlyTarget} 
                onChange={v=>setProduction({...production, monthlyTarget: v})} 
                suffix="Pcs"
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">*Biaya tetap akan dibagi jumlah ini.</p>
            </div>
            <div className="space-y-3">
              {fixedOps.map(op => (
                <div key={op.id} className="flex gap-3">
                  <input className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold outline-none" placeholder="Nama Biaya" value={op.name} onChange={e=>updateFix(op.id,'name',e.target.value)} />
                  <div className="w-40">
                    <NumericInput value={op.cost} onChange={v=>updateFix(op.id, v)} prefix="Rp" />
                  </div>
                  <button onClick={()=>removeRow(setFixedOps,fixedOps,op.id)} className="text-slate-300 hover:text-rose-500 px-2"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <Button variant="secondary" onClick={addFix} className="w-full text-xs h-8">Tambah Biaya Tetap</Button>
            </div>
          </div>
        )}
      </Card>

      {/* STEP 4: STRATEGY */}
      <Card title="Strategi Penjualan" icon={TrendingUp} help="Tentukan harga jual berdasarkan margin keuntungan yang diinginkan.">
        
        {/* Toggle Rounding */}
        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-6 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm"><RotateCcw className="w-4 h-4 text-emerald-500"/></div>
            <div>
              <p className="font-bold text-sm text-slate-700 dark:text-white">Smart Rounding</p>
              <p className="text-[10px] text-slate-400">Bulatkan harga (Cth: 12.350 &rarr; 12.500)</p>
            </div>
          </div>
          <div onClick={()=>setSmartRounding(!smartRounding)} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${smartRounding ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${smartRounding ? 'translate-x-6' : ''}`}></div>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {tiers.map((t, i) => {
            const d = getTier(t.margin);
            const isSelected = customMargin === t.margin;
            return (
              <div key={i} onClick={()=>setCustomMargin(t.margin)} className={`relative overflow-hidden rounded-2xl border-2 transition-all cursor-pointer group ${isSelected ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 scale-105 z-10' : 'border-transparent hover:border-slate-200'}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${t.grad} opacity-50 dark:opacity-10`}></div>
                <div className="relative p-5">
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t.name}</span>
                    <span className={`w-2 h-2 rounded-full ${t.color}`}></span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1">{formatIDR(d.final)}</h3>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200/50 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500">Margin {t.margin}%</span>
                    <span className="text-xs font-bold text-emerald-600">+{formatIDR(d.profit)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Custom Slider */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-end mb-4">
            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Edit3 className="w-4 h-4"/> Custom Margin</label>
            <div className="text-right">
              <p className="text-xs text-slate-400 mb-1">Harga Jual Final</p>
              <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{formatIDR(getPriceTier(customMargin).final)}</p>
            </div>
          </div>
          <input type="range" min="0" max="150" className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" value={customMargin} onChange={(e) => setCustomMargin(parseInt(e.target.value))} />
          <div className="text-center mt-2 font-bold text-slate-900 dark:text-white">{customMargin}%</div>
        </div>

        {/* Target Calculation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <NumericInput label="Target Profit / Bulan" placeholder="5.000.000" prefix="Rp" value={targetProfit} onChange={setTargetProfit} />
            <div className="mt-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 block">Cek Harga Pasar</label>
              <NumericInput placeholder="Harga Kompetitor" prefix="Rp" value={competitorPrice} onChange={setCompetitorPrice} />
              {competitorPrice > 0 && (
                <p className={`text-xs mt-2 font-bold ${competitorPrice < finalPrice ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {competitorPrice < finalPrice ? `Lebih mahal ${formatIDR(finalPrice - competitorPrice)}` : `Lebih murah ${formatIDR(competitorPrice - finalPrice)}`}
                </p>
              )}
            </div>
          </div>
          
          {targetProfit > 0 && (
            <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-lg">
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase">Target Penjualan</span>
                  <TrendingUp className="w-5 h-5 text-emerald-400"/>
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl font-black">{targetPcsMonth}</span>
                  <span className="text-sm font-medium text-slate-400 mb-1">pcs / bulan</span>
                </div>
                <div className="w-full h-px bg-white/10 my-3"></div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Harian: ~{Math.ceil(targetPcsMonth/30)} pcs</span>
                  <span>Omzet: {formatIDR((targetPcsMonth/30)*finalPrice)}/hari</span>
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500 rounded-full blur-2xl opacity-30"></div>
            </div>
          )}
        </div>
      </Card>

      {/* 5. CHARTS & ACTIONS */}
      <Card className="flex flex-col items-center justify-center py-8">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Breakdown Biaya</h3>
        {hppBersih > 0 ? (
          <div className="flex flex-col md:flex-row items-center gap-8 w-full justify-center px-4">
            <div className="relative w-40 h-40 shrink-0">
              <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90">
                <circle cx="16" cy="16" r="16" fill="currentColor" className="text-slate-100 dark:text-slate-800" />
                <circle cx="16" cy="16" r="8" fill="transparent" stroke="#6366f1" strokeWidth="16" strokeDasharray={`${(matPerUnit/hppBersih)*100} 100`} />
                <circle cx="16" cy="16" r="8" fill="transparent" stroke="#f59e0b" strokeWidth="16" strokeDasharray={`${(varPerUnit/hppBersih)*100} 100`} strokeDashoffset={-((matPerUnit/hppBersih)*100)} />
                {showFixed && <circle cx="16" cy="16" r="8" fill="transparent" stroke="#10b981" strokeWidth="16" strokeDasharray={`${(fixPerUnit/hppBersih)*100} 100`} strokeDashoffset={-(((matPerUnit+varPerUnit)/hppBersih)*100)} />}
                <circle cx="16" cy="16" r="6" fill="currentColor" className="text-white dark:text-slate-900" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300">HPP</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              {[
                { l: 'Bahan', v: matPerUnit, c: 'bg-indigo-500' },
                { l: 'Operasional', v: varPerUnit, c: 'bg-amber-500' },
                ...(showFixed ? [{ l: 'Tetap', v: fixPerUnit, c: 'bg-emerald-500' }] : [])
              ].map((d,i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${d.c}`}></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{d.l}</span>
                  </div>
                  <span className="text-xs font-bold">{Math.round((d.v/hppBersih)*100)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="text-slate-400 text-sm">Belum ada data.</p>}
      </Card>

      {/* BOTTOM FLOATING ACTIONS */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-40">
        <div className="flex gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
          <button onClick={reset} className="p-3 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><RotateCcw className="w-5 h-5"/></button>
          <button onClick={()=>setShowLoad(true)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white font-bold rounded-xl text-sm hover:bg-slate-200 transition">Load</button>
          <button onClick={save} className="flex-1 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition">Simpan</button>
        </div>
      </div>

      {/* LOAD MODAL */}
      {showLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
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
// 3. TAB: POS (KASIR)
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
    <div className="h-full flex flex-col md:flex-row pb-24 max-w-7xl mx-auto">
      {/* Catalog */}
      <div className="flex-1 p-4 overflow-y-auto">
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
                {p.image ? <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition"/> : <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-slate-300">{p.name[0]}</div>}
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
            <h2 className="font-bold text-lg text-slate-800 dark:text-white">Keranjang</h2>
            <button onClick={()=>setShowCart(false)} className="md:hidden"><X className="w-6 h-6"/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length===0 && <div className="h-full flex flex-col items-center justify-center text-slate-300"><ShoppingCart className="w-12 h-12 mb-2"/><p>Kosong</p></div>}
            {cart.map(i => (
              <div key={i.id} className="flex gap-3 items-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shrink-0">
                  {i.image && <img src={i.image} className="w-full h-full object-cover"/>}
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
                  {newProd.image ? <img src={newProd.image} className="w-full h-full object-cover"/> : <ImageIcon className="w-8 h-8 text-slate-300"/>}
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
// 3. TAB: REPORT
// ============================================================================

const ReportTab = () => {
  const [filter, setFilter] = useState('month');
  const [txs, setTxs] = useState([]);

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

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 pb-32 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Laporan Keuangan</h1><p className="text-sm text-slate-400">Ringkasan performa bisnismu</p></div>
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          {['today','month','all'].map(k => (
            <button key={k} onClick={()=>setFilter(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${filter===k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{k==='all'?'Semua':k==='today'?'Hari Ini':'Bulan Ini'}</button>
          ))}
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
        
        {/* Dark Mode Toggle */}
        <button onClick={()=>setDark(!dark)} className="fixed top-4 right-4 z-50 w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center text-slate-600 dark:text-white hover:scale-110 transition">
          {dark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
        </button>

        {/* Content */}
        <div className="animate-fade-in pt-6">
          {active==='calc' && <CalculatorTab/>}
          {active==='pos' && <PosTab/>}
          {active==='report' && <ReportTab/>}
        </div>

        {/* Bottom Nav */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-full shadow-2xl shadow-slate-200/50 dark:shadow-black/50 z-40 flex gap-1 border border-white/20 dark:border-white/10">
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

        {/* Animation Styles */}
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

