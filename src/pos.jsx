// ============================================================
// POS / KASIR v4 — perubahan struktur besar: panel TIKET PESANAN
// permanen di kanan (desktop) + bottom-sheet checkout (mobile).
// Logika kasir dipertahankan 100%: scanner BarcodeDetector nyata,
// materialUsage saat checkout, restore stok saat batal/edit,
// harga grosir/ojol, numpad tunai, meja & self-order.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';
import {
  Toko, WaktuReal, LayarBuddy, Search, Pindai, Plus, Trash2,
  Keranjang, RefreshCw, Selesai, Check, X, Edit3, StrukCetak,
  Uang, Qris, Dompet, PaketBuddy, OrangBuddy, RoketBuddy, QrDinamis,
  MinusCircle, ChevronDown, CategoryIcon, HapusBuddy, Tim, PerisaiBuddy,
  Ban, Undo2
} from './welp-icons.jsx';
import {
  safeParse, formatIDR, isPro, computeOrderTotals, getBizConfig,
  getPaymentIcon, useQr, buildDynamicQris, buildIntentQris, t, BRANCH_ID, db,
  auditLog, todayKey, normShifts, shiftsForBranch, shiftById, shiftOfMs,
  verifyCred, credIsLegacy, upgradeCred, pinGate, pinGateMsg,   // v15 F0
  dbSet, dbSetDoc, getDeviceId,   // v15 F1 + v21
  stockTrackingOn,   // v21.1 — inventory optional
} from './core.jsx';
import { Button, Card, Badge, EmptyState } from './ui';
// v21 — domain transaksi, sync engine, dan komponen finansial bersama
import {
  TX_STATE, txStateOf, normalizePayments, newClientTxId, newPaymentId,
  netTotalOf, refundedAmountOf, dateKeyOfMs, canVoid as canVoidTx, canRefund as canRefundTx,
} from './welp-core/tx.js';
import { commitFinanceDoc } from './welp-core/sync.js';
// v21.1 — Modifier Engine + WELP Payment Core
import {
  productMode, activeGroupsForProduct, needsModifierSheet, defaultSelection,
  validateSelection, lineUnitPrice, lineModifiersPayload, cartLineKey, modifiersLabelByGroup,
} from './welp-core/modifier.js';
import {
  MATCH_STATUS, MATCH_STATUS_META, newPaymentReference, buildSimulatedEvent, intentExpiryOf,
} from './welp-core/payment.js';
import { ingestPaymentEvent, paymentRecWithIntent } from './welp-core/paymentOps.js';
import { TxStateBadge, SyncPill, ShiftPanel, VoidModal, RefundModal, permsOfSession, commitOrder } from './txactions.jsx';

// v15.3: QR pembayaran di-generate lokal (data URL, tanpa layanan luar)
// agar checkout QRIS tidak bergantung kecepatan layanan pihak ketiga.
const QrPay = ({ text, size = 320, cls = '', alt = '' }) => {
  const qr = useQr(text, size);
  if (!qr) return <div className={cls + ' bg-white animate-pulse'} />;
  return <img src={qr} className={cls} alt={alt} />;
};

