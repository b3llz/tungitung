// ============================================================
// KALKULATOR HPP v5 WELP — dua panel: pembuat resep (kiri) +
// KARTU BIAYA ala kwitansi (kanan, sticky). Logika perhitungan
// dipertahankan 100% (calcRow, margin tier 22.8/48.6/78.4,
// smart rounding, proyeksi, save/load/export Excel).
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  BahanBaku, BiayaVariabel, Plus, Trash2, Save, FolderOpen, RotateCcw,
  Omzet, Edit3, KameraBuddy, PaketBuddy, FileExcelBuddy,
  StrukCetak, Lisensi, KoinBuddy, HargaJual, Kompetitor, CategoryIcon
} from './welp-icons.jsx';
import {
  safeParse, formatIDR, isPro,
  MATERIAL_UNITS, VARIABLE_COST_TYPES, loadXLSX,
  dbSet, useDbSync   // v15 F1
} from './core.jsx';
import { Button, Card, NumericInput, Select, Toggle, Badge, Modal, EmptyState, ImageCropperModal } from './ui';

/* ---------- SMART PLANNER (fitur PRO) ---------- */
const SmartPlannerModal = ({ materials, production, onClose }) => {
  const [target, setTarget] = useState(100);
  return (
    <Modal open onClose={onClose} title="Smart Production Planner" sub="Fitur Pro" width="max-w-lg">
      <div className="bg-paper dark:bg-white/[.03] p-4 rounded-2xl border border-line dark:border-line-dark mb-5">
        <label className="kicker block mb-2">Rencana Produksi (Qty)</label>
        <div className="flex gap-2">
          <input type="number" value={target} onChange={e => setTarget(e.target.value)}
            className="field-lg flex-1" />
          <span className="px-4 flex items-center rounded-xl bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-xs font-extrabold text-ink-faint">Pcs</span>
        </div>
      </div>
      <div className="max-h-[40vh] overflow-y-auto custom-scrollbar space-y-2 mb-5">
        <h4 className="font-extrabold text-sm text-ink dark:text-ink-inv mb-2">Estimasi Belanja Bahan:</h4>
        {materials.map((m, i) => {
          const yieldPcs = production?.yield || 1;
          const totalNeed = ((m.usage || 0) / yieldPcs) * target;
          const packsToBuy = Math.ceil(totalNeed / (m.content || 1));
          return (
            <div key={i} className="flex justify-between items-center p-3.5 rounded-xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
              <div>
                <p className="font-extrabold text-ink dark:text-ink-inv text-[13px]">{m.name || 'Bahan'}</p>
                <p className="text-[10px] text-ink-faint font-semibold money">Butuh: {formatNumberSafe(totalNeed)} {m.unit}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-ink dark:text-ink-inv money">{packsToBuy} Pack</p>
                <p className="text-[10px] text-ink-faint font-semibold money">Est. {formatIDR(packsToBuy * m.price)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <Button variant="secondary" onClick={() => window.print()} icon={StrukCetak} className="w-full py-3">Cetak Rencana Belanja</Button>
    </Modal>
  );
};
const formatNumberSafe = (v) => {
  if (v === undefined || v === null || isNaN(v)) return '';
  return String(Math.round(v * 100) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/* ============================================================
   CALCULATOR TAB
   ============================================================ */
export const CalculatorTab = ({ licenseInfo, triggerAlert, setEditingMode }) => {
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
  const [showPlanner, setShowPlanner] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

  // Sembunyikan navbar saat crop foto
  useEffect(() => {
    if (cropSrc) setEditingMode(true);
    else setEditingMode(false);
  }, [cropSrc, setEditingMode]);

  const calcRow = (price, content, usage) => (!content || content === 0) ? 0 : (price / content) * usage;
  const updateMat = (id, f, v) => setMaterials(prev => prev.map(m => m.id === id ? { ...m, [f]: v, cost: calcRow(f === 'price' ? v : m.price, f === 'content' ? v : m.content, f === 'usage' ? v : m.usage) } : m));
  const updateVar = (id, f, v) => setVariableOps(prev => prev.map(o => {
    if (o.id !== id) return o;
    const newData = { ...o, [f]: v };
    if (f === 'type') { const defs = VARIABLE_COST_TYPES[v]; newData.unit = defs.units[0]; newData.content = 1; newData.usage = 0; }
    newData.cost = calcRow(newData.price, newData.content, newData.usage);
    return newData;
  }));
  const updateFix = (id, v) => setFixedOps(prev => prev.map(f => f.id === id ? { ...f, cost: v } : f));
  const addMat = () => setMaterials([...materials, { id: Date.now(), name: '', price: 0, unit: 'gr', content: 1000, usage: 0, cost: 0 }]);
  const addVar = () => setVariableOps([...variableOps, { id: Date.now(), type: 'Kemasan', name: '', price: 0, unit: 'pcs', content: 1, usage: 0, cost: 0 }]);
  const addFix = () => setFixedOps([...fixedOps, { id: Date.now(), name: '', cost: 0 }]);
  const removeRow = (setter, id) => {
    setter(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(item => item.id !== id);
    });
  };

  const totalMat = materials.reduce((a, b) => a + b.cost, 0);
  const totalVar = variableOps.reduce((a, b) => a + b.cost, 0);
  const totalFix = fixedOps.reduce((a, b) => a + b.cost, 0);
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

  const round = (p) => smartRounding ? (p < 1000 ? Math.ceil(p / 100) * 100 : Math.ceil(p / 500) * 500) : p;
  const getTier = (margin) => {
    const raw = hppBersih / (1 - (margin / 100)); // Rumus Margin Benar
    return { raw, final: round(raw), profit: round(raw) - hppBersih };
  };
  // Tier harga (v6): teal → accent flame → gold
  const tiers = [
    { name: "SERANG PASAR", label: "kompetitif", desc: "Penetrasi pasar", margin: 22.8, tone: 'teal' },
    { name: "STANDAR SEHAT", label: "umum", desc: "Margin umum", margin: 48.6, tone: 'accent' },
    { name: "PREMIUM", label: "niche", desc: "Niche market", margin: 78.4, tone: 'gold' }
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
    if (!product.name) return triggerAlert("Isi nama produk dulu!", "error");
    if (!isPro(licenseInfo) && savedRecipes.length >= 5) {
      return triggerAlert("Upgrade ke PRO untuk simpan > 5 resep!", "error");
    }

    // UPDATE STOK PRODUK
    const currentProducts = safeParse("product_stock_db");
    const existingProdIndex = currentProducts.findIndex(p => p.name.toLowerCase() === product.name.toLowerCase());

    const prodImage = product.image || null;
    const existingProd = existingProdIndex >= 0 ? currentProducts[existingProdIndex] : null;
    const newProductItem = {
      id: existingProd ? existingProd.id : `p_${Date.now()}`,
      name: product.name,
      price: finalPrice, hpp: hppBersih,
      stock: existingProd ? existingProd.stock : 0,
      type: product.type, image: prodImage,
      // harga grosir/ojol lama dipertahankan bila produk sudah ada
      priceGrosir: existingProd?.priceGrosir ?? 0,
      priceOjol: existingProd?.priceOjol ?? 0,
      ...(existingProd?.sku ? { sku: existingProd.sku } : {})
    };

    let updatedProducts;
    if (existingProdIndex >= 0) {
      updatedProducts = [...currentProducts];
      updatedProducts[existingProdIndex] = { ...updatedProducts[existingProdIndex], ...newProductItem };
    } else {
      updatedProducts = [...currentProducts, newProductItem];
    }
    // v15 F1: mirror + Firestore
    dbSet(licenseInfo?.id, 'product_stock_db', updatedProducts);

    // SIMPAN RESEP dengan productId stabil
    const data = { id: Date.now(), productId: newProductItem.id, product, materials, variableOps, fixedOps, production, hppBersih, finalPrice };
    setSavedRecipes(prev => {
      // v15 F1 + bug lama teraudit: resep untuk produk yang sama DIGANTI
      // (bukan ditumpuk) — pencocokan checkout tidak lagi memakai resep basi.
      const n = [...prev.filter(r => r.productId !== newProductItem.id), data];
      dbSet(licenseInfo?.id, 'hpp_pro_db', n);   // v15 F1: mirror + Firestore
      return n;
    });

    const currentRawMaterials = safeParse("raw_material_db");
    let updatedRawMaterials = [...currentRawMaterials];

    materials.forEach(mat => {
      if (!mat.name) return;
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
    // v15 F1: mirror + Firestore
    dbSet(licenseInfo?.id, 'raw_material_db', updatedRawMaterials);

    triggerAlert("Data Tersimpan! Stok & Bahan Baku terupdate.");
  };

  const load = (r) => {
    setProduct(r.product); setMaterials(r.materials); setVariableOps(r.variableOps); setFixedOps(r.fixedOps || []);
    setProduction(r.production); setShowLoad(false);
  };
  const reset = () => {
    if (confirm("Reset formulir?")) {
      setProduct({ name: '', type: 'Makanan', image: null });
      setMaterials([{ id: 1, name: '', price: 0, unit: 'gr', content: 1000, usage: 0, cost: 0 }]);
      setVariableOps([{ id: 1, type: 'Kemasan', name: '', price: 0, unit: 'pcs', content: 1, usage: 0, cost: 0 }]);
      setFixedOps([{ id: 1, name: 'Sewa', cost: 0 }]);
      setProduction({ yield: 1, monthlyTarget: 100 }); setSimpleModal(0);
    }
  };
  const handleExportExcel = async () => {
    if (!product.name) return triggerAlert("Beri nama produk dulu!", "error");
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

  const compPct = (v) => ((v / hppBersih) * 100 || 0).toFixed(0);

  return (
    <div className="w-full max-w-6xl mx-auto lg:grid lg:grid-cols-[1fr_400px] lg:gap-6 xl:gap-8 items-start">

      {/* ================= KOLOM KIRI: BUILDER ================= */}
      <div className="space-y-4 pb-32 lg:pb-8 min-w-0">

        {/* Produk header */}
        <Card flush className="overflow-hidden">
          <div className="p-4 flex gap-4 items-center">
            <div className="w-20 h-20 shrink-0 bg-paper dark:bg-white/[.03] rounded-2xl border-2 border-dashed border-line dark:border-line-dark flex items-center justify-center relative group cursor-pointer hover:border-flame-400 transition-all overflow-hidden">
              {product.image ? <img src={product.image} className="w-full h-full object-cover" /> : <KameraBuddy className="w-7 h-7 text-ink-faint/50" />}
              <div className="absolute inset-0 bg-chrome-deep/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 className="w-5 h-5 text-white" /></div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => {
                if (e.target.files[0]) { const r = new FileReader(); r.onload = v => setCropSrc(v.target.result); r.readAsDataURL(e.target.files[0]); }
              }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="kicker mb-1">Resep Produk</p>
              <input className="w-full bg-transparent text-xl font-extrabold tracking-tight outline-none placeholder:text-ink-faint/50 text-ink dark:text-ink-inv pb-1 mb-2"
                placeholder="Nama Produk..." value={product.name} onChange={e => setProduct({ ...product, name: e.target.value })} />
              <div className="flex gap-1.5 flex-wrap">
                {['Makanan', 'Minuman', 'Fashion', 'Jasa'].map(tp => (
                  <button key={tp} onClick={() => setProduct({ ...product, type: tp })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition border ${product.type === tp
                      ? 'bg-flame-600 text-white border-flame-600 shadow-card'
                      : 'bg-surface dark:bg-white/5 border-line dark:border-line-dark text-ink-faint hover:border-flame-300'}`}>
                    <CategoryIcon name={tp} className="w-3.5 h-3.5" /> {tp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Mode toggle */}
        <div className="flex items-center justify-between px-1">
          <div className="flex bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl p-1 shadow-card">
            <button onClick={() => setCalcMode('detail')} className={`px-4 py-2 rounded-lg text-[11px] font-extrabold transition ${calcMode === 'detail' ? 'bg-flame-600 text-white' : 'text-ink-faint'}`}>Mode Detail</button>
            <button onClick={() => setCalcMode('simple')} className={`px-4 py-2 rounded-lg text-[11px] font-extrabold transition ${calcMode === 'simple' ? 'bg-flame-600 text-white' : 'text-ink-faint'}`}>Mode Cepat</button>
          </div>
          {calcMode === 'detail' && <Badge tone="green"><BahanBaku className="w-3 h-3" /> {materials.length} bahan</Badge>}
        </div>

        {calcMode === 'detail' ? (
          <>
            {/* BAHAN BAKU */}
            <Card title="Bahan Baku" icon={BahanBaku} help="Biaya bahan untuk 1x resep (Batch)">
              <div className="space-y-3">
                {materials.map((m) => (
                  <div key={m.id} className="relative p-3.5 bg-paper dark:bg-white/[.03] rounded-xl border border-line dark:border-line-dark">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <input className="w-full bg-transparent border-b border-line dark:border-line-dark py-1.5 text-sm font-extrabold placeholder:text-ink-faint/60 focus:border-flame-400 outline-none text-ink dark:text-ink-inv" placeholder="Nama Bahan (Tepung, Telur...)" value={m.name} onChange={e => updateMat(m.id, 'name', e.target.value)} />
                      </div>
                      <NumericInput label="Harga Beli" placeholder="0" prefix="Rp" value={m.price} onChange={v => updateMat(m.id, 'price', v)} />
                      <div>
                        <label className="kicker block mb-1.5">Isi Kemasan</label>
                        <div className="flex">
                          <input type="number" className="field rounded-r-none min-w-0" placeholder="1000" value={m.content} onChange={e => updateMat(m.id, 'content', parseFloat(e.target.value))} />
                          <Select value={m.unit} options={MATERIAL_UNITS} onChange={v => updateMat(m.id, 'unit', v)} className="w-24 shrink-0 [&>button]:rounded-l-none [&>button]:border-l-0" />
                        </div>
                      </div>
                      <div className="col-span-2 pt-2.5 border-t border-dashed border-line dark:border-line-dark flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-flame-700 dark:text-apricot mb-1 block">Dipakai ({m.unit})</label>
                          <input type="number" className="field money" placeholder="0" value={m.usage} onChange={e => updateMat(m.id, 'usage', parseFloat(e.target.value))} />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="kicker">Biaya</p>
                          <p className="text-lg font-extrabold text-ink dark:text-ink-inv money leading-none mt-0.5">{formatIDR(m.cost)}</p>
                          {/* HINT SATUAN: harga per satuan kemasan ditampilkan agar
                              salah konversi langsung terlihat dari angkanya. */}
                          <p className="text-[9px] text-ink-faint font-semibold money">≈ {formatIDR((m.price || 0) / (m.content || 1))} / {m.unit}</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeRow(setMaterials, m.id)} className="absolute -top-2 -right-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-full p-1.5 text-ink-faint hover:text-brick shadow-card"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <Button variant="outline" onClick={addMat} icon={Plus} className="w-full py-3">Tambah Bahan</Button>
              </div>
            </Card>

            {/* BIAYA VARIABEL */}
            <Card title="Biaya Variabel" icon={BiayaVariabel} help="Biaya yang keluar tergantung jumlah produksi (Kemasan, Tenaga Kerja per pcs, dll)">
              <div className="space-y-3">
                {variableOps.map((op) => (
                  <div key={op.id} className="relative p-3.5 bg-paper dark:bg-white/[.03] rounded-xl border border-line dark:border-line-dark">
                    <Select label="Kategori Biaya" value={op.type} options={Object.keys(VARIABLE_COST_TYPES)} onChange={v => updateVar(op.id, 'type', v)} />
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="col-span-2">
                        <input className="w-full bg-transparent border-b border-line dark:border-line-dark py-1.5 text-sm font-extrabold placeholder:text-ink-faint/60 focus:border-flame-400 outline-none text-ink dark:text-ink-inv" placeholder={`Nama ${op.type}...`} value={op.name} onChange={e => updateVar(op.id, 'name', e.target.value)} />
                      </div>
                      <NumericInput label="Biaya Satuan" placeholder="0" prefix="Rp" value={op.price} onChange={v => updateVar(op.id, 'price', v)} />
                      <div>
                        <label className="kicker block mb-1.5">{VARIABLE_COST_TYPES[op.type]?.label}</label>
                        <div className="flex">
                          <input type="number" className="field rounded-r-none min-w-0" placeholder="1" value={op.content} onChange={e => updateVar(op.id, 'content', parseFloat(e.target.value))} />
                          <Select value={op.unit} options={VARIABLE_COST_TYPES[op.type]?.units || ['pcs']} onChange={v => updateVar(op.id, 'unit', v)} className="w-24 shrink-0 [&>button]:rounded-l-none [&>button]:border-l-0" />
                        </div>
                      </div>
                      <div className="col-span-2 pt-2.5 border-t border-dashed border-line dark:border-line-dark flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-gold-deep dark:text-gold mb-1 block">Pemakaian ({op.unit})</label>
                          <input type="number" className="field money" placeholder="0" value={op.usage} onChange={e => updateVar(op.id, 'usage', parseFloat(e.target.value))} />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="kicker">Biaya</p>
                          <p className="text-lg font-extrabold text-ink dark:text-ink-inv money leading-none mt-0.5">{formatIDR(op.cost)}</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeRow(setVariableOps, op.id)} className="absolute -top-2 -right-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-full p-1.5 text-ink-faint hover:text-brick shadow-card"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <Button variant="outline" onClick={addVar} icon={Plus} className="w-full py-3">Tambah Biaya Variabel</Button>
              </div>
            </Card>
          </>
        ) : (
          <Card title="Mode Hitung Cepat" icon={BiayaVariabel} help="Isi total uang belanja 1x produksi, lalu bagi dengan jumlah produk jadi.">
            <div className="max-w-sm">
              <NumericInput label="Total Modal Belanja (Rp)" placeholder="Masukkan total uang keluar" prefix="Rp" value={simpleModal} onChange={setSimpleModal} className="text-lg" />
            </div>
          </Card>
        )}

        {/* BIAYA TETAP (opsional) */}
        <Card flush>
          <div className="flex justify-between items-center p-4 cursor-pointer" onClick={() => setShowFixed(!showFixed)}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${showFixed ? 'bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot' : 'bg-paper dark:bg-white/5 text-ink-faint'}`}><KoinBuddy className="w-4 h-4" /></div>
              <div>
                <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Biaya Tetap</h3>
                <p className="text-[10px] text-ink-faint font-semibold">Opsional, dibagi target produksi bulanan</p>
              </div>
            </div>
            <Toggle on={showFixed} onClick={() => setShowFixed(!showFixed)} />
          </div>
          {showFixed && (
            <div className="px-4 pb-4 animate-fade-in border-t border-line/60 dark:border-line-dark/60 pt-4 mx-0">
              <div className="mb-3"><NumericInput label="Target Produksi / Bulan" placeholder="100" value={production.monthlyTarget} onChange={v => setProduction({ ...production, monthlyTarget: v })} suffix="Pcs" /></div>
              <div className="space-y-2">
                {fixedOps.map(op => (
                  <div key={op.id} className="flex gap-2 items-end">
                    <div className="flex-1"><input className="field" placeholder="Nama Biaya" value={op.name} onChange={e => updateFix(op.id, 'name', e.target.value)} /></div>
                    <div className="w-32"><NumericInput value={op.cost} onChange={v => updateFix(op.id, v)} prefix="Rp" /></div>
                    <button onClick={() => removeRow(setFixedOps, op.id)} className="p-2.5 rounded-xl text-ink-faint hover:text-brick hover:bg-brick-soft dark:hover:bg-brick/10 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <Button variant="ghost" onClick={addFix} className="w-full text-xs">+ Tambah Biaya Tetap</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Aksi utama (mobile) */}
        <div className="grid grid-cols-4 gap-2 lg:hidden">
          <Button variant="secondary" onClick={reset} icon={RotateCcw} className="col-span-1">Reset</Button>
          <Button variant="secondary" onClick={() => setShowLoad(true)} icon={FolderOpen} className="col-span-1">Load</Button>
          <Button onClick={save} icon={Save} className="col-span-2">Simpan Data</Button>
        </div>
      </div>

      {/* ================= KOLOM KANAN: KARTU BIAYA (sticky) ================= */}
      <div className="lg:sticky lg:top-6 space-y-4 pb-32 lg:pb-8">

        {/* --- KARTU BIAYA ala kwitansi --- */}
        <div className="card overflow-hidden !rounded-3xl">
          <div className="bg-chrome-deep px-5 py-4 relative overflow-hidden">
            <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-flame-500/20 blur-xl"></div>
            <p className="text-apricot/80 text-[10px] font-extrabold uppercase tracking-[0.2em]">HPP Bersih / Pcs</p>
            <p className="text-3xl font-extrabold text-white money tracking-tight mt-0.5">{formatIDR(hppBersih)}</p>
            {product.name && <p className="text-ink-inv/50 text-[10px] font-bold uppercase tracking-widest mt-1 truncate">{product.name}</p>}
          </div>

          {/* baris kwitansi */}
          <div className="px-5 py-4 text-[12px]">
            {calcMode === 'detail' && (
              <>
                <div className="flex justify-between py-1.5 border-b border-dotted border-line dark:border-line-dark">
                  <span className="text-ink-faint font-bold">Bahan / pcs</span>
                  <span className="font-extrabold text-ink dark:text-ink-inv money">{formatIDR(matPerUnit)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-dotted border-line dark:border-line-dark">
                  <span className="text-ink-faint font-bold">Biaya variabel / pcs</span>
                  <span className="font-extrabold text-ink dark:text-ink-inv money">{formatIDR(varPerUnit)}</span>
                </div>
              </>
            )}
            {showFixed && calcMode === 'detail' && (
              <div className="flex justify-between py-1.5 border-b border-dotted border-line dark:border-line-dark">
                <span className="text-ink-faint font-bold">Biaya tetap / pcs</span>
                <span className="font-extrabold text-ink dark:text-ink-inv money">{formatIDR(fixPerUnit)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 pb-1">
              <span className="text-ink-faint font-extrabold uppercase text-[10px] tracking-widest">Hasil produksi</span>
              <div className="flex items-center gap-2 bg-paper dark:bg-white/5 px-3 py-1.5 rounded-lg border border-line dark:border-line-dark">
                <input
                  type="number"
                  className="w-14 bg-transparent text-right font-extrabold text-sm outline-none text-ink dark:text-ink-inv money"
                  value={production.yield}
                  onChange={e => {
                    const val = e.target.value;
                    // Izinkan kosong sementara agar user bisa hapus angka
                    setProduction({ ...production, yield: val === '' ? '' : parseFloat(val) });
                  }}
                  onBlur={() => {
                    // Saat selesai ketik, jika kosong kembalikan ke 1
                    if (!production.yield) setProduction({ ...production, yield: 1 });
                  }} />
                <span className="text-[10px] font-extrabold text-ink-faint">Pcs</span>
              </div>
            </div>
          </div>

          {/* komposisi biaya */}
          {calcMode === 'detail' && hppBersih > 0 && (
            <div className="px-5 pb-4">
              <div className="h-2.5 w-full bg-paper dark:bg-white/5 rounded-full overflow-hidden flex border border-line/60 dark:border-line-dark">
                <div className="h-full bg-flame-500 transition-all duration-500" style={{ width: `${(matPerUnit / hppBersih) * 100}%` }}></div>
                <div className="h-full bg-gold transition-all duration-500" style={{ width: `${(varPerUnit / hppBersih) * 100}%` }}></div>
                <div className="h-full bg-teal2 transition-all duration-500" style={{ width: `${(fixPerUnit / hppBersih) * 100}%` }}></div>
              </div>
              <div className="flex gap-3 mt-2.5 text-[9px] font-extrabold text-ink-faint uppercase tracking-wider">
                <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-flame-500 inline-block"></i>Bahan {compPct(matPerUnit)}%</span>
                <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-gold inline-block"></i>Variabel {compPct(varPerUnit)}%</span>
                {showFixed && <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-teal2 inline-block"></i>Tetap {compPct(fixPerUnit)}%</span>}
              </div>
            </div>
          )}

          {/* total modal */}
          <div className="px-5 py-3.5 bg-paper dark:bg-white/[.03] border-t border-dashed border-line dark:border-line-dark flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">{calcMode === 'detail' ? 'Modal Langsung' : 'Total Modal'}</span>
            <span className="font-extrabold text-ink dark:text-ink-inv money">{formatIDR(calcMode === 'detail' ? totalMat + totalVar : simpleModal)}</span>
          </div>
        </div>

        {/* --- Tangga harga / tier --- */}
        <Card title="Saran Harga Jual" icon={HargaJual} flush>
          <div className="px-4 pt-3 pb-1 flex justify-between items-center">
            <span className="text-[10px] text-ink-faint font-bold">Smart Rounding</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-ink-faint">{smartRounding ? 'Aktif' : 'Mati'}</span>
              <Toggle on={smartRounding} onClick={() => setSmartRounding(!smartRounding)} size="sm" />
            </div>
          </div>
          <div className="p-4 space-y-2">
            {tiers.map((tr, i) => {
              const d = getTier(tr.margin);
              const isSelected = customMargin === tr.margin;
              const toneMap = {
                teal: { badge: 'bg-teal2-soft dark:bg-teal2/15 text-teal2', bar: 'bg-teal2' },
                accent: { badge: 'bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot', bar: 'bg-flame-600' },
                gold: { badge: 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold', bar: 'bg-gold' }
              };
              const tone = toneMap[tr.tone];
              return (
                <button key={i} onClick={() => setCustomMargin(tr.margin)}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all press ${isSelected
                    ? 'border-flame-600 bg-flame-50/60 dark:bg-flame-900/30'
                    : 'border-line dark:border-line-dark bg-surface dark:bg-transparent hover:border-flame-300'}`}>
                  <div className="flex justify-between items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${tone.badge}`}>{tr.name}</span>
                        <span className="text-[10px] font-bold text-ink-faint">{tr.margin}%</span>
                      </div>
                      <p className="text-[10px] text-ink-faint font-semibold">{tr.desc} · Untung <span className="text-ink dark:text-ink-inv money font-extrabold">{formatIDR(d.profit)}</span></p>
                    </div>
                    <p className="text-lg font-extrabold text-ink dark:text-ink-inv money shrink-0 ml-2">{formatIDR(d.final)}</p>
                  </div>
                </button>
              );
            })}

            {/* custom margin */}
            <div className="bg-paper dark:bg-white/[.03] rounded-xl p-4 border border-line dark:border-line-dark">
              <div className="flex justify-between items-center mb-2">
                <label className="kicker flex items-center gap-1"><Edit3 className="w-3 h-3" /> Custom Margin</label>
                <p className="text-lg font-extrabold text-ink dark:text-ink-inv money leading-none">{formatIDR(finalPrice)}</p>
              </div>
              <input type="range" min="0" max="150" step="0.1" className="w-full h-2 bg-line dark:bg-line-dark rounded-lg appearance-none cursor-pointer accent-flame-600" value={customMargin} onChange={(e) => setCustomMargin(parseFloat(e.target.value))} />
              <div className="text-center mt-1.5 font-extrabold text-ink dark:text-ink-inv text-xs">{customMargin}%</div>
            </div>
          </div>
        </Card>

        {/* --- Cek kompetitor --- */}
        <Card title="Cek Kompetitor" icon={Kompetitor} flush>
          <div className="p-4">
            <NumericInput placeholder="Harga Pesaing" prefix="Rp" value={competitorPrice} onChange={setCompetitorPrice} />
            {competitorPrice > 0 && (
              <div className={`mt-3 text-xs font-extrabold px-3 py-2.5 rounded-xl ${competitorPrice < finalPrice ? 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick' : 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf'}`}>
                {competitorPrice < finalPrice
                  ? `Kompetitor lebih mahal ${formatIDR(finalPrice - competitorPrice)}. Ruang margin kamu masih ada`
                  : `Kompetitor lebih murah ${formatIDR(competitorPrice - finalPrice)}. Cek lagi neraca harganya`}
              </div>
            )}
          </div>
        </Card>

        {/* --- Target & proyeksi --- */}
        {targetProfit > 0 && hppBersih > 0 && (
          <div className="card !rounded-3xl overflow-hidden border-chrome-edge bg-chrome-deep shadow-pop animate-rise">
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-apricot/80 text-[10px] font-extrabold uppercase tracking-[0.2em]">Proyeksi Menuju Target</p>
              <p className="text-ink-inv/70 text-[11px] font-semibold mt-0.5">Target laba bersih {formatIDR(targetProfit)} / bulan</p>
            </div>
            <div className="px-5 py-2 text-[12px] text-ink-inv/85">
              <div className="flex justify-between py-2 border-b border-dotted border-white/10">
                <span className="font-semibold text-ink-inv/60">Jual / hari</span>
                <span className="font-extrabold money">{targetPcsDay} pcs</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dotted border-white/10">
                <span className="font-semibold text-ink-inv/60">Jual / bulan</span>
                <span className="font-extrabold money">{targetPcsMonth} pcs</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dotted border-white/10">
                <span className="font-semibold text-ink-inv/60">Omzet / bulan</span>
                <span className="font-extrabold money">{formatIDR(projOmzetMonth)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dotted border-white/10">
                <span className="font-semibold text-ink-inv/60">Biaya produksi / bulan</span>
                <span className="font-extrabold money">{formatIDR(projProdCostMonth)}</span>
              </div>
              {showFixed && (
                <div className="flex justify-between py-2 border-b border-dotted border-white/10">
                  <span className="font-semibold text-ink-inv/60">Biaya tetap / bulan</span>
                  <span className="font-extrabold money">{formatIDR(projFixedCostMonth)}</span>
                </div>
              )}
            </div>
            <div className="px-5 py-4 bg-chrome-panel flex justify-between items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-apricot">Laba bersih / bulan</span>
              <span className="text-xl font-extrabold text-apricot money">{formatIDR(projNetProfitMonth)}</span>
            </div>
          </div>
        )}

        {/* --- Aksi (desktop) --- */}
        <div className="hidden lg:grid grid-cols-4 gap-2">
          <Button variant="secondary" onClick={reset} icon={RotateCcw} className="col-span-1">Reset</Button>
          <Button variant="secondary" onClick={() => setShowLoad(true)} icon={FolderOpen} className="col-span-1">Load</Button>
          <Button onClick={save} icon={Save} className="col-span-2">Simpan Data</Button>
          <Button variant="secondary" onClick={() => isPro(licenseInfo) ? setShowPlanner(true) : triggerAlert("Fitur PRO Only", "error")} icon={PaketBuddy}
            className={`col-span-2 ${!isPro(licenseInfo) && 'opacity-60'}`}>
            Smart Planner {!isPro(licenseInfo) && <Lisensi className="w-3 h-3 text-gold" />}
          </Button>
          <Button onClick={handleExportExcel} disabled={isExporting} icon={FileExcelBuddy} variant="bright" className="col-span-2">
            {isExporting ? 'Mengekspor...' : 'Export (.xlsx)'}
          </Button>
        </div>
        <div className="lg:hidden grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => isPro(licenseInfo) ? setShowPlanner(true) : triggerAlert("Fitur PRO Only", "error")} icon={PaketBuddy} className={!isPro(licenseInfo) && 'opacity-60'}>
            Smart Planner {!isPro(licenseInfo) && '(PRO)'}
          </Button>
          <Button onClick={handleExportExcel} disabled={isExporting} icon={FileExcelBuddy} variant="bright">
            {isExporting ? 'Mengekspor...' : 'Export Excel'}
          </Button>
        </div>
      </div>

      {/* MODAL LOAD RESEP */}
      <Modal open={showLoad} onClose={() => setShowLoad(false)} title="Load Resep Tersimpan" sub="Arsip resep" width="max-w-sm">
        <div className="space-y-2">
          {savedRecipes.length === 0 && <EmptyState mascot="pikir" title="Belum ada data" desc="Resep yang Anda simpan akan muncul di sini." />}
          {savedRecipes.map(r => (
            <div key={r.id} onClick={() => load(r)} className="p-3 rounded-xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark flex gap-3 cursor-pointer hover:border-flame-400 transition group relative">
              <div className="w-11 h-11 bg-surface dark:bg-white/10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                {r.product?.image ? <img src={r.product.image} className="w-full h-full object-cover" /> : <span className="text-[10px] font-extrabold text-ink-faint">{r.product?.name?.[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-ink dark:text-ink-inv text-xs truncate">{r.product?.name}</h4>
                <p className="text-[10px] text-ink-faint money mt-0.5">{formatIDR(r.finalPrice)} • {new Date(r.id).toLocaleDateString()}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); const n = savedRecipes.filter(i => i.id !== r.id); setSavedRecipes(n); dbSet(licenseInfo?.id, 'hpp_pro_db', n); }}
                className="text-ink-faint hover:text-brick self-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </Modal>

      {showPlanner && <SmartPlannerModal materials={materials} production={production} onClose={() => setShowPlanner(false)} />}

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          onCropComplete={(img) => { setProduct({ ...product, image: img }); setCropSrc(null); }}
          onClose={() => setCropSrc(null)}
        />
      )}
    </div>
  );
};
