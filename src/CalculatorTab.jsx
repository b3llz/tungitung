import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, ShoppingCart, BarChart3, Plus, Trash2, 
  Save, FolderOpen, RotateCcw, Info, CheckCircle, 
  TrendingUp, Package, Zap, DollarSign, Menu, X, 
  ChevronRight, Upload, Edit3, Image as ImageIcon,
  Search, Sun, Moon, ArrowRight
} from 'lucide-react';

// ============================================================================
// UTILS & COMPONENTS (PREMIUM UI KIT)
// ============================================================================

// 1. Format Currency Helper (Display Only)
const formatDisplay = (val) => {
  if (!val && val !== 0) return '';
  // Remove non-digit chars first to avoid errors
  const num = val.toString().replace(/[^0-9.]/g, '');
  // Format with commas
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// 2. Numeric Input Component (Auto Comma)
const NumericInput = ({ value, onChange, placeholder, className, prefix, ...props }) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatDisplay(value));
  }, [value]);

  const handleChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, ''); // Hapus koma untuk logic
    if (!isNaN(rawValue)) {
      setDisplayValue(formatDisplay(rawValue));
      onChange(parseFloat(rawValue) || 0);
    }
  };

  return (
    <div className="relative w-full">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium z-10 pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 focus:border-transparent transition-all placeholder:text-slate-400 ${prefix ? 'pl-9' : 'pl-4'} ${className}`}
        {...props}
      />
    </div>
  );
};

// 3. Card Container
const Card = ({ children, className = "", noPadding = false }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-300 ${noPadding ? '' : 'p-6'} ${className}`}>
    {children}
  </div>
);

