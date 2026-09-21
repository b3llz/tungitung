// ============================================================
// POS / KASIR v4 — perubahan struktur besar: panel TIKET PESANAN
// permanen di kanan (desktop) + bottom-sheet checkout (mobile).
// Logika kasir dipertahankan 100%: scanner BarcodeDetector nyata,
// materialUsage saat checkout, restore stok saat batal/edit,
// harga grosir/ojol, numpad tunai, meja & self-order.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Store, Clock, MonitorSmartphone, Search, Pindai, Plus, Trash2,
  Keranjang, RefreshCw, Selesai, Check, X, Edit3, Receipt,
  Uang, Qris, Dompet, Package, User, Rocket, MinusCircle, ChevronDown, CategoryIcon
} from './welp-icons.jsx';
import {
  safeParse, formatIDR, isPro, computeOrderTotals, getBizConfig,
  getPaymentIcon, qrUrl, t, BRANCH_ID
} from './core.jsx';
import { Button, Card, Badge, EmptyState } from './ui';

/* ---------- PILIH TIER HARGA (Pro) ---------- */
export const PremiumPriceSelector = ({ currentTier, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const tiers = [
    { id: 'retail', label: 'Harga Ecer', icon: User, color: 'text-ink-soft', bg: 'bg-paper dark:bg-white/10' },
    { id: 'grosir', label: 'Harga Grosir', icon: Package, color: 'text-ink-soft', bg: 'bg-paper dark:bg-white/10' },
    { id: 'ojol', label: 'Harga App Online', icon: Rocket, color: 'text-gold-deep dark:text-gold', bg: 'bg-gold-soft dark:bg-gold/15' }
  ];
  const selected = tiers.find(x => x.id === currentTier) || tiers[0];

  return (
    <div className="relative z-30">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark px-2.5 py-1.5 rounded-xl shadow-card hover:border-flame-300 transition-all active:scale-95 press">
        <div className={`p-1.5 rounded-lg ${selected.bg} ${selected.color}`}><selected.icon className="w-3.5 h-3.5" /></div>
        <div className="text-left mr-1 hidden sm:block">
          <p className="text-[8px] text-ink-faint font-extrabold uppercase tracking-wider">Mode Harga</p>
          <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv leading-none mt-0.5">{selected.label}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-56 bg-surface dark:bg-surface-dark rounded-2xl shadow-pop border border-line dark:border-line-dark p-2 z-50 animate-pop">
            <p className="kicker px-3 py-2 border-b border-line/60 dark:border-line-dark/60 mb-1">Pilih Kategori Jual</p>
            {tiers.map(x => (
              <button key={x.id} onClick={() => { onChange(x.id); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${currentTier === x.id ? 'bg-flame-50 dark:bg-flame-900/25' : 'hover:bg-paper dark:hover:bg-white/5'}`}>
                <div className={`p-2 rounded-lg ${x.bg} ${x.color}`}><x.icon className="w-4 h-4" /></div>
                <span className={`text-xs font-extrabold ${currentTier === x.id ? 'text-flame-700 dark:text-apricot' : 'text-ink-soft dark:text-ink-inv/70'}`}>{x.label}</span>
                {currentTier === x.id && <Selesai className="w-4 h-4 text-flame-600 dark:text-apricot ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ---------- TIMER ---------- */
export const CountdownTimer = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setTimeLeft("Expired"); clearInterval(interval); }
      else {
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${m}:${s < 10 ? '0' + s : s}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);
  return <span className="text-brick font-mono font-bold">{timeLeft}</span>;
};

/* ---------- STRUK (print via window.print, z-[80]) ---------- */
export const ReceiptModal = ({ order, profile, onClose }) => {
  if (!order) return null;
  const subtotal = order.subtotal ?? order.items.reduce((a, b) => a + b.price * b.qty, 0);
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-chrome-deep/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-xs rounded-2xl shadow-pop overflow-hidden animate-pop" onClick={e => e.stopPropagation()}>
        <div id="receipt-print" className="p-5 text-slate-900 font-mono text-[11px] leading-relaxed">
          <div className="text-center mb-3">
            {profile?.logo && <img src={profile.logo} className="w-12 h-12 object-contain mx-auto mb-2" />}
            <h2 className="font-black text-base uppercase tracking-wide">{profile?.name || 'TOKO ANDA'}</h2>
            {profile?.address && <p className="text-[10px]">{profile.address}</p>}
            {/* FIX: baca wa dulu (Profil menyimpan di `wa`), fallback phone */}
            {(profile?.wa || profile?.phone) && <p className="text-[10px]">{profile.wa || profile.phone}</p>}
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
        <div className="no-print p-3 bg-paper border-t border-slate-200 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs">Tutup</button>
          <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl bg-flame-600 text-white font-bold text-xs flex items-center justify-center gap-2"><Receipt className="w-4 h-4" /> Cetak / Simpan PDF</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ============================================================
   CHECKOUT SHEET (mobile bottom sheet / desktop modal)
   Kontrak prop IDENTIK dengan CartPopup lama (dipakai SelfOrder).
   ============================================================ */
export const CartPopup = ({ showCart, setShowCart, cart, updateQty, removeFromCart, buyerName, setBuyerName, paymentMethod, setPaymentMethod, handleCheckout, profile, isLoading, orderType, setOrderType, tableNo, setTableNo, notes, setNotes, cashTendered, setCashTendered, isSelfOrder = false }) => {
  const [showNumpad, setShowNumpad] = useState(false);
  const [splitCash, setSplitCash] = useState(0);
  const bill = computeOrderTotals(cart);
  const grandTotal = bill.total;
  const bizMode = localStorage.getItem('biz_mode') || 'retail';

  if (!showCart) return null;
  const canPay = cart.length > 0 && !isLoading && !!paymentMethod && !(paymentMethod === 'Cash' && cashTendered < grandTotal);

  return (
    <div className="fixed inset-0 z-[100] bg-chrome-deep/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={() => setShowCart(false)}>
      <div className="bg-surface dark:bg-surface-dark w-full sm:w-[480px] rounded-t-3xl sm:rounded-3xl shadow-pop relative flex flex-col max-h-[92vh] overflow-hidden animate-pop"
        onClick={e => e.stopPropagation()}>

        <div className="p-4 border-b border-line/70 dark:border-line-dark/70 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-flame-50 dark:bg-flame-900/20 text-flame-600 dark:text-apricot flex items-center justify-center"><Keranjang className="w-4.5 h-4.5" /></div>
            <div>
              <p className="kicker">Checkout</p>
              <p className="font-extrabold text-ink dark:text-ink-inv text-sm leading-none mt-0.5">{cart.length} item · {formatIDR(grandTotal)}</p>
            </div>
          </div>
          <button onClick={() => setShowCart(false)} className="w-9 h-9 rounded-xl bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick transition"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5 bg-paper/60 dark:bg-white/[.02]">
          {cart.map(i => (
            <div key={i.id} className="flex gap-3 items-center bg-surface dark:bg-surface-dark p-2 pr-3 rounded-xl border border-line dark:border-line-dark">
              <div className="w-11 h-11 bg-paper dark:bg-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                {i.image ? <img src={i.image} className="w-full h-full object-cover" /> : <span className="font-extrabold text-ink-faint">{i.name?.[0] || '?'}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-[13px] truncate text-ink dark:text-ink-inv">{i.name}</p>
                <p className="text-[11px] font-extrabold text-ink-faint money">{formatIDR(i.price)}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-paper dark:bg-white/5 p-1 rounded-lg border border-line dark:border-line-dark">
                <button onClick={() => updateQty(i.id, -1)} className="w-7 h-7 bg-surface dark:bg-surface-dark rounded-md shadow-sm text-xs font-extrabold hover:text-brick transition">−</button>
                <span className="text-xs font-extrabold w-4 text-center text-ink dark:text-ink-inv">{i.qty}</span>
                <button onClick={() => updateQty(i.id, 1)} className="w-7 h-7 bg-surface dark:bg-surface-dark rounded-md shadow-sm text-xs font-extrabold hover:text-flame-600 dark:hover:text-apricot transition">+</button>
              </div>
              <button onClick={() => removeFromCart(i.id)} className="text-ink-faint hover:text-brick transition px-0.5"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}

          <div className="pt-2 space-y-2.5">
            {!isSelfOrder && (
              <input className="field" placeholder="Nama Pelanggan (Opsional)" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
            )}
            {bizMode === 'fnb' && !isSelfOrder && (
              <div className="flex gap-2">
                <div className="flex bg-surface dark:bg-surface-dark border border-line dark:border-line-dark p-1 rounded-xl w-1/2 shrink-0">
                  {['Dine-in', 'Takeaway'].map(ot => (
                    <button key={ot} onClick={() => setOrderType(ot)}
                      className={`flex-1 text-[10px] font-extrabold rounded-lg py-2 transition ${orderType === ot ? 'bg-chrome-deep text-white' : 'text-ink-faint'}`}>{ot}</button>
                  ))}
                </div>
                {orderType === 'Dine-in' && (
                  <input type="number" placeholder="No Meja" value={tableNo} onChange={e => setTableNo(e.target.value)} className="field flex-1 min-w-0" />
                )}
              </div>
            )}
            <input type="text" placeholder="Catatan Pesanan (Opsional)..." value={notes} onChange={e => setNotes(e.target.value)} className="field" />
          </div>

          <div className="space-y-2 pt-1">
            <p className="kicker">{t('payMethod')}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {(isSelfOrder ? ['QRIS', ...(profile.payment?.ewallets?.map(w => w.type) || []), ...(profile.payment?.bank?.map(b => b.bank) || [])] : ['Cash', 'QRIS', 'Split Bill', ...(profile.payment?.ewallets?.map(w => w.type) || []), ...(profile.payment?.bank?.map(b => b.bank) || [])]).map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border shrink-0 transition-all ${paymentMethod === m
                    ? 'bg-flame-600 border-flame-600 text-white shadow-card'
                    : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70'}`}>
                  {getPaymentIcon(m)} <span className="text-xs font-extrabold">{m}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-dashed border-line dark:border-line-dark">
            <div className="flex justify-between text-xs font-bold text-ink-faint"><span>{t('subtotal')}</span><span className="money">{formatIDR(bill.subtotal)}</span></div>
            {bill.discountAmt > 0 && <div className="flex justify-between text-xs font-extrabold text-flame-700 dark:text-apricot"><span>{t('disc')} ({bill.discPercent}%)</span><span className="money">- {formatIDR(bill.discountAmt)}</span></div>}
            {bill.taxAmt > 0 && <div className="flex justify-between text-xs font-bold text-ink-faint"><span>{t('tax')} ({bill.taxPercent}%)</span><span className="money">{formatIDR(bill.taxAmt)}</span></div>}
            {bill.serviceAmt > 0 && <div className="flex justify-between text-xs font-bold text-ink-faint"><span>{t('service')} ({bill.servicePercent}%)</span><span className="money">{formatIDR(bill.serviceAmt)}</span></div>}
          </div>

          {/* TUNAI: uang pas / numpad */}
          {paymentMethod === 'Cash' && !isSelfOrder && (
            <div className="p-4 bg-surface dark:bg-surface-dark rounded-2xl border border-line dark:border-line-dark space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCashTendered(grandTotal)} className="bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf py-2.5 rounded-xl font-extrabold transition-colors flex items-center justify-center gap-1.5 text-xs border border-leaf/25"><Selesai className="w-4 h-4" /> Uang Pas</button>
                <button onClick={() => setShowNumpad(!showNumpad)} className="bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold py-2.5 rounded-xl font-extrabold transition-colors flex items-center justify-center gap-1.5 text-xs border border-gold/25"><Edit3 className="w-4 h-4" /> Input Manual</button>
              </div>
              <div className="text-center font-extrabold text-2xl text-ink dark:text-ink-inv money py-1">{formatIDR(cashTendered)}</div>

              {showNumpad && (
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line dark:border-line-dark">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} onClick={() => setCashTendered(Number(`${cashTendered}${num}`))} className="py-3.5 bg-paper dark:bg-white/5 rounded-xl font-extrabold text-lg text-ink dark:text-ink-inv active:scale-95 transition press">{num}</button>
                  ))}
                  <button onClick={() => setCashTendered(Number(`${cashTendered}000`))} className="py-3.5 bg-paper dark:bg-white/5 rounded-xl font-extrabold text-xs text-ink dark:text-ink-inv active:scale-95 transition press">+000</button>
                  <button onClick={() => setCashTendered(Number(`${cashTendered}0`))} className="py-3.5 bg-paper dark:bg-white/5 rounded-xl font-extrabold text-lg text-ink dark:text-ink-inv active:scale-95 transition press">0</button>
                  <button onClick={() => setCashTendered(Number(cashTendered.toString().slice(0, -1)))} className="py-3.5 bg-brick-soft dark:bg-brick/10 text-brick rounded-xl font-extrabold active:scale-95 transition press"><MinusCircle className="w-5 h-5 mx-auto" /></button>
                </div>
              )}
              {cashTendered >= grandTotal && (
                <div className="flex justify-between text-base font-extrabold text-leaf-deep dark:text-leaf pt-3 border-t border-line dark:border-line-dark">
                  <span>Kembalian:</span>
                  <span className="money">{formatIDR(cashTendered - grandTotal)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-surface dark:bg-surface-dark border-t border-line/70 dark:border-line-dark/70 shrink-0">
          <div className="flex justify-between items-end mb-3">
            <span className="text-ink-faint text-xs font-extrabold uppercase tracking-widest">{t('total')}</span>
            <span className="text-2xl font-extrabold text-ink dark:text-ink-inv money tracking-tight">{formatIDR(grandTotal)}</span>
          </div>
          <button onClick={handleCheckout} disabled={!canPay}
            className={`w-full py-4 rounded-xl font-extrabold text-sm transition-all active:scale-[.98] flex items-center justify-center gap-2 press ${canPay
              ? 'bg-flame-600 hover:bg-flame-500 text-white shadow-card'
              : 'bg-paper dark:bg-white/5 text-ink-faint'}`}>
            {isLoading ? <><RefreshCw className="w-5 h-5 animate-spin" /> Memproses...</> : (!paymentMethod ? "Pilih Metode Pembayaran" : <><Selesai className="w-5 h-5" /> Proses Pesanan</>)}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   POS TAB
   ============================================================ */
export const PosTab = ({ licenseInfo, triggerAlert, setEditingMode, activeTab }) => {
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
      setProducts(safeParse('product_stock_db', []));
      setProfile(safeParse('store_profile', {}));
    }
  }, [activeTab]);

  useEffect(() => {
    const p = safeParse('product_stock_db', []);
    setProducts(p);
    setActiveOrders(safeParse('active_orders_db', []));
    setProfile(safeParse('store_profile', {}));
  }, []);

  // LOGIKA LIVE CAMERA SCANNER — BarcodeDetector nyata (bukan simulasi).
  useEffect(() => {
    let stream, rafId, stopped = false;
    const cleanup = () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(t2 => t2.stop());
    };
    if (!liveScanner.show) return cleanup;

    if (!('BarcodeDetector' in window)) {
      triggerAlert("Browser ini belum mendukung deteksi barcode. Gunakan scanner fisik (mode keyboard) atau tab Hardware.", "error");
      setLiveScanner({ show: false, mode: '' });
      return cleanup;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        if (stopped) { s.getTracks().forEach(t2 => t2.stop()); return; }
        stream = s;
        if (videoRef.current) { videoRef.current.srcObject = s; if (videoRef.current.play) videoRef.current.play(); }
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a', 'itf'] });
        const beep = () => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); osc.connect(ctx.destination); osc.frequency.value = 800; osc.start(); setTimeout(() => { osc.stop(); if (ctx.close) ctx.close(); }, 150); } catch (e) { } };
        const onDetected = (val) => {
          beep();
          setLiveScanner({ show: false, mode: '' });
          if (liveScanner.mode === 'validation') {
            // QR pelanggan self-order berformat "CL-ORDER:{json}" -> cocokkan ke meja
            let table = null;
            if (typeof val === 'string' && val.startsWith('CL-ORDER:')) {
              try { table = JSON.parse(val.slice(9)).t; } catch (e) { }
            }
            const ords = safeParse('active_orders_db', []);
            const found = (table !== null && table !== undefined && ords.find(o => o.status === 'pending' && String(o.tableNo) === String(table))) ||
              ords.find(o => o.status === 'pending');
            if (found) setSelectedOrder(found);
            else triggerAlert("Tidak ada pesanan pending yang cocok untuk QR ini.", "error");
          } else {
            // Mode produk: cocokkan hasil scan dengan SKU/barcode atau nama produk
            const q = String(val || '').trim().toLowerCase();
            const hit = products.find(p => (p.sku && String(p.sku).toLowerCase() === q) || String(p.name).toLowerCase() === q);
            if (hit) { addToCart(hit); triggerAlert("Produk ditambahkan: " + hit.name, "success"); }
            else triggerAlert("Kode \"" + val + "\" tidak cocok dengan SKU/nama produk mana pun.", "error");
          }
        };
        const loop = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length) { onDetected(codes[0].rawValue); return; }
          } catch (e) { /* frame drop: lanjutkan */ }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      })
      .catch(e => { triggerAlert("Akses Kamera Ditolak/Tidak Tersedia!", "error"); setLiveScanner({ show: false, mode: '' }); });

    return cleanup;
  }, [liveScanner.show]);

  const saveActiveOrders = (ords) => {
    setActiveOrders(ords);
    localStorage.setItem('active_orders_db', JSON.stringify(ords));
  };

  const addToCart = (p) => {
    if (p.stock <= 0) return triggerAlert("Stok habis!", "error");
    let finalPrice = p.price;
    if (priceTier === 'grosir' && p.priceGrosir > 0) finalPrice = p.priceGrosir;
    if (priceTier === 'ojol' && p.priceOjol > 0) finalPrice = p.priceOjol;

    setCart(prev => {
      const exist = prev.find(i => i.id === p.id && i.price === finalPrice);
      if (exist && exist.qty >= p.stock) return prev;
      return exist ? prev.map(i => (i.id === p.id && i.price === finalPrice) ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1, price: finalPrice }];
    });
  };

  const updateQty = (id, d) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = Math.max(1, i.qty + d);
      const prod = products.find(p => p.id === id);
      if (prod && newQty > prod.stock) return i;
      return { ...i, qty: newQty };
    }));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const handleCheckout = async () => {
    if (cart.length === 0) return triggerAlert("Keranjang masih kosong!", "error");
    if (isLoading) return;
    setIsLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const bill = computeOrderTotals(cart);
      // Snapshot HPP saat penjualan (hppAtSale) — fondasi laporan laba nyata.
      const orderItems = cart.map(i => ({
        ...i,
        hppAtSale: (typeof i.hppAtSale === 'number' ? i.hppAtSale : (typeof i.hpp === 'number' ? i.hpp : null))
      }));
      const newOrder = {
        id: `ord_${Date.now()}`, date: new Date().toISOString(), buyer: buyerName || 'Tanpa Nama',
        paymentMethod: paymentMethod, items: orderItems,
        subtotal: bill.subtotal, discountAmt: bill.discountAmt, taxAmt: bill.taxAmt, serviceAmt: bill.serviceAmt,
        taxPercent: bill.taxPercent, servicePercent: bill.servicePercent, discPercent: bill.discPercent,
        total: bill.total, cashTendered: paymentMethod === 'Cash' ? cashTendered : 0,
        change: paymentMethod === 'Cash' ? Math.max(0, cashTendered - bill.total) : 0,
        orderType: orderType, tableNo: tableNo, notes: notes,
        status: 'pending', branchId: BRANCH_ID
      };

      const updatedProducts = [...products];
      const rawMaterialsDb = safeParse('raw_material_db', []);
      const recipesDb = safeParse('hpp_pro_db', []);
      let updatedRawMaterials = [...rawMaterialsDb];
      // Catat pemakaian bahan baku per item agar bisa dikembalikan saat batal/edit.
      const materialUsageByItem = {};

      cart.forEach(cartItem => {
        const prodIdx = updatedProducts.findIndex(p => p.id === cartItem.id);
        if (prodIdx >= 0) updatedProducts[prodIdx].stock = Math.max(0, updatedProducts[prodIdx].stock - cartItem.qty);
        // Cocokkan resep via productId (stabil); fallback nama untuk resep lama.
        // Bila satu produk punya banyak resep, pakai yang TERAKHIR disimpan.
        let resep = null;
        recipesDb.forEach(r => { if (r.productId === cartItem.id) resep = r; });
        if (!resep) recipesDb.forEach(r => { if (r.product?.name === cartItem.name) resep = r; });
        if (resep && resep.materials) {
          const usageList = [];
          resep.materials.forEach(mat => {
            const matNameClean = mat.name.trim().toLowerCase();
            const rawIdx = updatedRawMaterials.findIndex(rm => rm.name.trim().toLowerCase() === matNameClean);
            if (rawIdx >= 0) {
              const yieldPcs = resep.production?.yield || 1;
              const totalUsage = ((mat.usage || 0) / yieldPcs) * cartItem.qty;
              updatedRawMaterials[rawIdx].stock = Math.max(0, (updatedRawMaterials[rawIdx].stock || 0) - totalUsage);
              usageList.push({ rawMaterialId: updatedRawMaterials[rawIdx].id, qty: totalUsage });
            }
          });
          if (usageList.length) materialUsageByItem[cartItem.id] = usageList;
        }
      });

      newOrder.materialUsage = materialUsageByItem;

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
    const history = safeParse('pos_history_db', []);
    const completedOrder = { ...order, status: 'paid', paidAt: new Date().toISOString() };
    localStorage.setItem('pos_history_db', JSON.stringify([...history, completedOrder]));
    saveActiveOrders(activeOrders.map(o => o.id === order.id ? completedOrder : o));
    setSelectedOrder(completedOrder);
  };

  // Kembalikan stok bahan baku berdasarkan materialUsage saat batal/edit.
  const restoreMaterialUsage = (order) => {
    if (!order.materialUsage) return;
    const rawMaterialsDb = safeParse('raw_material_db', []);
    const updated = [...rawMaterialsDb];
    Object.values(order.materialUsage).flat().forEach(({ rawMaterialId, qty }) => {
      const idx = updated.findIndex(rm => rm.id === rawMaterialId);
      if (idx >= 0) updated[idx].stock = (updated[idx].stock || 0) + qty;
    });
    localStorage.setItem('raw_material_db', JSON.stringify(updated));
  };

  const cancelOrder = (order) => {
    if (confirm("Batalkan pesanan? Stok akan dikembalikan.")) {
      const newStock = products.map(p => {
        const inOrder = order.items.find(i => i.id === p.id);
        return inOrder ? { ...p, stock: p.stock + inOrder.qty } : p;
      });
      setProducts(newStock);
      localStorage.setItem('product_stock_db', JSON.stringify(newStock));
      restoreMaterialUsage(order);
      saveActiveOrders(activeOrders.filter(o => o.id !== order.id));
      setSelectedOrder(null);
    }
  };

  // Ubah pesanan: kembalikan stok lalu muat ulang item ke keranjang
  const editOrder = (order) => {
    const newStock = products.map(p => {
      const inOrder = order.items.find(i => i.id === p.id);
      return inOrder ? { ...p, stock: p.stock + inOrder.qty } : p;
    });
    setProducts(newStock);
    localStorage.setItem('product_stock_db', JSON.stringify(newStock));
    restoreMaterialUsage(order);
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
    if (method === 'Cash') return <div className="p-3 bg-paper dark:bg-white/5 rounded-xl text-center font-extrabold text-ink dark:text-ink-inv text-sm">Bayar Tunai di Kasir</div>;
    if (method === 'QRIS') return (
      <div className="flex flex-col items-center">
        {profile.payment?.qris ? <img src={profile.payment.qris} className="w-48 h-48 object-contain bg-white p-2 rounded-xl border" /> : <p>Belum ada QRIS</p>}
        <p className="text-xs mt-2 text-ink-faint font-semibold">Scan untuk membayar</p>
      </div>
    );
    const wallet = profile.payment?.ewallets?.find(w => w.type === method);
    if (wallet) return <div className="p-4 bg-paper dark:bg-white/5 rounded-xl text-center"><p className="font-extrabold text-ink-soft dark:text-ink-inv/80">{method}</p><p className="text-xl font-extrabold mt-1 select-all text-ink dark:text-ink-inv money">{wallet.number}</p></div>;
    return null;
  };

  const totalCartPrice = cart.reduce((a, b) => a + (b.price * b.qty), 0);
  const totalCartQty = cart.reduce((a, b) => a + b.qty, 0);
  const cartBill = computeOrderTotals(cart);
  const pendingCount = activeOrders.filter(o => o.status === 'pending').length;
  const isFnb = localStorage.getItem('biz_mode') === 'fnb';

  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => activeCategory === 'Semua' ? true : p.type === activeCategory);

  /* ---------- kartu produk ---------- */
  const ProductCard = ({ p }) => {
    let displayPrice = p.price;
    if (priceTier === 'grosir' && p.priceGrosir > 0) displayPrice = p.priceGrosir;
    else if (priceTier === 'ojol' && p.priceOjol > 0) displayPrice = p.priceOjol;
    const inCartQty = cart.find(i => i.id === p.id)?.qty || 0;

    return (
      <button onClick={() => addToCart(p)} disabled={p.stock <= 0}
        className={`relative bg-surface dark:bg-surface-dark p-2.5 rounded-2xl border text-left transition-all duration-200 group ${p.stock > 0
          ? inCartQty > 0
            ? 'border-flame-500 ring-2 ring-flame-500/25 shadow-card cursor-pointer'
            : 'border-line dark:border-line-dark hover:border-flame-300 shadow-card cursor-pointer press'
          : 'opacity-50 grayscale cursor-not-allowed border-line dark:border-line-dark'}`}>
        <div className="aspect-square bg-paper dark:bg-white/[.04] rounded-xl mb-2 overflow-hidden relative">
          {p.image ? <img src={p.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            : <div className="w-full h-full flex items-center justify-center"><CategoryIcon name={p.type} className="w-10 h-10 opacity-80" /></div>}
          {inCartQty > 0 && (
            <span className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-flame-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-card">{inCartQty}</span>
          )}
          <span className={`absolute bottom-1.5 right-1.5 text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${p.stock > 0
            ? 'bg-chrome-deep/85 backdrop-blur text-white'
            : 'bg-brick text-white'}`}>{p.stock > 0 ? `${p.stock}` : 'Habis'}</span>
        </div>
        <h4 className="font-bold text-ink dark:text-ink-inv text-xs truncate mb-0.5">{p.name}</h4>
        <p className="text-ink dark:text-ink-inv font-extrabold text-[13px] money">{formatIDR(displayPrice)}</p>
      </button>
    );
  };

  /* ---------- TIKET (rail desktop / bar mobile) ---------- */
  const TicketRail = ({ compact }) => (
    <div className="card !rounded-3xl overflow-hidden flex flex-col">
      <div className="bg-chrome-deep px-4 py-3.5 flex justify-between items-center">
        <div>
          <p className="text-apricot/80 text-[9px] font-extrabold uppercase tracking-[0.2em]">Tiket Pesanan</p>
          <p className="text-ink-inv font-extrabold text-sm leading-none mt-0.5">{totalCartQty} item</p>
        </div>
        <Keranjang className="w-5 h-5 text-apricot" />
      </div>
      <div className={`overflow-y-auto custom-scrollbar px-4 ${compact ? 'max-h-[30vh]' : 'flex-1 max-h-[42vh]'}`}>
        {cart.length === 0 ? (
          <div className="py-8 text-center">
            <Keranjang className="w-9 h-9 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Keranjang masih kosong</p>
            <p className="text-[10px] text-ink-faint/70 mt-1">Klik produk buat nambahin</p>
          </div>
        ) : cart.map(i => (
          <div key={i.id} className="flex items-center gap-2.5 py-2.5 border-b border-dotted border-line dark:border-line-dark last:border-0">
            <div className="w-9 h-9 bg-paper dark:bg-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
              {i.image ? <img src={i.image} className="w-full h-full object-cover" /> : <span className="text-[10px] font-extrabold text-ink-faint">{i.name?.[0]}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs truncate text-ink dark:text-ink-inv">{i.name}</p>
              <p className="text-[10px] text-ink-faint money font-bold">{formatIDR(i.price)} × {i.qty}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => updateQty(i.id, -1)} className="w-6 h-6 rounded-md bg-paper dark:bg-white/5 text-xs font-extrabold text-ink-soft hover:text-brick transition">−</button>
              <span className="w-5 text-center text-xs font-extrabold text-ink dark:text-ink-inv">{i.qty}</span>
              <button onClick={() => updateQty(i.id, 1)} className="w-6 h-6 rounded-md bg-flame-50 dark:bg-flame-900/40 text-xs font-extrabold text-flame-700 dark:text-apricot hover:bg-flame-100 dark:hover:bg-flame-900/70 transition">+</button>
              <button onClick={() => removeFromCart(i.id)} className="w-6 h-6 rounded-md text-ink-faint hover:text-brick transition"><Trash2 className="w-3.5 h-3.5 mx-auto" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-dashed border-line dark:border-line-dark space-y-1 text-xs">
        <div className="flex justify-between font-bold text-ink-faint"><span>Subtotal</span><span className="money">{formatIDR(cartBill.subtotal)}</span></div>
        {cartBill.discountAmt > 0 && <div className="flex justify-between font-extrabold text-flame-700 dark:text-apricot"><span>Diskon ({cartBill.discPercent}%)</span><span className="money">- {formatIDR(cartBill.discountAmt)}</span></div>}
        {cartBill.taxAmt > 0 && <div className="flex justify-between font-bold text-ink-faint"><span>Pajak ({cartBill.taxPercent}%)</span><span className="money">{formatIDR(cartBill.taxAmt)}</span></div>}
        {cartBill.serviceAmt > 0 && <div className="flex justify-between font-bold text-ink-faint"><span>Servis ({cartBill.servicePercent}%)</span><span className="money">{formatIDR(cartBill.serviceAmt)}</span></div>}
      </div>
      <div className="px-4 py-3.5 bg-paper/60 dark:bg-white/[.03] border-t border-line/60 dark:border-line-dark">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">Total</span>
          <span className="text-xl font-extrabold text-ink dark:text-ink-inv money">{formatIDR(cartBill.total)}</span>
        </div>
        <Button onClick={() => setShowCart(true)} disabled={cart.length === 0} icon={Keranjang} className="w-full py-3.5">
          Checkout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full max-w-7xl mx-auto relative">

      {/* ===== view switcher ===== */}
      <div className="flex gap-1.5 mb-5 bg-surface dark:bg-surface-dark p-1 rounded-xl border border-line dark:border-line-dark shadow-card inline-flex">
        <button onClick={() => setViewMode('shop')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${viewMode === 'shop' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}><Store className="w-4 h-4" /> {t('shop')}</button>
        <button onClick={() => setViewMode('status')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${viewMode === 'status' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}>
          <Clock className="w-4 h-4" /> {t('orders')}
          {pendingCount > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${viewMode === 'status' ? 'bg-white/20' : 'bg-brick text-white'}`}>{pendingCount}</span>}
        </button>
        {isFnb && (
          <button onClick={() => setViewMode('table')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${viewMode === 'table' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}><MonitorSmartphone className="w-4 h-4" /> {t('tables')}</button>
        )}
      </div>

      {/* ============ VIEW: MEJA ============ */}
      {viewMode === 'table' && (
        <div className="animate-rise pb-24">
          <div className="card !rounded-3xl p-6 mb-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="kicker">Live Table Monitoring</p>
                <h3 className="font-extrabold text-ink dark:text-ink-inv text-lg tracking-tight">Denah Meja</h3>
              </div>
              <div className="flex gap-4 text-[10px] font-extrabold">
                <span className="flex items-center gap-1.5 text-ink-faint"><span className="w-2.5 h-2.5 rounded-full bg-line dark:bg-line-dark"></span> Kosong</span>
                <span className="flex items-center gap-1.5 text-brick"><span className="w-2.5 h-2.5 rounded-full bg-brick"></span> Terisi</span>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: parseInt(localStorage.getItem('table_count')) || 24 }, (_, i) => i + 1).map(tableNum => {
                const occupiedOrder = activeOrders.find(o => parseInt(o.tableNo) === tableNum && o.status === 'pending');
                return (
                  <button key={tableNum} onClick={() => occupiedOrder ? setSelectedOrder(occupiedOrder) : triggerAlert(`Meja ${tableNum} masih kosong.`, 'success')}
                    className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-200 cursor-pointer press ${occupiedOrder
                      ? 'bg-brick-soft dark:bg-brick/10 border-brick/50'
                      : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark hover:border-flame-300'}`}>
                    <span className={`text-xl font-extrabold ${occupiedOrder ? 'text-brick-deep dark:text-brick' : 'text-ink-faint'}`}>{tableNum}</span>
                    {occupiedOrder && <span className="text-[8px] font-extrabold text-brick-deep dark:text-brick truncate max-w-full px-1 money">{formatIDR(occupiedOrder.total)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============ VIEW: KASIR ============ */}
      {viewMode === 'shop' && (
        <div className="lg:grid lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px] lg:gap-6 items-start pb-32 lg:pb-8">
          {/* --- katalog --- */}
          <div className="min-w-0">
            <div className="relative flex gap-2 mb-3">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search className="w-4 h-4 text-ink-faint" /></div>
                <input className="field-lg pl-10 pr-12" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
                <button onClick={() => { localStorage.getItem('scanner_mode') === 'camera' ? setLiveScanner({ show: true, mode: 'product' }) : triggerAlert("Gunakan Scanner Fisik Anda.", "success") }}
                  className="absolute inset-y-2 right-2 px-3 bg-flame-50 dark:bg-flame-900/20 rounded-xl text-flame-600 dark:text-apricot hover:bg-flame-100 dark:hover:bg-flame-900/40 transition flex items-center justify-center"><Pindai className="w-4.5 h-4.5" /></button>
              </div>
              {isPro(licenseInfo) && <PremiumPriceSelector currentTier={priceTier} onChange={setPriceTier} />}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 custom-scrollbar no-scrollbar">
              {['Semua', 'Makanan', 'Minuman', 'Fashion', 'Jasa', 'Lainnya'].map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all border ${activeCategory === cat
                    ? 'bg-flame-600 text-white border-flame-600 shadow-card'
                    : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark hover:border-flame-300'}`}>
                  {cat !== 'Semua' && <CategoryIcon name={cat} className={`w-3.5 h-3.5 ${activeCategory === cat ? 'opacity-95' : 'opacity-70'}`} />}
                  {cat}
                </button>
              ))}
            </div>

            {products.length === 0 ? (
              <EmptyState mascot="bingung" title="Belum ada produk" desc="Tambahkan produk lewat tab Stok Barang atau simpan resep dari Kalkulator HPP, lalu produk muncul di sini." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map(p => <ProductCard key={p.id} p={p} />)}
              </div>
            )}
          </div>

          {/* --- tiket permanen (desktop) --- */}
          <div className="hidden lg:block sticky top-6">
            <TicketRail />
          </div>

          {/* --- bar keranjang (mobile) --- */}
          {cart.length > 0 && (
            <div className="lg:hidden fixed bottom-20 left-0 right-0 px-4 z-30 animate-slide-up">
              <button onClick={() => setShowCart(true)}
                className="w-full max-w-md mx-auto flex justify-between items-center bg-chrome-deep text-ink-inv p-3.5 pl-5 rounded-3xl shadow-pop border border-chrome-edge press">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-2xl bg-flame-500 text-white font-extrabold text-xs flex items-center justify-center">{totalCartQty}</span>
                  <div className="text-left">
                    <span className="block text-[9px] font-extrabold uppercase tracking-widest text-ink-inv/50">Lihat Keranjang</span>
                    <span className="block text-base font-extrabold money leading-none mt-0.5">{formatIDR(cartBill.total)}</span>
                  </div>
                </div>
                <span className="flex items-center gap-2 font-extrabold text-xs bg-flame-500 text-white px-4 py-2.5 rounded-2xl"><Keranjang className="w-4 h-4" /> Checkout</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ VIEW: PESANAN ============ */}
      {viewMode === 'status' && (
        <div className="space-y-3 pb-24 relative">
          {activeOrders.length === 0 && <EmptyState mascot="yuk" title="Belum ada pesanan aktif" desc="Pesanan dari kasir & self-order meja akan tampil di sini sebelum dan sesudah pembayaran." />}
          <div className="grid md:grid-cols-2 gap-3">
            {activeOrders.map(order => (
              <div key={order.id} onClick={() => setSelectedOrder(order)}
                className={`card p-4 cursor-pointer press hover:shadow-pop transition ${order.status === 'pending' ? 'border-gold/40' : 'border-leaf/40'}`}>
                <div className="flex justify-between items-start mb-3">
                  <Badge tone={order.status === 'pending' ? 'gold' : 'green'}>
                    {order.status === 'pending' ? <><Clock className="w-3 h-3" /> Menunggu Pembayaran</> : <><Check className="w-3 h-3" /> Lunas</>}
                  </Badge>
                  <span className="text-[10px] font-mono text-ink-faint">#{order.id.slice(-5)}</span>
                </div>
                <div className="flex gap-3.5 items-center">
                  <div className="w-14 h-14 bg-paper dark:bg-white/5 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                    {order.items[0]?.image ? <img src={order.items[0].image} className="w-full h-full object-cover" /> : <span className="font-extrabold text-ink-faint/50 text-xs">Img</span>}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-ink dark:text-ink-inv text-sm">{order.buyer}</h4>
                    <p className="text-[11px] text-ink-faint font-semibold truncate">{order.items[0].name} {order.items.length > 1 && `+ ${order.items.length - 1} lainnya`}</p>
                    <p className="font-extrabold text-flame-700 dark:text-apricot money mt-0.5">{formatIDR(order.total)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tombol validasi pesanan F&B */}
          {isFnb && (
            <div className="fixed bottom-20 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
              <button onClick={() => { localStorage.getItem('scanner_mode') === 'camera' ? setLiveScanner({ show: true, mode: 'validation' }) : triggerAlert("Gunakan Scanner Fisik Anda untuk scan QR Customer.", "success") }}
                className="pointer-events-auto animate-slide-up bg-chrome-deep hover:bg-chrome-panel text-ink-inv rounded-full pl-3 pr-5 py-3 shadow-pop flex items-center gap-3 font-extrabold text-sm transition press border border-chrome-edge">
                <span className="bg-flame-500 text-white p-2 rounded-full"><Pindai className="w-5 h-5" /></span> Validasi Pesanan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== checkout sheet (dipasang di level root agar bisa dibuka
           dari rail desktop maupun bar mobile) ===== */}
      <CartPopup showCart={showCart} setShowCart={setShowCart} cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} buyerName={buyerName} setBuyerName={setBuyerName} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} handleCheckout={handleCheckout} profile={profile} isLoading={isLoading} orderType={orderType} setOrderType={setOrderType} tableNo={tableNo} setTableNo={setTableNo} notes={notes} setNotes={setNotes} cashTendered={cashTendered} setCashTendered={setCashTendered} />

      {/* ============ DETAIL PESANAN (modal) ============ */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedOrder(null)}>
          <div className="bg-surface dark:bg-surface-dark w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-pop relative animate-pop max-h-[92vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick"><X className="w-4 h-4" /></button>
            <div className="mb-5">
              <p className="kicker">Detail Pesanan · #{selectedOrder.id.slice(-5)}</p>
              {selectedOrder.status === 'pending' ? (
                <Badge tone="gold" className="mt-1.5"><Clock className="w-3 h-3" /> Menunggu Pembayaran</Badge>
              ) : (
                <div className="inline-flex items-center gap-2 mt-1.5 text-leaf-deep dark:text-leaf">
                  <div className="w-7 h-7 rounded-full bg-leaf-soft dark:bg-leaf/15 flex items-center justify-center"><Check className="w-4 h-4 text-leaf-deep dark:text-leaf" /></div>
                  <span className="font-extrabold text-sm">Order Berhasil</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4 text-[10px] font-extrabold">
              <span className="px-2.5 py-1 rounded-lg bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf flex items-center gap-1">{getPaymentIcon(selectedOrder.paymentMethod)} {selectedOrder.paymentMethod || 'Metode -'}</span>
              {selectedOrder.buyer && <span className="px-2.5 py-1 rounded-lg bg-paper dark:bg-white/5 text-ink-soft dark:text-ink-inv/70">{selectedOrder.buyer}</span>}
              {selectedOrder.tableNo && <span className="px-2.5 py-1 rounded-lg bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick">Meja {selectedOrder.tableNo}</span>}
              {selectedOrder.orderType && <span className="px-2.5 py-1 rounded-lg bg-paper dark:bg-white/5 text-ink-soft dark:text-ink-inv/70">{selectedOrder.orderType}</span>}
            </div>

            <div className="bg-paper dark:bg-white/[.03] rounded-2xl p-4 mb-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar border border-line dark:border-line-dark">
              {selectedOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="font-bold text-ink-soft dark:text-ink-inv/80">{item.qty}x {item.name}</span>
                  <span className="font-extrabold text-ink dark:text-ink-inv money">{formatIDR(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-line dark:border-line-dark pt-2 space-y-1 text-[11px] font-bold text-ink-faint">
                <div className="flex justify-between"><span>Subtotal</span><span className="money">{formatIDR(selectedOrder.subtotal ?? selectedOrder.items.reduce((a, b) => a + b.price * b.qty, 0))}</span></div>
                {selectedOrder.discountAmt > 0 && <div className="flex justify-between text-flame-700 dark:text-apricot"><span>Diskon{selectedOrder.discPercent ? ` (${selectedOrder.discPercent}%)` : ''}</span><span className="money">- {formatIDR(selectedOrder.discountAmt)}</span></div>}
                {selectedOrder.taxAmt > 0 && <div className="flex justify-between"><span>Pajak{selectedOrder.taxPercent ? ` (${selectedOrder.taxPercent}%)` : ''}</span><span className="money">{formatIDR(selectedOrder.taxAmt)}</span></div>}
                {selectedOrder.serviceAmt > 0 && <div className="flex justify-between"><span>Servis{selectedOrder.servicePercent ? ` (${selectedOrder.servicePercent}%)` : ''}</span><span className="money">{formatIDR(selectedOrder.serviceAmt)}</span></div>}
              </div>
              <div className="border-t border-line dark:border-line-dark pt-2 flex justify-between font-extrabold text-sm text-ink dark:text-ink-inv"><span>Total</span><span className="money">{formatIDR(selectedOrder.total)}</span></div>
              {selectedOrder.paymentMethod === 'Cash' && selectedOrder.cashTendered > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-ink-faint"><span>Tunai / Kembali</span><span className="money">{formatIDR(selectedOrder.cashTendered)} / {formatIDR(selectedOrder.change || 0)}</span></div>
              )}
              {selectedOrder.notes && <div className="text-[11px] text-ink-faint italic pt-1">Catatan: {selectedOrder.notes}</div>}
              {selectedOrder.paymentMethod && selectedOrder.status !== 'paid' && getPaymentInfo(selectedOrder.paymentMethod) && (
                <div className="pt-2">{getPaymentInfo(selectedOrder.paymentMethod)}</div>
              )}
            </div>

            <div className="space-y-2">
              {selectedOrder.status === 'pending' ? (
                <>
                  <button onClick={() => confirmPayment(selectedOrder)} className="w-full bg-flame-600 hover:bg-flame-500 text-white py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 press"><Selesai className="w-4.5 h-4.5" /> Selesaikan Pesanan</button>
                  <button onClick={() => editOrder(selectedOrder)} className="w-full bg-surface dark:bg-surface-dark text-ink-soft dark:text-ink-inv/80 border border-line dark:border-line-dark hover:border-flame-300 py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 press"><Edit3 className="w-4 h-4" /> Ubah Pesanan</button>
                  <button onClick={() => setShowReceipt(selectedOrder)} className="w-full bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70 py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 press"><Receipt className="w-4 h-4" /> Cetak Struk</button>
                  <button onClick={() => cancelOrder(selectedOrder)} className="w-full bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 press"><X className="w-4 h-4" /> Batalkan Pesanan</button>
                </>
              ) : (
                <button onClick={() => setShowReceipt(selectedOrder)} className="w-full bg-flame-600 hover:bg-flame-500 text-white py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 press"><Receipt className="w-4 h-4" /> Download Struk</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceipt && <ReceiptModal order={showReceipt} profile={profile} onClose={() => setShowReceipt(null)} />}

      {/* ============ OVERLAY SCANNER ============ */}
      {liveScanner.show && (
        <div className="fixed inset-0 z-[200] bg-chrome-deep/95 flex flex-col items-center justify-center p-4 animate-fade-in">
          <h2 className="text-ink-inv font-extrabold text-xl mb-8 flex items-center gap-2"><Pindai className="w-6 h-6 text-apricot" /> Scanner WELP</h2>
          <div className="relative w-64 h-64 border-4 border-flame-400 rounded-3xl overflow-hidden shadow-pop">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-150"></video>
            <div className="absolute left-0 right-0 h-1 bg-flame-400 shadow-[0_0_15px_#F4622E] animate-scanline"></div>
            <div className="absolute inset-0 border-[40px] border-chrome-deep/60 pointer-events-none rounded-3xl"></div>
          </div>
          <p className="mt-8 text-white/80 font-bold animate-pulse text-sm">Arahkan barcode ke dalam kotak...</p>
          <button onClick={() => setLiveScanner({ show: false, mode: '' })} className="mt-10 bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-extrabold transition press">Batal / Tutup</button>
        </div>
      )}
    </div>
  );
};
