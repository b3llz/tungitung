// ============================================================
// INVENTORI v5 WELP — Stok Barang (etalase + bahan baku), Stok
// Opname, Barang Masuk/Keluar, Riwayat Stok, Supplier.
// Logika dipertahankan 100% (termasuk scanner SKU BarcodeDetector
// nyata & pro pricing strategy).
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import {
  Stok, Plus, Trash2, KameraBuddy, Pindai, PaketBuddy,
  Opname, Save, StokRiwayat, Supplier, InOut, StokMasuk, StokKeluar, CategoryIcon
} from './welp-icons.jsx';
import { safeParse, formatIDR, isPro, dbSet, useDbSync } from './core.jsx';
import { Button, Card, PageTitle, NumericInput, Select, Badge, EmptyState, ImageCropperModal } from './ui';

/* ================= STOK BARANG ================= */
export const StockTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [showRawMat, setShowRawMat] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [newProd, setNewProd] = useState({ name: '', price: 0, stock: 0, type: 'Makanan', image: null });
  const [skuScanner, setSkuScanner] = useState(false);
  const skuVideoRef = useRef(null);

  // AUTO-REFRESH saat tab dibuka + rebind saat ada sinkronisasi F1
  useEffect(() => {
    if (activeTab === 'stock') {
      setProducts(safeParse('product_stock_db', []));
      setRawMaterials(safeParse('raw_material_db', []));
    }
  }, [activeTab]);
  useDbSync(() => { setProducts(safeParse('product_stock_db', [])); setRawMaterials(safeParse('raw_material_db', [])); });

  useEffect(() => {
    if (cropSrc || showAdd) setEditingMode(true);
    else setEditingMode(false);
  }, [cropSrc, showAdd, setEditingMode]);

  // SCANNER SKU NYATA (BarcodeDetector) — bukan alert palsu.
  useEffect(() => {
    let stream, rafId, stopped = false;
    const cleanup = () => { stopped = true; if (rafId) cancelAnimationFrame(rafId); if (stream) stream.getTracks().forEach(t => t.stop()); };
    if (!skuScanner) return cleanup;
    if (!('BarcodeDetector' in window)) {
      triggerAlert("Browser belum mendukung deteksi barcode. Gunakan scanner fisik: klik kolom SKU lalu tembak barcode-nya.", "error");
      setSkuScanner(false);
      return cleanup;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        if (skuVideoRef.current) { skuVideoRef.current.srcObject = s; if (skuVideoRef.current.play) skuVideoRef.current.play(); }
        const detector = new window.BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a', 'itf', 'qr_code'] });
        const loop = async () => {
          if (stopped || !skuVideoRef.current) return;
          try {
            const codes = await detector.detect(skuVideoRef.current);
            if (codes && codes.length) {
              const val = codes[0].rawValue;
              setNewProd(prev => ({ ...prev, sku: val }));
              triggerAlert("SKU terbaca: " + val, "success");
              setSkuScanner(false);
              return;
            }
          } catch (e) { /* lanjutkan */ }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      })
      .catch(() => { triggerAlert("Akses kamera ditolak/tidak tersedia.", "error"); setSkuScanner(false); });
    return cleanup;
  }, [skuScanner]);

  // v15 F1: tulis komersial → mirror + Firestore (dbSet)
  const saveProducts = (newP) => { setProducts(newP); dbSet(licenseInfo?.id, 'product_stock_db', newP); };
  const saveRaw = (newR) => { setRawMaterials(newR); dbSet(licenseInfo?.id, 'raw_material_db', newR); };

  const addProduct = () => {
    if (!newProd.name) return triggerAlert("Nama produk wajib diisi", "error");
    const item = { id: `p_${Date.now()}`, ...newProd, hpp: newProd.price * 0.7 };
    saveProducts([...products, item]);
    setShowAdd(false); triggerAlert("Produk berhasil ditambahkan");
    setNewProd({ name: '', price: 0, stock: 0, type: 'Makanan', image: null });
  };

  // v21.1 — Modifier Engine: grup modifier per tenant + assignment per produk
  const [modGroups, setModGroups] = useState(() => safeParse('modifier_group_db', []));
  const [showModMgr, setShowModMgr] = useState(false);
  const [modProduct, setModProduct] = useState(null);   // produk yg diatur variannya
  useEffect(() => {
    const h = () => setModGroups(safeParse('modifier_group_db', []));
    window.addEventListener('welp_db_sync', h);
    return () => window.removeEventListener('welp_db_sync', h);
  }, []);
  const saveModGroups = (rows) => {
    const norm = rows.map((g, i) => ({ ...g, id: g.id || `mgrp_${Date.now().toString(36)}_${i}` }));
    setModGroups(norm);
    dbSet(licenseInfo?.id, 'modifier_group_db', norm);
  };

  const deleteProduct = (id) => {
    if (confirm("Hapus produk ini?")) saveProducts(products.filter(p => p.id !== id));
  };
  const updateStock = (id, delta) => saveProducts(products.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p));

  return (
    <div className="max-w-3xl mx-auto w-full pb-24">
      <PageTitle title="Manajemen Stok" sub="Etalase & Gudang Bahan"
        right={
          <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-xl p-1 flex shadow-card">
            <button onClick={() => setShowRawMat(false)} className={`px-4 py-2 rounded-lg text-[11px] font-extrabold transition ${!showRawMat ? 'bg-flame-600 text-white' : 'text-ink-faint'}`}>Produk Jadi</button>
            <button onClick={() => setShowRawMat(true)} className={`px-4 py-2 rounded-lg text-[11px] font-extrabold transition ${showRawMat ? 'bg-flame-600 text-white' : 'text-ink-faint'}`}>Bahan Baku</button>
          </div>
        } />

      {!showRawMat ? (
        <div className="animate-fade-in space-y-3">
          <div className="flex justify-between items-center mb-1">
            <Badge tone="green"><Stok className="w-3.5 h-3.5" /> {products.length} item terdaftar</Badge>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowModMgr(true)} icon={Plus}>Grup Modifier</Button>
              <Button onClick={() => setShowAdd(true)} icon={Plus}>Tambah</Button>
            </div>
          </div>

          {products.length === 0 && <EmptyState mascot="bingung" title="Belum ada produk" desc="Klik Tambah untuk memulai, atau simpan resep dari Kalkulator HPP agar produk & harga terisi otomatis." />}

          {products.map(p => {
            const low = (p.stock || 0) <= (parseInt(localStorage.getItem('low_stock_threshold')) || 5);
            return (
              <div key={p.id} className="card p-3 flex gap-3.5 items-center hover:border-flame-300 transition-all">
                <div className="w-14 h-14 bg-paper dark:bg-white/5 rounded-xl overflow-hidden shrink-0 border border-line dark:border-line-dark relative">
                  {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><CategoryIcon name={p.type} className="w-9 h-9 opacity-80" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h4 className="font-extrabold text-ink dark:text-ink-inv text-[13px] truncate">{p.name}</h4>
                    <Badge><CategoryIcon name={p.type} className="w-3 h-3" /> {p.type}</Badge>
                    {/* v21.1: mode produk — QUICK vs CONFIGURABLE */}
                    {(p.modifierGroupIds || []).length > 0 && <Badge tone="gold">Custom (modifier)</Badge>}
                    {low && <Badge tone="red">Menipis</Badge>}
                  </div>
                  <p className="text-ink dark:text-ink-inv font-extrabold text-sm money">{formatIDR(p.price)}</p>
                  {p.priceGrosir > 0 && <p className="text-[10px] text-ink-faint font-bold money">Grosir {formatIDR(p.priceGrosir)}{p.priceOjol > 0 ? ` (Ojol ${formatIDR(p.priceOjol)})` : ''}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-1 bg-paper dark:bg-white/5 p-1 rounded-xl border border-line dark:border-line-dark">
                    <button onClick={() => updateStock(p.id, -1)} className="w-8 h-8 bg-surface dark:bg-surface-dark rounded-lg shadow-sm flex items-center justify-center text-sm font-extrabold text-ink-soft hover:text-brick transition active:scale-90 press">−</button>
                    <span className="w-9 text-center text-sm font-extrabold text-ink dark:text-ink-inv money">{p.stock}</span>
                    <button onClick={() => updateStock(p.id, 1)} className="w-8 h-8 bg-surface dark:bg-surface-dark rounded-lg shadow-sm flex items-center justify-center text-sm font-extrabold text-ink-soft hover:text-flame-600 dark:hover:text-apricot transition active:scale-90 press">+</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setModProduct(p)} className="text-[10px] font-bold text-ink-faint hover:text-flame-600 dark:hover:text-apricot transition px-1">Varian</button>
                    <button onClick={() => deleteProduct(p.id)} className="text-[10px] font-bold text-ink-faint hover:text-brick transition px-2">Hapus</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="animate-fade-in space-y-3">
          <div className="card !rounded-3xl overflow-hidden">
            <div className="bg-chrome-deep px-5 py-5 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-1 opacity-80">
                <PaketBuddy className="w-4 h-4 text-apricot" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-apricot/80">Total Aset Bahan</span>
              </div>
              <p className="text-3xl font-extrabold text-white money tracking-tight">{formatIDR(rawMaterials.reduce((a, b) => a + (b.lastPrice * (b.stock || 0)), 0))}</p>
            </div>
          </div>

          {rawMaterials.length === 0 && <EmptyState mascot="kerja" title="Data bahan baku kosong" desc="Bahan baku otomatis terdaftar saat Anda menyimpan resep di Kalkulator HPP." />}

          {rawMaterials.map((rm, idx) => {
            const baseUnit = rm.unit || 'gr';
            return (
              <div key={rm.id} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold rounded-xl flex items-center justify-center font-extrabold text-xs">{idx + 1}</div>
                    <div>
                      <h4 className="font-extrabold text-ink dark:text-ink-inv text-sm">{rm.name}</h4>
                      <p className="text-[10px] text-ink-faint font-bold uppercase mt-0.5">Stok Gudang ({baseUnit})</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="kicker">Nilai Aset</p>
                    <p className="text-ink dark:text-ink-inv font-extrabold text-sm money">{formatIDR((rm.stock || 0) * rm.lastPrice)}</p>
                  </div>
                </div>
                <div className="bg-paper dark:bg-white/[.03] rounded-xl p-3 flex justify-between items-center border border-line dark:border-line-dark">
                  <span className="text-lg font-extrabold text-ink dark:text-ink-inv money">{rm.stock} <span className="text-xs text-ink-faint font-bold ml-0.5">{baseUnit}</span></span>
                  <button onClick={() => {
                    const add = prompt(`Tambah stok ${rm.name} (satuan basis: ${baseUnit}):`, "0");
                    if (add) saveRaw(rawMaterials.map(x => x.id === rm.id ? { ...x, stock: (x.stock || 0) + parseFloat(add) } : x));
                  }} className="text-xs font-extrabold text-flame-700 dark:text-apricot hover:bg-flame-50 dark:hover:bg-flame-900/40 px-3.5 py-2 rounded-lg border border-flame-200 dark:border-flame-800 transition press">+ Stok</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL TAMBAH PRODUK */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in">
          <div className="card w-full sm:max-w-sm max-h-[92vh] overflow-y-auto custom-scrollbar shadow-pop rounded-t-3xl sm:rounded-3xl animate-pop">
            <div className="p-5 border-b border-line/70 dark:border-line-dark/70">
              <p className="kicker">Produk Baru</p>
              <h3 className="font-extrabold text-base text-ink dark:text-ink-inv mt-0.5">Tambah Produk</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-center py-1">
                <div className="w-24 h-24 bg-paper dark:bg-white/[.03] rounded-2xl flex items-center justify-center relative overflow-hidden border-2 border-dashed border-line dark:border-line-dark group hover:border-flame-400 transition cursor-pointer">
                  {newProd.image ? <img src={newProd.image} className="w-full h-full object-cover" /> : <div className="text-center text-ink-faint/60"><KameraBuddy className="w-7 h-7 mx-auto" /><span className="text-[9px] font-extrabold">Upload Foto</span></div>}
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { if (e.target.files[0]) { const r = new FileReader(); r.onload = v => { setCropSrc(v.target.result); }; r.readAsDataURL(e.target.files[0]); } }} />
                </div>
              </div>

              <div>
                <label className="kicker block mb-1.5 ml-0.5">Nama Produk</label>
                <input className="field-lg" placeholder="Contoh: Kopi Susu Gula Aren" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} />
              </div>

              <div>
                <label className="kicker block mb-1.5 ml-0.5">Kode Barcode / SKU</label>
                <div className="relative flex">
                  <input className="field-lg pr-12" placeholder="Scan Barcode / Ketik SKU..." value={newProd.sku || ''} onChange={e => setNewProd({ ...newProd, sku: e.target.value })} />
                  <button onClick={() => setSkuScanner(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot rounded-lg hover:bg-flame-100 dark:hover:bg-flame-900/70 transition">
                    <KameraBuddy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1"><Select label="Kategori" value={newProd.type} options={['Makanan', 'Minuman', 'Fashion', 'Jasa', 'Lainnya']} onChange={v => setNewProd({ ...newProd, type: v })} /></div>
                <div className="w-28"><NumericInput label="Stok Awal" value={newProd.stock} onChange={v => setNewProd({ ...newProd, stock: v })} /></div>
              </div>

              <NumericInput placeholder="0" value={newProd.price} onChange={v => setNewProd({ ...newProd, price: v })} prefix="Rp" label="Harga Jual (Retail)" />

              {isPro(licenseInfo) && (
                <div className="space-y-2 p-3.5 bg-gold-soft dark:bg-gold/10 rounded-xl border border-gold/25">
                  <div className="kicker text-gold-deep dark:text-gold flex items-center gap-1 mb-1"><Badge className="!static">PRO</Badge> Pro Pricing Strategy</div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumericInput placeholder="Grosir" value={newProd.priceGrosir || 0} onChange={v => setNewProd({ ...newProd, priceGrosir: v })} prefix="Rp" label="Harga Grosir" />
                    <NumericInput placeholder="App Online" value={newProd.priceOjol || 0} onChange={v => setNewProd({ ...newProd, priceOjol: v })} prefix="Rp" label="Harga App Online" />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1 py-3" onClick={() => setShowAdd(false)}>Batal</Button>
                <Button className="flex-1 py-3" onClick={addProduct}>Simpan Produk</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cropSrc && (
        <ImageCropperModal imageSrc={cropSrc} onCropComplete={(img) => { setNewProd({ ...newProd, image: img }); setCropSrc(null); }} onClose={() => setCropSrc(null)} />
      )}

      {/* v21.1 — MANAGER GRUP MODIFIER (CRUD penuh, spec #8) */}
      {showModMgr && <ModifierGroupsManager groups={modGroups} onSave={saveModGroups} onClose={() => setShowModMgr(false)} />}
      {/* v21.1 — ATUR MODE & GRUP PER PRODUK */}
      {modProduct && <ProductModifierDialog product={modProduct} groups={modGroups}
        onSave={(mode, ids) => {
          saveProducts(products.map(p => p.id === modProduct.id
            ? { ...p, mode, modifierGroupIds: ids }
            : p));
          setModProduct(null);
          triggerAlert(mode === 'configurable' ? 'Produk kini configurable — kasir diminta memilih varian.' : 'Produk quick — tap langsung masuk keranjang.', 'success');
        }} onClose={() => setModProduct(null)} />}

      {/* OVERLAY SCANNER SKU */}
      {skuScanner && (
        <div className="fixed inset-0 z-[150] bg-chrome-deep/95 flex flex-col items-center justify-center p-4 animate-fade-in">
          <h2 className="text-ink-inv font-extrabold text-lg mb-6 flex items-center gap-2"><Pindai className="w-6 h-6 text-apricot" /> Scan SKU / Barcode</h2>
          <div className="relative w-64 h-64 border-4 border-flame-400 rounded-3xl overflow-hidden shadow-pop">
            <video ref={skuVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
            <div className="absolute left-0 right-0 h-1 bg-flame-400 shadow-[0_0_15px_#F4622E] animate-scanline"></div>
            <div className="absolute inset-0 border-[30px] border-chrome-deep/60 pointer-events-none rounded-3xl"></div>
          </div>
          <p className="mt-6 text-white/70 text-xs font-bold animate-pulse">Arahkan barcode produk ke dalam kotak…</p>
          <button onClick={() => setSkuScanner(false)} className="mt-8 bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-extrabold transition press">Tutup</button>
        </div>
      )}
    </div>
  );
};

/* ================= STOK OPNAME ================= */
export const OpnameTab = ({ triggerAlert, licenseInfo }) => {
  const [products, setProducts] = useState(safeParse('product_stock_db', []));
  const [adjustments, setAdjustments] = useState({});
  useDbSync(() => setProducts(safeParse('product_stock_db', [])));

  const saveOpname = () => {
    let updatedProducts = [...products];
    let logs = safeParse('stock_history_db', []);

    let changed = false;
    updatedProducts = updatedProducts.map(p => {
      if (adjustments[p.id] !== undefined && adjustments[p.id] !== p.stock) {
        changed = true;
        const diff = adjustments[p.id] - p.stock;
        logs.push({
          id: `log_${Date.now()}_${p.id}`, date: new Date().toISOString(),
          productName: p.name, type: 'Opname', qty: diff, note: 'Penyesuaian Fisik Gudang'
        });
        return { ...p, stock: adjustments[p.id] };
      }
      return p;
    });

    if (!changed) return triggerAlert("Tidak ada perubahan stok untuk disimpan.", "error");

    // v15 F1: mirror + Firestore
    dbSet(licenseInfo?.id, 'product_stock_db', updatedProducts);
    dbSet(licenseInfo?.id, 'stock_history_db', logs);
    setProducts(updatedProducts);
    setAdjustments({});
    triggerAlert("Stok Opname Berhasil Disimpan!");
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24">
      <PageTitle title="Stok Opname" sub="Penyelarasan Fisik & Sistem" />
      <Card title="Hitung Fisik" icon={Opname} help="Isi jumlah fisik yang benar, sistem akan mencatat selisihnya ke Riwayat Stok.">
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
          {products.length === 0 ? <EmptyState icon={Stok} title="Belum ada produk" desc="Tambahkan produk di tab Stok Barang dulu, lalu lakukan opname untuk menyelaraskan stok fisik dengan sistem." /> : products.map(p => {
            const diff = adjustments[p.id];
            const changed = diff !== undefined && diff !== p.stock;
            return (
              <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl border transition ${changed ? 'bg-gold-soft dark:bg-gold/10 border-gold/40' : 'bg-paper dark:bg-white/[.03] border-line dark:border-line-dark'}`}>
                <div>
                  <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{p.name}</p>
                  <p className="text-[10px] text-ink-faint font-bold money">Stok sistem: {p.stock}{changed && <span className="text-gold-deep dark:text-gold"> → {diff} (selisih {diff - p.stock >= 0 ? '+' : ''}{diff - p.stock})</span>}</p>
                </div>
                <div className="w-24 shrink-0">
                  <input type="number" placeholder="Fisik" value={adjustments[p.id] !== undefined ? adjustments[p.id] : ''} onChange={e => setAdjustments({ ...adjustments, [p.id]: parseInt(e.target.value) || 0 })} className="field text-center" />
                </div>
              </div>
            );
          })}
        </div>
        <Button onClick={saveOpname} disabled={products.length === 0} className="w-full mt-4 py-3" icon={Save}>Simpan Hasil Opname</Button>
      </Card>
    </div>
  );
};

/* ================= BARANG MASUK & KELUAR ================= */
export const InOutTab = ({ triggerAlert, licenseInfo }) => {
  const [products, setProducts] = useState(safeParse('product_stock_db', []));
  const [form, setForm] = useState({ type: 'Masuk', qty: '', note: '' });
  const [selectedProd, setSelectedProd] = useState('Pilih Produk...');
  useDbSync(() => setProducts(safeParse('product_stock_db', [])));

  const prodOptions = ['Pilih Produk...', ...products.map(p => `${p.id} | ${p.name} (Stok: ${p.stock})`)];

  const saveInOut = () => {
    const actualId = selectedProd.split(' |')[0];
    if (selectedProd === 'Pilih Produk...' || form.qty <= 0) return triggerAlert("Pilih produk dan masukkan jumlah!", "error");

    let updatedProducts = [...products];
    let logs = safeParse('stock_history_db', []);
    const prodIdx = updatedProducts.findIndex(p => p.id === actualId);

    if (prodIdx === -1) return;
    const p = updatedProducts[prodIdx];

    if (form.type === 'Keluar' && p.stock < form.qty) return triggerAlert("Stok sistem tidak mencukupi untuk dikeluarkan!", "error");

    const finalQty = form.type === 'Masuk' ? Number(form.qty) : -Number(form.qty);
    updatedProducts[prodIdx].stock += finalQty;

    logs.push({
      id: `log_${Date.now()}`, date: new Date().toISOString(),
      productName: p.name, type: form.type, qty: finalQty, note: form.note || `Barang ${form.type}`
    });

    // v15 F1: mirror + Firestore
    dbSet(licenseInfo?.id, 'product_stock_db', updatedProducts);
    dbSet(licenseInfo?.id, 'stock_history_db', logs);
    setProducts(updatedProducts);
    setForm({ type: 'Masuk', qty: '', note: '' });
    setSelectedProd('Pilih Produk...');
    triggerAlert(`Barang ${form.type} Berhasil Dicatat!`);
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24">
      <PageTitle title="Barang Masuk / Keluar" sub="Pencatatan Manual Stok" />
      <Card title="Form Pergerakan Stok" icon={InOut}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'Masuk', icon: StokMasuk, cls: 'bg-leaf-soft dark:bg-leaf/15 border-leaf/40 text-leaf-deep dark:text-leaf' },
              { id: 'Keluar', icon: StokKeluar, cls: 'bg-brick-soft dark:bg-brick/10 border-brick/40 text-brick-deep dark:text-brick' }
            ].map(o => (
              <button key={o.id} onClick={() => setForm({ ...form, type: o.id })}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 font-extrabold text-sm transition ${form.type === o.id ? o.cls : 'border-line dark:border-line-dark text-ink-faint hover:border-flame-300'}`}>
                <o.icon className="w-4 h-4" /> {o.id}
              </button>
            ))}
          </div>
          <Select label="Pilih Produk" value={selectedProd} options={prodOptions} onChange={setSelectedProd} />
          <NumericInput label="Jumlah Barang" value={form.qty} onChange={v => setForm({ ...form, qty: v })} />
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Keterangan / Supplier</label>
            <input className="field" placeholder="Contoh: Barang dari Supplier A" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <Button onClick={saveInOut} className="w-full py-3" icon={Save}>Simpan Pergerakan</Button>
        </div>
      </Card>
    </div>
  );
};

/* ================= RIWAYAT STOK ================= */
export const StockHistoryTab = ({ activeTab }) => {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    if (activeTab === 'stockhistory') setLogs(safeParse('stock_history_db', []).slice().reverse());
  }, [activeTab]);
  useDbSync(() => setLogs(safeParse('stock_history_db', []).slice().reverse()));
  return (
    <div className="max-w-3xl mx-auto w-full pb-24">
      <PageTitle title="Riwayat Stok" sub="Log Pergerakan Barang" />
      <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
        {logs.length === 0 ? <EmptyState icon={StokRiwayat} title="Belum ada riwayat stok" desc="Pergerakan barang masuk, keluar, opname, dan pemakaian resep akan tercatat otomatis di sini." /> :
          logs.map(log => (
            <div key={log.id} className="card p-4 flex justify-between items-center hover:border-flame-300 transition">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 bg-paper dark:bg-white/5 rounded-xl flex items-center justify-center text-ink-faint shrink-0"><StokRiwayat className="w-5 h-5" /></div>
                <div>
                  <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{log.productName}</p>
                  <p className="text-[10px] text-ink-faint font-bold mt-0.5">{log.note} , {new Date(log.date).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div className={`font-extrabold text-lg money ${log.qty > 0 ? 'text-leaf-deep dark:text-leaf' : 'text-brick'}`}>
                {log.qty > 0 ? '+' : ''}{log.qty}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

/* ================= SUPPLIER ================= */
export const SupplierTab = ({ triggerAlert, licenseInfo }) => {
  const [suppliers, setSuppliers] = useState(safeParse('supplier_db', []));
  const [form, setForm] = useState({ name: '', contact: '', address: '' });
  useDbSync(() => setSuppliers(safeParse('supplier_db', [])));

  const saveSupplier = () => {
    if (!form.name) return triggerAlert("Nama supplier wajib diisi!", "error");
    const newSup = { id: `sup_${Date.now()}`, ...form };
    const updated = [...suppliers, newSup];
    setSuppliers(updated);
    dbSet(licenseInfo?.id, 'supplier_db', updated);   // v15 F1
    setForm({ name: '', contact: '', address: '' });
    triggerAlert("Supplier Berhasil Ditambahkan!");
  };

  const deleteSupplier = (id) => {
    if (confirm("Hapus supplier ini?")) {
      const updated = suppliers.filter(s => s.id !== id);
      setSuppliers(updated);
      dbSet(licenseInfo?.id, 'supplier_db', updated);   // v15 F1
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24">
      <PageTitle title="Data Supplier" sub="Manajemen Pemasok / Vendor" />
      <Card title="Tambah Supplier" icon={Supplier}>
        <div className="space-y-3.5">
          <input className="field-lg" placeholder="Nama Supplier" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="No. Telepon / WhatsApp" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
          <textarea className="field resize-none h-20" placeholder="Alamat lengkap..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}></textarea>
          <Button onClick={saveSupplier} className="w-full py-3" icon={Save}>Simpan Database</Button>
        </div>
      </Card>
      <div className="space-y-2.5 mt-4">
        {suppliers.length === 0 && <EmptyState icon={Supplier} title="Belum ada supplier" desc="Simpan kontak pemasok agar mudah dihubungi saat stok bahan menipis." />}
        {suppliers.map(s => (
          <div key={s.id} className="card p-4 flex justify-between items-center">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold rounded-full flex items-center justify-center font-extrabold shrink-0">{s.name[0]}</div>
              <div><p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{s.name}</p><p className="text-[10px] text-ink-faint font-bold">{s.contact}</p></div>
            </div>
            <button onClick={() => deleteSupplier(s.id)} className="text-ink-faint hover:text-brick p-2 hover:bg-brick-soft dark:hover:bg-brick/10 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================
   v21.1 — MODIFIER GROUPS MANAGER (spec #8)
   CRUD grup modifier: name, required/optional, single/multi,
   min/max, priceDelta, default option, urutan. Contoh bisnis:
   Cimol → Level Pedas / Bumbu / Topping (tidak dibuat SKU baru).
   ============================================================ */
const ModifierGroupsManager = ({ groups, onSave, onClose }) => {
  const [draft, setDraft] = useState(() => (groups || []).map(g => ({
    id: g.id, name: g.name || '', active: g.active !== false, required: !!g.required,
    multi: !!g.multi, min: Number(g.min) || 0, max: Number(g.max) || 0,
    options: (g.options || []).map(o => ({ ...o })),
  })));

  const updGroup = (i, patch) => setDraft(d => d.map((g, x) => x === i ? { ...g, ...patch } : g));
  const addGroup = () => setDraft(d => [...d, { name: '', required: false, multi: false, min: 0, max: 0, options: [{ name: '', priceDelta: 0 }] }]);
  const delGroup = (i) => setDraft(d => d.filter((_, x) => x !== i));
  const updOpt = (gi, oi, patch) => setDraft(d => d.map((g, x) => x !== gi ? g : { ...g, options: g.options.map((o, y) => y === oi ? { ...o, ...patch } : o) }));
  const addOpt = (gi) => setDraft(d => d.map((g, x) => x !== gi ? g : { ...g, options: [...g.options, { name: '', priceDelta: 0 }] }));
  const delOpt = (gi, oi) => setDraft(d => d.map((g, x) => x !== gi ? g : { ...g, options: g.options.filter((_, y) => y !== oi) }));
  const setDefault = (gi, oi) => setDraft(d => d.map((g, x) => x !== gi ? g : { ...g, options: g.options.map((o, y) => ({ ...o, isDefault: y === oi ? !o.isDefault : false })) }));

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in">
      <div className="card w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-pop flex flex-col overflow-hidden animate-pop">
        <div className="p-5 border-b border-line/70 dark:border-line-dark/70 shrink-0 flex justify-between items-start gap-3">
          <div>
            <p className="kicker">Modifier Engine</p>
            <h3 className="font-extrabold text-base text-ink dark:text-ink-inv mt-0.5">Grup Modifier</h3>
            <p className="text-[10.5px] text-ink-faint font-semibold mt-1">Contoh: Level Pedas (wajib), Bumbu (pilih 1), Topping (boleh banyak, +harga). Kombinasi TIDAK dibuat SKU baru.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick shrink-0">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {draft.length === 0 && <EmptyState mascot="pikir" title="Belum ada grup" desc="Tambahkan grup seperti Level Pedas, Bumbu, atau Topping, lalu pasang ke produk lewat tombol Varian." compact />}
          {draft.map((g, gi) => (
            <div key={gi} className="border border-line dark:border-line-dark rounded-2xl p-3.5 space-y-2.5 bg-paper/60 dark:bg-white/[.03]">
              <div className="flex gap-2 items-center">
                <input className="field flex-1" placeholder="Nama grup (mis. Level Pedas)" value={g.name} onChange={e => updGroup(gi, { name: e.target.value })} />
                <button onClick={() => delGroup(gi)} className="w-9 h-9 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick font-extrabold shrink-0">✕</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => updGroup(gi, { required: !g.required })} className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition ${g.required ? 'bg-flame-600 text-white border-flame-600' : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark'}`}>{g.required ? 'Wajib' : 'Opsional'}</button>
                <button onClick={() => updGroup(gi, { multi: !g.multi, min: !g.multi ? g.min : 0 })} className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition ${g.multi ? 'bg-flame-600 text-white border-flame-600' : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark'}`}>{g.multi ? 'Multi-pilih' : 'Pilih satu'}</button>
                {g.multi && <div className="w-20"><NumericInput value={g.max} onChange={v => updGroup(gi, { max: v })} placeholder="Maks" label="" /></div>}
                {g.multi && g.min > 0 && <div className="w-20"><NumericInput value={g.min} onChange={v => updGroup(gi, { min: v })} placeholder="Min" label="" /></div>}
              </div>
              <div className="space-y-1.5">
                {g.options.map((o, oi) => (
                  <div key={oi} className="flex gap-1.5 items-center">
                    <input className="field !py-2 flex-1 min-w-0" placeholder={`Opsi ${oi + 1} (mis. Pedas)`} value={o.name} onChange={e => updOpt(gi, oi, { name: e.target.value })} />
                    <div className="w-24 shrink-0"><NumericInput value={o.priceDelta} onChange={v => updOpt(gi, oi, { priceDelta: v })} prefix="+" label="" /></div>
                    <button onClick={() => setDefault(gi, oi)} title="Jadikan default" className={`w-9 h-9 rounded-lg shrink-0 text-[10px] font-extrabold border transition ${o.isDefault ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf border-leaf/25' : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark'}`}>★</button>
                    <button onClick={() => delOpt(gi, oi)} className="w-9 h-9 rounded-lg shrink-0 text-ink-faint hover:text-brick transition">✕</button>
                  </div>
                ))}
                <button onClick={() => addOpt(gi)} className="text-[10.5px] font-extrabold text-flame-600 dark:text-apricot px-1 py-1">+ Tambah opsi</button>
              </div>
            </div>
          ))}
          <button onClick={addGroup} className="w-full py-3 rounded-2xl border-2 border-dashed border-line dark:border-line-dark text-[11.5px] font-extrabold text-ink-faint hover:border-flame-300 hover:text-flame-600 dark:hover:text-apricot transition">+ Tambah Grup Modifier</button>
        </div>

        <div className="p-4 border-t border-line dark:border-line-dark shrink-0 flex gap-2">
          <Button variant="secondary" className="flex-1 py-3" onClick={onClose}>Batal</Button>
          <Button className="flex-1 py-3" onClick={() => { onSave(draft.filter(g => String(g.name || '').trim())); onClose(); }}>Simpan Grup</Button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   v21.1 — MODE & GRUP PER PRODUK (QUICK vs CONFIGURABLE)
   ============================================================ */
const ProductModifierDialog = ({ product, groups, onSave, onClose }) => {
  const [mode, setMode] = useState(product?.mode === 'configurable' ? 'configurable' : 'quick');
  const [ids, setIds] = useState(() => (Array.isArray(product?.modifierGroupIds) ? product.modifierGroupIds : []));
  const activeGroups = (groups || []).filter(g => g.active !== false);
  const toggle = (gid) => setIds(prev => prev.includes(gid) ? prev.filter(x => x !== gid) : [...prev, gid]);

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in">
      <div className="card w-full sm:max-w-md max-h-[92vh] overflow-y-auto custom-scrollbar shadow-pop rounded-t-3xl sm:rounded-3xl animate-pop">
        <div className="p-5 border-b border-line/70 dark:border-line-dark/70">
          <p className="kicker">Mode Penjualan</p>
          <h3 className="font-extrabold text-base text-ink dark:text-ink-inv mt-0.5">{product?.name}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('quick')} className={`p-3.5 rounded-2xl border text-left transition ${mode === 'quick' ? 'border-flame-500 ring-2 ring-flame-500/20 bg-flame-50 dark:bg-flame-900/20' : 'border-line dark:border-line-dark'}`}>
              <p className="font-extrabold text-[12px] text-ink dark:text-ink-inv">Quick Product</p>
              <p className="text-[10px] text-ink-faint font-bold mt-1">Tap → langsung masuk keranjang. Paling cepat.</p>
            </button>
            <button onClick={() => setMode('configurable')} className={`p-3.5 rounded-2xl border text-left transition ${mode === 'configurable' ? 'border-flame-500 ring-2 ring-flame-500/20 bg-flame-50 dark:bg-flame-900/20' : 'border-line dark:border-line-dark'}`}>
              <p className="font-extrabold text-[12px] text-ink dark:text-ink-inv">Configurable</p>
              <p className="text-[10px] text-ink-faint font-bold mt-1">Tap → sheet varian → masuk keranjang.</p>
            </button>
          </div>
          {mode === 'configurable' && (
            <div className="space-y-2">
              <p className="kicker">Grup Modifier Terpasang</p>
              {activeGroups.length === 0 && <p className="text-[11px] font-bold text-ink-faint">Belum ada grup. Buat dulu lewat tombol <b>Grup Modifier</b> di daftar produk.</p>}
              {activeGroups.map(g => (
                <button key={g.id} onClick={() => toggle(g.id)}
                  className={`w-full flex justify-between items-center px-3.5 py-2.5 rounded-xl border text-left transition ${ids.includes(g.id) ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/20' : 'border-line dark:border-line-dark'}`}>
                  <span className="font-extrabold text-[12px] text-ink dark:text-ink-inv">{g.name}</span>
                  <span className="text-[9.5px] font-extrabold text-ink-faint">{g.required ? 'Wajib' : 'Opsional'} · {g.options?.length || 0} opsi</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1 py-3" onClick={onClose}>Batal</Button>
            <Button className="flex-1 py-3" onClick={() => onSave(mode, ids)}>Simpan</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
