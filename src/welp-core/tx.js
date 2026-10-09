// ============================================================
// WELP CORE — TRANSACTION / PAYMENT DOMAIN v21
// ------------------------------------------------------------
// Satu sumber kebenaran untuk seluruh domain finansial kasir:
//   • State machine transaksi (SALE → PAYMENT → SETTLEMENT)
//   • Payment records (tunai, QRIS, e-wallet, split-ready)
//   • VOID & REFUND (full/partial) dengan jejak approval
//   • Settlement (gross - MDR/fee - refund ± adjustment = net)
//   • Rekonsiliasi (sales vs settlement, dengan ALASAN beda)
//   • Shift & kas (open/close, uang masuk/keluar, selisih)
//   • ID & idempotency (clientTransactionId aman multi-device)
//
// ATURAN:
//   - Modul ini PURE FUNCTION (tanpa React, tanpa Firestore).
//   - Kompatibel mundur: order lama (status 'pending'/'paid'/
//     'cancelled' tanpa payments[]) tetap terbaca via txStateOf().
//   - Status legacy TIDAK ditimpa; field baru ditambahkan.
//   - TIDAK ada nilai finansial yang di-hardcode: fee/MDR dibaca
//     dari konfigurasi metode (profile.payment.methods).
// ============================================================

// ------------------------------------------------------------
// 1. STATE MACHINE — kanonik, tidak ada string status liar lagi
// ------------------------------------------------------------
export const TX_STATE = {
  SALE_CREATED: 'SALE_CREATED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  SETTLEMENT_PENDING: 'SETTLEMENT_PENDING',
  SETTLED: 'SETTLED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
  VOIDED: 'VOIDED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUND_PROCESSING: 'REFUND_PROCESSING',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
  SETTLEMENT_FAILED: 'SETTLEMENT_FAILED',
  SETTLEMENT_MISMATCH: 'SETTLEMENT_MISMATCH',
};

// Urutan pipeline utama (untuk stepper UI).
export const TX_PIPELINE = [
  TX_STATE.PAYMENT_PENDING,
  TX_STATE.PAYMENT_CONFIRMED,
  TX_STATE.SETTLEMENT_PENDING,
  TX_STATE.SETTLED,
];

// Label & tone untuk badge UI (dipakai lintas POS/History/Finance).
export const TX_STATE_META = {
  SALE_CREATED:         { label: 'Dibuat',            tone: 'grey'  },
  PAYMENT_PENDING:      { label: 'Menunggu Bayar',    tone: 'gold'  },
  PAYMENT_CONFIRMED:    { label: 'Lunas',             tone: 'green' },
  SETTLEMENT_PENDING:   { label: 'Menunggu Settlement', tone: 'blue' },
  SETTLED:              { label: 'Settled',           tone: 'green' },
  PAYMENT_FAILED:       { label: 'Bayar Gagal',       tone: 'red'   },
  PAYMENT_EXPIRED:      { label: 'Kedaluwarsa',       tone: 'red'   },
  VOIDED:               { label: 'Dibatalkan (Void)', tone: 'red'   },
  REFUND_PENDING:       { label: 'Refund Menunggu',   tone: 'gold'  },
  REFUND_PROCESSING:    { label: 'Refund Diproses',   tone: 'blue'  },
  PARTIALLY_REFUNDED:   { label: 'Refund Sebagian',   tone: 'gold'  },
  REFUNDED:             { label: 'Direfund',          tone: 'red'   },
  SETTLEMENT_FAILED:    { label: 'Settlement Gagal',  tone: 'red'   },
  SETTLEMENT_MISMATCH:  { label: 'Selisih Settlement', tone: 'gold' },
};

