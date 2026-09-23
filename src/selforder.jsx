// ============================================================
// SELF-ORDER PELANGGAN v8 WELP — halaman ?meja=N.
// KEAMANAN BARU (anti-fraud):
//  • QR meja kini membawa token sesi unik (?k=) + tenant (?lic=).
//  • Hanya PERANGKAT PERTAMA yang memindai QR yang bisa memesan
//    (device binding di Firestore) — share link tidak berlaku.
//  • Mengubah angka meja di URL tanpa token sah → tidak bisa order.
//  • Sesi ditutup/di-reset kasir → otomatis tidak bisa order.
//  • Pesanan disinkronkan realtime ke kasir (tenants/{lic}/self_orders).
// Logika keranjang/checkout lama dipertahankan.
// ============================================================
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, setDoc, addDoc, onSnapshot, collection } from 'firebase/firestore';
import {
  Toko, Riwayat, Plus, Keranjang, WaktuReal, Qris, Edit3, Check,
  CategoryIcon, Perangkat, PerisaiBuddy, BahayaBuddy
} from './welp-icons.jsx';
import { safeParse, formatIDR, computeOrderTotals, qrUrl, db, getDeviceId } from './core.jsx';
import { CartPopup } from './pos';
import { Badge, Mascot } from './ui';

