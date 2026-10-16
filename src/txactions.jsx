// ============================================================
// WELP v21 — KOMPONEN DOMAIN FINANSIAL BERSAMA
// ------------------------------------------------------------
// Dipakai lintas POS (kasir), Riwayat (Business), dan Keuangan:
//   • TxStateBadge  — badge status kanonik (state machine)
//   • SyncPill      — status sinkronisasi online/offline/antrean
//   • VoidModal     — pembatalan transaksi (permission + alasan
//                     + stok + audit, original tx tidak dihapus)
//   • RefundModal   — refund penuh/sebagian (permission + alasan
//                     + metode + status REFUNDED/PROCESSING)
//   • ShiftPanel    — buka/tutup shift, uang masuk/keluar, selisih
//
// SEMUA aksi: UI → state → persistence (mirror + Firestore via
// outbox idempoten) → permission → audit → error handling.
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  X, Ban, Undo2, RefreshCw, Uang, KasKeluar, WaktuReal, Toko, PerisaiBuddy,
} from './welp-icons.jsx';
import { safeParse, formatIDR, dbSet, auditLog, stockTrackingOn } from './core.jsx';
import { Button, NumericInput, Select } from './ui';
import {
  TX_STATE, TX_STATE_META, txStateOf, netTotalOf, refundedAmountOf,
  buildVoid, buildRefund,
  newShiftLogId, newCashEventId, openShiftOf, expectedCashOf, closeShiftResult,
  SHIFT_RESULT_META,
} from './welp-core/tx.js';
import { commitFinanceDoc, useSyncStatus, forceFlush, SYNC_STATE_META } from './welp-core/sync.js';
import { permsOf } from './core.jsx';

// ------------------------------------------------------------
// Badge status transaksi (kanonik, kompatibel order legacy)
// ------------------------------------------------------------
export const TxStateBadge = ({ order }) => {
  const s = txStateOf(order);
  const meta = TX_STATE_META[s] || TX_STATE_META.PAYMENT_PENDING;
  const toneMap = {
    gold: 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold',
    green: 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf',
    red: 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick',
    blue: 'bg-paper dark:bg-white/10 text-ink-soft dark:text-ink-inv/80',
    grey: 'bg-paper dark:bg-white/5 text-ink-faint',
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold ${toneMap[meta.tone] || toneMap.grey}`}>{meta.label}</span>;
};

// ------------------------------------------------------------
// Sync pill — SATU indikator jaringan+antrean untuk seluruh app
// ------------------------------------------------------------
export const SyncPill = ({ licenseInfo, compact = false }) => {
  const st = useSyncStatus(licenseInfo?.id);
  const meta = SYNC_STATE_META[st.state] || SYNC_STATE_META.ONLINE;
  const tone = {
    green: 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf',
    gold: 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold',
    red: 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick',
    blue: 'bg-paper dark:bg-white/10 text-ink-soft dark:text-ink-inv/80',
  }[meta.tone] || 'bg-paper text-ink-faint';
  return (
    <button onClick={() => forceFlush()} title="Klik untuk sinkron sekarang"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-extrabold transition press ${tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.state === 'OFFLINE' ? 'bg-gold' : st.state === 'SYNC_ERROR' ? 'bg-brick' : 'bg-leaf-500'} ${st.syncing ? 'animate-pulse-dot' : ''}`} />
      {compact ? (st.state === 'ONLINE' ? 'Online' : st.state === 'OFFLINE' ? 'Offline' : st.state === 'SYNCING' ? 'Sync…' : 'Sync error')
        : <>{meta.label}{st.pending > 0 ? ` · ${st.pending} antre` : ''}</>}
    </button>
  );
};