// ------------------------------------------------------------
// 2. ID GENERATOR — collision-safe lintas perangkat
// ------------------------------------------------------------
const rand36 = (n) => {
  let s = '';
  try {
    const b = new Uint32Array(n);
    crypto.getRandomValues(b);
    for (let i = 0; i < n; i++) s += (b[i] % 36).toString(36);
  } catch (e) {
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 36).toString(36);
  }
  return s;
};
export const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${rand36(6)}`;

// clientTransactionId = kunci idempotensi. Sama untuk 1 transaksi,
// walau request sync dikirim berkali-kali (offline retry, double-tap).
export const newClientTxId = () => uid('ctx');
export const newTxId = () => uid('ord');
export const newPaymentId = () => uid('pay');
export const newRefundId = () => uid('ref');
export const newVoidId = () => uid('vod');
export const newSettlementId = () => uid('stl');
export const newShiftLogId = () => uid('shf');
export const newCashEventId = () => uid('csh');

// ------------------------------------------------------------
// 3. NORMALISASI ORDER & PAYMENT RECORDS
// ------------------------------------------------------------
// Payment record kanonik (order baru). Order legacy tetap sah:
// pseudo-record dibentuk dari paymentMethod/cashTendered.
export const normalizePayments = (order) => {
  if (!order) return [];
  if (Array.isArray(order.payments) && order.payments.length) {
    return order.payments.map(p => ({
      paymentId: p.paymentId || uid('pay'),
      method: p.method || 'Cash',
      amount: Number(p.amount) || 0,
      status: p.status || 'CONFIRMED',
      paidAt: p.paidAt || null,
      confirmedAt: p.confirmedAt || null,
      providerRef: p.providerRef || null,   // integration boundary provider
      cashTendered: p.cashTendered ?? null,
      change: p.change ?? null,
      ...p,
    }));
  }
  // Legacy: satu record dari field lama.
  if (!order.paymentMethod) return [];
  return [{
    paymentId: order.paymentId || uid('pay'),
    method: order.paymentMethod,
    amount: Number(order.total) || 0,
    status: order.status === 'paid' ? 'CONFIRMED' : 'PENDING',
    paidAt: order.paidAt || null,
    confirmedAt: order.paidAt || null,
    providerRef: null,
    cashTendered: order.cashTendered ?? null,
    change: order.change ?? null,
  }];
};

// State kanonik — derivasi dari field baru ATAU legacy.
export const txStateOf = (order) => {
  if (!order) return TX_STATE.SALE_CREATED;

  // 1) VOID menang atas segalanya (terminal, immutable).
  if (order.voidInfo || order.voidedAt || order.status === 'voided') return TX_STATE.VOIDED;
  // Legacy cancel (sebelum bayar) = void pra-pembayaran.
  if (order.status === 'cancelled') return TX_STATE.VOIDED;

  // 2) Refund (bisa terjadi setelah lunas).
  const refunds = Array.isArray(order.refunds) ? order.refunds : [];
  const activeRefunds = refunds.filter(r => r && r.status !== 'DECLINED');
  if (activeRefunds.length) {
    const st = { pending: 0, processing: 0, refunded: 0, failed: 0 };
    activeRefunds.forEach(r => {
      if (r.status === 'REFUNDED') st.refunded++;
      else if (r.status === 'REFUND_FAILED') st.failed++;
      else if (r.status === 'REFUND_PROCESSING') st.processing++;
      else st.pending++;
    });
    const refundedAmt = refundedAmountOf(order);
    if (st.refunded > 0 && refundedAmt >= (Number(order.total) || 0) - 0.5) return TX_STATE.REFUNDED;
    if (st.refunded > 0) return TX_STATE.PARTIALLY_REFUNDED;
    if (st.processing > 0) return TX_STATE.REFUND_PROCESSING;
    if (st.pending > 0) return TX_STATE.REFUND_PENDING;
    if (st.failed > 0 && refundedAmt === 0) return TX_STATE.PAYMENT_CONFIRMED; // refund gagal, penjualan tetap sah
  }

  // 3) Pembayaran (payment records / legacy status).
  const pays = normalizePayments(order);
  const confirmed = pays.filter(p => p.status === 'CONFIRMED');
  const sumConfirmed = confirmed.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const total = Number(order.total) || 0;
  const fullyPaid = sumConfirmed >= total - 0.5 && total > 0;
  if (!fullyPaid) {
    if (pays.some(p => p.status === 'FAILED')) return TX_STATE.PAYMENT_FAILED;
    if (pays.some(p => p.status === 'EXPIRED')) return TX_STATE.PAYMENT_EXPIRED;
    return TX_STATE.PAYMENT_PENDING;
  }

  // 4) Lunas → status settlement (batch-level, dibaca dari flag order).
  if (order.settlementStatus === 'SETTLED') return TX_STATE.SETTLED;
  if (order.settlementStatus === 'SETTLEMENT_FAILED') return TX_STATE.SETTLEMENT_FAILED;
  if (order.settlementStatus === 'SETTLEMENT_MISMATCH') return TX_STATE.SETTLEMENT_MISMATCH;
  return TX_STATE.SETTLEMENT_PENDING;
};

export const isTerminalBad = (s) => [TX_STATE.VOIDED, TX_STATE.REFUNDED, TX_STATE.PAYMENT_FAILED, TX_STATE.PAYMENT_EXPIRED].includes(s);
// Transaksi yang dihitung sebagai penjualan sah.
export const countsAsSale = (order) => {
  const s = txStateOf(order);
  return [TX_STATE.PAYMENT_CONFIRMED, TX_STATE.SETTLEMENT_PENDING, TX_STATE.SETTLED,
    TX_STATE.REFUND_PENDING, TX_STATE.REFUND_PROCESSING, TX_STATE.PARTIALLY_REFUNDED].includes(s);
};

// ------------------------------------------------------------
// 4. VOID & REFUND — matematika & validasi
// ------------------------------------------------------------
export const refundedAmountOf = (order) =>
  (Array.isArray(order?.refunds) ? order.refunds : [])
    .filter(r => r && r.status === 'REFUNDED')
    .reduce((a, r) => a + (Number(r.amount) || 0), 0);

export const netTotalOf = (order) =>
  Math.max(0, (Number(order?.total) || 0) - refundedAmountOf(order));

export const canVoid = (order) => {
  const s = txStateOf(order);
  // Void sah sebelum dana settle di provider. SETTLEMENT_PENDING = uang
  // sudah diterima tapi belum settlement → masih bisa dibatalkan penuh.
  // SETTLED → hanya refund.
  return [TX_STATE.PAYMENT_PENDING, TX_STATE.PAYMENT_CONFIRMED, TX_STATE.SETTLEMENT_PENDING, TX_STATE.SALE_CREATED].includes(s);
};
export const canRefund = (order) => {
  const s = txStateOf(order);
  if (!countsAsSale(order)) return false;
  return netTotalOf(order) > 0;    // masih ada saldo yang bisa direfund
};
export const maxRefundableOf = (order) => canRefund(order) ? netTotalOf(order) : 0;

// Validasi refund parsial: total refund (termasuk yang diproses) tak boleh melebihi total.
export const validateRefund = (order, amount) => {
  const amt = Number(amount) || 0;
  if (amt <= 0) return { ok: false, error: 'Nominal refund harus lebih dari nol.' };
  const committed = (Array.isArray(order?.refunds) ? order.refunds : [])
    .filter(r => r && r.status !== 'DECLINED' && r.status !== 'REFUND_FAILED')
    .reduce((a, r) => a + (Number(r.amount) || 0), 0);
  if (committed + amt > (Number(order?.total) || 0) + 0.5)
    return { ok: false, error: 'Total refund melebihi nilai transaksi.' };
  return { ok: true, amount: amt };
};

// Builder record refund (status awal sesuai metode):
//   Cash   → langsung REFUNDED saat uang diberikan (disetujui).
//   QRIS/e-wallet/bank → REFUND_PROCESSING (menunggu provider);
//   providerRef = integration boundary (isi saat provider terhubung).
export const buildRefund = ({ order, amount, reason, actor, actorRole, approver, method, instant = false }) => {
  const v = validateRefund(order, amount);
  if (!v.ok) throw new Error(v.error);
  return {
    refundId: newRefundId(),
    originalTxId: order.id,
    clientTxId: order.clientTransactionId || order.id,
    paymentId: (normalizePayments(order).find(p => p.status === 'CONFIRMED') || {}).paymentId || null,
    method: method || order.paymentMethod || 'Cash',
    amount: v.amount,
    reason: String(reason || '').trim() || 'Tanpa keterangan',
    requestedBy: actor || '-', requestedRole: actorRole || '-', requestedAt: Date.now(),
    approver: approver || actor || '-', approvedAt: Date.now(),
    status: instant ? 'REFUNDED' : 'REFUND_PROCESSING',
    processedAt: instant ? Date.now() : null,
    providerRef: null,
    branchId: order.branchId || null,
  };
};

export const buildVoid = ({ order, reason, actor, actorRole, approver, stockReturned = true }) => ({
  voidId: newVoidId(),
  originalTxId: order.id,
  clientTxId: order.clientTransactionId || order.id,
  amount: Number(order.total) || 0,
  reason: String(reason || '').trim() || 'Tanpa keterangan',
  requestedBy: actor || '-', requestedRole: actorRole || '-', requestedAt: Date.now(),
  approver: approver || actor || '-', approvedAt: Date.now(),
  voidedAt: Date.now(),
  stockReturned: !!stockReturned,
  branchId: order.branchId || null,
});

// ------------------------------------------------------------
// 5. SETTLEMENT — gross, fee/MDR, refund, adjustment, net
// ------------------------------------------------------------
// Konfigurasi metode (integration boundary): Owner mengatur di
// Metode Pembayaran. Nilai default 0 = belum dikonfigurasi.
export const methodCfgOf = (payment, method) => {
  const cfg = payment?.methods?.[method] || {};
  return {
    feePercent: Number(cfg.feePercent) || 0,
    feeFixed: Number(cfg.feeFixed) || 0,
    account: cfg.account || '',
    label: cfg.label || method,
  };
};

export const feeOf = (amount, cfg) =>
  Math.round((Number(amount) || 0) * (cfg.feePercent || 0) / 100 + (cfg.feeFixed || 0));

// Kumpulkan penjualan sah per metode untuk satu tanggal (YYYY-MM-DD)
// di satu cabang. Return: { method: { gross, refunds, txIds, refundIds } }
export const salesByMethodForDate = (orders, dateKey, branchId = null) => {
  const out = {};
  (orders || []).forEach(o => {
    if (!countsAsSale(o)) return;
    if (branchId && (o.branchId || 'PUSAT') !== branchId) return;
    const d = dateKeyOfMs(Date.parse(o.date) || Date.parse(o.paidAt) || 0);
    if (d !== dateKey) return;
    const pays = normalizePayments(o).filter(p => p.status === 'CONFIRMED');
    const m = pays[0]?.method || o.paymentMethod || 'Cash';
    if (!out[m]) out[m] = { gross: 0, refunds: 0, txIds: [], refundIds: [] };
    out[m].gross += Number(o.total) || 0;   // gross = nilai transaksi penuh
    out[m].txIds.push(o.clientTransactionId || o.id);
    (o.refunds || []).forEach(r => {
      if (r && r.status === 'REFUNDED') { out[m].refunds += Number(r.amount) || 0; out[m].refundIds.push(r.refundId); }
    });
  });
  return out;
};

export const buildSettlementDraft = ({ orders, dateKey, method, payment, branchId = null }) => {
  const agg = (salesByMethodForDate(orders, dateKey, branchId))[method];
  if (!agg || (!agg.txIds.length)) return null;
  const cfg = methodCfgOf(payment, method);
  const fee = feeOf(agg.gross, cfg);
  const net = agg.gross - fee - agg.refunds;
  const settlementId = newSettlementId();
  return {
    id: settlementId,              // kunci mirror Firestore (dbSet/idOf)
    settlementId,
    method,
    branchId: branchId || 'PUSAT',
    periodDate: dateKey,
    grossAmount: agg.gross,
    feeAmount: fee,
    mdrPercent: cfg.feePercent,
    refundAmount: agg.refunds,
    adjustment: 0,
    adjustmentReason: '',
    netAmount: net,
    status: 'PENDING',
    destination: cfg.account || '',
    referenceNumber: '',
    settlementDate: null,
    txIds: agg.txIds,
    refundIds: agg.refundIds,
    createdAt: Date.now(), createdBy: null,
    confirmedAt: null, confirmedBy: null, note: '',
    providerRef: null,   // ← integration boundary: isi bila provider API terhubung
    source: 'manual',    // 'manual' | 'provider' (masa depan)
  };
};

export const SETTLEMENT_STATE_META = {
  PENDING:   { label: 'Menunggu', tone: 'gold' },
  PROCESSING:{ label: 'Diproses', tone: 'blue' },
  SETTLED:   { label: 'Settled', tone: 'green' },
  FAILED:    { label: 'Gagal', tone: 'red' },
  MISMATCH:  { label: 'Selisih', tone: 'gold' },
};

// ------------------------------------------------------------
// 6. REKONSILIASI — sales vs settlement, dengan ALASAN beda
// ------------------------------------------------------------
export const RECON_STATUS = { MATCHED: 'MATCHED', MISMATCH: 'MISMATCH', PENDING: 'PENDING' };

export const reconcile = ({ orders, settlement, dateKey, payment }) => {
  const reasons = [];
  const agg = (salesByMethodForDate(orders, dateKey, settlement.branchId))[settlement.method] || { gross: 0, refunds: 0, txIds: [], refundIds: [] };

  // Tx di settlement yang tidak ada di penjualan (duplikat / salah cabang / salah tanggal).
  const saleSet = new Set(agg.txIds);
  const extra = (settlement.txIds || []).filter(id => !saleSet.has(id));
  if (extra.length) reasons.push({
    type: 'EXTRA_IN_SETTLEMENT', amount: null,
    detail: `${extra.length} transaksi tercatat di settlement tapi tidak ada di penjualan ${dateKey} (kemungkinan duplikat, salah tanggal, atau salah cabang): ${extra.slice(0, 3).join(', ')}${extra.length > 3 ? '…' : ''}`,
  });
  // Tx penjualan yang tidak masuk settlement (missing / partial).
  const stlSet = new Set(settlement.txIds || []);
  const missing = agg.txIds.filter(id => !stlSet.has(id));
  if (missing.length) reasons.push({
    type: 'MISSING_IN_SETTLEMENT', amount: null,
    detail: `${missing.length} transaksi penjualan belum masuk settlement: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
  });

  const expectedNet = settlement.grossAmount - settlement.feeAmount - settlement.refundAmount + (Number(settlement.adjustment) || 0);
  const cfg = methodCfgOf(payment, settlement.method);
  const recomputedFee = feeOf(settlement.grossAmount, cfg);
  if (settlement.feeAmount !== recomputedFee) reasons.push({
    type: 'FEE_DIFF', amount: settlement.feeAmount - recomputedFee,
    detail: `Fee tercatat ${fmt(settlement.feeAmount)} ≠ perhitungan config ${cfg.feePercent}% + ${fmt(cfg.feeFixed)} = ${fmt(recomputedFee)}. Konfigurasi metode mungkin berubah setelah settlement dibuat.`,
  });
  if ((settlement.refundAmount || 0) !== agg.refunds) reasons.push({
    type: 'REFUND_DIFF', amount: (settlement.refundAmount || 0) - agg.refunds,
    detail: `Refund di settlement ${fmt(settlement.refundAmount || 0)} ≠ refund penjualan ${fmt(agg.refunds)}. Refund baru mungkin terjadi setelah settlement dibuat.`,
  });
  if (Number(settlement.adjustment) || 0) reasons.push({
    type: 'ADJUSTMENT', amount: Number(settlement.adjustment) || 0,
    detail: `Ada penyesuaian manual ${fmt(Math.abs(settlement.adjustment))}${settlement.adjustmentReason ? `: ${settlement.adjustmentReason}` : ''}`,
  });
  if (['PENDING', 'PROCESSING'].includes(settlement.status)) reasons.push({
    type: 'PROVIDER_DELAY', amount: null,
    detail: 'Settlement belum dikonfirmasi — dana belum masuk rekening. Cocokkan setelah provider menyelesaikan siklus settlement.',
  });
  if (Math.abs(settlement.netAmount - expectedNet) > 0.5) reasons.push({
    type: 'NET_DIFF', amount: settlement.netAmount - expectedNet,
    detail: `Net tercatat ${fmt(settlement.netAmount)} ≠ komponen (gross − fee − refund ± adjustment = ${fmt(expectedNet)}).`,
  });

  let status;
  if (['PENDING', 'PROCESSING'].includes(settlement.status)) status = RECON_STATUS.PENDING;
  else if (reasons.length === 0) status = RECON_STATUS.MATCHED;
  else status = RECON_STATUS.MISMATCH;
  return { status, reasons, expected: { gross: settlement.grossAmount, fee: settlement.feeAmount, refunds: settlement.refundAmount, net: settlement.netAmount }, actual: { txCount: agg.txIds.length, gross: agg.gross, refunds: agg.refunds } };
};