const SelfOrderApp = ({ tableNo, profile, lic, token }) => {
  const [activeTab, setActiveTab] = useState('menu');
  const [products] = useState(safeParse('product_stock_db', []));
  const [cart, setCart] = useState([]);
  const [myOrder, setMyOrder] = useState(null);
  const [showCartPopup, setShowCartPopup] = useState(false);

  const [buyerName, setBuyerName] = useState(`Meja ${tableNo}`);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showValidationQR, setShowValidationQR] = useState(false);

  // ===== SESI MEJA (anti-fraud) =====
  // status: loading | valid | device-other | closed | invalid | legacy
  const [session, setSession] = useState(lic ? { status: 'loading' } : { status: 'legacy' });

  useEffect(() => {
    if (!lic || !db) return;
    const ref = doc(db, 'tenants', lic, 'meja_sessions', String(tableNo));
    const unsub = onSnapshot(ref, snap => {
      if (!snap.exists()) { setSession({ status: 'invalid' }); return; }
      const s = snap.data();
      if (!token || s.token !== token) { setSession({ status: 'invalid' }); return; }
      if (s.open === false) { setSession({ status: 'closed' }); return; }
      const my = getDeviceId();
      if (!s.device) {
        // perangkat pertama yang scan mengklaim sesi ini
        setDoc(ref, { device: my, boundAt: Date.now() }, { merge: true }).catch(() => { });
        setSession({ status: 'valid' });
      } else if (s.device === my) {
        setSession({ status: 'valid' });
      } else {
        setSession({ status: 'device-other' });
      }
    }, err => { console.warn('[WELP meja]', err.code || err.message); setSession({ status: 'invalid' }); });
    return () => unsub();
  }, [lic, tableNo, token]);

  const canOrder = session.status === 'valid';

  // PENTING: pesanan SELF-ORDER disimpan di key TERPISAH dari pesanan Kasir/POS
  useEffect(() => {
    const orders = safeParse('self_orders_db', []);
    const existingOrder = orders.find(o => o.tableNo === tableNo);
    if (existingOrder) { setMyOrder(existingOrder); setActiveTab('status'); }
  }, [tableNo]);

  const totalTagihan = cart.reduce((a, b) => a + (b.price * b.qty), 0);
  const totalCartQty = cart.reduce((a, b) => a + b.qty, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));

    const bill = computeOrderTotals(cart);
    const newOrder = {
      id: `self_${Date.now()}`, date: new Date().toISOString(),
      buyer: buyerName, paymentMethod: paymentMethod || 'Belum dipilih',
      items: cart, subtotal: bill.subtotal, discountAmt: bill.discountAmt, taxAmt: bill.taxAmt, serviceAmt: bill.serviceAmt,
      taxPercent: bill.taxPercent, servicePercent: bill.servicePercent, discPercent: bill.discPercent,
      total: bill.total, tableNo: tableNo, orderType: 'Dine-in', notes: notes, status: 'awaiting_validation'
    };
    // Simpan ke self_orders_db (TIDAK menyentuh active_orders_db milik Kasir/POS)
    const selfOrders = safeParse('self_orders_db', []).filter(o => o.tableNo !== tableNo);
    localStorage.setItem('self_orders_db', JSON.stringify([newOrder, ...selfOrders]));
    // Sinkron ke kasir secara realtime (bila sesi berlisensi)
    if (lic && db) {
      try { await addDoc(collection(db, 'tenants', lic, 'self_orders'), { ...newOrder, deviceId: getDeviceId() }); } catch (e) { }
    }
    setMyOrder(newOrder); setCart([]); setShowCartPopup(false); setActiveTab('status');
    setIsLoading(false);
  };

  const addToCart = (p) => {
    if (!canOrder) return;
    setCart(prev => {
      const exist = prev.find(i => i.id === p.id);
      return exist ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
    });
  };
  const updateQty = (id, d) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i));
  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const available = products.filter(p => p.stock > 0);

  /* Banner status sesi (anti-fraud transparan ke pelanggan) */
  const SessionBanner = () => {
    if (session.status === 'valid') return null;
    const map = {
      loading: { tone: 'bg-gold-soft dark:bg-gold/10 text-gold-deep dark:text-gold', icon: WaktuReal, t: 'Memeriksa sesi meja...' },
      'device-other': { tone: 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick', icon: Perangkat, t: 'Meja ini sedang dipakai perangkat lain. Satu QR hanya untuk satu perangkat yang memindai.' },
      closed: { tone: 'bg-gold-soft dark:bg-gold/10 text-gold-deep dark:text-gold', icon: Qris, t: 'Sesi meja sudah ditutup kasir. Minta pelayan memindai ulang QR untuk sesi baru.' },
      invalid: { tone: 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick', icon: BahayaBuddy, t: 'QR tidak valid atau sudah di-reset. Scan ulang QR terbaru yang tertempel di meja.' },
      legacy: { tone: 'bg-gold-soft dark:bg-gold/10 text-gold-deep dark:text-gold', icon: PerisaiBuddy, t: 'Mode aman: QR ini belum memakai token sesi. Menu hanya bisa dilihat — minta QR terbaru dari kasir untuk memesan.' },
    }[session.status] || { tone: '', icon: BahayaBuddy, t: '' };
    return (
      <div className={`mx-4 mt-4 p-3.5 rounded-2xl flex items-start gap-2.5 ${map.tone}`}>
        <map.icon className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-[11.5px] font-bold leading-relaxed">{map.t}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-paper dark:bg-night text-ink dark:text-ink-inv pb-24 animate-fade-in">
      {/* header toko */}
      <div className="bg-chrome-deep px-4 pt-5 pb-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-flame-500/20 blur-2xl"></div>
        <div className="max-w-lg mx-auto flex justify-between items-center relative">
          <div>
            <p className="text-apricot/80 text-[9px] font-extrabold uppercase tracking-[0.22em]">Self-Order · Meja {tableNo}</p>
            <h1 className="font-display font-extrabold text-xl text-ink-inv tracking-tight mt-0.5">{profile.name || 'Nama Toko'}</h1>
            {canOrder && <p className="text-[9px] font-extrabold text-leaf uppercase tracking-widest mt-1 flex items-center gap-1"><PerisaiBuddy className="w-3 h-3" /> Sesi Aman Aktif</p>}
          </div>
          <Mascot pose="yuk" className="w-14 h-14 object-contain" alt="" />
        </div>
      </div>

      <SessionBanner />

      <div className="max-w-lg mx-auto px-4">
        {activeTab === 'menu' && (
          <div className="pt-5 relative min-h-[70vh]">
            <div className="flex justify-between items-end mb-4">
              <h2 className="font-extrabold tracking-tight text-lg">Menu Tersedia</h2>
              <Badge tone="green">{available.length} item</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 pb-32">
              {available.length === 0 ? (
                <div className="col-span-2 pt-10 text-center text-ink-faint">
                  <Mascot pose="bingung" className="w-24 h-24 object-contain mx-auto mb-3" alt="" />
                  <p className="font-bold text-sm">Menu belum tersedia</p>
                  <p className="text-xs mt-1">Langsung aja panggil pelayan buat pesan.</p>
                </div>
              ) : available.map(p => {
                const inCart = cart.find(i => i.id === p.id);
                const qty = inCart?.qty || 0;
                return (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={!canOrder}
                    className={`bg-surface dark:bg-surface-dark p-2.5 rounded-2xl border text-left transition-all ${!canOrder ? 'opacity-60 cursor-not-allowed' : 'press'} ${qty > 0
                      ? 'border-flame-500 ring-2 ring-flame-500/25'
                      : 'border-line dark:border-line-dark shadow-card'}`}>
                    <div className="aspect-square bg-paper dark:bg-white/[.04] rounded-xl mb-2 overflow-hidden relative">
                      {p.image ? <img src={p.image} className="w-full h-full object-cover" alt={p.name} /> : <div className="w-full h-full flex items-center justify-center"><CategoryIcon name={p.type} className="w-10 h-10 opacity-80" /></div>}
                      {qty > 0 && <span className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-flame-500 text-white text-[10px] font-extrabold flex items-center justify-center">{qty}</span>}
                    </div>
                    <h4 className="font-bold text-xs truncate mb-0.5">{p.name}</h4>
                    <div className="flex justify-between items-center">
                      <p className="text-ink dark:text-ink-inv font-extrabold text-sm money">{formatIDR(p.price)}</p>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${qty > 0 ? 'bg-flame-500 text-white' : 'bg-flame-50 dark:bg-flame-900/20 text-flame-600 dark:text-apricot'}`}><Plus className="w-3.5 h-3.5" /></span>
                    </div>
                  </button>
                );
              })}
            </div>
            {cart.length > 0 && (
              <div className="fixed bottom-20 left-0 right-0 px-4 z-30 animate-slide-up">
                <button onClick={() => setShowCartPopup(true)}
                  className="w-full max-w-md mx-auto bg-chrome-deep text-ink-inv p-3.5 pl-5 rounded-3xl shadow-pop border border-chrome-edge flex justify-between items-center press">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-2xl bg-flame-500 text-white font-extrabold text-xs flex items-center justify-center">{totalCartQty}</span>
                    <div className="text-left">
                      <span className="block text-[9px] font-extrabold uppercase tracking-widest text-ink-inv/50">Keranjang Kamu</span>
                      <span className="block text-base font-extrabold money leading-none mt-0.5">{formatIDR(totalTagihan)}</span>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 font-extrabold text-xs bg-flame-500 text-white px-4 py-2.5 rounded-2xl"><Keranjang className="w-4 h-4" /> Lihat</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'status' && (
          <div className="pt-5 space-y-4">
            {!myOrder ? (
              <div className="text-center py-20 text-ink-faint">
                <Mascot pose="pikir" className="w-24 h-24 object-contain mx-auto mb-3" alt="" />
                <p className="font-bold text-sm text-ink dark:text-ink-inv">Belum ada pesanan.</p>
                <p className="text-xs mt-1">Pilih menu lalu buat pesanan Anda.</p>
                <button onClick={() => setActiveTab('menu')} className="mt-5 px-6 py-3 rounded-2xl bg-flame-600 text-white font-extrabold text-xs press">Lihat Menu</button>
              </div>
            ) : (
              <>
                <div className="card !rounded-3xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-extrabold text-lg tracking-tight">Rincian Pesanan</h2>
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mt-0.5">Meja {myOrder.tableNo} • {(myOrder.items || []).length} item</p>
                    </div>
                    <Badge tone="gold"><WaktuReal className="w-3 h-3" /> Belum Divalidasi</Badge>
                  </div>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {(myOrder.items || []).map((i, x) => (
                      <div key={x} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-paper dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0">{i.image ? <img src={i.image} className="w-full h-full object-cover" alt={i.name} /> : <span className="font-extrabold text-ink-faint text-xs">{i.name?.[0] || '?'}</span>}</div>
                        <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{i.name}</p><p className="text-[11px] text-ink-faint money">{i.qty} x {formatIDR(i.price)}</p></div>
                        <p className="font-extrabold text-sm money">{formatIDR(i.price * i.qty)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-dashed border-line dark:border-line-dark mt-4 pt-3 space-y-1 text-xs font-bold text-ink-faint">
                    <div className="flex justify-between"><span>Subtotal</span><span className="money">{formatIDR(myOrder.subtotal)}</span></div>
                    {myOrder.discountAmt > 0 && <div className="flex justify-between text-flame-700 dark:text-apricot"><span>Diskon{myOrder.discPercent ? ` (${myOrder.discPercent}%)` : ''}</span><span className="money">- {formatIDR(myOrder.discountAmt)}</span></div>}
                    {myOrder.taxAmt > 0 && <div className="flex justify-between"><span>Pajak{myOrder.taxPercent ? ` (${myOrder.taxPercent}%)` : ''}</span><span className="money">{formatIDR(myOrder.taxAmt)}</span></div>}
                    {myOrder.serviceAmt > 0 && <div className="flex justify-between"><span>Servis{myOrder.servicePercent ? ` (${myOrder.servicePercent}%)` : ''}</span><span className="money">{formatIDR(myOrder.serviceAmt)}</span></div>}
                    {myOrder.notes && <div className="text-[11px] italic pt-1">Catatan: {myOrder.notes}</div>}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-line dark:border-line-dark">
                    <span className="font-bold text-ink-faint text-sm">Total</span>
                    <span className="font-extrabold text-2xl text-ink dark:text-ink-inv money">{formatIDR(myOrder.total)}</span>
                  </div>
                </div>

                <button onClick={() => setShowValidationQR(true)} className="w-full py-4 rounded-2xl bg-flame-600 hover:bg-flame-500 text-white font-extrabold shadow-card flex items-center justify-center gap-2 press"><Qris className="w-5 h-5" /> Validasi ke Kasir</button>
                {canOrder && (
                  <button onClick={() => { const rest = safeParse('self_orders_db', []).filter(o => o.tableNo !== tableNo); localStorage.setItem('self_orders_db', JSON.stringify(rest)); if (lic && db) { try { setDoc(doc(db, 'tenants', lic, 'meja_sessions', String(tableNo)), { device: getDeviceId(), open: true }, { merge: true }); } catch (e) { } } setMyOrder(null); setActiveTab('menu'); }} className="w-full py-3 rounded-2xl bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink-faint font-extrabold text-sm flex items-center justify-center gap-2 press"><Edit3 className="w-4 h-4" /> Ubah / Buat Ulang Pesanan</button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showValidationQR && myOrder && createPortal(
        <div className="fixed inset-0 z-[90] bg-chrome-deep/70 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowValidationQR(false)}>
          <div className="bg-surface rounded-3xl p-6 w-full max-w-xs text-center shadow-pop animate-pop" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-flame-50 text-flame-600 flex items-center justify-center mx-auto mb-3"><Qris className="w-6 h-6" /></div>
            <h3 className="font-extrabold text-lg mb-1 text-ink">Tunjukkan ke Kasir</h3>
            <p className="text-xs text-ink-faint mb-4">Kasir memindai QR ini untuk memvalidasi pesanan Anda.</p>
            <div className="bg-paper p-4 rounded-2xl border-2 border-dashed border-line dark:border-line-dark inline-block mb-4">
              <img alt="QR Pesanan" src={qrUrl("CL-ORDER:" + JSON.stringify({ t: myOrder.tableNo, b: myOrder.buyer, p: myOrder.paymentMethod, tot: myOrder.total, it: (myOrder.items || []).map(i => ({ n: i.name, q: i.qty, h: i.price })) }), 240)} width={200} height={200} className="w-[200px] h-[200px] rounded" />
            </div>
            <p className="font-extrabold text-2xl text-ink money mb-1">{formatIDR(myOrder.total)}</p>
            <p className="text-[10px] text-ink-faint mb-4">Meja {myOrder.tableNo} • {myOrder.paymentMethod}</p>
            <button onClick={() => setShowValidationQR(false)} className="w-full py-3 rounded-xl bg-paper text-ink-soft font-extrabold text-sm press">Tutup</button>
          </div>
        </div>, document.body)}

      {/* Re-use Cart Popup (Tanpa Cash) */}
      <CartPopup showCart={showCartPopup} setShowCart={setShowCartPopup} cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} buyerName={buyerName} setBuyerName={setBuyerName} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} handleCheckout={handleCheckout} profile={profile} isLoading={isLoading} orderType="Dine-in" setOrderType={() => { }} tableNo={tableNo} setTableNo={() => { }} notes={notes} setNotes={setNotes} cashTendered={0} setCashTendered={() => { }} isSelfOrder={true} />

      <div className="fixed bottom-0 left-0 right-0 bg-surface/95 dark:bg-chrome-deep/95 backdrop-blur border-t border-line dark:border-chrome-edge flex justify-around p-2 z-50 pb-safe">
        <button onClick={() => setActiveTab('menu')} className={`flex flex-col items-center p-2 w-1/2 transition press ${activeTab === 'menu' ? 'text-flame-600 dark:text-apricot' : 'text-ink-faint dark:text-ink-inv/45'}`}><Toko className="w-5 h-5" /><span className="text-[9px] font-extrabold mt-1">Buku Menu</span></button>
        <div className="w-[1px] bg-line dark:bg-chrome-edge my-2"></div>
        <button onClick={() => setActiveTab('status')} className={`flex flex-col items-center p-2 w-1/2 transition press ${activeTab === 'status' ? 'text-flame-600 dark:text-apricot' : 'text-ink-faint dark:text-ink-inv/45'}`}><Riwayat className="w-5 h-5" /><span className="text-[9px] font-extrabold mt-1">Cek Pesanan</span></button>
      </div>
    </div>
  );
};

export { SelfOrderApp };
