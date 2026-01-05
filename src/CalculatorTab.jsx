import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Calculator, Save, FolderOpen,
  RotateCcw, Package, Zap, PieChart,
  CheckCircle, TrendingUp
} from 'lucide-react'


const CalculatorTab = () => {
  // --- [FITUR 3] PRESET USAHA ---
  const BUSINESS_PRESETS = {
    makanan: { margin: 40, unit: 'gram', label: 'Makanan (Umum)' },
    minuman: { margin: 50, unit: 'ml', label: 'Minuman' },
    frozen: { margin: 30, unit: 'pcs', label: 'Frozen Food' },
    reseller: { margin: 20, unit: 'pcs', label: 'Reseller/Thrift' }
  };

  // --- STATE MANAGEMENT ---
  const [recipeName, setRecipeName] = useState('Resep Baru');
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState([]);

  // [FITUR 2] Mode Hitung (Simple vs Detail)
  const [calcMode, setCalcMode] = useState('detail'); 
  const [simpleModal, setSimpleModal] = useState(0); 

  // [FITUR 3] Jenis Usaha
  const [businessType, setBusinessType] = useState('makanan');

  // 1. Bahan Baku
  const [materials, setMaterials] = useState([
    { id: 1, name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }
  ]);

  // 2. Operasional (Biaya Tambahan) - [FITUR 1] Update struktur state untuk tipe biaya
  const [operations, setOperations] = useState([
    { id: 1, type: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0, costType: 'variable' } 
  ]);

  // 3. Data Produksi - [FITUR 1] Tambah monthlyTarget untuk biaya tetap
  const [production, setProduction] = useState({
    yield: 0, 
    margin: 40,
    monthlyTarget: 100 // Target produksi per bulan (default)
  });

  // [FITUR 5] Target Laba
  const [monthlyProfitTarget, setMonthlyProfitTarget] = useState(0);

  // 4. Target Harga (Untuk Reverse calc)
  const [marketPrice, setMarketPrice] = useState(0);

  // --- INITIAL LOAD ---
  useEffect(() => {
    const saved = localStorage.getItem('hpp_recipes');
    if (saved) {
      setSavedRecipes(JSON.parse(saved));
    }
  }, []);

  // [FITUR 3] Handler Preset
  const applyPreset = (type) => {
    setBusinessType(type);
    setProduction(prev => ({ ...prev, margin: BUSINESS_PRESETS[type].margin }));
    // Update satuan default bahan baris pertama jika kosong
    if (materials.length === 1 && materials[0].name === '') {
      const newMats = [...materials];
      newMats[0].unit = BUSINESS_PRESETS[type].unit;
      setMaterials(newMats);
    }
  };

  // --- CALCULATIONS ---

  const formatIDR = (number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  };

  const calculateRowCost = (price, content, usage) => {
    if (!content || content === 0) return 0;
    return (price / content) * usage;
  };

  const updateMaterial = (id, field, value) => {
    const newMaterials = materials.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        updatedItem.cost = calculateRowCost(updatedItem.price, updatedItem.content, updatedItem.usage);
        return updatedItem;
      }
      return item;
    });
    setMaterials(newMaterials);
  };

  // [FITUR 1] Logic update operasional (handle Variabel vs Tetap)
  const updateOperation = (id, field, value) => {
    const newOperations = operations.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Jika Biaya Tetap, cost dihitung nanti di totalan (dianggap harga bulanan)
        // Jika Variabel, hitung seperti biasa
        if (updatedItem.costType === 'variable') {
           updatedItem.cost = calculateRowCost(updatedItem.price, updatedItem.content, updatedItem.usage);
        } else {
           updatedItem.cost = updatedItem.price; // Simpan harga nominal untuk display
        }
        return updatedItem;
      }
      return item;
    });
    setOperations(newOperations);
  };

  const addMaterialRow = () => setMaterials([...materials, { id: Date.now(), name: '', price: 0, unit: BUSINESS_PRESETS[businessType].unit, content: 1000, usage: 0, cost: 0 }]);
  const removeMaterialRow = (id) => materials.length > 1 && setMaterials(materials.filter(item => item.id !== id));
  
  const addOperationRow = () => setOperations([...operations, { id: Date.now(), type: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0, costType: 'variable' }]);
  const removeOperationRow = (id) => operations.length > 1 && setOperations(operations.filter(item => item.id !== id));

  // --- TOTALS & LOGIC UTAMA ---
  
  // 1. Hitung Bahan (Total Batch)
  const totalMaterialCost = materials.reduce((acc, curr) => acc + curr.cost, 0);

  // 2. Hitung Ops Variabel (Total Batch)
  const totalVariableOps = operations
    .filter(op => op.costType === 'variable')
    .reduce((acc, curr) => acc + curr.cost, 0);

  // 3. Hitung Ops Tetap (Total Bulanan)
  const totalFixedOpsMonthly = operations
    .filter(op => op.costType === 'fixed')
    .reduce((acc, curr) => acc + (curr.price || 0), 0);

  // 4. Kalkulasi HPP Per Unit
  let hppPerUnit = 0;
  let materialPerUnit = 0;
  let varOpsPerUnit = 0;
  let fixedOpsPerUnit = 0;

  if (calcMode === 'simple') {
    // Logic [FITUR 2] Mode Cepat
    hppPerUnit = production.yield > 0 ? simpleModal / production.yield : 0;
  } else {
    // Logic Detail
    if (production.yield > 0) {
      materialPerUnit = totalMaterialCost / production.yield;
      varOpsPerUnit = totalVariableOps / production.yield;
      
      // [FITUR 1] Alokasi Biaya Tetap: Total Biaya Tetap / Target Produksi Bulanan
      fixedOpsPerUnit = production.monthlyTarget > 0 ? totalFixedOpsMonthly / production.monthlyTarget : 0;
      
      hppPerUnit = materialPerUnit + varOpsPerUnit + fixedOpsPerUnit;
    }
  }

  // Total Modal Batch (Untuk display chart saja, khusus mode detail)
  const totalBatchCostDisplay = totalMaterialCost + totalVariableOps;

  const profitAmount = hppPerUnit * (production.margin / 100);
  const sellingPriceRaw = hppPerUnit + profitAmount;

  const roundUpPrice = (price) => {
    if (price < 1000) return Math.ceil(price / 100) * 100;
    return Math.ceil(price / 500) * 500;
  };
  const smartPrice = roundUpPrice(sellingPriceRaw);

  const realMargin = marketPrice > 0 && hppPerUnit > 0 
    ? ((marketPrice - hppPerUnit) / hppPerUnit) * 100 
    : 0;

  // [FITUR 5] Kalkulasi Target Laba
  const profitPerPcsReal = marketPrice > 0 ? (marketPrice - hppPerUnit) : profitAmount;
  const targetQtyPerMonth = profitPerPcsReal > 0 && monthlyProfitTarget > 0 ? Math.ceil(monthlyProfitTarget / profitPerPcsReal) : 0;
  const targetOmzetDaily = targetQtyPerMonth > 0 ? (targetQtyPerMonth * (marketPrice || smartPrice)) / 30 : 0;

  // --- STORAGE HANDLERS ---
  const saveRecipe = () => {
    if (!recipeName) return alert("Beri nama resep dulu!");
    const newRecipe = {
      id: Date.now(),
      name: recipeName,
      materials,
      operations,
      production,
      savedHpp: hppPerUnit, 
      savedPrice: smartPrice 
    };
    
    const updatedRecipes = [...savedRecipes, newRecipe];
    setSavedRecipes(updatedRecipes);
    localStorage.setItem('hpp_recipes', JSON.stringify(updatedRecipes));
    alert('Resep berhasil disimpan! Data kini tersedia di menu Kasir.');
  };

  const loadRecipe = (recipe) => {
    setRecipeName(recipe.name);
    setMaterials(recipe.materials);
    setOperations(recipe.operations || []);
    setProduction(recipe.production);
    setShowLoadModal(false);
  };

  const deleteRecipe = (id) => {
    const updated = savedRecipes.filter(r => r.id !== id);
    setSavedRecipes(updated);
    localStorage.setItem('hpp_recipes', JSON.stringify(updated));
  };

  const resetForm = () => {
    if(window.confirm("Reset semua data?")) {
      setRecipeName('Resep Baru');
      setMaterials([{ id: 1, name: '', price: 0, unit: 'gram', content: 1000, usage: 0, cost: 0 }]);
      setOperations([{ id: 1, type: '', price: 0, unit: 'jam', content: 1, usage: 0, cost: 0, costType: 'variable' }]);
      setProduction({ yield: 0, margin: 30, monthlyTarget: 100 });
      setMarketPrice(0);
      setSimpleModal(0);
    }
  };

  return (
    <div className="pb-24">
      {/* HEADER */}
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-4 shadow-lg sticky top-0 z-20 rounded-b-xl">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">HPP Master Pro</h1>
              {/* [FITUR 3] Preset Dropdown */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-blue-200">Jenis Usaha:</span>
                <select 
                  className="bg-blue-800/50 text-xs border border-blue-600 rounded px-2 py-0.5 outline-none"
                  value={businessType}
                  onChange={(e) => applyPreset(e.target.value)}
                >
                  {Object.entries(BUSINESS_PRESETS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex items-center bg-white/10 rounded-full p-1 pl-4 w-full md:w-auto">
            <input 
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className="bg-transparent border-none outline-none text-white placeholder-blue-200 text-sm w-full md:w-48"
              placeholder="Nama Resep..."
            />
            <div className="flex gap-1 ml-2">
              <button onClick={() => setShowLoadModal(true)} className="p-2 hover:bg-white/20 rounded-full transition" title="Buka Resep">
                <FolderOpen className="w-4 h-4" />
              </button>
              <button onClick={saveRecipe} className="p-2 hover:bg-white/20 rounded-full transition" title="Simpan Resep">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={resetForm} className="p-2 hover:bg-white/20 rounded-full transition" title="Reset">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* LOAD MODAL (Tidak Berubah) */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold">Resep Tersimpan</h3>
              <button onClick={() => setShowLoadModal(false)} className="text-slate-400 hover:text-red-500">Tutup</button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {savedRecipes.length === 0 ? (
                <p className="text-center text-slate-500 py-4">Belum ada resep tersimpan.</p>
              ) : (
                savedRecipes.map(recipe => (
                  <div key={recipe.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-blue-50 transition cursor-pointer group">
                    <div onClick={() => loadRecipe(recipe)} className="flex-1">
                      <p className="font-bold text-slate-700">{recipe.name}</p>
                      <p className="text-xs text-slate-500">{new Date(recipe.id).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => deleteRecipe(recipe.id)} className="p-2 text-slate-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 space-y-6 mt-4">

        {/* [FITUR 2] TOGGLE MODE SIMPLE/DETAIL */}
        <div className="flex justify-center mb-2">
          <div className="bg-white p-1 rounded-full shadow border border-slate-200 flex gap-1">
            <button 
              onClick={() => setCalcMode('detail')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${calcMode === 'detail' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Mode Detail
            </button>
            <button 
              onClick={() => setCalcMode('simple')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${calcMode === 'simple' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Mode Cepat
            </button>
          </div>
        </div>

        {/* VISUAL SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                   <PieChart className="w-4 h-4" /> <span className="text-xs font-bold uppercase">Komposisi (Per Batch)</span>
                </div>
                {/* Chart hanya relevan di mode detail */}
                {calcMode === 'detail' ? (
                  <>
                    <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${totalBatchCostDisplay === 0 ? 0 : (totalMaterialCost/totalBatchCostDisplay)*100}%` }}></div>
                        <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${totalBatchCostDisplay === 0 ? 0 : (totalVariableOps/totalBatchCostDisplay)*100}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs mt-2 font-medium">
                        <span className="text-blue-600">Bahan ({totalBatchCostDisplay > 0 ? Math.round((totalMaterialCost/totalBatchCostDisplay)*100) : 0}%)</span>
                        <span className="text-amber-600">Biaya Tambahan ({totalBatchCostDisplay > 0 ? Math.round((totalVariableOps/totalBatchCostDisplay)*100) : 0}%)</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-2">Mode Cepat aktif</p>
                )}
            </div>

            <div className="md:col-span-2 bg-indigo-600 rounded-xl shadow-lg p-4 text-white flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
                <div className="absolute -right-10 -top-10 bg-white/10 w-40 h-40 rounded-full blur-2xl"></div>
                <div className="z-10">
                    <p className="text-indigo-200 text-xs font-bold uppercase mb-1">
                      {calcMode === 'detail' ? 'Total Biaya (Bahan + Var Ops)' : 'Total Modal Diinput'}
                    </p>
                    <h2 className="text-3xl font-bold">
                      {formatIDR(calcMode === 'detail' ? totalBatchCostDisplay : simpleModal)}
                    </h2>
                </div>
                <div className="z-10 mt-4 md:mt-0 text-right">
                    <p className="text-indigo-200 text-xs font-bold uppercase mb-1">HPP Bersih / Pcs</p>
                    <div className="flex items-baseline gap-2 justify-end">
                      <span className="text-sm">Estimasi:</span>
                      <h2 className="text-2xl font-bold bg-white/20 px-3 py-1 rounded-lg">{formatIDR(hppPerUnit)}</h2>
                    </div>
                </div>
            </div>
        </div>

        {/* INPUT SECTIONS - HANYA TAMPIL JIKA MODE DETAIL */}
        {calcMode === 'detail' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* BAHAN BAKU */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
                <div className="p-4 border-b bg-blue-50/50 flex justify-between items-center">
                    <h2 className="font-bold text-blue-800 flex items-center gap-2"><Package className="w-4 h-4"/> Bahan Baku</h2>
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">{formatIDR(totalMaterialCost)}</span>
                </div>
                <div className="p-4 space-y-3 flex-1">
                    {materials.map((item, idx) => (
                        <div key={item.id} className="text-sm border-b border-slate-100 pb-3 last:border-0 relative">
                             <div className="flex justify-between mb-1">
                                <input 
                                    placeholder="Nama Bahan" 
                                    className="font-medium text-slate-700 w-full outline-none placeholder:font-normal"
                                    value={item.name}
                                    onChange={(e) => updateMaterial(item.id, 'name', e.target.value)}
                                />
                                <button onClick={() => removeMaterialRow(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                             </div>
                             <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-400 block">Harga Beli</label>
                                    <input type="number" className="w-full bg-slate-50 rounded p-1" value={item.price || ''} onChange={(e)=>updateMaterial(item.id, 'price', parseFloat(e.target.value)||0)} />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 block">Isi ({item.unit})</label>
                                    <div className="flex">
                                        <input type="number" className="w-full bg-slate-50 rounded-l p-1" value={item.content || ''} onChange={(e)=>updateMaterial(item.id, 'content', parseFloat(e.target.value)||0)} />
                                        <select className="bg-slate-200 text-[10px] rounded-r px-1" value={item.unit} onChange={(e)=>updateMaterial(item.id, 'unit', e.target.value)}>
                                            <option value="gram">gr</option><option value="kg">kg</option><option value="ml">ml</option><option value="liter">ltr</option><option value="pcs">pcs</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 block">Pakai</label>
                                    <input type="number" className="w-full bg-yellow-50 border border-yellow-100 rounded p-1 font-semibold" value={item.usage || ''} onChange={(e)=>updateMaterial(item.id, 'usage', parseFloat(e.target.value)||0)} />
                                </div>
                             </div>
                        </div>
                    ))}
                    <button onClick={addMaterialRow} className="w-full py-2 border border-dashed border-blue-300 text-blue-500 text-xs rounded-lg hover:bg-blue-50">+ Tambah Bahan</button>
                </div>
            </div>

            {/* [FITUR 6] RENAME: OPERASIONAL -> BIAYA TAMBAHAN */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
                <div className="p-4 border-b bg-amber-50/50 flex justify-between items-center">
                    <h2 className="font-bold text-amber-800 flex items-center gap-2"><Zap className="w-4 h-4"/> Biaya Tambahan</h2>
                    <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">
                      {/* Tampilkan total variabel + tetap bulanan untuk info */}
                      {formatIDR(totalVariableOps + totalFixedOpsMonthly)}
                    </span>
                </div>
                 <div className="p-4 space-y-3 flex-1">
                    {operations.map((item, idx) => (
                        <div key={item.id} className="text-sm border-b border-slate-100 pb-3 last:border-0 relative">
                             <div className="flex justify-between mb-1 gap-2">
                                <input 
                                    placeholder="Jenis (Gas, Gaji, Sewa)" 
                                    className="font-medium text-slate-700 w-full outline-none placeholder:font-normal"
                                    value={item.type}
                                    onChange={(e) => updateOperation(item.id, 'type', e.target.value)}
                                />
                                
                                {/* [FITUR 1] TOGGLE TIPE BIAYA DI ROW */}
                                <select 
                                  className={`text-[10px] border rounded px-1 font-bold ${item.costType === 'fixed' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                                  value={item.costType}
                                  onChange={(e) => updateOperation(item.id, 'costType', e.target.value)}
                                >
                                  <option value="variable">Variabel</option>
                                  <option value="fixed">Tetap (Bulanan)</option>
                                </select>
                                
                                <button onClick={() => removeOperationRow(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                             </div>

                             {item.costType === 'variable' ? (
                               // INPUT VARIABEL (Eksisting)
                               <div className="grid grid-cols-3 gap-2">
                                  <div>
                                      <label className="text-[10px] text-slate-400 block">Biaya</label>
                                      <input type="number" className="w-full bg-slate-50 rounded p-1" value={item.price || ''} onChange={(e)=>updateOperation(item.id, 'price', parseFloat(e.target.value)||0)} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-slate-400 block">Total Isi</label>
                                      <div className="flex">
                                          <input type="number" className="w-full bg-slate-50 rounded-l p-1" value={item.content || ''} onChange={(e)=>updateOperation(item.id, 'content', parseFloat(e.target.value)||0)} />
                                          <select className="bg-slate-200 text-[10px] rounded-r px-1" value={item.unit} onChange={(e)=>updateOperation(item.id, 'unit', e.target.value)}>
                                              <option value="menit">menit</option><option value="jam">jam</option><option value="hari">hari</option><option value="bulan">bln</option>
                                          </select>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-slate-400 block">Pakai</label>
                                      <input type="number" className="w-full bg-yellow-50 border border-yellow-100 rounded p-1 font-semibold" value={item.usage || ''} onChange={(e)=>updateOperation(item.id, 'usage', parseFloat(e.target.value)||0)} />
                                  </div>
                               </div>
                             ) : (
                               // INPUT TETAP (Simple)
                               <div className="grid grid-cols-1 gap-2">
                                 <div>
                                      <label className="text-[10px] text-purple-500 block font-semibold">Biaya Bulanan (Sewa/Wifi/Penyusutan)</label>
                                      <div className="relative">
                                        <span className="absolute left-2 top-1.5 text-xs text-slate-400">Rp</span>
                                        <input type="number" className="w-full bg-purple-50 border border-purple-100 rounded p-1 pl-6 font-semibold text-slate-700" value={item.price || ''} onChange={(e)=>updateOperation(item.id, 'price', parseFloat(e.target.value)||0)} />
                                      </div>
                                      <p className="text-[9px] text-slate-400 mt-0.5">Akan dibagi dengan target produksi bulanan.</p>
                                 </div>
                               </div>
                             )}
                        </div>
                    ))}
                    <button onClick={addOperationRow} className="w-full py-2 border border-dashed border-amber-300 text-amber-500 text-xs rounded-lg hover:bg-amber-50">+ Tambah Biaya</button>
                </div>
            </div>
        </div>
        )}

        {/* [FITUR 2] INPUT SIMPLE MODE */}
        {calcMode === 'simple' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-200 text-center space-y-4">
             <h3 className="font-bold text-emerald-800">Mode Hitung Cepat</h3>
             <div className="max-w-xs mx-auto">
               <label className="text-xs text-slate-500 font-bold mb-1 block">Total Modal Belanja (Rp)</label>
               <input 
                  type="number" 
                  className="w-full p-3 border border-emerald-300 rounded-lg text-xl font-bold text-center text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={simpleModal || ''}
                  onChange={(e) => setSimpleModal(parseFloat(e.target.value) || 0)}
                  placeholder="0"
               />
             </div>
             <p className="text-xs text-slate-400">Masukkan total uang yang dikeluarkan untuk satu kali produksi.</p>
          </div>
        )}

        {/* ANALYTICS CARD */}
        <section className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden">
             <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                 <h2 className="font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Strategi Harga</h2>
             </div>
             
             <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                
                {/* LEFT SIDE: HPP & PRICE */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase">1. Tentukan Margin</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            {/* [FITUR 6] RENAME: YIELD -> JUMLAH JADI */}
                            <label className="text-xs text-slate-500 font-bold block mb-1">Jumlah Jadi (Pcs)</label>
                            <input type="number" className="w-full border p-2 rounded text-center font-bold" value={production.yield||''} onChange={(e)=>setProduction({...production, yield: parseFloat(e.target.value)||0})} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold block mb-1">Margin (%)</label>
                            <input type="number" className="w-full border p-2 rounded text-center font-bold text-indigo-600" value={production.margin} onChange={(e)=>setProduction({...production, margin: parseFloat(e.target.value)||0})} />
                        </div>
                    </div>

                    {/* [FITUR 1] INPUT TARGET PRODUKSI BULANAN (Muncul jika ada biaya tetap) */}
                    {calcMode === 'detail' && operations.some(op => op.costType === 'fixed') && (
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <label className="text-[10px] font-bold text-purple-700 block mb-1">Target Produksi / Bulan (Pcs)</label>
                        <input 
                          type="number" 
                          className="w-full p-1.5 border border-purple-200 rounded text-sm text-center"
                          value={production.monthlyTarget}
                          onChange={(e) => setProduction({...production, monthlyTarget: parseFloat(e.target.value) || 1})}
                        />
                        <p className="text-[9px] text-purple-500 mt-1">Digunakan untuk membagi biaya tetap (sewa, dll).</p>
                      </div>
                    )}

                    {/* [FITUR 4] BREAKDOWN HPP PER PCS */}
                    {calcMode === 'detail' && hppPerUnit > 0 && (
                      <div className="text-[10px] text-slate-500 space-y-1 border-t pt-2 mt-2">
                        <div className="flex justify-between"><span>Bahan Baku/pcs:</span> <span>{formatIDR(materialPerUnit)}</span></div>
                        <div className="flex justify-between"><span>Ops Variabel/pcs:</span> <span>{formatIDR(varOpsPerUnit)}</span></div>
                        {fixedOpsPerUnit > 0 && (
                           <div className="flex justify-between text-purple-600 font-medium"><span>Biaya Tetap/pcs:</span> <span>{formatIDR(fixedOpsPerUnit)}</span></div>
                        )}
                        <div className="flex justify-between font-bold text-slate-700 border-t border-dashed pt-1 mt-1"><span>Total HPP Real:</span> <span>{formatIDR(hppPerUnit)}</span></div>
                      </div>
                    )}

                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-2">
                        <p className="text-xs text-indigo-800 mb-1 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Saran Harga Jual</p>
                        <p className="text-3xl font-extrabold text-indigo-600">{formatIDR(smartPrice)}</p>
                        <p className="text-[10px] text-indigo-400 mt-1">*Dibulatkan agar mudah kembalian</p>
                    </div>
                </div>

                {/* RIGHT SIDE: REVERSE & TARGET */}
                <div className="space-y-4 pt-4 md:pt-0">
                    {/* [FITUR 6] RENAME: REVERSE -> CEK HARGA PASAR */}
                    <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">2. Cek Harga Pasar <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">Simulasi</span></h3>
                    
                    <div>
                        <label className="text-xs text-slate-500 font-bold">Harga Jual Pesaing</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">Rp</span>
                            <input 
                                type="number" 
                                className="w-full pl-10 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="Misal: 3000"
                                value={marketPrice || ''}
                                onChange={(e) => setMarketPrice(parseFloat(e.target.value)||0)}
                            />
                        </div>
                    </div>

                    {marketPrice > 0 && (
                        <div className={`p-4 rounded-xl border ${realMargin > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-600">Margin Anda:</span>
                                <span className={`text-2xl font-bold ${realMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {realMargin.toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-slate-500">Untung Bersih:</span>
                                <span className={`text-sm font-bold ${realMargin > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {formatIDR(marketPrice - hppPerUnit)} / pcs
                                </span>
                            </div>
                        </div>
                    )}

                    {/* [FITUR 5] TARGET LABA BULANAN */}
                    <div className="border-t pt-4 mt-4">
                        <label className="text-xs text-slate-500 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Target Laba Bersih / Bulan</label>
                        <input 
                            type="number" 
                            className="w-full p-2 mt-1 border border-slate-300 rounded text-sm"
                            placeholder="Contoh: 5000000"
                            value={monthlyProfitTarget || ''}
                            onChange={(e) => setMonthlyProfitTarget(parseFloat(e.target.value)||0)}
                        />
                        {monthlyProfitTarget > 0 && (marketPrice > 0 || smartPrice > 0) && (
                          <div className="mt-2 bg-slate-100 p-2 rounded text-[10px] text-slate-600 space-y-1">
                             <p>• Harus jual minimal: <b className="text-slate-800">{targetQtyPerMonth} pcs</b> / bulan</p>
                             <p>• Atau <b className="text-slate-800">{Math.ceil(targetQtyPerMonth/30)} pcs</b> / hari</p>
                             <p>• Target Omzet Harian: <b className="text-slate-800">{formatIDR(targetOmzetDaily)}</b></p>
                          </div>
                        )}
                    </div>
                </div>

             </div>
        </section>

      </main>
    </div>
  );
};

export default CalculatorTab