// ------------------------------------------------------------
// Hook: mirror data finansial (refresh saat ada sinkronisasi)
// ------------------------------------------------------------
export const useFinMirrors = (activeTab = null) => {
  const read = () => ({
    history: safeParse('pos_history_db', []),
    activeOrders: safeParse('active_orders_db', []),
    settlements: safeParse('settlement_db', []),
    shiftLogs: safeParse('shift_log_db', []),
    cashEvents: safeParse('cash_event_db', []),
    products: safeParse('product_stock_db', []),
    profile: safeParse('store_profile', {}),
  });
  const [data, setData] = useState(read);
  useEffect(() => {
    const h = () => setData(read());
    window.addEventListener('welp_db_sync', h);
    window.addEventListener('welp_sync_evt', h);
    if (activeTab) setData(read());
    return () => {
      window.removeEventListener('welp_db_sync', h);
      window.removeEventListener('welp_sync_evt', h);
    };
  }, [activeTab]);
  return data;
};

// Permissi efektif sesi (matrix role + custom role dari mirror pengaturan)
export const permsOfSession = (licenseInfo) =>
  permsOf(licenseInfo?.currentUserRole || 'kasir', safeParse('pengaturan_db', []));

// Tulis ulang satu order ke mirror + outbox (idempoten via clientTxId)
export const commitOrder = (licenseInfo, order) => {
  const docId = order.clientTransactionId || order.id;
  commitFinanceDoc({ tenantId: licenseInfo?.id, localKey: 'pos_history_db', docId, data: order });
};

// Kembalikan stok produk + bahan baku saat void (opsional oleh approver)
// v21.1: hanya saat Stock Tracking ON — pesanan saat tracking OFF tidak
// pernah menurunkan stok, jadi tidak ada yang perlu dikembalikan (spec #10).
export const restoreStockForOrder = (licenseInfo, order, productsOverride = null) => {
  if (!stockTrackingOn()) return null;
  const products = productsOverride || safeParse('product_stock_db', []);
  const updated = products.map(p => {
    const inOrder = (order.items || []).find(i => i.id === p.id);
    return inOrder ? { ...p, stock: (p.stock || 0) + inOrder.qty } : p;
  });
  dbSet(licenseInfo?.id, 'product_stock_db', updated);
  if (order.materialUsage) {
    const raw = safeParse('raw_material_db', []);
    const updRaw = [...raw];
    Object.values(order.materialUsage).flat().forEach(({ rawMaterialId, qty }) => {
      const idx = updRaw.findIndex(rm => rm.id === rawMaterialId);
      if (idx >= 0) updRaw[idx].stock = (updRaw[idx].stock || 0) + qty;
    });
    dbSet(licenseInfo?.id, 'raw_material_db', updRaw);
  }
  return updated;
};