/* ---------- PILIH TIER HARGA (Pro) ---------- */
export const PremiumPriceSelector = ({ currentTier, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const tiers = [
    { id: 'retail', label: 'Harga Ecer', icon: OrangBuddy, color: 'text-ink-soft', bg: 'bg-paper dark:bg-white/10' },
    { id: 'grosir', label: 'Harga Grosir', icon: PaketBuddy, color: 'text-ink-soft', bg: 'bg-paper dark:bg-white/10' },
    { id: 'ojol', label: 'Harga App Online', icon: RoketBuddy, color: 'text-gold-deep dark:text-gold', bg: 'bg-gold-soft dark:bg-gold/15' }
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
  const code = String(order.id || 'WELP0000').slice(-8).toUpperCase() || 'WELP0000';
  const method = order.paymentMethod || '-';
  const isCash = method === 'Cash';
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-chrome-deep/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-[390px] rounded-[1.5rem] shadow-pop overflow-hidden animate-pop" onClick={e => e.stopPropagation()}>
        <div id="receipt-print" className="receipt-paper p-5 sm:p-6 text-slate-900 text-[11px] leading-relaxed">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="min-w-0">
              {profile?.logo ? <img src={profile.logo} className="w-11 h-11 object-contain rounded-xl border border-slate-200 mb-2" alt="Logo" /> : <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm mb-2">W</div>}
              <h2 className="font-black text-[15px] tracking-tight truncate">{profile?.name || 'TOKO ANDA'}</h2>
              {profile?.address && <p className="text-[9px] text-slate-500 mt-0.5 max-w-[220px] leading-snug">{profile.address}</p>}
              {(profile?.wa || profile?.phone) && <p className="text-[9px] text-slate-500">{profile.wa || profile.phone}</p>}
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-[.14em]">Lunas</span>
              <p className="font-mono font-black text-[10px] mt-2">#{code}</p>
              <p className="text-[8.5px] text-slate-500 mt-0.5">{new Date(order.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 py-3 border-b border-dashed border-slate-300">
            <div><p className="text-[7.5px] uppercase tracking-[.16em] font-black text-slate-400">Pelanggan</p><p className="font-bold text-[10px] truncate">{order.buyer || 'Umum'}</p></div>
            <div className="text-right"><p className="text-[7.5px] uppercase tracking-[.16em] font-black text-slate-400">Pesanan</p><p className="font-bold text-[10px]">{order.orderType || 'Take away'}{order.tableNo ? ` · Meja ${order.tableNo}` : ''}</p></div>
          </div>

          <div className="py-3 space-y-2">
            {order.items.map((i, x) => (
              <div key={x} className="grid grid-cols-[1fr_auto] gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[10.5px] leading-snug break-words">{i.name}</p>
                  {/* v21.1 — modifier tersimpan di line item & tampil di struk */}
                  {(i.modifiers || []).length > 0 && modifiersLabelByGroup(i.modifiers).map((lbl, mi) => (
                    <p key={mi} className="text-[8.5px] text-slate-500 font-semibold leading-tight">+ {lbl}</p>
                  ))}
                  <p className="text-[9px] text-slate-500 mt-0.5">{i.qty} × {formatIDR(i.price)}</p>
                </div>
                <p className="font-bold text-[10.5px] text-right">{formatIDR(i.price * i.qty)}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
            {order.discountAmt > 0 && <div className="flex justify-between"><span>Diskon{order.discPercent ? ` (${order.discPercent}%)` : ''}</span><span>- {formatIDR(order.discountAmt)}</span></div>}
            {order.taxAmt > 0 && <div className="flex justify-between"><span>Pajak{order.taxPercent ? ` (${order.taxPercent}%)` : ''}</span><span>{formatIDR(order.taxAmt)}</span></div>}
            {order.serviceAmt > 0 && <div className="flex justify-between"><span>Servis{order.servicePercent ? ` (${order.servicePercent}%)` : ''}</span><span>{formatIDR(order.serviceAmt)}</span></div>}
            <div className="flex justify-between items-end pt-2 mt-1 border-t border-slate-200"><span className="font-black uppercase tracking-[.12em] text-[8px]">Total</span><span className="font-black text-[17px] tracking-tight">{formatIDR(order.total)}</span></div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-dashed border-slate-300">
            <div><p className="text-[7.5px] uppercase tracking-[.16em] font-black text-slate-400">Pembayaran</p><p className="font-black text-[11px] mt-0.5">{method}</p></div>
            {isCash && <div className="text-right text-[9px]"><p>Bayar {formatIDR(order.cashTendered || order.total)}</p><p className="font-black">Kembali {formatIDR(order.change || 0)}</p></div>}
          </div>
          {/* v21.1 WELP Payment Core — paymentReference unik (bukan nominal) */}
          {(order.payments || []).some(p => p.paymentReference) && (
            <div className="py-2 text-[8px] text-slate-400 font-mono break-all">
              Ref: {(order.payments.find(p => p.paymentReference) || {}).paymentReference}
            </div>
          )}

          <div className="pt-4 text-center">
            <div className="receipt-code mx-auto mb-2" aria-label={`Kode transaksi ${code}`}>
              {Array.from({length: 24}, (_, i) => <i key={i} style={{height: `${10 + ((i * 7 + code.charCodeAt(i % Math.max(1, code.length))) % 15)}px`}} />)}
            </div>
            <p className="font-black text-[10px]">Terima kasih sudah belanja.</p>
            <p className="text-[8.5px] text-slate-400 mt-0.5">Simpan struk ini sebagai bukti transaksi.</p>
          </div>
        </div>
        <div className="no-print p-3 bg-surface dark:bg-surface-dark border-t border-line dark:border-line-dark flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-paper dark:bg-white/10 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/80 font-bold text-xs">Tutup</button>
          <button type="button" onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl bg-flame-600 hover:bg-flame-500 text-white font-bold text-xs flex items-center justify-center gap-2"><StrukCetak className="w-4 h-4" /> Cetak / PDF</button>
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
/* ============================================================
   QUICK CASHIER MODE — keypad tunai yang menyatu dgn pembayaran.
   hierarchy: angka netral, koreksi amber, hapus merah lembut,
   BAYAR oranye solid WELP. Nominal terhubung langsung ke state
   transaksi (cashTendered) — bukan kalkulator berdiri sendiri.
   ============================================================ */
const QUICK_ADDS = [
  { label: '+5rb', val: 5000 }, { label: '+10rb', val: 10000 },
  { label: '+20rb', val: 20000 }, { label: '+50rb', val: 50000 },
  { label: '+100rb', val: 100000 },
];

export const CartPopup = ({ showCart, setShowCart, cart, updateQty, removeFromCart, buyerName, setBuyerName, paymentMethod, setPaymentMethod, handleCheckout, profile, isLoading, orderType, setOrderType, tableNo, setTableNo, notes, setNotes, cashTendered, setCashTendered, isSelfOrder = false, qrisReference = null }) => {
  const bill = computeOrderTotals(cart);
  const grandTotal = bill.total;
  const bizMode = localStorage.getItem('biz_mode') || 'retail';
  // v21 payment-first: Tunai/QRIS utama, sisanya di balik "Lainnya".
  const [showOther, setShowOther] = useState(false);      // sub-daftar metode lain
  const [showItems, setShowItems] = useState(cart.length <= 4);   // daftar item collapsible
  const [showOpts, setShowOpts] = useState(false);        // opsi pesanan (progressive disclosure)

  // sumber tunggal nominal tunai: string digit → number di state induk.
  const [cashStr, setCashStr] = useState('');
  useEffect(() => { setCashTendered(Number(cashStr || 0)); }, [cashStr]);
  // ganti metode dari Cash → bersihkan nominal tunai sementara (no stale state)
  useEffect(() => { if (paymentMethod && paymentMethod !== 'Cash') setCashStr(''); }, [paymentMethod]);
  // transaksi baru selalu mulai dari nol
  useEffect(() => { if (showCart && !cashTendered) setCashStr(''); }, [showCart]);

  const pressDigit = (d) => setCashStr(prev => {
    const next = (prev === '0' ? '' : prev) + d;
    return next.length > 9 ? prev : next;            // batas aman 999.999.999
  });
  const press00 = () => setCashStr(prev => {
    if (!prev || prev === '0') return prev;
    return prev.length + 2 > 9 ? prev : prev + '00';
  });
  const pressBack = () => setCashStr(prev => prev.slice(0, -1));
  const pressClear = () => setCashStr('');
  const setExact = () => setCashStr(String(grandTotal));
  const quickAdd = (n) => setCashStr(prev => {
    const next = Number(prev || 0) + n;
    return next > 999999999 ? prev : String(next);
  });

  // keyboard fisik tetap jalan (kecuali saat mengetik di input teks)
  useEffect(() => {
    if (!showCart || paymentMethod !== 'Cash' || isSelfOrder) return;
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key >= '0' && e.key <= '9') { pressDigit(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { pressBack(); e.preventDefault(); }
      else if (e.key === 'Escape' || e.key === 'Delete') pressClear();
      else if (e.key === 'Enter' && cart.length > 0 && Number(cashStr || 0) >= grandTotal && !isLoading) handleCheckout();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCart, paymentMethod, cashStr, grandTotal, isLoading, cart.length]);

  if (!showCart) return null;
  const canPay = cart.length > 0 && !isLoading && !!paymentMethod && !(paymentMethod === 'Cash' && cashTendered < grandTotal);
  const cashEnough = cashTendered >= grandTotal && grandTotal > 0;

  // v21.1 — QR dinamis + paymentReference (tag 62/07) utk matching engine.
  // Reference unik per sesi keranjang — nominal sama antar order TIDAK
  // menghasilkan QR yang sama.
  const dynQris = paymentMethod === 'QRIS' && profile.payment?.qrisPayload ? buildIntentQris(profile.payment.qrisPayload, grandTotal, qrisReference) : null;
  const otherMethods = isSelfOrder
    ? [...(profile.payment?.ewallets?.map(w => w.type) || []), ...(profile.payment?.bank?.map(b => b.bank) || [])]
    : [...(profile.payment?.ewallets?.map(w => w.type) || []), ...(profile.payment?.bank?.map(b => b.bank) || []), 'Split Bill'];
  const hasOpts = !!(buyerName || tableNo || notes || (bizMode === 'fnb' && orderType === 'Dine-in'));
  const payBtnLabel = !paymentMethod ? 'Pilih Metode Pembayaran'
    : (paymentMethod === 'Cash' && !isSelfOrder && cashEnough) ? `BAYAR · kembalian ${formatIDR(cashTendered - grandTotal)}`
      : `BAYAR · ${formatIDR(grandTotal)}`;

  // palet Quick Cashier Mode (light / dark) — angka netral, aksi oranye
  const keyCls = 'py-3.5 sm:py-4 rounded-xl text-lg sm:text-xl font-extrabold select-none transition-all active:scale-95 press border bg-white dark:bg-[#272A2E] text-[#1D1D1B] dark:text-[#F5F5F2] border-[#E1E1DD] dark:border-[#34383D] hover:bg-[#F1F1EE] dark:hover:bg-[#30343A] active:bg-[#E7E7E3] dark:active:bg-[#383C42]';
  const backCls = 'bg-[#FFF6E8] dark:bg-[#3A3021] text-[#A86200] dark:text-[#F2BD6B] border-[#F0E4D0] dark:border-[#4A4030] hover:bg-[#FDEED3] dark:hover:bg-[#463B29]';
  const chipCls = 'shrink-0 px-3 py-1.5 rounded-full text-[10.5px] font-extrabold border transition-all active:scale-95 press bg-white dark:bg-[#272A2E] text-[#1D1D1B]/70 dark:text-[#F5F5F2]/70 border-[#E1E1DD] dark:border-[#34383D] hover:border-flame-400 active:bg-flame-50 dark:active:bg-flame-900/40 active:text-flame-600 dark:active:text-[#FF9A5C]';
  const segCls = (on) => `flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-extrabold transition-all press ${on ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv'}`;

  return (
    <div className="fixed inset-0 z-[100] bg-chrome-deep/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={() => setShowCart(false)}>
      <div className="bg-surface dark:bg-surface-dark w-full sm:w-[480px] rounded-t-3xl sm:rounded-3xl shadow-pop relative flex flex-col max-h-[94vh] overflow-hidden animate-pop"
        onClick={e => e.stopPropagation()}>

        {/* ===== HEADER: identitas checkout + TOTAL (fokus utama) ===== */}
        <div className="px-4 pt-4 pb-3 bg-chrome-deep text-ink-inv shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center"><Keranjang className="w-4.5 h-4.5 text-apricot" /></div>
              <div>
                <p className="text-apricot/80 text-[9px] font-extrabold uppercase tracking-[0.2em]">Checkout</p>
                <p className="font-extrabold text-xs leading-none mt-0.5">{cart.length} item siap dibayar</p>
              </div>
            </div>
            <button onClick={() => setShowCart(false)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition"><X className="w-4 h-4" /></button>
          </div>
          <div key={grandTotal} className="mt-3 flex items-end justify-between animate-pop">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-white/50">Total Tagihan</span>
            <span className="text-[30px] leading-none font-extrabold money tracking-tight">{formatIDR(grandTotal)}</span>
          </div>
        </div>

        {/* ===== METODE PEMBAYARAN: Tunai · QRIS · Lainnya ===== */}
        <div className="px-4 py-3 border-b border-line/70 dark:border-line-dark/70 shrink-0 bg-surface dark:bg-surface-dark">
          <div className="flex gap-1.5 bg-paper dark:bg-white/[.04] p-1 rounded-2xl border border-line dark:border-line-dark">
            {!isSelfOrder && (
              <button onClick={() => setPaymentMethod('Cash')} className={segCls(paymentMethod === 'Cash')}>
                <Uang className="w-4 h-4" /> Tunai
              </button>
            )}
            <button onClick={() => setPaymentMethod('QRIS')} className={segCls(paymentMethod === 'QRIS')}>
              <Qris className="w-4 h-4" /> QRIS
            </button>
            <button onClick={() => { setShowOther(v => !v); }} className={`${segCls(paymentMethod !== '' && paymentMethod !== 'Cash' && paymentMethod !== 'QRIS')} ${paymentMethod && paymentMethod !== 'Cash' && paymentMethod !== 'QRIS' ? '' : ''}`}>
              Lainnya <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOther ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showOther && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 pt-2 custom-scrollbar no-scrollbar animate-rise">
              {otherMethods.length === 0 && <p className="text-[10px] font-bold text-ink-faint px-1">Belum ada metode lain. Tambahkan e-wallet/bank di menu Metode Pembayaran.</p>}
              {otherMethods.map(m => (
                <button key={m} onClick={() => { setPaymentMethod(m); setShowOther(false); }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border shrink-0 transition-all press ${paymentMethod === m
                    ? 'bg-flame-600 border-flame-600 text-white shadow-card'
                    : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70'}`}>
                  {getPaymentIcon(m)} <span className="text-[11px] font-extrabold">{m}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===== KONTEN SESUAI METODE (scroll) ===== */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-paper/60 dark:bg-white/[.02]">

          {/* --- TUNAI: Quick Cashier Mode (keypad, Uang Pas, kembalian) --- */}
          {paymentMethod === 'Cash' && !isSelfOrder && (
            <div className="m-3 rounded-2xl overflow-hidden border border-[#E1E1DD] dark:border-[#34383D] bg-[#F6F6F4] dark:bg-[#151719] animate-fade-in">
              <div className="px-3.5 pt-3 pb-3 bg-[#ECEDEA] dark:bg-[#1D2023] border-b border-[#E1E1DD] dark:border-[#34383D]">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#1D1D1B]/55 dark:text-[#F5F5F2]/50">Uang Diterima</p>
                  <p className="text-[10.5px] font-extrabold text-flame-700 dark:text-apricot">Total {formatIDR(grandTotal)}</p>
                </div>
                <div className={`mt-2.5 rounded-xl px-4 py-2.5 text-center border ${cashEnough ? 'bg-[#FFF0E5] dark:bg-[#3A281F] border-flame-200 dark:border-flame-900/60' : 'bg-[#F6F6F4] dark:bg-[#151719] border-[#E1E1DD] dark:border-[#34383D]'}`}>
                  <p className={`text-[26px] font-extrabold money leading-none ${cashEnough ? 'text-flame-700 dark:text-apricot' : 'text-[#1D1D1B] dark:text-[#F5F5F2]'}`}>{formatIDR(cashTendered)}</p>
                  <div className="mt-1.5 min-h-[17px]">
                    {cashEnough ? (
                      <p className="text-[11.5px] font-extrabold text-flame-700 dark:text-apricot">Kembalian {formatIDR(cashTendered - grandTotal)}</p>
                    ) : cashTendered > 0 ? (
                      <p className="text-[11.5px] font-extrabold text-[#C83B3B] dark:text-[#FF8B8B]">Kurang {formatIDR(grandTotal - cashTendered)}</p>
                    ) : (
                      <p className="text-[10px] font-bold text-[#1D1D1B]/40 dark:text-[#F5F5F2]/35">Masukkan nominal uang yang diterima</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar pb-0.5">
                  <button onClick={setExact} className={`${chipCls} ${cashTendered === grandTotal && grandTotal > 0 ? '!bg-flame-50 dark:!bg-flame-900/40 !text-flame-600 dark:!text-apricot !border-flame-300 dark:!border-[#5A3A22]' : ''}`}>
                    <Selesai className="w-3 h-3 inline -mt-0.5" /> Uang Pas
                  </button>
                  {QUICK_ADDS.map(q => (
                    <button key={q.val} onClick={() => quickAdd(q.val)} className={chipCls}>{q.label}</button>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-[#ECEDEA] dark:bg-[#1D2023] grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
                  <button key={n} onClick={() => pressDigit(n)} className={keyCls} aria-label={n}>{n}</button>
                ))}
                <button onClick={pressClear} className={`${keyCls} !bg-[#FFF0F0] dark:!bg-[#3A2526] !text-[#C83B3B] dark:!text-[#FF8B8B] !border-[#F5D5D5] dark:!border-[#4A3031] !text-base hover:!bg-[#FCE4E4] dark:hover:!bg-[#462D2E]`} aria-label="Hapus semua">C</button>
                <button onClick={() => pressDigit('0')} className={keyCls} aria-label="0">0</button>
                <button onClick={pressBack} className={`${keyCls} ${backCls}`} aria-label="Hapus satu angka"><HapusBuddy className="w-5 h-5 mx-auto" /></button>
                <button onClick={press00} className={`${keyCls} col-span-3 !py-3 text-base`} aria-label="Tambah dua nol">00</button>
              </div>
            </div>
          )}

          {/* --- QRIS: QR dinamis/statis inline, pelanggan tinggal scan --- */}
          {paymentMethod === 'QRIS' && (
            <div className="m-3 p-4 rounded-2xl bg-surface dark:bg-surface-dark border border-line dark:border-line-dark flex flex-col items-center animate-fade-in">
              {dynQris ? (
                <>
                  <div className="relative bg-white p-2 rounded-2xl border-2 border-flame-200 shadow-card">
                    <QrPay text={dynQris} size={280} cls="w-40 h-40" alt="QRIS Dinamis" />
                    <span className="absolute -top-2.5 -right-2 flex items-center gap-1 bg-flame-600 text-white text-[8px] font-extrabold px-2 py-1 rounded-full shadow-card"><QrDinamis className="w-3 h-3" /> DINAMIS</span>
                  </div>
                  <p className="text-base mt-2.5 text-flame-700 dark:text-apricot font-extrabold money">{formatIDR(grandTotal)}</p>
                  <p className="text-[10px] mt-0.5 text-ink-faint font-bold text-center">Pelanggan scan — nominal terisi otomatis.<br />Setelah dibayar, tekan BAYAR untuk menutup transaksi.</p>
                </>
              ) : profile.payment?.qris ? (
                <>
                  <img src={profile.payment.qris} className="w-44 h-44 object-contain bg-white p-2 rounded-xl border" alt="QRIS Toko" />
                  <p className="text-[11px] mt-2 text-ink-faint font-bold text-center">QRIS statis. Pelanggan scan lalu isi nominal<br />{formatIDR(grandTotal || 0)} secara manual.</p>
                </>
              ) : (
                <p className="text-xs text-ink-faint font-bold py-4">Belum ada QRIS. Atur dulu di menu Metode Pembayaran.</p>
              )}
            </div>
          )}

          {/* --- METODE LAIN: tampilkan nomor tujuan / info --- */}
          {paymentMethod && paymentMethod !== 'Cash' && paymentMethod !== 'QRIS' && (
            <div className="m-3 p-4 rounded-2xl bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-center animate-fade-in">
              <p className="font-extrabold text-ink-soft dark:text-ink-inv/80 text-sm">{paymentMethod}</p>
              {(() => {
                const w = profile.payment?.ewallets?.find(x => x.type === paymentMethod);
                const b = profile.payment?.bank?.find(x => x.bank === paymentMethod);
                return (w?.number || b?.number)
                  ? <p className="text-xl font-extrabold mt-1 select-all text-ink dark:text-ink-inv money">{w?.number || b?.number}</p>
                  : <p className="text-[11px] text-ink-faint font-bold mt-1">Terima pembayaran {paymentMethod} sebesar {formatIDR(grandTotal)}, lalu tekan BAYAR.</p>;
              })()}
            </div>
          )}

          {!paymentMethod && (
            <p className="m-3 px-4 py-5 rounded-2xl border border-dashed border-line dark:border-line-dark text-center text-[11px] font-bold text-ink-faint animate-fade-in">
              Pilih metode pembayaran di atas. Tunai & QRIS paling cepat; metode lain tersedia di <span className="text-ink-soft dark:text-ink-inv/70">Lainnya</span>.
            </p>
          )}

          {/* --- ITEM PESANAN (collapsible) --- */}
          <div className="mx-3 mb-3 rounded-2xl bg-surface dark:bg-surface-dark border border-line dark:border-line-dark overflow-hidden">
            <button onClick={() => setShowItems(v => !v)} className="w-full px-4 py-3 flex justify-between items-center press">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">Item Pesanan ({cart.length})</span>
              <span className="flex items-center gap-2 text-xs font-extrabold text-ink-soft dark:text-ink-inv/70 money">{formatIDR(bill.subtotal)} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showItems ? 'rotate-180' : ''}`} /></span>
            </button>
            {showItems && (
              <div className="px-4 pb-3 space-y-2 animate-rise">
                {cart.map(i => (
                  <div key={i.lineId || i.id} className="flex gap-3 items-center bg-paper dark:bg-white/[.04] p-2 pr-3 rounded-xl border border-line/70 dark:border-line-dark/70 animate-slide-in-right">
                    <div className="w-10 h-10 bg-paper dark:bg-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                      {i.image ? <img src={i.image} className="w-full h-full object-cover" /> : <span className="font-extrabold text-ink-faint">{i.name?.[0] || '?'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[12px] truncate text-ink dark:text-ink-inv">{i.name}</p>
                      {(i.modifiers || []).length > 0 && modifiersLabelByGroup(i.modifiers).map((lbl, mi) => (
                        <p key={mi} className="text-[9px] font-bold text-flame-700/80 dark:text-apricot/80 truncate">+ {lbl}</p>
                      ))}
                      <p className="text-[10.5px] font-extrabold text-ink-faint money">{formatIDR(i.price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface dark:bg-surface-dark p-1 rounded-lg border border-line dark:border-line-dark">
                      <button onClick={() => updateQty(i.lineId || i.id, -1)} className="w-7 h-7 bg-surface dark:bg-surface-dark rounded-md shadow-sm text-xs font-extrabold hover:text-brick transition">−</button>
                      <span key={i.qty} className="text-xs font-extrabold w-4 text-center text-ink dark:text-ink-inv animate-num">{i.qty}</span>
                      <button onClick={() => updateQty(i.lineId || i.id, 1)} className="w-7 h-7 bg-surface dark:bg-surface-dark rounded-md shadow-sm text-xs font-extrabold hover:text-flame-600 dark:hover:text-apricot transition">+</button>
                    </div>
                    <button onClick={() => removeFromCart(i.lineId || i.id)} className="text-ink-faint hover:text-brick transition px-0.5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="pt-2 space-y-1.5 border-t border-dashed border-line dark:border-line-dark">
                  <div className="flex justify-between text-xs font-bold text-ink-faint"><span>{t('subtotal')}</span><span className="money">{formatIDR(bill.subtotal)}</span></div>
                  {bill.discountAmt > 0 && <div className="flex justify-between text-xs font-extrabold text-flame-700 dark:text-apricot"><span>{t('disc')} ({bill.discPercent}%)</span><span className="money">- {formatIDR(bill.discountAmt)}</span></div>}
                  {bill.taxAmt > 0 && <div className="flex justify-between text-xs font-bold text-ink-faint"><span>{t('tax')} ({bill.taxPercent}%)</span><span className="money">{formatIDR(bill.taxAmt)}</span></div>}
                  {bill.serviceAmt > 0 && <div className="flex justify-between text-xs font-bold text-ink-faint"><span>{t('service')} ({bill.servicePercent}%)</span><span className="money">{formatIDR(bill.serviceAmt)}</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* --- OPSI PESANAN (progressive disclosure) --- */}
          {isSelfOrder ? (
            <div className="mx-3 mb-3">
              <input type="text" placeholder="Catatan Pesanan (Opsional)..." value={notes} onChange={e => setNotes(e.target.value)} className="field" />
            </div>
          ) : (
            <div className="mx-3 mb-3 rounded-2xl bg-surface dark:bg-surface-dark border border-line dark:border-line-dark overflow-hidden">
              <button onClick={() => setShowOpts(v => !v)} className="w-full px-4 py-3 flex justify-between items-center press">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint flex items-center gap-1.5">Opsi Pesanan
                  {hasOpts && <span className="w-1.5 h-1.5 rounded-full bg-flame-500" />}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-ink-faint transition-transform ${showOpts ? 'rotate-180' : ''}`} />
              </button>
              {showOpts && (
                <div className="px-4 pb-3.5 space-y-2.5 animate-rise">
                  <input className="field" placeholder="Nama Pelanggan (Opsional)" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
                  {bizMode === 'fnb' && (
                    <div className="flex gap-2">
                      <div className="flex bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark p-1 rounded-xl w-1/2 shrink-0">
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
              )}
            </div>
          )}
        </div>

        {/* ===== FOOTER: SATU tombol BAYAR (selalu terlihat) ===== */}
        <div className="p-4 bg-surface dark:bg-surface-dark border-t border-line/70 dark:border-line-dark/70 shrink-0">
          <button onClick={handleCheckout} disabled={!canPay}
            className={`w-full py-4 rounded-2xl font-extrabold text-base transition-all active:scale-[.98] flex items-center justify-center gap-2 press ${canPay
              ? 'bg-[#F26A21] hover:bg-[#F4772E] dark:bg-flame-600 dark:hover:bg-flame-500 text-white shadow-card'
              : 'bg-paper dark:bg-white/5 text-ink-faint cursor-not-allowed'}`}>
            {isLoading ? <><RefreshCw className="w-5 h-5 animate-spin" /> Memproses...</> : <><Selesai className="w-5 h-5" /> {payBtnLabel}</>}
          </button>
          {paymentMethod === 'Cash' && !isSelfOrder && !cashEnough && cashTendered > 0 && (
            <p className="text-center text-[10px] font-bold text-[#C83B3B] dark:text-[#FF8B8B] mt-2">Nominal belum cukup. Tambah lewat keypad atau pilih Uang Pas.</p>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   STATION KASIR GATE — identifikasi personal di POS Station.
   Station tetap aktif di monitor; tiap kasir login pribadi dgn
   PIN miliknya (dibuat di Manajemen Karyawan). Transaksi lalu
   tercatat: station_id + branch_id + employee_id + shift_id.
   ============================================================ */
const StationKasirGate = ({ licenseInfo, onClose, triggerAlert }) => {
  const staff = safeParse('karyawan_db', []).filter(e => (e.branchId || 'PUSAT') === (licenseInfo.branchId || 'PUSAT') && e.status !== 'nonaktif');
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

  // Shift aktif kasir (v12): penugasan owner dulu, lalu deteksi jam
  // dari shift cabang. Shift ikut tercatat di setiap transaksi.
  const shiftOfEmployee = (e) => {
    const pusat = normShifts((safeParse('pengaturan_db', []).find(s => s.key === 'shift_pusat') || {}).shifts);
    const shs = shiftsForBranch(licenseInfo.branchId || 'PUSAT', safeParse('cabang_db', []), pusat);
    return (e?.shiftId ? shiftById(shs, e.shiftId) : null) || shiftOfMs(shs, Date.now());
  };

  const confirm = async () => {
    if (!sel) return;
    // v15 F0: PIN pribadi kasir diverifikasi hash cred (fallback plaintext
    // legacy + upgrade) + gate percobaan per perangkat.
    const gateKey = `kasir:${licenseInfo.id}:${licenseInfo.stationCode || 'POS'}:${sel.cid}`;
    const st = pinGate.status(gateKey);
    if (st.locked) { setErr(pinGateMsg(st)); setPin(''); return; }
    if ((sel.pin != null || sel.cred) && !(await verifyCred(pin, sel, 'pin'))) {
      const gst = pinGate.fail(gateKey);
      setErr(gst.locked ? pinGateMsg(gst) : 'PIN salah!');
      setPin(''); return;
    }
    pinGate.reset(gateKey);
    if (credIsLegacy(sel)) upgradeCred(['tenants', licenseInfo.id, 'karyawan', sel.cid], pin, 'pin');
    try {
      const sh = shiftOfEmployee(sel);
      const saved = JSON.parse(localStorage.getItem('app_license') || '{}');
      saved.employeeCid = sel.cid;
      saved.employeeId = sel.empId || '';
      saved.employeeName = sel.name;
      saved.shiftId = sh ? `${licenseInfo.stationCode || 'POS'}-${sh.nama}-${todayKey()}` : `${licenseInfo.stationCode || 'POS'}-${sel.cid.slice(-4)}-${todayKey()}`;
      saved.shiftNama = sh?.nama || null;
      localStorage.setItem('app_license', JSON.stringify(saved));
      auditLog(licenseInfo, 'STATION_KASIR_LOGIN', { target: sel.cid, kasir: sel.name, shift: sh?.nama || null }, { actor: sel.name, actorRole: sel.role || 'kasir' });
      window.dispatchEvent(new Event('welp_session_update'));
      triggerAlert(`Siap, ${sel.name}!${sh ? ` Shift ${sh.nama} (${sh.mulai} s/d ${sh.selesai}).` : ''}`, 'success');
      onClose();
    } catch (e) { setErr('Gagal menyimpan sesi kasir.'); }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
  return (
    <div className="fixed inset-0 z-[150] bg-chrome-deep/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-surface dark:bg-surface-dark rounded-3xl shadow-pop p-5 animate-pop max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-9 h-9 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center"><Tim className="w-4.5 h-4.5" /></span>
          <div>
            <p className="font-extrabold text-[15px] text-ink dark:text-ink-inv">Kasir aktif di {licenseInfo.stationCode || 'Station'}</p>
            <p className="text-[10px] font-bold text-ink-faint">Pilih namamu, lalu masukkan PIN pribadi</p>
          </div>
        </div>

        {err && <p className="mt-3 px-3.5 py-2.5 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-xs font-bold">{err}</p>}

        {!sel ? (
          staff.length === 0 ? (
            <div className="py-6 text-center">
              <Tim className="w-9 h-9 text-ink-faint/40 mx-auto mb-2" />
              <p className="text-xs font-bold text-ink-faint">Belum ada karyawan di cabang ini. Tambahkan dulu di Manajemen Karyawan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {staff.map(e => (
                <button key={e.cid} onClick={() => { setSel(e); setPin(''); setErr(''); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 border-line dark:border-line-dark bg-paper dark:bg-white/5 hover:border-flame-400 transition press">
                  <span className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold">{e.name?.[0]}</span>
                  <span className="font-extrabold text-[12px] text-ink dark:text-ink-inv truncate max-w-full">{e.name}</span>
                  <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-ink-faint">{e.empId || 'ID belum ada'}</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="mt-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-flame-50 dark:bg-flame-900/25 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-2xl bg-flame-600 text-white flex items-center justify-center font-extrabold shrink-0">{sel.name?.[0]}</span>
                <div className="min-w-0"><p className="font-extrabold text-sm truncate">{sel.name}</p><p className="text-[9.5px] font-bold text-ink-faint uppercase tracking-wider">{sel.empId || 'PIN belum diatur Owner'}</p></div>
              </div>
              <button onClick={() => { setSel(null); setPin(''); }} className="text-[10px] font-extrabold text-ink-faint hover:text-ink-soft transition shrink-0">Ganti</button>
            </div>
            {sel.pin ? (
              <>
                <div className="flex gap-2 justify-center mb-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`w-8 h-10 rounded-xl border-2 flex items-center justify-center ${i < pin.length ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25' : 'border-line dark:border-line-dark'}`}>
                      {i < pin.length && <div className="w-2 h-2 rounded-full bg-flame-500" />}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {keys.map(k => k === 'del'
                    ? <button key={k} onClick={() => setPin(p => p.slice(0, -1))} className="py-3 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick font-extrabold active:scale-95 press"><HapusBuddy className="w-4.5 h-4.5 mx-auto" /></button>
                    : k === 'go'
                      ? <button key={k} onClick={confirm} disabled={pin.length < 6} className="py-3 rounded-xl bg-flame-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 press"><Check className="w-5 h-5" /></button>
                      : <button key={k} onClick={() => setPin(p => (p.length < 6 ? p + k : p))} className="py-3 rounded-xl bg-paper dark:bg-white/5 text-ink dark:text-ink-inv text-lg font-extrabold active:scale-95 press">{k}</button>)}
                </div>
              </>
            ) : (
              <div className="text-center py-3">
                <p className="text-[11px] font-bold text-ink-faint mb-3">Kasir ini belum punya PIN pribadi. Transaksi tetap tercatat atas namanya, tapi minta Owner mengatur PIN di Manajemen Karyawan biar aman.</p>
                <Button onClick={confirm} className="w-full py-3.5">Lanjut sebagai {sel.name}</Button>
              </div>
            )}
          </div>
        )}

        <button onClick={onClose} className="w-full mt-3 py-2.5 text-[11px] font-extrabold text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv transition">
          {licenseInfo?.employeeName ? 'Tutup' : 'Nanti saja'}
        </button>
      </div>
    </div>
  );
};

/* ============================================================
   POS TAB
   ============================================================ */
/* ============================================================
   MODIFIER SHEET (v21.1, spec #8) — CONFIGURABLE PRODUCT:
   TAP → Modifier Sheet → Pilih → Tambah Cart.
   • Anchor-aware spring (muncul dari konteks interaksi, bukan fade)
   • Grup required/min/max divalidasi — tombol mati + alasan jelas
   • Harga live: base + Σ priceDelta (lihat total SEBELUM tambah)
   • Tidak ada SKU baru — line menyimpan modifiers[]
   ============================================================ */
export const ModifierSheet = ({ product, groups, onClose, onAdd }) => {
  const active = activeGroupsForProduct(product, groups);
  const [sel, setSel] = useState(() => defaultSelection(active));
  const [qty, setQty] = useState(1);
  const [errShake, setErrShake] = useState(false);
  const validation = validateSelection(active, sel);
  const unit = lineUnitPrice(product?.price ?? 0, active, sel);
  const total = unit * qty;
  const firstError = validation.errors[0];

  const pick = (g, opt) => {
    setSel(prev => {
      const cur = selectedIds(prev, g.id);
      if (!g.multi) return { ...prev, [g.id]: opt.id };           // single: ganti
      const has = cur.includes(opt.id);
      let next = has ? cur.filter(x => x !== opt.id) : [...cur, opt.id];
      if (!has && g.max > 0 && next.length > g.max) next = next.slice(1);  // max: buang terlama
      return { ...prev, [g.id]: next };
    });
  };
  const selectedIds = (s, gid) => {
    const v = s?.[gid];
    if (v == null || v === '') return [];
    return Array.isArray(v) ? v : [v];
  };

  if (!product) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-surface dark:bg-surface-dark w-full sm:w-[460px] rounded-t-3xl sm:rounded-3xl shadow-pop flex flex-col max-h-[92vh] overflow-hidden animate-sheet"
        onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="px-5 pt-4 pb-3 bg-chrome-deep text-ink-inv shrink-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <p className="text-apricot/80 text-[9px] font-extrabold uppercase tracking-[0.2em]">Pilih Varian</p>
              <h3 className="font-extrabold text-base leading-tight mt-0.5 truncate">{product.name}</h3>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* grup modifier */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4 bg-paper/60 dark:bg-white/[.02]">
          {active.map(g => {
            const chosen = selectedIds(sel, g.id);
            return (
              <div key={g.id}>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv">{g.name}</h4>
                  <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-md ${g.required ? 'bg-flame-50 dark:bg-flame-900/40 text-flame-600 dark:text-apricot' : 'bg-paper dark:bg-white/5 text-ink-faint'}`}>
                    {g.required ? 'Wajib' : 'Opsional'}{g.multi ? (g.max > 0 ? ` · maks ${g.max}` : ' · boleh banyak') : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {g.options.filter(o => o.active).map(o => {
                    const on = chosen.includes(o.id);
                    return (
                      <button key={o.id} onClick={() => pick(g, o)}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-all press active:scale-[.97] ${on
                          ? 'bg-flame-600 border-flame-600 text-white shadow-card'
                          : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/80 hover:border-flame-300'}`}>
                        <span className="block text-[11.5px] font-extrabold leading-tight">{o.name}</span>
                        {o.priceDelta !== 0 && <span className={`block text-[9.5px] font-bold mt-0.5 ${on ? 'text-white/80' : 'text-ink-faint'}`}>{o.priceDelta > 0 ? `+${formatIDR(o.priceDelta)}` : formatIDR(o.priceDelta)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* footer: qty + total live + tambah */}
        <div className={`p-4 border-t border-line dark:border-line-dark bg-surface dark:bg-surface-dark shrink-0 space-y-2.5 ${errShake ? 'animate-shake' : ''}`}>
          {firstError && <p className="text-[10px] font-extrabold text-gold-deep dark:text-gold">{firstError.msg}</p>}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark rounded-xl p-1">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg font-extrabold text-ink-soft hover:text-brick transition">−</button>
              <span key={qty} className="w-6 text-center text-sm font-extrabold text-ink dark:text-ink-inv animate-num">{qty}</span>
              <button onClick={() => setQty(q => Math.min(99, q + 1))} className="w-8 h-8 rounded-lg font-extrabold text-flame-600 dark:text-apricot hover:bg-flame-50 dark:hover:bg-flame-900/40 transition">+</button>
            </div>
            <div className="flex-1 text-right min-w-0">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Total</p>
              <p key={total} className="text-lg font-extrabold text-ink dark:text-ink-inv money leading-none animate-num">{formatIDR(total)}</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!validation.ok) { setErrShake(true); setTimeout(() => setErrShake(false), 350); return; }
              onAdd(product, sel, active, qty, unit);
            }}
            className={`w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all press ${validation.ok
              ? 'bg-[#F26A21] hover:bg-[#F4772E] dark:bg-flame-600 dark:hover:bg-flame-500 text-white shadow-card active:scale-[.98]'
              : 'bg-paper dark:bg-white/5 text-ink-faint cursor-not-allowed'}`}>
            <Plus className="w-4.5 h-4.5" /> Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [kasirGate, setKasirGate] = useState(false);   // POS Station: pilih kasir aktif
  const [showVoid, setShowVoid] = useState(null);      // v21: modal void (transaksi lunas)
  const [showRefund, setShowRefund] = useState(null);  // v21: modal refund
  // v21.1 — Modifier Engine & WELP Payment Core
  const [modGroups, setModGroups] = useState(() => safeParse('modifier_group_db', []));
  const [modProduct, setModProduct] = useState(null);          // produk menunggu pilihan modifier
  const [qrisReference, setQrisReference] = useState(null);    // paymentReference sesi keranjang
  const qrisRefLive = useRef(null);                            // sinkron dgn state utk checkout
  const trackStock = stockTrackingOn();                        // inventory optional (spec #9–11)
  const posPerms = permsOfSession(licenseInfo);

  // LIVE CAMERA SCANNER STATE
  const [liveScanner, setLiveScanner] = useState({ show: false, mode: '' });
  const videoRef = useRef(null);

  // SELF-ORDER LIVE (Firestore): pesanan pelanggan ?meja= masuk realtime
  const [remoteSelfOrders, setRemoteSelfOrders] = useState([]);
  useEffect(() => {
    if (!licenseInfo?.id || !db) return;
    const unsub = onSnapshot(collection(db, 'tenants', licenseInfo.id, 'self_orders'),
      snap => setRemoteSelfOrders(snap.docs.map(d => ({ ...d.data(), cid: d.id })).filter(o => o.status === 'awaiting_validation')),
      err => console.warn('[WELP self_orders]', err.code || err.message));
    return () => unsub();
  }, [licenseInfo?.id]);

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

  // POS Station wajib punya kasir aktif (identitas manusia) sebelum transaksi
  useEffect(() => {
    if (licenseInfo?.isStation && !licenseInfo?.employeeName) setKasirGate(true);
  }, [licenseInfo?.isStation, licenseInfo?.employeeName]);

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
            // v15 F1/B2b: validasi BERBASIS FIRESTORE dulu (pesanan self-order
            // yang sama yang dikirim pelanggan), baru fallback pesanan lokal.
            const remote = (table !== null && table !== undefined && remoteSelfOrders.find(o => String(o.tableNo) === String(table))) ||
              (table === null || table === undefined ? remoteSelfOrders[0] : null);
            if (remote) {
              // tandai tervalidasi di Firestore — HP pelanggan langsung melihat statusnya
              setDoc(doc(db, 'tenants', licenseInfo.id, 'self_orders', remote.cid),
                { status: 'pending', validatedAt: Date.now(), validatedBy: licenseInfo.employeeName || licenseInfo.stationCode || 'kasir' },
                { merge: true }).catch(() => { });
              // cid DIPERTAHANKAN di salinan lokal — dipakai confirmPayment/
              // cancelOrder untuk menulis status balik ke dokumen self_orders.
              const localCopy = { ...remote, status: 'pending' };
              saveActiveOrders([localCopy, ...safeParse('active_orders_db', []).filter(o => o.id !== remote.id)]);
              setSelectedOrder(localCopy);
              return;
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

  // v15 F1: pesanan aktif tersinkron Firestore (koleksi orders) via dbSet
  const saveActiveOrders = (ords) => {
    setActiveOrders(ords);
    dbSet(licenseInfo?.id, 'active_orders_db', ords);
  };

  // v21.1: mirror grup modifier ikut segar saat sinkron antar-tab
  useEffect(() => {
    const h = () => setModGroups(safeParse('modifier_group_db', []));
    window.addEventListener('welp_db_sync', h);
    return () => window.removeEventListener('welp_db_sync', h);
  }, []);
  useEffect(() => { if (activeTab === 'pos') setModGroups(safeParse('modifier_group_db', [])); }, [activeTab]);

  // v21.1 FLIGHT-TO-CART — spatial continuity (spec #32–34): produk
  // TIDAK teleport; titik kecil terbang dari kartu produk ke keranjang.
  // Compositor-only (transform), 380ms, hormati reduced-motion.
  const flyToCart = (fromEl) => {
    try {
      if (!fromEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const a = fromEl.getBoundingClientRect();
      const target = document.querySelector('[data-cart-anchor]');
      const b = target ? target.getBoundingClientRect() : { left: window.innerWidth - 60, top: window.innerHeight - 90, width: 40, height: 40 };
      const dot = document.createElement('span');
      dot.style.cssText = `position:fixed;z-index:9999;left:${a.left + a.width / 2 - 9}px;top:${a.top + a.height / 2 - 9}px;width:18px;height:18px;border-radius:9999px;background:#F26A21;box-shadow:0 4px 14px rgba(242,106,33,.45);pointer-events:none;will-change:transform,opacity;transition:transform .38s cubic-bezier(.3,.9,.4,1),opacity .38s ease;`;
      document.body.appendChild(dot);
      requestAnimationFrame(() => {
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        dot.style.transform = `translate(${dx}px,${dy}px) scale(.35)`;
        dot.style.opacity = '.25';
      });
      setTimeout(() => dot.remove(), 420);
    } catch (e) { /* animasi gagal → abaikan, state tetap jalan */ }
  };

  // v21.1 — addToCart pintar (spec #5–8):
  //   QUICK        → TAP → cart (tanpa modal)
  //   CONFIGURABLE → TAP → Modifier Sheet → cart
  //   Stock Tracking OFF → stok TIDAK memblok penjualan (spec #10)
  const addToCart = (p, ev) => {
    if (needsModifierSheet(p, modGroups)) { setModProduct(p); return; }
    let finalPrice = p.price;
    if (priceTier === 'grosir' && p.priceGrosir > 0) finalPrice = p.priceGrosir;
    if (priceTier === 'ojol' && p.priceOjol > 0) finalPrice = p.priceOjol;
    const lineKey = cartLineKey(p.id, priceTier, []);
    if (ev && ev.currentTarget) flyToCart(ev.currentTarget);
    setCart(prev => {
      const exist = prev.find(i => i.lineId === lineKey);
      const qtyInCart = exist ? exist.qty : 0;
      if (trackStock && qtyInCart >= (p.stock || 0)) return prev;
      return exist ? prev.map(i => (i.lineId === lineKey) ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { ...p, qty: 1, price: finalPrice, basePrice: p.price, tier: priceTier, lineId: lineKey, lineKey, modifiers: [] }];
    });
  };

  // Tambah dari ModifierSheet (validasi sudah lolos di sheet)
  const addModToCart = (p, sel, groups, qty, unitPrice) => {
    const mods = lineModifiersPayload(groups, sel);
    const lineKey = cartLineKey(p.id, priceTier, mods);
    setCart(prev => {
      const exist = prev.find(i => i.lineId === lineKey);
      if (exist) return prev.map(i => (i.lineId === lineKey) ? { ...i, qty: Math.min(99, i.qty + qty) } : i);
      return [...prev, {
        ...p, qty, price: unitPrice, basePrice: p.price, tier: priceTier,
        lineId: lineKey, lineKey, modifiers: mods,
      }];
    });
    setModProduct(null);
    triggerAlert(`${p.name} masuk keranjang`, 'success');
  };

  // Semua operasi qty memakai lineId (produk yg sama dgn modifier beda
  // = baris beda). Stok hanya menjadi batas saat tracking ON.
  const updateQty = (lineId, d) => {
    setCart(prev => prev.map(i => {
      if ((i.lineId || i.id) !== lineId) return i;
      const newQty = Math.max(1, i.qty + d);
      const prod = products.find(p => p.id === i.id);
      if (trackStock && prod && newQty > prod.stock) return i;
      return { ...i, qty: newQty };
    }));
  };

  const removeFromCart = (lineId) => setCart(prev => prev.filter(i => (i.lineId || i.id) !== lineId));

  // v21 IDEMPOTENCY (dua lapis):
  //  1. lastSaleSigRef — LATCH SINKRON: fast-path tunai selesai tanpa await,
  //     sehingga double-fire dalam tick yang sama tidak tertahan isLoading.
  //     Latch dibuka kembali saat keranjang benar-benar dikosongkan (commit).
  //  2. clientTransactionId — kunci idempotensi server: retry sync/offline
  //     menulis dokumen Firestore yang SAMA (doc id = ctx).
  const cartTxRef = useRef(null);
  const lastSaleSigRef = useRef(null);
  // v21.1: signature menyertakan lineKey (produk+modifier) — dua keranjang
  // berbeda KOMBINASI tidak mungkin dianggap sama (idempotensi tetap ketat).
  const cartSignature = () => cart.map(i => `${i.lineKey || i.id}:${i.qty}:${i.price}`).sort().join('|');
  // Latch terbuka lagi saat keranjang sudah benar-benar dikosongkan setelah sale.
  useEffect(() => { if (cart.length === 0) lastSaleSigRef.current = null; }, [cart]);

  // Finalisasi pembayaran (dipakai fast-path tunai & konfirmasi manual):
  // payment → CONFIRMED, tulis ke riwayat via outbox idempoten + audit.
  const finalizePaidOrder = (order) => {
    const paidAt = new Date().toISOString();
    const payments = normalizePayments(order).map(p => p.status === 'CONFIRMED' ? p
      : { ...p, status: 'CONFIRMED', paidAt, confirmedAt: Date.now() });
    const paid = {
      ...order, status: 'paid', paidAt, payments,
      txState: TX_STATE.PAYMENT_CONFIRMED,
      settlementStatus: order.settlementStatus || null,
      syncStatus: 'PENDING',
    };
    commitOrder(licenseInfo, paid);
    // v21.1: proyeksi intent ikut CONFIRMED (server matching membaca ini)
    payments.forEach(p => {
      if (p.paymentReference) commitFinanceDoc({
        tenantId: licenseInfo?.id, localKey: 'payment_intent_db',
        docId: p.paymentReference,
        data: { intentId: p.intentId || p.paymentId, paymentId: p.paymentId, paymentReference: p.paymentReference, orderId: paid.clientTransactionId || paid.id, clientTransactionId: paid.clientTransactionId || paid.id, amount: p.amount, method: p.method, branchId: paid.branchId || null, status: 'CONFIRMED', confirmedAt: Date.now(), providerRef: p.providerRef || null, eventId: p.eventId || null, syncStatus: 'PENDING' },
      });
    });
    // v15 F1/B2b: status PAID ikut ke dokumen self_orders bila dari meja
    if (order.cid && licenseInfo?.id && db) {
      setDoc(doc(db, 'tenants', licenseInfo.id, 'self_orders', order.cid),
        { status: 'paid', paidAt: Date.now(), paidBy: licenseInfo.employeeName || 'kasir' },
        { merge: true }).catch(() => { });
    }
    auditLog(licenseInfo, 'TRANSAKSI_LUNAS', { target: order.id, clientTxId: order.clientTransactionId || order.id, total: order.total, method: order.paymentMethod });
    return paid;
  };

  const resetCartState = () => {
    setCart([]); setBuyerName(''); setNotes(''); setCashTendered(0);
    setPaymentMethod(''); setTableNo('');
    cartTxRef.current = null;
    // v21.1: reference QRIS habis bersama sesi keranjang (nominal sama
    // berikutnya = reference baru = QR baru = intent baru).
    qrisRefLive.current = null; setQrisReference(null);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return triggerAlert("Keranjang masih kosong!", "error");
    if (isLoading) return;
    const sig = cartSignature();
    // Double-fire sinkron: keranjang yang PERSIS sama baru saja diproses.
    if (lastSaleSigRef.current === sig) return;
    if (!paymentMethod) return triggerAlert("Pilih metode pembayaran dulu.", "error");
    const bill = computeOrderTotals(cart);
    if (paymentMethod === 'Cash' && cashTendered < bill.total) return triggerAlert("Nominal tunai belum cukup.", "error");
    lastSaleSigRef.current = sig;   // kunci SEKARANG — sebelum efek apa pun
    setIsLoading(true);

    try {
      // (v21: delay artifisial 500ms DIHAPUS — kasir harus ngebut.)
      const ctx = (cartTxRef.current && cartTxRef.current.sig === sig)
        ? cartTxRef.current.ctx : newClientTxId();
      cartTxRef.current = { sig, ctx };

      // Snapshot HPP saat penjualan (hppAtSale) — fondasi laporan laba nyata.
      const orderItems = cart.map(i => ({
        ...i,
        hppAtSale: (typeof i.hppAtSale === 'number' ? i.hppAtSale : (typeof i.hpp === 'number' ? i.hpp : null))
      }));
      const now = Date.now();
      // Payment record kanonik — status final ditentukan saat konfirmasi.
      // v21.1 WELP PAYMENT CORE: QRIS mendapat PaymentIntent dengan
      // paymentReference UNIK (spec #18) — nominal bukan identitas.
      const isQris = paymentMethod === 'QRIS';
      const qrisRef = isQris ? (qrisRefLive.current || newPaymentReference()) : null;
      if (isQris && !qrisRefLive.current) qrisRefLive.current = qrisRef;
      const basePaymentRec = {
        paymentId: newPaymentId(), method: paymentMethod, amount: bill.total,
        status: 'PENDING', paidAt: null, confirmedAt: null, providerRef: null,
        cashTendered: paymentMethod === 'Cash' ? cashTendered : null,
        change: paymentMethod === 'Cash' ? Math.max(0, cashTendered - bill.total) : null,
      };
      const paymentRec = isQris
        ? paymentRecWithIntent({ paymentRec: { ...basePaymentRec, paymentReference: qrisRef }, merchantId: profile?.payment?.qrisMeta?.merchantId || null, createdAtMs: now })
        : basePaymentRec;
      const newOrder = {
        // v21: id = clientTransactionId — SATU identitas utk tampilan, mirror
        // lokal, dan doc Firestore. Double-tap/retry menulis dokumen yang
        // SAMA → mustahil jadi dua transaksi.
        id: ctx,
        clientTransactionId: ctx,
        date: new Date(now).toISOString(), createdAtMs: now,
        buyer: buyerName || 'Tanpa Nama',
        paymentMethod,                                 // kompatibilitas pembaca lama
        payments: [paymentRec],                        // model pembayaran baru
        items: orderItems,
        subtotal: bill.subtotal, discountAmt: bill.discountAmt, taxAmt: bill.taxAmt, serviceAmt: bill.serviceAmt,
        taxPercent: bill.taxPercent, servicePercent: bill.servicePercent, discPercent: bill.discPercent,
        total: bill.total, cashTendered: paymentMethod === 'Cash' ? cashTendered : 0,
        change: paymentMethod === 'Cash' ? Math.max(0, cashTendered - bill.total) : 0,
        orderType: orderType, tableNo: tableNo, notes: notes,
        status: 'pending', txState: TX_STATE.PAYMENT_PENDING,
        syncStatus: 'PENDING',
        branchId: licenseInfo?.branchId || BRANCH_ID,
        // jejak perangkat & manusia: transaksi tercatat pada POS Station
        // tertentu dan dilakukan oleh karyawan tertentu.
        stationCode: licenseInfo?.stationCode || null,
        employeeId: licenseInfo?.employeeId || null,
        employeeName: licenseInfo?.employeeName || null,
        deviceId: getDeviceId(),
        shiftId: licenseInfo?.shiftId || `${licenseInfo?.stationCode || licenseInfo?.branchId || 'PUSAT'}-${todayKey()}`,
        shiftNama: licenseInfo?.shiftNama || null
      };
      auditLog(licenseInfo, 'TRANSAKSI_BARU', { target: newOrder.id, clientTxId: ctx, total: bill.total, method: paymentMethod, items: cart.length });

      const updatedProducts = [...products];
      const rawMaterialsDb = safeParse('raw_material_db', []);
      const recipesDb = safeParse('hpp_pro_db', []);
      let updatedRawMaterials = [...rawMaterialsDb];
      // Catat pemakaian bahan baku per item agar bisa dikembalikan saat batal/edit.
      const materialUsageByItem = {};

      // v21.1 (spec #10–11): Stock Tracking OFF → TIDAK ada forced stock
      // decrement (produk & bahan baku). Crew tidak dipaksa mengelola stok.
      if (trackStock) cart.forEach(cartItem => {
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
      if (trackStock) {
        dbSet(licenseInfo?.id, 'product_stock_db', updatedProducts);
        dbSet(licenseInfo?.id, 'raw_material_db', updatedRawMaterials);
      }

      // v21.1: proyeksi PaymentIntent ke Firestore utk matching server
      // (endpoint welpPaymentEvents membaca koleksi payment_intents).
      if (isQris && paymentRec.paymentReference) {
        commitFinanceDoc({
          tenantId: licenseInfo?.id, localKey: 'payment_intent_db',
          docId: paymentRec.paymentReference,
          data: {
            intentId: paymentRec.intentId, paymentId: paymentRec.paymentId,
            paymentReference: paymentRec.paymentReference,
            orderId: newOrder.id, clientTransactionId: newOrder.id,
            amount: bill.total, method: 'QRIS', status: 'PENDING',
            branchId: newOrder.branchId, stationCode: newOrder.stationCode,
            merchantId: paymentRec.merchantId || null,
            createdAt: now, expiresAt: paymentRec.expiresAt || intentExpiryOf(now),
            providerRef: null, eventId: null, syncStatus: 'PENDING',
          },
        });
      }

      if (paymentMethod === 'Cash' && cashTendered >= bill.total) {
        // ============ FAST-PATH TUNAI ============
        // Uang diterima tuntas saat checkout → langsung LUNAS + struk.
        // SCAN/KLIK → BAYAR → SELESAI (tanpa layar antara).
        const paid = finalizePaidOrder(newOrder);
        resetCartState();
        setShowCart(false);
        setShowReceipt(paid);
        triggerAlert(`Lunas! Kembalian ${formatIDR(paid.change || 0)}.`, 'success');
      } else {
        // QRIS / e-wallet / split → pesanan pending, layar pembayaran
        // langsung terbuka (QR tampil) untuk konfirmasi kasir.
        saveActiveOrders([newOrder, ...activeOrders]);
        resetCartState();
        setShowCart(false);
        setSelectedOrder(newOrder);
      }
    } catch (error) { triggerAlert("Terjadi kesalahan: " + error.message, "error"); }
    finally { setIsLoading(false); }
  };

  const confirmPayment = (order) => {
    const paid = finalizePaidOrder(order);
    saveActiveOrders(activeOrders.filter(o => o.id !== order.id));
    setSelectedOrder(paid);
  };

  // v21.1 PWA PAYMENT EVENT SIMULATOR di titik jual (spec #25):
  // menembakkan event uji ke matching engine dgn intent NYATA order ini.
  // Jalur sama dgn endpoint backend → arsitektur identik, tanpa fake path.
  const simulatePaymentForOrder = (order) => {
    const pay = (order.payments || []).find(p => p.paymentReference);
    if (!pay) return triggerAlert('Order ini tidak punya PaymentIntent (QRIS).', 'error');
    const intent = { paymentReference: pay.paymentReference, amount: pay.amount, method: pay.method || 'QRIS' };
    const rawEvent = buildSimulatedEvent({ intent, variant: 'exact' });
    const orders = [...activeOrders, ...safeParse('pos_history_db', [])];
    const res = ingestPaymentEvent({
      tenantId: licenseInfo?.id, rawEvent, orders,
      actor: licenseInfo?.employeeName || licenseInfo?.tenant || 'kasir',
      actorRole: licenseInfo?.currentUserRole || 'owner', licenseInfo,
    });
    if (res.status === MATCH_STATUS.CONFIRMED) {
      const merged = { ...order, ...(res.order || {}) };
      saveActiveOrders(activeOrders.filter(o => o.id !== order.id));
      setSelectedOrder(merged);
      triggerAlert(`Event cocok (paymentReference) → LUNAS otomatis via Payment Core.`, 'success');
    } else {
      triggerAlert(`Simulasi: ${MATCH_STATUS_META[res.status]?.label || res.status} — ${res.reason || ''}`, res.status === MATCH_STATUS.DUPLICATE ? 'success' : 'error');
    }
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
    dbSet(licenseInfo?.id, 'raw_material_db', updated);
  };

  const cancelOrder = (order) => {
    if (confirm("Batalkan pesanan? Stok akan dikembalikan.")) {
      // v21.1: stok hanya dikembalikan saat tracking ON (pesanan saat OFF
      // tidak pernah menurunkan stok — restore juga tidak dilakukan).
      if (trackStock) {
        const newStock = products.map(p => {
          const inOrder = order.items.find(i => i.id === p.id);
          return inOrder ? { ...p, stock: p.stock + inOrder.qty } : p;
        });
        setProducts(newStock);
        dbSet(licenseInfo?.id, 'product_stock_db', newStock);
        restoreMaterialUsage(order);
      }
      saveActiveOrders(activeOrders.filter(o => o.id !== order.id));
      // v15 F1/B2b: status DIBATALKAN ikut ke Firestore utk self-order
      if (order.cid && licenseInfo?.id && db) {
        setDoc(doc(db, 'tenants', licenseInfo.id, 'self_orders', order.cid),
          { status: 'cancelled', cancelledAt: Date.now() }, { merge: true }).catch(() => { });
      }
      auditLog(licenseInfo, 'TRANSAKSI_DIBATALKAN', { target: order.id, total: order.total });
      setSelectedOrder(null);
    }
  };

  // Ubah pesanan: kembalikan stok lalu muat ulang item ke keranjang
  const editOrder = (order) => {
    if (trackStock) {
      const newStock = products.map(p => {
        const inOrder = order.items.find(i => i.id === p.id);
        return inOrder ? { ...p, stock: p.stock + inOrder.qty } : p;
      });
      setProducts(newStock);
      dbSet(licenseInfo?.id, 'product_stock_db', newStock);
      restoreMaterialUsage(order);
    }
    setCart(order.items.map(i => ({ ...i, lineId: i.lineKey || cartLineKey(i.id, i.tier || 'retail', i.modifiers || []) })));
    setBuyerName(order.buyer === 'Tanpa Nama' ? '' : (order.buyer || ''));
    setPaymentMethod(order.paymentMethod || '');
    setNotes(order.notes || '');
    setOrderType(order.orderType || 'Take away');
    setTableNo(order.tableNo || '');
    setCashTendered(0);                                  // nominal lama tidak terbawa saat edit ulang
    saveActiveOrders(activeOrders.filter(o => o.id !== order.id));
    setSelectedOrder(null);
    setViewMode('shop');
    setShowCart(true);
    triggerAlert("Pesanan dimuat ke keranjang. Ubah item lalu checkout ulang.", "success");
  };

  // v21.1: paymentReference QRIS dibuat saat metode QRIS dipilih — QR yang
  // tampil SUDAH membawa reference (tag 62/07) sebelum BAYAR ditekan.
  useEffect(() => {
    if (paymentMethod === 'QRIS') {
      if (!qrisRefLive.current) {
        qrisRefLive.current = newPaymentReference();
        setQrisReference(qrisRefLive.current);
      } else setQrisReference(qrisRefLive.current);
    }
  }, [paymentMethod]);

  const getPaymentInfo = (method, amount = 0, order = null) => {
    if (method === 'Cash') return <div className="p-3 bg-paper dark:bg-white/5 rounded-xl text-center font-extrabold text-ink dark:text-ink-inv text-sm">Bayar Tunai di Kasir</div>;
    if (method === 'QRIS') {
      const payload = profile.payment?.qrisPayload;
      const ref = (order?.payments || []).find(p => p.paymentReference)?.paymentReference || null;
      const dyn = payload ? buildIntentQris(payload, amount, ref) : null;
      return (
        <div className="flex flex-col items-center">
          {dyn ? (
            <>
              <div className="relative bg-white p-2 rounded-2xl border-2 border-flame-200 shadow-card">
                <QrPay text={dyn} size={320} cls="w-44 h-44" alt="QRIS Dinamis" />
                <span className="absolute -top-2.5 -right-2 flex items-center gap-1 bg-flame-600 text-white text-[8px] font-extrabold px-2 py-1 rounded-full shadow-card"><QrDinamis className="w-3 h-3" /> DINAMIS</span>
              </div>
              <p className="text-base mt-2.5 text-flame-700 dark:text-apricot font-extrabold money">{formatIDR(amount)}</p>
              <p className="text-[10px] mt-0.5 text-ink-faint font-bold">Nominal sudah terisi otomatis, pelanggan tinggal scan</p>
              {ref && <p className="text-[8.5px] mt-1 font-mono text-ink-faint/80">Ref: {ref}</p>}
            </>
          ) : profile.payment?.qris ? (
            <>
              <img src={profile.payment.qris} className="w-48 h-48 object-contain bg-white p-2 rounded-xl border" alt="QRIS Toko" />
              <p className="text-[11px] mt-2 text-ink-faint font-bold text-center">QRIS statis. Pelanggan scan lalu isi nominal<br />{formatIDR(amount || 0)} secara manual</p>
            </>
          ) : <p className="text-xs text-ink-faint font-bold">Belum ada QRIS. Atur dulu di menu Metode Pembayaran</p>}
        </div>
      );
    }
    const wallet = profile.payment?.ewallets?.find(w => w.type === method);
    if (wallet) return <div className="p-4 bg-paper dark:bg-white/5 rounded-xl text-center"><p className="font-extrabold text-ink-soft dark:text-ink-inv/80">{method}</p><p className="text-xl font-extrabold mt-1 select-all text-ink dark:text-ink-inv money">{wallet.number}</p></div>;
    return null;
  };

  const totalCartPrice = cart.reduce((a, b) => a + (b.price * b.qty), 0);
  const totalCartQty = cart.reduce((a, b) => a + b.qty, 0);
  const cartBill = computeOrderTotals(cart);
  const mergedOrders = [...remoteSelfOrders, ...activeOrders];
  const pendingCount = mergedOrders.filter(o => o.status === 'pending').length;
  const isFnb = localStorage.getItem('biz_mode') === 'fnb';

  // v15 F4-H4: pencarian mencakup SKU/barcode — sesuai placeholder
  // "Ketik SKU / Nama Produk..."
  const filteredProducts = products
    .filter(p => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (p.name || '').toLowerCase().includes(q) ||
        (p.sku && String(p.sku).toLowerCase().includes(q));
    })
    .filter(p => activeCategory === 'Semua' ? true : p.type === activeCategory);

  /* ---------- kartu produk ---------- */
  const ProductCard = ({ p }) => {
    let displayPrice = p.price;
    if (priceTier === 'grosir' && p.priceGrosir > 0) displayPrice = p.priceGrosir;
    else if (priceTier === 'ojol' && p.priceOjol > 0) displayPrice = p.priceOjol;
    const configurable = needsModifierSheet(p, modGroups);
    const inCartQty = cart.filter(i => i.id === p.id).reduce((a, b) => a + b.qty, 0);
    // v21.1: Stock Tracking OFF → produk TIDAK pernah dinonaktifkan
    // karena stok (spec #10). Badge stok hanya tampil saat ON.
    const outOfStock = trackStock && (p.stock || 0) <= 0;

    return (
      <button onClick={(ev) => addToCart(p, ev)} disabled={outOfStock}
        className={`relative bg-surface dark:bg-surface-dark p-2.5 rounded-2xl border text-left transition-all duration-200 group ${!outOfStock
          ? inCartQty > 0
            ? 'border-flame-500 ring-2 ring-flame-500/25 shadow-card cursor-pointer'
            : 'border-line dark:border-line-dark hover:border-flame-300 shadow-card cursor-pointer press'
          : 'opacity-50 grayscale cursor-not-allowed border-line dark:border-line-dark'}`}>
        <div className="aspect-square bg-paper dark:bg-white/[.04] rounded-xl mb-2 overflow-hidden relative">
          {p.image ? <img src={p.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            : <div className="w-full h-full flex items-center justify-center"><CategoryIcon name={p.type} className="w-10 h-10 opacity-80" /></div>}
          {configurable && (
            <span className="absolute top-1.5 right-1.5 text-[7.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-chrome-deep/85 backdrop-blur text-apricot">Custom</span>
          )}
          {inCartQty > 0 && (
            <span key={inCartQty} className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-flame-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-card animate-bump">{inCartQty}</span>
          )}
          {trackStock && (
            <span className={`absolute bottom-1.5 right-1.5 text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${p.stock > 0
              ? 'bg-chrome-deep/85 backdrop-blur text-white'
              : 'bg-brick text-white'}`}>{p.stock > 0 ? `${p.stock}` : 'Habis'}</span>
          )}
        </div>
        <h4 className="font-bold text-ink dark:text-ink-inv text-xs truncate mb-0.5">{p.name}</h4>
        <p className="text-ink dark:text-ink-inv font-extrabold text-[13px] money">{formatIDR(displayPrice)}{configurable && <span className="text-[9px] text-ink-faint font-bold ml-1">+</span>}</p>
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
        <span data-cart-anchor className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"><Keranjang className="w-5 h-5 text-apricot" /></span>
      </div>
      <div className={`overflow-y-auto custom-scrollbar px-4 ${compact ? 'max-h-[30vh]' : 'flex-1 max-h-[42vh]'}`}>
        {cart.length === 0 ? (
          <div className="py-8 text-center">
            <Keranjang className="w-9 h-9 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Keranjang masih kosong</p>
            <p className="text-[10px] text-ink-faint/70 mt-1">Klik produk buat nambahin</p>
          </div>
        ) : cart.map(i => (
          <div key={i.lineId || i.id} className="flex items-center gap-2.5 py-2.5 border-b border-dotted border-line dark:border-line-dark last:border-0 animate-slide-in-right">
            <div className="w-9 h-9 bg-paper dark:bg-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
              {i.image ? <img src={i.image} className="w-full h-full object-cover" /> : <span className="text-[10px] font-extrabold text-ink-faint">{i.name?.[0]}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs truncate text-ink dark:text-ink-inv">{i.name}</p>
              {(i.modifiers || []).length > 0 && modifiersLabelByGroup(i.modifiers).map((lbl, mi) => (
                <p key={mi} className="text-[8.5px] font-bold text-flame-700/80 dark:text-apricot/80 truncate">+ {lbl}</p>
              ))}
              <p className="text-[10px] text-ink-faint money font-bold">{formatIDR(i.price)} × {i.qty}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => updateQty(i.lineId || i.id, -1)} className="w-6 h-6 rounded-md bg-paper dark:bg-white/5 text-xs font-extrabold text-ink-soft hover:text-brick transition">−</button>
              <span key={i.qty} className="w-5 text-center text-xs font-extrabold text-ink dark:text-ink-inv animate-num">{i.qty}</span>
              <button onClick={() => updateQty(i.lineId || i.id, 1)} className="w-6 h-6 rounded-md bg-flame-50 dark:bg-flame-900/40 text-xs font-extrabold text-flame-700 dark:text-apricot hover:bg-flame-100 dark:hover:bg-flame-900/70 transition">+</button>
              <button onClick={() => removeFromCart(i.lineId || i.id)} className="w-6 h-6 rounded-md text-ink-faint hover:text-brick transition"><Trash2 className="w-3.5 h-3.5 mx-auto" /></button>
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
          <span key={cartBill.total} className="text-xl font-extrabold text-ink dark:text-ink-inv money animate-flash-soft">{formatIDR(cartBill.total)}</span>
        </div>
        <Button onClick={() => setShowCart(true)} disabled={cart.length === 0} icon={Keranjang} className="w-full py-3.5">
          Checkout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full max-w-7xl mx-auto relative">

      {/* ===== banner POS STATION: identitas perangkat + kasir aktif ===== */}
      {licenseInfo?.isStation && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-chrome-deep dark:bg-chrome-panel text-ink-inv shadow-card">
          <div className="flex items-center gap-2.5 min-w-0">
            <LayarBuddy className="w-4.5 h-4.5 text-apricot shrink-0" />
            <p className="text-[11px] font-extrabold truncate">
              {licenseInfo.stationCode || 'POS'} ({licenseInfo.branchName || 'Cabang'}), kasir {licenseInfo.employeeName || 'belum ada'}
              {licenseInfo.shiftNama && <span className="text-apricot">, shift {licenseInfo.shiftNama}</span>}
            </p>
          </div>
          <button onClick={() => setKasirGate(true)} className="text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition shrink-0 press">
            {licenseInfo.employeeName ? 'Ganti Kasir' : 'Pilih Kasir'}
          </button>
        </div>
      )}

      {/* ===== STATUS SINKRONISASI + SHIFT KASIR (v21) ===== */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SyncPill licenseInfo={licenseInfo} />
        <span className="text-[10px] font-bold text-ink-faint hidden sm:inline">Transaksi tetap aman saat internet putus — antrean lokal tersinkron otomatis.</span>
      </div>
      <ShiftPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} />

      {/* ===== view switcher ===== */}
      <div className="flex gap-1.5 mb-5 bg-surface dark:bg-surface-dark p-1 rounded-xl border border-line dark:border-line-dark shadow-card inline-flex">
        <button onClick={() => setViewMode('shop')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${viewMode === 'shop' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}><Toko className="w-4 h-4" /> {t('shop')}</button>
        <button onClick={() => setViewMode('status')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${viewMode === 'status' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}>
          <WaktuReal className="w-4 h-4" /> {t('orders')}
          {pendingCount > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${viewMode === 'status' ? 'bg-white/20' : 'bg-brick text-white'}`}>{pendingCount}</span>}
        </button>
        {isFnb && (
          <button onClick={() => setViewMode('table')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${viewMode === 'table' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}><LayarBuddy className="w-4 h-4" /> {t('tables')}</button>
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
                const occupiedOrder = mergedOrders.find(o => parseInt(o.tableNo) === tableNum && o.status === 'pending' || parseInt(o.tableNo) === tableNum && o.status === 'awaiting_validation');
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
                <input className="field-lg pl-10 pr-12" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    // v21 SCANNER HOT-PATH: scanner fisik mengetik kode lalu Enter.
                    // Cocok persis (SKU/nama) → item langsung masuk keranjang,
                    // TANPA modal, TANPA konfirmasi. Keyboard/mouse tetap jalan.
                    if (e.key !== 'Enter') return;
                    const q = String(search || '').trim().toLowerCase();
                    if (!q) return;
                    const hit = products.find(p => (p.sku && String(p.sku).toLowerCase() === q) || String(p.name).toLowerCase() === q);
                    if (hit) { addToCart(hit); setSearch(''); triggerAlert('+1 ' + hit.name, 'success'); }
                  }} />
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
                className="w-full max-w-md mx-auto flex justify-between items-center bg-surface dark:bg-chrome-deep text-ink dark:text-ink-inv p-3.5 pl-5 rounded-3xl shadow-pop border border-line dark:border-chrome-edge press">
                <div className="flex items-center gap-3">
                  <span data-cart-anchor className="w-8 h-8 rounded-2xl bg-flame-500 text-white font-extrabold text-xs flex items-center justify-center animate-bump" key={totalCartQty}>{totalCartQty}</span>
                  <div className="text-left">
                    <span className="block text-[9px] font-extrabold uppercase tracking-widest text-ink-faint dark:text-ink-inv/50">Lihat Keranjang</span>
                    <span key={cartBill.total} className="block text-base font-extrabold money leading-none mt-0.5 animate-flash-soft">{formatIDR(cartBill.total)}</span>
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
          {mergedOrders.length === 0 && <EmptyState mascot="yuk" title="Belum ada pesanan aktif" desc="Pesanan dari kasir & self-order meja akan tampil di sini sebelum dan sesudah pembayaran." />}
          <div className="grid md:grid-cols-2 gap-3">
            {mergedOrders.map(order => (
              <div key={order.id} onClick={() => setSelectedOrder(order)}
                className={`card p-4 cursor-pointer press hover:shadow-pop transition ${order.status === 'pending' ? 'border-gold/40' : 'border-leaf/40'}`}>
                <div className="flex justify-between items-start mb-3">
                  <Badge tone={order.status === 'pending' ? 'gold' : 'green'}>
                    {order.status === 'pending' ? <><WaktuReal className="w-3 h-3" /> Menunggu Pembayaran</> : <><Check className="w-3 h-3" /> Lunas</>}
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
                className="pointer-events-auto animate-slide-up bg-surface dark:bg-chrome-deep hover:bg-paper dark:hover:bg-chrome-panel text-ink dark:text-ink-inv rounded-full pl-3 pr-5 py-3 shadow-pop flex items-center gap-3 font-extrabold text-sm transition press border border-line dark:border-chrome-edge">
                <span className="bg-flame-500 text-white p-2 rounded-full"><Pindai className="w-5 h-5" /></span> Validasi Pesanan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== checkout sheet (dipasang di level root agar bisa dibuka
           dari rail desktop maupun bar mobile) ===== */}
      <CartPopup showCart={showCart} setShowCart={setShowCart} cart={cart} updateQty={updateQty} removeFromCart={removeFromCart} buyerName={buyerName} setBuyerName={setBuyerName} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} handleCheckout={handleCheckout} profile={profile} isLoading={isLoading} orderType={orderType} setOrderType={setOrderType} tableNo={tableNo} setTableNo={setTableNo} notes={notes} setNotes={setNotes} cashTendered={cashTendered} setCashTendered={setCashTendered} qrisReference={qrisReference} />

      {/* ===== MODIFIER SHEET (v21.1) — produk configurable ===== */}
      {modProduct && <ModifierSheet product={modProduct} groups={modGroups} onClose={() => setModProduct(null)} onAdd={addModToCart} />}

      {/* ============ DETAIL PESANAN (modal) ============
          v8: layout flex — header & tombol aksi TETAP terlihat
          tanpa scroll; hanya daftar item yang scroll. Cetak Struk
          hanya muncul SETELAH pembayaran lunas. QRIS dinamis. */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedOrder(null)}>
          <div className="bg-surface dark:bg-surface-dark w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-pop relative animate-pop flex flex-col max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick z-10"><X className="w-4 h-4" /></button>
            <div className="p-5 pb-3 shrink-0">
              <p className="kicker">Detail Pesanan #{selectedOrder.id.slice(-5)}</p>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <TxStateBadge order={selectedOrder} />
                {selectedOrder.status === 'paid' && selectedOrder.syncStatus === 'PENDING' && (
                  <span className="text-[9px] font-extrabold text-ink-faint flex items-center gap-1"><WaktuReal className="w-3 h-3" /> antre sinkron</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3 text-[10px] font-extrabold">
                <span className="px-2.5 py-1 rounded-lg bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf flex items-center gap-1">{getPaymentIcon(selectedOrder.paymentMethod)} {selectedOrder.paymentMethod || 'Metode -'}</span>
                {selectedOrder.buyer && <span className="px-2.5 py-1 rounded-lg bg-paper dark:bg-white/5 text-ink-soft dark:text-ink-inv/70">{selectedOrder.buyer}</span>}
                {selectedOrder.tableNo && <span className="px-2.5 py-1 rounded-lg bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick">Meja {selectedOrder.tableNo}</span>}
                {selectedOrder.orderType && <span className="px-2.5 py-1 rounded-lg bg-paper dark:bg-white/5 text-ink-soft dark:text-ink-inv/70">{selectedOrder.orderType}</span>}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 pb-3">
              <div className="bg-paper dark:bg-white/[.03] rounded-2xl p-4 space-y-2 border border-line dark:border-line-dark">
                {selectedOrder.items.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-ink-soft dark:text-ink-inv/80">{item.qty}x {item.name}</span>
                      <span className="font-extrabold text-ink dark:text-ink-inv money">{formatIDR(item.price * item.qty)}</span>
                    </div>
                    {(item.modifiers || []).length > 0 && modifiersLabelByGroup(item.modifiers).map((lbl, mi) => (
                      <p key={mi} className="text-[9px] font-bold text-flame-700/80 dark:text-apricot/80">+ {lbl}</p>
                    ))}
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
                {(() => {
                  const ref = (selectedOrder.payments || []).find(p => p.paymentReference)?.paymentReference;
                  if (!ref) return null;
                  const exp = (selectedOrder.payments || []).find(p => p.expiresAt)?.expiresAt;
                  const left = exp ? Math.max(0, Math.round((exp - Date.now()) / 60000)) : null;
                  return (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[8.5px] font-mono text-ink-faint/80 break-all">Ref: {ref}</span>
                      {left != null && selectedOrder.status !== 'paid' && <span className="text-[8.5px] font-extrabold text-gold-deep dark:text-gold shrink-0">intent {left}m</span>}
                    </div>
                  );
                })()}
                {selectedOrder.paymentMethod && selectedOrder.status !== 'paid' && getPaymentInfo(selectedOrder.paymentMethod, selectedOrder.total, selectedOrder) && (
                  <div className="pt-2">{getPaymentInfo(selectedOrder.paymentMethod, selectedOrder.total, selectedOrder)}</div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-line dark:border-line-dark p-4 bg-surface dark:bg-surface-dark">
              {selectedOrder.status === 'pending' ? (
                <div className="space-y-2">
                  <button onClick={() => confirmPayment(selectedOrder)} className="w-full bg-flame-600 hover:bg-flame-500 text-white py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 press"><Selesai className="w-4.5 h-4.5" /> Selesaikan Pembayaran</button>
                  {/* v21.1 — simulator di titik jual: menguji jalur event →
                      webhook → matching → PAID dgn intent nyata (spec #25) */}
                  {selectedOrder.paymentMethod === 'QRIS' && (selectedOrder.payments || []).some(p => p.paymentReference) && (
                    <button onClick={() => simulatePaymentForOrder(selectedOrder)}
                      className="w-full text-[10px] font-extrabold text-ink-faint hover:text-flame-600 dark:hover:text-apricot py-1.5 transition press">
                      Simulasikan event pembayaran (uji Payment Core)
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => editOrder(selectedOrder)} className="bg-surface dark:bg-surface-dark text-ink-soft dark:text-ink-inv/80 border border-line dark:border-line-dark hover:border-flame-300 py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 press"><Edit3 className="w-4 h-4" /> Ubah</button>
                    <button onClick={() => cancelOrder(selectedOrder)} className="bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 press"><X className="w-4 h-4" /> Batalkan</button>
                  </div>
                  <p className="text-[9.5px] text-ink-faint font-bold text-center">Struk bisa dicetak setelah pembayaran lunas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={() => setShowReceipt(selectedOrder)} className="w-full bg-flame-600 hover:bg-flame-500 text-white py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 press"><StrukCetak className="w-4.5 h-4.5" /> Cetak Struk</button>
                  {(posPerms.has('transaction.void') || posPerms.has('transaction.refund')) && (
                    <div className="grid grid-cols-2 gap-2">
                      {posPerms.has('transaction.void') && canVoidTx(selectedOrder) && (
                        <button onClick={() => setShowVoid(selectedOrder)} className="bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 press"><Ban className="w-4 h-4" /> Void</button>
                      )}
                      {posPerms.has('transaction.refund') && canRefundTx(selectedOrder) && (
                        <button onClick={() => setShowRefund(selectedOrder)} className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/80 hover:border-flame-300 py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 press"><Undo2 className="w-4 h-4" /> Refund</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceipt && <ReceiptModal order={showReceipt} profile={profile} onClose={() => setShowReceipt(null)} />}

      {/* ===== VOID & REFUND (v21) — permission + alasan + audit ===== */}
      {showVoid && <VoidModal order={showVoid} licenseInfo={licenseInfo} triggerAlert={triggerAlert}
        onClose={() => setShowVoid(null)} onDone={() => setSelectedOrder(null)} />}
      {showRefund && <RefundModal order={showRefund} licenseInfo={licenseInfo} triggerAlert={triggerAlert}
        onClose={() => setShowRefund(null)} onDone={(upd) => setSelectedOrder(upd)} />}

      {/* ===== GATE KASIR AKTIF (POS Station) =====
          Perangkat tetap login sebagai station, tapi tiap manusia
          mengidentifikasi diri dengan akun employee sendiri. */}
      {kasirGate && licenseInfo?.isStation && (
        <StationKasirGate licenseInfo={licenseInfo} onClose={() => setKasirGate(false)} triggerAlert={triggerAlert} />
      )}

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