// ------------------------------------------------------------
// 7. SHIFT & KAS — open, cash in/out, close dengan selisih
// ------------------------------------------------------------
export const SHIFT_RESULT_META = {
  MATCHED: { label: 'Cocok', tone: 'green' },
  SHORT:   { label: 'Kurang', tone: 'red' },
  OVER:    { label: 'Lebih', tone: 'blue' },
};

// Shift terbuka = log 'open' tanpa pasangan 'close' (urut waktu).
export const openShiftOf = (shiftLogs, { branchId, stationCode }) =>
  (shiftLogs || [])
    .filter(l => l && l.type === 'open' && (l.branchId || 'PUSAT') === (branchId || 'PUSAT')
      && (!stationCode || !l.stationCode || l.stationCode === stationCode)
      && !((shiftLogs || []).some(c => c.type === 'close' && c.shiftLogId === l.shiftLogId)))
    .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))[0] || null;

// Penjualan tunai dalam rentang shift (sudah lunas, tidak void).
export const cashSalesInWindow = (orders, { fromMs, toMs, branchId, stationCode }) =>
  (orders || []).filter(o => {
    const st = txStateOf(o);
    if (![TX_STATE.PAYMENT_CONFIRMED, TX_STATE.SETTLEMENT_PENDING, TX_STATE.SETTLED, TX_STATE.PARTIALLY_REFUNDED].includes(st)) return false;
    const t = Date.parse(o.paidAt || o.date) || 0;
    if (t < fromMs || (toMs && t > toMs)) return false;
    if (branchId && (o.branchId || 'PUSAT') !== branchId) return false;
    if (stationCode && o.stationCode && stationCode !== o.stationCode) return false;
    const pays = normalizePayments(o);
    return pays.some(p => p.method === 'Cash' && p.status === 'CONFIRMED');
  }).reduce((a, o) => a + netTotalOf(o), 0);