// ------------------------------------------------------------
// REFUND SELESAI — menandai refund REFUND_PROCESSING menjadi
// REFUNDED setelah provider mengonfirmasi (nomor referensi wajib).
// Melengkapi siklus: REFUND_PENDING → PROCESSING → REFUNDED.
// ------------------------------------------------------------
export const RefundCompleteModal = ({ order, refund, licenseInfo, onClose, onDone, triggerAlert }) => {
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const perms = permsOfSession(licenseInfo);
  const allowed = perms.has('transaction.refund');
  const actor = licenseInfo?.employeeName || licenseInfo?.tenant || '-';

  if (!order || !refund) return null;

  const complete = () => {
    if (!ref.trim()) { setErr('Nomor referensi provider wajib diisi sebagai bukti.'); return; }
    setBusy(true);
    const refunds = (order.refunds || []).map(r => r.refundId === refund.refundId
      ? { ...r, status: 'REFUNDED', processedAt: Date.now(), providerRef: ref.trim(), completedBy: actor }
      : r);
    const updated = { ...order, refunds, txState: txStateOf({ ...order, refunds }), syncStatus: 'PENDING' };
    commitOrder(licenseInfo, updated);
    auditLog(licenseInfo, 'REFUND_SELESAI', {
      target: order.id, refundId: refund.refundId, amount: refund.amount,
      metode: refund.method, referensi: ref.trim(),
    }, { actor });
    triggerAlert(`Refund ${formatIDR(refund.amount)} ditandai selesai (referensi tersimpan).`, 'success');
    setBusy(false);
    onDone?.(updated); onClose();
  };

  return (
    <div className="fixed inset-0 z-[126] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-surface dark:bg-surface-dark w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-pop animate-pop p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="kicker">Tandai Refund Selesai</p>
            <p className="text-[11px] font-bold text-ink-faint mt-0.5">{refund.method} · {formatIDR(refund.amount)} · {refund.reason || '-'}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick transition"><X className="w-4 h-4" /></button>
        </div>
        {!allowed ? (
          <p className="px-3 py-2.5 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-xs font-bold">Role Anda tidak memiliki izin transaction.refund.</p>
        ) : (
          <>
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Nomor Referensi Provider (wajib)</label>
              <input className="field font-mono" placeholder="mis. RF-99182-2026" value={ref} onChange={e => setRef(e.target.value)} />
              <p className="text-[10px] text-ink-faint font-bold mt-1.5">Dari dasbor provider (Midtrans/e-wallet/bank). Tersimpan permanen sebagai bukti refund.</p>
            </div>
            {err && <p className="px-3 py-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-xs font-bold">{err}</p>}
            <Button onClick={complete} disabled={busy} className="w-full py-3" icon={Undo2}>{busy ? 'Memproses…' : 'Refund Selesai'}</Button>
          </>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// VOID — transaksi lunas/pending dibatalkan dengan izin & alasan.
// Original transaction TIDAK dihapus; voidInfo menempel di record.
// ------------------------------------------------------------
export const VoidModal = ({ order, licenseInfo, onClose, onDone, triggerAlert }) => {
  const [reason, setReason] = useState('');
  const [stockReturn, setStockReturn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const perms = permsOfSession(licenseInfo);
  const allowed = perms.has('transaction.void');
  const actor = licenseInfo?.employeeName || licenseInfo?.tenant || '-';
  const actorRole = licenseInfo?.currentUserRole || 'owner';

  if (!order) return null;

  const doVoid = async () => {
    if (!reason.trim()) { setErr('Alasan void wajib diisi (jejak audit).'); return; }
    setBusy(true); setErr('');
    try {
      const voidInfo = buildVoid({ order, reason, actor, actorRole, approver: actor, stockReturned: stockReturn });
      const updated = {
        ...order,
        voidInfo,
        voidedAt: voidInfo.voidedAt,
        status: 'voided',                       // status legacy turunan
        txState: TX_STATE.VOIDED,
        syncStatus: 'PENDING',
      };
      commitOrder(licenseInfo, updated);
      if (stockReturn) restoreStockForOrder(licenseInfo, order);
      auditLog(licenseInfo, 'VOID_TRANSAKSI', {
        target: order.id, clientTxId: updated.clientTransactionId || order.id,
        total: order.total, alasan: voidInfo.reason, stokKembali: stockReturn,
      }, { actor, actorRole });
      triggerAlert('Transaksi dibatalkan (void). Riwayat asli tetap tersimpan.', 'success');
      onDone?.(updated); onClose();
    } catch (e) {
      setErr(e?.message || 'Gagal membatalkan transaksi.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-surface dark:bg-surface-dark w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-pop animate-pop flex flex-col max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 pb-3 flex items-start justify-between shrink-0">
          <div>
            <p className="kicker">Void Transaksi</p>
            <h3 className="font-extrabold text-ink dark:text-ink-inv text-base mt-0.5">#{String(order.id).slice(-8)}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-4 space-y-4 overflow-y-auto custom-scrollbar">
          {!allowed && (
            <div className="p-3.5 rounded-2xl bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick text-xs font-bold flex gap-2">
              <PerisaiBuddy className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Role <b>{actorRole}</b> tidak memiliki izin <b>transaction.void</b>. Minta Owner/Manager yang berwenang melakukan void — semua akses dikontrol server.</span>
            </div>
          )}
          <div className="p-3.5 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-faint font-bold">Total</span><span className="font-extrabold text-ink dark:text-ink-inv money">{formatIDR(order.total)}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint font-bold">Metode</span><span className="font-extrabold text-ink dark:text-ink-inv">{order.paymentMethod || '-'}</span></div>
            {refundedAmountOf(order) > 0 && <div className="flex justify-between"><span className="text-ink-faint font-bold">Sudah direfund</span><span className="font-extrabold text-brick money">{formatIDR(refundedAmountOf(order))}</span></div>}
          </div>
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Alasan Void (tercatat di audit)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="field resize-none" placeholder="Contoh: salah input kasir, pesanan dibatalkan pelanggan…" />
          </div>
          <label className="flex items-center gap-2.5 text-xs font-bold text-ink-soft dark:text-ink-inv/80 cursor-pointer select-none">
            <input type="checkbox" checked={stockReturn} onChange={e => setStockReturn(e.target.checked)} className="w-4 h-4 accent-flame-600" />
            Kembalikan stok produk & bahan baku
          </label>
          {err && <p className="px-3 py-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-xs font-bold">{err}</p>}
          <p className="text-[10px] text-ink-faint font-bold flex gap-1.5"><PerisaiBuddy className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Riwayat asli tidak dihapus — status menjadi VOIDED, pelakunya, alasan, dan waktu dicatat permanen di audit log.</p>
        </div>
        <div className="p-4 border-t border-line dark:border-line-dark shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark font-extrabold text-xs text-ink-soft dark:text-ink-inv/80 press">Batal</button>
          <Button onClick={doVoid} disabled={!allowed || busy} className="flex-1 py-3 !bg-brick hover:!bg-brick-deep" icon={busy ? RefreshCw : Ban}>
            {busy ? 'Memproses…' : 'Void Transaksi'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// REFUND — penuh / sebagian, dengan metode & status nyata:
//   Cash  → REFUNED saat disetujui (uang diberikan langsung)
//   QRIS/e-wallet/bank → REFUND_PROCESSING (menunggu provider;
//   providerRef = integration boundary, diisi bila API terhubung)
// ------------------------------------------------------------
export const RefundModal = ({ order, licenseInfo, onClose, onDone, triggerAlert }) => {
  const [mode, setMode] = useState('full');                 // 'full' | 'partial'
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState(order?.paymentMethod || 'Cash');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const perms = permsOfSession(licenseInfo);
  const allowed = perms.has('transaction.refund');
  const actor = licenseInfo?.employeeName || licenseInfo?.tenant || '-';
  const actorRole = licenseInfo?.currentUserRole || 'owner';
  const maxRefund = order ? netTotalOf(order) : 0;
  const instant = method === 'Cash';

  useEffect(() => { if (mode === 'full') setAmount(maxRefund); if (mode === 'partial') setAmount(0); }, [mode, maxRefund]);

  if (!order) return null;
  const methods = ['Cash', 'QRIS', ...(safeParse('store_profile', {})?.payment?.ewallets?.map(w => w.type) || []),
    ...(safeParse('store_profile', {})?.payment?.bank?.map(b => b.bank) || [])];

  const doRefund = async () => {
    if (!allowed) { setErr('Tidak memiliki izin transaction.refund.'); return; }
    if (!reason.trim()) { setErr('Alasan refund wajib diisi (jejak audit).'); return; }
    setBusy(true); setErr('');
    try {
      const refund = buildRefund({ order, amount, reason, actor, actorRole, approver: actor, method, instant });
      const updated = {
        ...order,
        refunds: [...(Array.isArray(order.refunds) ? order.refunds : []), refund],
        txState: txStateOf({ ...order, refunds: [...(Array.isArray(order.refunds) ? order.refunds : []), refund] }),
        syncStatus: 'PENDING',
      };
      commitOrder(licenseInfo, updated);
      auditLog(licenseInfo, 'REFUND_TRANSAKSI', {
        target: order.id, refundId: refund.refundId, amount: refund.amount,
        metode: refund.method, tipe: mode, alasan: refund.reason, status: refund.status,
      }, { actor, actorRole });
      triggerAlert(instant
        ? `Refund ${formatIDR(refund.amount)} dicatat (uang diberikan langsung).`
        : `Refund ${formatIDR(refund.amount)} masuk status DIPROSES — selesaikan di dashboard provider, lalu tandai selesai.`, 'success');
      onDone?.(updated); onClose();
    } catch (e) {
      setErr(e?.message || 'Gagal mencatat refund.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-surface dark:bg-surface-dark w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-pop animate-pop flex flex-col max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 pb-3 flex items-start justify-between shrink-0">
          <div>
            <p className="kicker">Refund Transaksi</p>
            <h3 className="font-extrabold text-ink dark:text-ink-inv text-base mt-0.5">#{String(order.id).slice(-8)} · maks {formatIDR(maxRefund)}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-4 space-y-4 overflow-y-auto custom-scrollbar">
          {!allowed && (
            <div className="p-3.5 rounded-2xl bg-brick-soft dark:bg-brick/10 border border-brick/25 text-brick-deep dark:text-brick text-xs font-bold flex gap-2">
              <PerisaiBuddy className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Role <b>{actorRole}</b> tidak memiliki izin <b>transaction.refund</b>. Minta pihak berwenang (Owner/Manager/Supervisor).</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[['full', 'Refund Penuh'], ['partial', 'Refund Sebagian']].map(([k, lbl]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`py-2.5 rounded-xl text-xs font-extrabold border transition press ${mode === k ? 'bg-flame-600 text-white border-flame-600 shadow-card' : 'bg-surface dark:bg-surface-dark border-line dark:border-line-dark text-ink-soft'}`}>{lbl}</button>
            ))}
          </div>
          {mode === 'partial' && (
            <NumericInput label="Nominal Refund" prefix="Rp" value={amount} onChange={v => setAmount(Math.min(v, maxRefund))} />
          )}
          <Select label="Metode Refund" value={method} options={methods} onChange={setMethod} />
          {!instant && (
            <p className="text-[10px] text-ink-faint font-bold leading-relaxed flex gap-1.5">
              <WaktuReal className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Refund non-tunai masuk status DIPROSES sampai provider mengonfirmasi. Saat provider API WELP terhubung, status mengikuti provider otomatis.
            </p>
          )}
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Alasan Refund (tercatat di audit)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="field resize-none" placeholder="Contoh: barang rusak, pesanan tidak sesuai…" />
          </div>
          {err && <p className="px-3 py-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-xs font-bold">{err}</p>}
          <div className="p-3.5 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-ink-faint font-bold">Total transaksi</span><span className="font-extrabold money text-ink dark:text-ink-inv">{formatIDR(order.total)}</span></div>
            <div className="flex justify-between"><span className="text-ink-faint font-bold">Sudah direfund</span><span className="font-extrabold money text-brick">{formatIDR(refundedAmountOf(order))}</span></div>
            <div className="flex justify-between border-t border-dashed border-line dark:border-line-dark pt-1.5"><span className="text-ink-faint font-bold">Refund kali ini</span><span className="font-extrabold money text-flame-700 dark:text-apricot">{formatIDR(amount)}</span></div>
          </div>
        </div>
        <div className="p-4 border-t border-line dark:border-line-dark shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark font-extrabold text-xs text-ink-soft dark:text-ink-inv/80 press">Batal</button>
          <Button onClick={doRefund} disabled={!allowed || busy || amount <= 0} className="flex-1 py-3" icon={busy ? RefreshCw : Undo2}>
            {busy ? 'Memproses…' : instant ? 'Refund Sekarang' : 'Ajukan Refund'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// SHIFT PANEL — siklus kas harian kasir:
//   Buka Shift (modal awal) → transaksi berjalan → Uang Masuk/
//   Keluar → Tutup Shift (hitung fisik → selisih MATCHED/SHORT/OVER)
// ------------------------------------------------------------
export const ShiftPanel = ({ licenseInfo, triggerAlert, compact = false }) => {
  const { history, activeOrders, shiftLogs, cashEvents } = useFinMirrors();
  const [modal, setModal] = useState(null);   // 'open' | 'in' | 'out' | 'close'
  const perms = permsOfSession(licenseInfo);
  const canOpen = perms.has('shift.open'), canClose = perms.has('shift.close'), canView = perms.has('shift.view') || canOpen || canClose;

  const branchId = licenseInfo?.branchId || 'PUSAT';
  const stationCode = licenseInfo?.stationCode || null;
  const shift = openShiftOf(shiftLogs, { branchId, stationCode });
  const allOrders = [...(history || []), ...(activeOrders || []).filter(o => !o.paidAt)];
  const calc = shift ? expectedCashOf({ shiftLog: shift, orders: allOrders, cashEvents }) : null;
  const actor = licenseInfo?.employeeName || licenseInfo?.tenant || '-';
  const actorRole = licenseInfo?.currentUserRole || 'kasir';

  if (!canView) return null;

  const saveShiftLog = (rec) => commitFinanceDoc({ tenantId: licenseInfo?.id, localKey: 'shift_log_db', docId: rec.id, data: rec });
  const saveCashEvent = (rec) => commitFinanceDoc({ tenantId: licenseInfo?.id, localKey: 'cash_event_db', docId: rec.id, data: rec });

  return (
    <>
      {!shift ? (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-dashed border-gold/50 bg-gold-soft/40 dark:bg-gold/10 ${compact ? '' : 'mb-4'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Toko className="w-4.5 h-4.5 text-gold-deep dark:text-gold shrink-0" />
            <p className="text-[11px] font-extrabold text-gold-deep dark:text-gold truncate">Shift belum dibuka — buka shift sebelum melayani pembayaran tunai.</p>
          </div>
          {canOpen && <Button onClick={() => setModal('open')} className="shrink-0 !py-2 !px-3.5 !text-[11px]">Buka Shift</Button>}
        </div>
      ) : (
        <div className={`card !rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${compact ? '' : 'mb-4'}`}>
          <div className="min-w-0">
            <p className="kicker">Shift Aktif · dibuka {new Date(shift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] font-extrabold text-ink dark:text-ink-inv">
              <span>Kas di laci (est.) <span className="money text-flame-700 dark:text-apricot">{formatIDR(calc.expected)}</span></span>
              <span className="text-ink-faint">Penjualan tunai {formatIDR(calc.cashSales)}</span>
              {calc.cashIn > 0 && <span className="text-leaf-deep dark:text-leaf">Masuk {formatIDR(calc.cashIn)}</span>}
              {calc.cashOut > 0 && <span className="text-brick">Keluar {formatIDR(calc.cashOut)}</span>}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setModal('in')} className="px-3 py-2 rounded-xl bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf text-[10.5px] font-extrabold press flex items-center gap-1.5"><Uang className="w-3.5 h-3.5" /> Uang Masuk</button>
            <button onClick={() => setModal('out')} className="px-3 py-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick text-[10.5px] font-extrabold press flex items-center gap-1.5"><KasKeluar className="w-3.5 h-3.5" /> Uang Keluar</button>
            {canClose && <Button onClick={() => setModal('close')} className="!py-2 !px-3.5 !text-[11px]">Tutup Shift</Button>}
          </div>
        </div>
      )}

      {modal === 'open' && <OpenShiftModal licenseInfo={licenseInfo} branchId={branchId} stationCode={stationCode} actor={actor} actorRole={actorRole} onSave={(rec) => { saveShiftLog(rec); auditLog(licenseInfo, 'SHIFT_OPEN', { target: rec.id, modalAwal: rec.openingCash }, { actor, actorRole }); triggerAlert('Shift dibuka. Semua transaksi kini tercatat pada shift ini.', 'success'); }} onClose={() => setModal(null)} />}
      {modal === 'in' && <CashEventModal kind="CASH_IN" licenseInfo={licenseInfo} shift={shift} actor={actor} actorRole={actorRole} onSave={(rec) => { saveCashEvent(rec); auditLog(licenseInfo, 'KAS_MASUK', { target: rec.id, amount: rec.amount, note: rec.note }, { actor, actorRole }); triggerAlert(`Uang masuk ${formatIDR(rec.amount)} dicatat.`, 'success'); }} onClose={() => setModal(null)} />}
      {modal === 'out' && <CashEventModal kind="CASH_OUT" licenseInfo={licenseInfo} shift={shift} actor={actor} actorRole={actorRole} onSave={(rec) => { saveCashEvent(rec); auditLog(licenseInfo, 'KAS_KELUAR_SHIFT', { target: rec.id, amount: rec.amount, note: rec.note }, { actor, actorRole }); triggerAlert(`Uang keluar ${formatIDR(rec.amount)} dicatat.`, 'success'); }} onClose={() => setModal(null)} />}
      {modal === 'close' && <CloseShiftModal licenseInfo={licenseInfo} shift={shift} calc={calc} allOrders={allOrders} cashEvents={cashEvents} actor={actor} actorRole={actorRole} onSave={(rec) => { saveShiftLog(rec); auditLog(licenseInfo, 'SHIFT_CLOSE', { target: rec.shiftLogId, expected: rec.expectedCash, actual: rec.actualCash, difference: rec.difference, result: rec.result }, { actor, actorRole }); triggerAlert(`Shift ditutup. Kas ${SHIFT_RESULT_META[rec.result]?.label || rec.result}: ${formatIDR(Math.abs(rec.difference))}.`, rec.result === 'MATCHED' ? 'success' : 'error'); }} onClose={() => setModal(null)} />}
    </>
  );
};

/* ---- Modal: buka shift ---- */
const OpenShiftModal = ({ licenseInfo, branchId, stationCode, actor, actorRole, onSave, onClose }) => {
  const [opening, setOpening] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = () => {
    setBusy(true);
    const id = newShiftLogId();
    onSave({
      id, shiftLogId: id, type: 'open',
      branchId, stationCode,
      employeeId: licenseInfo?.employeeId || null,
      employeeName: licenseInfo?.employeeName || actor,
      openingCash: opening, openedAt: Date.now(), date: new Date().toISOString(),
      device: licenseInfo?.stationCode || 'web',
      shiftNama: licenseInfo?.shiftNama || null,
    });
    setBusy(false); onClose();
  };
  return (
    <ModalShell title="Buka Shift" sub="Masukkan modal kas awal di laci" onClose={onClose}>
      <NumericInput label="Modal Kas Awal" prefix="Rp" value={opening} onChange={setOpening} />
      <p className="text-[10px] text-ink-faint font-bold">Kasir: {actor} · Cabang: {branchId}{stationCode ? ` · Station: ${stationCode}` : ''}</p>
      <Button onClick={start} disabled={busy} className="w-full py-3">Buka Shift Sekarang</Button>
    </ModalShell>
  );
};

/* ---- Modal: uang masuk / keluar ---- */
const CashEventModal = ({ kind, licenseInfo, shift, actor, actorRole, onSave, onClose }) => {
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isIn = kind === 'CASH_IN';
  const save = () => {
    if (amount <= 0) return;
    setBusy(true);
    const id = newCashEventId();
    onSave({
      id, cashEventId: id, type: kind,
      amount, note: note.trim() || (isIn ? 'Setoran / tambah modal' : 'Pengambilan kas'),
      shiftLogId: shift?.shiftLogId || null,
      branchId: shift?.branchId || licenseInfo?.branchId || 'PUSAT',
      stationCode: licenseInfo?.stationCode || null,
      employeeName: actor, employeeRole: actorRole,
      date: new Date().toISOString(), createdAt: Date.now(),
    });
    setBusy(false); onClose();
  };
  return (
    <ModalShell title={isIn ? 'Catat Uang Masuk' : 'Catat Uang Keluar'} sub={isIn ? 'Setoran tambahan / pemasukan lain ke laci' : 'Pengambilan kas untuk kebutuhan operasional'} onClose={onClose}>
      <NumericInput label="Nominal" prefix="Rp" value={amount} onChange={setAmount} />
      <input className="field" placeholder="Keterangan (contoh: beli es batu, setoran owner)" value={note} onChange={e => setNote(e.target.value)} />
      <Button onClick={save} disabled={busy || amount <= 0} className={`w-full py-3 ${isIn ? '' : '!bg-brick hover:!bg-brick-deep'}`}>{isIn ? 'Catat Masuk' : 'Catat Keluar'}</Button>
    </ModalShell>
  );
};

/* ---- Modal: tutup shift ---- */
const CloseShiftModal = ({ licenseInfo, shift, calc, allOrders, cashEvents, actor, actorRole, onSave, onClose }) => {
  const [actual, setActual] = useState(0);
  const [busy, setBusy] = useState(false);
  const res = closeShiftResult(calc.expected, actual);
  const meta = SHIFT_RESULT_META[res.result];
  const close = () => {
    setBusy(true);
    const id = newShiftLogId();
    onSave({
      id, shiftLogId: shift.shiftLogId, type: 'close',
      branchId: shift.branchId, stationCode: shift.stationCode,
      openingCash: calc.opening, cashSales: calc.cashSales, cashIn: calc.cashIn, cashOut: calc.cashOut,
      expectedCash: calc.expected, actualCash: actual, difference: res.difference, result: res.result,
      openedAt: shift.openedAt, closedAt: Date.now(), closedBy: actor, closedByRole: actorRole,
      employeeName: shift.employeeName || actor, date: new Date().toISOString(),
      txCount: allOrders.length, cashEventCount: (cashEvents || []).filter(e => e.shiftLogId === shift.shiftLogId).length,
    });
    setBusy(false); onClose();
  };
  const row = (lbl, val, cls = '') => (
    <div className="flex justify-between text-xs font-bold"><span className="text-ink-faint">{lbl}</span><span className={`money font-extrabold ${cls}`}>{formatIDR(val)}</span></div>
  );
  return (
    <ModalShell title="Tutup Shift" sub="Hitung uang fisik di laci, bandingkan dengan catatan sistem" onClose={onClose}>
      <div className="p-3.5 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark space-y-1.5">
        {row('Modal awal', calc.opening)}
        {row('Penjualan tunai', calc.cashSales, 'text-leaf-deep dark:text-leaf')}
        {row('Uang masuk', calc.cashIn, 'text-leaf-deep dark:text-leaf')}
        {row('Uang keluar', -calc.cashOut, 'text-brick')}
        <div className="border-t border-dashed border-line dark:border-line-dark pt-1.5" />
        {row('Kas seharusnya', calc.expected, 'text-ink dark:text-ink-inv')}
      </div>
      <NumericInput label="Kas Fisik Dihitung" prefix="Rp" value={actual} onChange={setActual} />
      <div className={`p-3 rounded-2xl text-center border ${res.result === 'MATCHED' ? 'bg-leaf-soft dark:bg-leaf/10 border-leaf/30' : res.result === 'SHORT' ? 'bg-brick-soft dark:bg-brick/10 border-brick/30' : 'bg-gold-soft dark:bg-gold/10 border-gold/30'}`}>
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Selisih ({meta?.label})</p>
        <p className={`text-xl font-extrabold money mt-0.5 ${res.result === 'MATCHED' ? 'text-leaf-deep dark:text-leaf' : res.result === 'SHORT' ? 'text-brick' : 'text-gold-deep dark:text-gold'}`}>
          {res.difference >= 0 ? '+' : ''}{formatIDR(res.difference)}
        </p>
      </div>
      <Button onClick={close} disabled={busy} className="w-full py-3">Tutup Shift & Simpan Hasil</Button>
    </ModalShell>
  );
};

/* ---- Shell modal kecil bersama ---- */
const ModalShell = ({ title, sub, onClose, children }) => (
  <div className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
    <div className="bg-surface dark:bg-surface-dark w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-pop animate-pop p-5 max-h-[92vh] overflow-y-auto custom-scrollbar space-y-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between">
        <div>
          <p className="kicker">{title}</p>
          {sub && <p className="text-[11px] font-bold text-ink-faint mt-0.5">{sub}</p>}
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick transition"><X className="w-4 h-4" /></button>
      </div>
      {children}
    </div>
  </div>
);