// 4. Button
const Button = ({ children, onClick, variant = 'primary', className = "", icon: Icon }) => {
  const variants = {
    primary: "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
    outline: "border border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500",
    ghost: "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
  };

  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

// ============================================================================
// 1. CALCULATOR TAB
// ============================================================================

const CalculatorTab = () => {
  // State
  const [productInfo, setProductInfo] = useState({ name: '', type: 'Makanan', image: null });
  const [materials, setMaterials] = useState([{ id: 1, name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
  const [variableOps, setVariableOps] = useState([{ id: 1, name: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0 }]);
  const [showFixedCost, setShowFixedCost] = useState(false);
  const [fixedOps, setFixedOps] = useState([{ id: 1, name: 'Sewa/Wifi', cost: 0 }]); 
  const [production, setProduction] = useState({ yield: 1, monthlyTarget: 100 }); 
  const [useSmartRounding, setUseSmartRounding] = useState(true);
  const [targetMonthlyProfit, setTargetMonthlyProfit] = useState(0);
  const [customMargin, setCustomMargin] = useState(30);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);

  // Logic
  const calculateRowCost = (price, content, usage) => (!content || content === 0) ? 0 : (price / content) * usage;

  const updateMaterial = (id, field, value) => {
    setMaterials(materials.map(item => item.id === id ? { 
      ...item, [field]: value, cost: calculateRowCost(field==='price'?value:item.price, field==='content'?value:item.content, field==='usage'?value:item.usage) 
    } : item));
  };

  const updateVarOp = (id, field, value) => {
    setVariableOps(variableOps.map(item => item.id === id ? { 
      ...item, [field]: value, cost: calculateRowCost(field==='price'?value:item.price, field==='content'?value:item.content, field==='usage'?value:item.usage) 
    } : item));
  };

  const updateFixedOp = (id, value) => setFixedOps(fixedOps.map(item => item.id === id ? { ...item, cost: value } : item));

  const addMat = () => setMaterials([...materials, { id: Date.now(), name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
  const addVarOp = () => setVariableOps([...variableOps, { id: Date.now(), name: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0 }]);
  const addFixedOp = () => setFixedOps([...fixedOps, { id: Date.now(), name: '', cost: 0 }]);
  const removeRow = (setter, list, id) => list.length > 1 && setter(list.filter(i => i.id !== id));

  // Calculations
  const totalMaterialCost = materials.reduce((a, b) => a + b.cost, 0);
  const totalVarOpCost = variableOps.reduce((a, b) => a + b.cost, 0);
  const totalFixedOpMonthly = fixedOps.reduce((a, b) => a + b.cost, 0);
  
  const matPerUnit = totalMaterialCost / (production.yield || 1);
  const varOpPerUnit = totalVarOpCost / (production.yield || 1);
  const fixedOpPerUnit = showFixedCost ? (totalFixedOpMonthly / (production.monthlyTarget || 1)) : 0;
  
  const hppBersih = matPerUnit + varOpPerUnit + fixedOpPerUnit;

  const roundPrice = (price) => {
    if (!useSmartRounding) return price;
    if (price < 1000) return Math.ceil(price / 100) * 100;
    return Math.ceil(price / 500) * 500;
  };

  const getPriceTier = (margin) => {
    const raw = hppBersih + (hppBersih * (margin / 100));
    return { raw, final: roundPrice(raw), profit: roundPrice(raw) - hppBersih };
  };

  const tiers = [
    { name: "Siap Tempur", sub: "Kompetitif", margin: 20 },
    { name: "Akal Sehat", sub: "Standar", margin: 40 },
    { name: "Auto Umroh", sub: "Premium", margin: 70 },
  ];

  // Target Profit Logic
  const selectedPrice = getPriceTier(customMargin).final;
  const profitPerPcs = selectedPrice - hppBersih;
  const targetPcsMonth = profitPerPcs > 0 ? Math.ceil(targetMonthlyProfit / profitPerPcs) : 0;
  const targetPcsDay = Math.ceil(targetPcsMonth / 30);

  // Storage
  useEffect(() => {
    const saved = localStorage.getItem('hpp_master_recipes');
    if (saved) setSavedRecipes(JSON.parse(saved));
  }, []);

  const saveRecipe = () => {
    if(!productInfo.name) return alert("Beri nama produk dulu ya!");
    const newRecipe = {
      id: Date.now(), productInfo, materials, variableOps, fixedOps, showFixedCost, production,
      savedHpp: hppBersih, savedPrice: getPriceTier(customMargin).final
    };
    const updated = [...savedRecipes, newRecipe];
    setSavedRecipes(updated);
    localStorage.setItem('hpp_master_recipes', JSON.stringify(updated));
    alert("Resep berhasil disimpan ke Database!");
  };

  const loadRecipe = (r) => {
    setProductInfo(r.productInfo); setMaterials(r.materials); setVariableOps(r.variableOps);
    setFixedOps(r.fixedOps || []); setShowFixedCost(r.showFixedCost); setProduction(r.production);
    setShowLoadModal(false);
  };

  const resetAll = () => {
    if(confirm("Reset data?")) {
      setProductInfo({ name: '', type: 'Makanan', image: null });
      setMaterials([{ id: 1, name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
      setVariableOps([{ id: 1, name: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0 }]);
      setShowFixedCost(false);
      setProduction({ yield: 1, monthlyTarget: 100 });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. PRODUCT HEADER */}
      <Card noPadding className="overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex flex-col sm:flex-row gap-6 items-center">
          <div className="w-24 h-24 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-600 relative overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition">
            {productInfo.image ? <img src={productInfo.image} className="w-full h-full object-cover"/> : <ImageIcon className="w-8 h-8 text-slate-300"/>}
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
              if (e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => setProductInfo({...productInfo, image: ev.target.result});
                reader.readAsDataURL(e.target.files[0]);
              }
            }}/>
          </div>
          <div className="flex-1 w-full space-y-3 text-center sm:text-left">
            <input 
              className="text-2xl sm:text-3xl font-bold bg-transparent text-slate-800 dark:text-white outline-none placeholder:text-slate-300 w-full"
              placeholder="Nama Produk..."
              value={productInfo.name}
              onChange={(e) => setProductInfo({...productInfo, name: e.target.value})}
            />
            <div className="flex justify-center sm:justify-start gap-2">
              {['Makanan', 'Minuman', 'Jasa', 'Barang'].map(type => (
                <button 
                  key={type}
                  onClick={() => setProductInfo({...productInfo, type})}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${productInfo.type === type ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 2. COST CALCULATION */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-slate-900 dark:bg-white rounded-xl text-white dark:text-slate-900">
            <Calculator className="w-5 h-5"/>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Komponen Biaya</h2>
        </div>

        {/* BAHAN BAKU */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">A. Bahan Baku</h3>
            <button className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline">
              <Upload className="w-3 h-3"/> Import Excel
            </button>
          </div>
          <div className="space-y-3">
            {materials.map((m) => (
              <div key={m.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 group hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                <div className="flex-1 w-full">
                  <span className="text-[10px] text-slate-400 block mb-1">Nama Bahan</span>
                  <input className="w-full bg-transparent font-semibold text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-300" placeholder="Contoh: Tepung" value={m.name} onChange={e=>updateMaterial(m.id,'name',e.target.value)} />
                </div>
                <div className="w-full sm:w-32">
                  <span className="text-[10px] text-slate-400 block mb-1">Harga Beli</span>
                  <NumericInput value={m.price} onChange={v=>updateMaterial(m.id,'price',v)} className="py-1.5 text-xs bg-white dark:bg-slate-900" />
                </div>
                <div className="w-full sm:w-40 flex gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block mb-1">Isi Kemasan</span>
                    <NumericInput value={m.content} onChange={v=>updateMaterial(m.id,'content',v)} className="py-1.5 text-xs bg-white dark:bg-slate-900" />
                  </div>
                  <div className="w-16">
                    <span className="text-[10px] text-slate-400 block mb-1">Unit</span>
                    <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-1 text-xs outline-none dark:text-white" value={m.unit} onChange={e=>updateMaterial(m.id,'unit',e.target.value)}>
                      <option value="gram">gr</option><option value="ml">ml</option><option value="pcs">pcs</option>
                    </select>
                  </div>
                </div>
                <div className="w-full sm:w-24">
                  <span className="text-[10px] text-slate-400 block mb-1 font-bold text-emerald-600">Pakai</span>
                  <NumericInput value={m.usage} onChange={v=>updateMaterial(m.id,'usage',v)} className="py-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" />
                </div>
                <button onClick={()=>removeRow(setMaterials,materials,m.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors self-end sm:self-center"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
            <Button variant="secondary" onClick={addMat} className="w-full border-dashed border-2 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800" icon={Plus}>Tambah Bahan</Button>
          </div>
        </div>

        {/* OPERASIONAL VARIABEL */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">B. Biaya Variabel (Opsional)</h3>
          <div className="space-y-3">
            {variableOps.map((op) => (
              <div key={op.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex-1 w-full">
                  <span className="text-[10px] text-slate-400 block mb-1">Item</span>
                  <input className="w-full bg-transparent font-semibold text-slate-700 dark:text-slate-200 outline-none" placeholder="Gas / Kemasan" value={op.name} onChange={e=>updateVarOp(op.id,'name',e.target.value)} />
                </div>
                <div className="w-full sm:w-32">
                  <span className="text-[10px] text-slate-400 block mb-1">Biaya</span>
                  <NumericInput value={op.price} onChange={v=>updateVarOp(op.id,'price',v)} className="py-1.5 text-xs bg-white dark:bg-slate-900" />
                </div>
                <div className="w-full sm:w-40 flex gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block mb-1">Total Isi</span>
                    <NumericInput value={op.content} onChange={v=>updateVarOp(op.id,'content',v)} className="py-1.5 text-xs bg-white dark:bg-slate-900" />
                  </div>
                  <div className="w-16">
                    <span className="text-[10px] text-slate-400 block mb-1">Unit</span>
                    <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-1 text-xs outline-none dark:text-white" value={op.unit} onChange={e=>updateVarOp(op.id,'unit',e.target.value)}>
                      <option value="jam">Jam</option><option value="pcs">Pcs</option>
                    </select>
                  </div>
                </div>
                <div className="w-full sm:w-24">
                  <span className="text-[10px] text-slate-400 block mb-1 font-bold text-emerald-600">Pakai</span>
                  <NumericInput value={op.usage} onChange={v=>updateVarOp(op.id,'usage',v)} className="py-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" />
                </div>
                <button onClick={()=>removeRow(setVariableOps,variableOps,op.id)} className="p-2 text-slate-300 hover:text-red-500 self-end sm:self-center"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
            <Button variant="secondary" onClick={addVarOp} className="w-full border-dashed border-2 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800" icon={Plus}>Tambah Ops</Button>
          </div>
        </div>

        {/* SUBTOTAL */}
        <div className="mt-8 p-5 bg-slate-900 dark:bg-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-white shadow-lg">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Modal Langsung</p>
            <p className="text-2xl font-bold">{formatIDR(totalMaterialCost + totalVarOpCost)}</p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 p-2 pr-4 rounded-xl border border-white/10">
            <div className="bg-white text-slate-900 px-3 py-2 rounded-lg text-xs font-bold uppercase">Jumlah Jadi</div>
            <input 
              type="number" 
              className="w-20 bg-transparent text-right font-bold text-xl outline-none" 
              value={production.yield} 
              onChange={e=>setProduction({...production, yield: parseFloat(e.target.value)||1})} 
            />
            <span className="text-sm font-medium text-slate-300">Pcs</span>
          </div>
        </div>

        {/* C. BIAYA TETAP */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center cursor-pointer mb-4" onClick={() => setShowFixedCost(!showFixedCost)}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              C. Biaya Tetap Bulanan (Opsional)
            </h3>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${showFixedCost ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showFixedCost ? 'translate-x-6' : ''}`}></div>
            </div>
          </div>

          {showFixedCost && (
            <div className="animate-fade-in space-y-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl text-xs text-indigo-800 dark:text-indigo-200 flex gap-3">
                <Info className="w-5 h-5 shrink-0"/>
                <p>Biaya ini akan dibagi dengan <b>Target Produksi Bulanan</b>. Contoh: Sewa Tempat, Gaji Karyawan Tetap, Listrik.</p>
              </div>
              
              <div className="w-full sm:w-1/2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 block">Target Produksi / Bulan</label>
                <NumericInput 
                  value={production.monthlyTarget} 
                  onChange={v => setProduction({...production, monthlyTarget: v})} 
                  placeholder="100"
                  suffix="Pcs"
                />
              </div>

              <div className="space-y-2">
                {fixedOps.map((op) => (
                  <div key={op.id} className="flex gap-2 items-center">
                    <input className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-white outline-none focus:border-indigo-500" placeholder="Nama Biaya" value={op.name} onChange={e=>updateFixedOp(op.id, 'name', e.target.value)} />
                    <div className="w-40">
                      <NumericInput value={op.cost} onChange={v=>updateFixedOp(op.id, v)} prefix="Rp" />
                    </div>
                    <button onClick={()=>removeRow(setFixedOps,fixedOps,op.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
                <button onClick={addFixedOp} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2">+ Tambah Biaya</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 3. RESULTS & STRATEGY */}
      <Card noPadding className="overflow-hidden">
        <div className="bg-slate-900 dark:bg-slate-950 p-8 text-center relative overflow-hidden">
          {/* Decorative Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]"></div>
          
          <div className="relative z-10">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Total HPP Bersih / Pcs</p>
            <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight mb-2">{formatIDR(hppBersih)}</h1>
            <div className="flex justify-center gap-4 text-[10px] font-bold uppercase text-slate-500">
              <span>Bahan: {formatIDR(matPerUnit)}</span>
              <span className="text-slate-700">•</span>
              <span>Ops: {formatIDR(varOpPerUnit)}</span>
              {showFixedCost && (
                <>
                  <span className="text-slate-700">•</span>
                  <span>Tetap: {formatIDR(fixedOpPerUnit)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {/* Pricing Tiers */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Strategi Harga Jual</h3>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setUseSmartRounding(!useSmartRounding)}>
              <span className={`text-[10px] font-bold uppercase ${useSmartRounding ? 'text-emerald-600' : 'text-slate-400'}`}>Smart Rounding</span>
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useSmartRounding ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${useSmartRounding ? 'translate-x-4' : ''}`}></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {tiers.map((tier, idx) => {
              const data = getPriceTier(tier.margin);
              const colors = [
                "bg-orange-50 text-orange-900 border-orange-100 dark:bg-orange-900/20 dark:text-orange-100 dark:border-orange-800/50",
                "bg-blue-50 text-blue-900 border-blue-100 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-800/50",
                "bg-purple-50 text-purple-900 border-purple-100 dark:bg-purple-900/20 dark:text-purple-100 dark:border-purple-800/50"
              ];
              return (
                <div 
                  key={tier.name} 
                  onClick={() => setCustomMargin(tier.margin)} 
                  className={`p-5 rounded-2xl border cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md ${colors[idx]} relative group`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{tier.sub}</span>
                    {idx === 2 && <span className="text-[10px] bg-white/50 px-2 rounded-full">👑</span>}
                  </div>
                  <h4 className="text-xl font-black mb-1">{formatIDR(data.final)}</h4>
                  <div className="text-xs font-medium opacity-80 flex justify-between border-t border-black/5 dark:border-white/10 pt-2 mt-2">
                    <span>Cuan: {formatIDR(data.profit)}</span>
                    <span>{tier.margin}%</span>
                  </div>
                  {/* Selection Ring */}
                  {customMargin === tier.margin && (
                    <div className="absolute inset-0 border-2 border-slate-900 dark:border-white rounded-2xl pointer-events-none"></div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Custom Margin */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 mb-8">
            <div className="flex justify-between items-end mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Edit3 className="w-4 h-4"/> Custom Margin
              </label>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Harga Jual Final</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{formatIDR(getPriceTier(customMargin).final)}</p>
              </div>
            </div>
            <input 
              type="range" min="0" max="150" 
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
              value={customMargin} onChange={(e) => setCustomMargin(parseInt(e.target.value))} 
            />
            <div className="text-center mt-2 font-bold text-slate-900 dark:text-white">{customMargin}%</div>
          </div>

          {/* Target Simulation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4"/> Target Profit
              </h3>
              <NumericInput 
                value={targetMonthlyProfit} 
                onChange={setTargetMonthlyProfit}
                placeholder="5.000.000"
                prefix="Rp"
                className="font-bold text-lg"
              />
              <p className="text-[10px] text-slate-400 mt-2">Masukkan target laba bersih per bulan yang kamu inginkan.</p>
            </div>
            
            {targetMonthlyProfit > 0 && hppBersih > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-5 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase">Jual Minimal / Bulan</span>
                  <span className="text-xl font-black text-emerald-800 dark:text-emerald-300">{targetPcsMonth} pcs</span>
                </div>
                <div className="w-full h-px bg-emerald-200 dark:bg-emerald-800 mb-3"></div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase">Omzet Harian</span>
                  <span className="text-xl font-black text-emerald-800 dark:text-emerald-300">{formatIDR(targetOmzetDaily)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 4. ACTION BAR */}
      <div className="grid grid-cols-2 gap-4 pb-8">
        <Button variant="outline" onClick={resetAll} icon={RotateCcw} className="py-4">Reset</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={()=>setShowLoadModal(true)} icon={FolderOpen} className="flex-1 py-4">Load</Button>
          <Button variant="primary" onClick={saveRecipe} icon={Save} className="flex-1 py-4 shadow-xl shadow-slate-900/20 dark:shadow-none">Simpan</Button>
        </div>
      </div>

      {/* MODAL */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Load Resep</h3>
              <button onClick={()=>setShowLoadModal(false)}><X className="w-6 h-6 text-slate-400"/></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
              {savedRecipes.length===0 && <p className="text-center py-10 text-slate-400 text-sm">Belum ada data.</p>}
              {savedRecipes.map(r => (
                <div key={r.id} onClick={()=>loadRecipe(r)} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition flex justify-between items-center group">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white">{r.productInfo?.name || "Tanpa Nama"}</h4>
                    <p className="text-xs text-slate-500 mt-1">{formatIDR(r.savedPrice)} • {new Date(r.id).toLocaleDateString()}</p>
                  </div>
                  <button onClick={(e)=>{e.stopPropagation(); 
                    const updated = savedRecipes.filter(item => item.id !== r.id);
                    setSavedRecipes(updated);
                    localStorage.setItem('hpp_master_recipes', JSON.stringify(updated));
                  }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-4 h-4"/></button>
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
// 2. POS TAB
// ============================================================================

const PosTab = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProd, setNewProd] = useState({ name: '', price: 0, stock: 0, image: null });

  useEffect(() => {
    const recipes = JSON.parse(localStorage.getItem('hpp_master_recipes') || '[]');
    const manual = JSON.parse(localStorage.getItem('pos_stock') || '[]');
    const recipeProds = recipes.map(r => ({ id: r.id, name: r.productInfo?.name||'Resep', price: r.savedPrice||0, image: r.productInfo?.image, stock: 999, type: 'Resep', hpp: r.savedHpp }));
    setProducts([...recipeProds, ...manual]);
  }, []);

  const addManualProduct = () => {
    if(!newProd.name || !newProd.price) return;
    const item = { id: `m_${Date.now()}`, ...newProd, type: 'Manual', hpp: newProd.price*0.7 };
    const current = JSON.parse(localStorage.getItem('pos_stock') || '[]');
    localStorage.setItem('pos_stock', JSON.stringify([...current, item]));
    setProducts(prev => [...prev, item]);
    setShowAddModal(false); setNewProd({ name: '', price: 0, stock: 0, image: null });
  };

  const addToCart = (p) => {
    const exist = cart.find(c => c.id === p.id);
    setCart(exist ? cart.map(c => c.id === p.id ? {...c, qty: c.qty + 1} : c) : [...cart, {...p, qty: 1}]);
  };

  const updateQty = (id, delta) => setCart(cart.map(c => c.id === id ? {...c, qty: Math.max(1, c.qty + delta)} : c));
  const handleCheckout = () => {
    const tx = { id: Date.now(), date: new Date().toISOString(), items: cart, total: cart.reduce((a,b)=>a+(b.price*b.qty),0), profit: cart.reduce((a,b)=>a+((b.price-b.hpp)*b.qty),0) };
    const history = JSON.parse(localStorage.getItem('pos_transactions') || '[]');
    localStorage.setItem('pos_transactions', JSON.stringify([...history, tx]));
    setCart([]); setIsSuccess(true); setTimeout(()=>setIsSuccess(false),3000); setShowCartMobile(false);
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800">
      {/* Left: Catalog */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex gap-3 z-10">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/>
            <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none dark:text-white" placeholder="Cari..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          </div>
          <button onClick={()=>setShowAddModal(true)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-2.5 rounded-xl hover:scale-105 transition"><Plus className="w-5 h-5"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
            {filtered.map(p => (
              <div key={p.id} onClick={()=>addToCart(p)} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden cursor-pointer group hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                <div className="aspect-square bg-slate-100 dark:bg-slate-800 relative">
                  {p.image ? <img src={p.image} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-2xl">{p.name[0]}</div>}
                  <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur text-white px-2 py-1 rounded-lg text-[10px] font-bold">{formatIDR(p.price)}</div>
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">{p.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{p.stock} Stok</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm md:static md:bg-transparent md:w-96 transition-all ${showCartMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'}`} onClick={()=>setShowCartMobile(false)}>
        <div className={`absolute right-0 top-0 bottom-0 w-full md:w-96 bg-white dark:bg-slate-900 md:border-l border-slate-100 dark:border-slate-800 flex flex-col transition-transform duration-300 ${showCartMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`} onClick={e=>e.stopPropagation()}>
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h2 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">Order <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full">{cart.length}</span></h2>
            <button onClick={()=>setShowCartMobile(false)} className="md:hidden"><X className="w-6 h-6"/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map(item => (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0">
                  {item.image && <img src={item.image} className="w-full h-full object-cover"/>}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-slate-700 dark:text-white line-clamp-1">{item.name}</p>
                  <p className="text-xs text-slate-500">{formatIDR(item.price)}</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-1">
                  <button onClick={()=>updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-700 rounded shadow-sm text-xs font-bold">-</button>
                  <span className="text-xs font-bold dark:text-white">{item.qty}</span>
                  <button onClick={()=>updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-slate-700 rounded shadow-sm text-xs font-bold">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-500 text-sm font-medium">Total</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{formatIDR(cart.reduce((a,b)=>a+(b.price*b.qty),0))}</span>
            </div>
            <Button variant="primary" className="w-full py-4 rounded-xl shadow-xl shadow-slate-900/20 dark:shadow-none" onClick={handleCheckout} disabled={cart.length===0}>Bayar</Button>
          </div>
        </div>
      </div>

      {/* Floating Cart Button Mobile */}
      <button onClick={()=>setShowCartMobile(true)} className="md:hidden fixed bottom-24 right-4 w-14 h-14 bg-slate-900 text-white rounded-full shadow-xl flex items-center justify-center z-40">
        <ShoppingCart className="w-6 h-6"/>
        {cart.length > 0 && <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full border-2 border-slate-900 text-[10px] font-bold flex items-center justify-center">{cart.length}</span>}
      </button>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Tambah Stok</h3>
            <div className="space-y-3">
              <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none dark:text-white" placeholder="Nama Produk" value={newProd.name} onChange={e=>setNewProd({...newProd, name:e.target.value})} />
              <NumericInput placeholder="Harga Jual" value={newProd.price} onChange={v=>setNewProd({...newProd, price:v})} prefix="Rp" />
              <NumericInput placeholder="Stok Awal" value={newProd.stock} onChange={v=>setNewProd({...newProd, stock:v})} />
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="ghost" className="flex-1" onClick={()=>setShowAddModal(false)}>Batal</Button>
              <Button variant="primary" className="flex-1" onClick={addManualProduct}>Simpan</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Success Popup */}
      {isSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-800 px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center animate-bounce">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-3 text-emerald-600"><CheckCircle className="w-8 h-8"/></div>
            <h2 className="font-bold text-xl text-slate-800 dark:text-white">Transaksi Berhasil!</h2>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. REPORT TAB
// ============================================================================

const ReportTab = () => {
  const [filter, setFilter] = useState('all');
  const [txs, setTxs] = useState([]);

  useEffect(() => {
    setTxs(JSON.parse(localStorage.getItem('pos_transactions') || '[]'));
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const filtered = txs.filter(t => {
      const d = new Date(t.date);
      if(filter === 'today') return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
      if(filter === 'month') return d.getMonth() === now.getMonth();
      return true;
    });
    return {
      revenue: filtered.reduce((a,b)=>a+b.total,0),
      profit: filtered.reduce((a,b)=>a+b.profit,0),
      count: filtered.length,
      list: filtered.reverse()
    }
  }, [filter, txs]);

  // SVG Chart
  const chartData = useMemo(() => {
    if(stats.list.length < 2) return null;
    const data = stats.list.slice(0,10).map(t => t.total).reverse();
    const max = Math.max(...data, 100);
    const points = data.map((val, i) => `${(i / (data.length - 1)) * 100},${100 - (val / max) * 100}`).join(' ');
    return { points };
  }, [stats]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-8 pb-32">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Report</h1>
          <p className="text-slate-400 text-sm">Realtime Overview</p>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          {['Hari Ini', 'Bulan Ini', 'Semua'].map((l, i) => {
            const val = ['today', 'month', 'all'][i];
            return (
              <button key={val} onClick={()=>setFilter(val)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter===val ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{l}</button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Omzet</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">{formatIDR(stats.revenue)}</h2>
          </div>
          <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-100 dark:text-slate-800 group-hover:scale-110 transition"/>
        </Card>
        <Card className="relative overflow-hidden group border-emerald-100 dark:border-emerald-900/30">
          <div className="relative z-10">
            <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Laba Bersih</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">{formatIDR(stats.profit)}</h2>
          </div>
          <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-50 dark:text-emerald-900/20 group-hover:scale-110 transition"/>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Transaksi</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">{stats.count}</h2>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"><ShoppingCart className="w-6 h-6 text-slate-400"/></div>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold text-slate-800 dark:text-white mb-6">Tren Penjualan</h3>
        {chartData ? (
          <div className="h-48 w-full relative">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline fill="none" stroke="#0f172a" strokeWidth="2" points={chartData.points} vectorEffect="non-scaling-stroke" className="dark:stroke-white drop-shadow-md"/>
              <polygon fill="url(#gradient)" points={`0,100 ${chartData.points} 100,100`} />
            </svg>
          </div>
        ) : <div className="h-40 flex items-center justify-center text-slate-300 text-sm italic">Belum ada data grafik</div>}
      </Card>

      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-white">Riwayat Terakhir</h3>
        {stats.list.length === 0 ? <p className="text-center text-slate-400 py-10">Belum ada transaksi.</p> : stats.list.map(t => (
          <div key={t.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-500">#{t.id.toString().slice(-3)}</div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white">{formatIDR(t.total)}</p>
                <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">+{formatIDR(t.profit)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP SHELL
// ============================================================================

const App = () => {
  const [activeTab, setActiveTab] = useState('calc');
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
        
        {/* Toggle Dark Mode */}
        <button 
          onClick={() => setDarkMode(!darkMode)} 
          className="fixed top-4 right-4 z-50 w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center text-slate-600 dark:text-white transition hover:scale-110"
        >
          {darkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
        </button>

        <div className="animate-fade-in pb-20 pt-4">
          {activeTab === 'calc' && <CalculatorTab />}
          {activeTab === 'pos' && <PosTab />}
          {activeTab === 'report' && <ReportTab />}
        </div>

        {/* Premium Bottom Nav */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-full shadow-2xl shadow-slate-200 dark:shadow-black/50 z-40 flex gap-1 border border-slate-200 dark:border-slate-800">
          {[
            { id: 'calc', icon: Calculator, label: 'Hitung' },
            { id: 'pos', icon: ShoppingCart, label: 'Kasir' },
            { id: 'report', icon: BarChart3, label: 'Laporan' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative px-6 py-3 rounded-full transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === item.id 
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon className={`w-5 h-5`}/>
              {activeTab === item.id && <span className="text-xs font-bold whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default CalculatorTab;