// Uang kas harapan saat close = modal awal + penjualan tunai + masuk − keluar.
export const expectedCashOf = ({ shiftLog, orders, cashEvents, closeMs = Date.now() }) => {
  const from = shiftLog?.openedAt || 0;
  const branchId = shiftLog?.branchId, stationCode = shiftLog?.stationCode;
  const cashSales = cashSalesInWindow(orders, { fromMs: from, toMs: closeMs, branchId, stationCode });
  const evs = (cashEvents || []).filter(e =>
    e.shiftLogId === shiftLog.shiftLogId ||
    ((Date.parse(e.date) || 0) >= from && (Date.parse(e.date) || 0) <= closeMs &&
      (e.branchId || 'PUSAT') === (branchId || 'PUSAT')));
  const cashIn = evs.filter(e => e.type === 'CASH_IN').reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const cashOut = evs.filter(e => e.type === 'CASH_OUT').reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const opening = Number(shiftLog?.openingCash) || 0;
  return { opening, cashSales, cashIn, cashOut, expected: opening + cashSales + cashIn - cashOut };
};

export const closeShiftResult = (expected, actual) => {
  const diff = (Number(actual) || 0) - (Number(expected) || 0);
  return { difference: diff, result: Math.abs(diff) < 0.5 ? 'MATCHED' : (diff < 0 ? 'SHORT' : 'OVER') };
};

// ------------------------------------------------------------
// 8. UTIL kecil
// ------------------------------------------------------------
export const dateKeyOfMs = (ms) => {
  const d = new Date(ms || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmt = (n) => 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(Number(n) || 0));

// Label ringkas metode pembayaran utk UI.
export const methodShortLabel = (m) => (m === 'Split Bill' ? 'Split' : m);
