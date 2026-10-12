// Quick domain verification for WELP v21 (run with node, ESM)
import {
  TX_STATE, txStateOf, normalizePayments, netTotalOf, refundedAmountOf,
  canVoid, canRefund, validateRefund, buildRefund, buildVoid,
  countsAsSale, salesByMethodForDate, buildSettlementDraft, methodCfgOf, feeOf,
  reconcile, RECON_STATUS, openShiftOf, expectedCashOf, closeShiftResult,
  newClientTxId, dateKeyOfMs,
} from '../src/welp-core/tx.js';
import assert from 'node:assert';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '→', e.message); } };

console.log('== ID / Idempotency ==');
t('clientTransactionId unik', () => assert.notEqual(newClientTxId(), newClientTxId()));

console.log('== State machine ==');
t('legacy pending → PAYMENT_PENDING', () => assert.equal(txStateOf({ status: 'pending', total: 10000, paymentMethod: 'Cash' }), TX_STATE.PAYMENT_PENDING));
t('legacy paid → SETTLEMENT_PENDING (pipeline default)', () => assert.equal(txStateOf({ status: 'paid', total: 10000, paymentMethod: 'Cash' }), TX_STATE.SETTLEMENT_PENDING));
t('legacy cancelled → VOIDED', () => assert.equal(txStateOf({ status: 'cancelled', total: 10000 }), TX_STATE.VOIDED));
t('voidInfo → VOIDED (menang atas paid)', () => assert.equal(txStateOf({ status: 'paid', total: 100, voidInfo: { voidId: 'v' } }), TX_STATE.VOIDED));
t('payments CONFIRMED penuh → SETTLEMENT_PENDING', () => assert.equal(txStateOf({ status: 'paid', total: 10000, payments: [{ paymentId: 'p', method: 'QRIS', amount: 10000, status: 'CONFIRMED' }] }), TX_STATE.SETTLEMENT_PENDING));
t('payments belum lunas → PAYMENT_PENDING', () => assert.equal(txStateOf({ status: 'pending', total: 10000, payments: [{ method: 'QRIS', amount: 5000, status: 'CONFIRMED' }] }), TX_STATE.PAYMENT_PENDING));
t('refund penuh → REFUNDED', () => assert.equal(txStateOf({ status: 'paid', total: 10000, payments: [{ method: 'QRIS', amount: 10000, status: 'CONFIRMED' }], refunds: [{ refundId: 'r', amount: 10000, status: 'REFUNDED' }] }), TX_STATE.REFUNDED));
t('refund sebagian → PARTIALLY_REFUNDED', () => assert.equal(txStateOf({ status: 'paid', total: 10000, payments: [{ method: 'QRIS', amount: 10000, status: 'CONFIRMED' }], refunds: [{ refundId: 'r', amount: 3000, status: 'REFUNDED' }] }), TX_STATE.PARTIALLY_REFUNDED));
t('refund processing → REFUND_PROCESSING', () => assert.equal(txStateOf({ status: 'paid', total: 10000, payments: [{ method: 'QRIS', amount: 10000, status: 'CONFIRMED' }], refunds: [{ refundId: 'r', amount: 3000, status: 'REFUND_PROCESSING' }] }), TX_STATE.REFUND_PROCESSING));

console.log('== Refund math ==');
const ord = { id: 'o1', total: 50000, status: 'paid', paymentMethod: 'QRIS', payments: [{ method: 'QRIS', amount: 50000, status: 'CONFIRMED' }], refunds: [{ amount: 10000, status: 'REFUNDED' }] };
t('netTotal = total - refunded', () => assert.equal(netTotalOf(ord), 40000));
t('canVoid true untuk paid tanpa refund', () => assert.equal(canVoid({ id: 'o2', total: 50000, status: 'paid', paymentMethod: 'QRIS', payments: [{ method: 'QRIS', amount: 50000, status: 'CONFIRMED' }] }), true));
t('canVoid false untuk yang sudah direfund', () => assert.equal(canVoid(ord), false));
t('canRefund true masih ada saldo', () => assert.equal(canRefund(ord), true));
t('validateRefund menolak melebihi total', () => assert.equal(validateRefund(ord, 45000).ok, false));
t('validateRefund menerima 40rb', () => assert.equal(validateRefund(ord, 40000).ok, true));
t('buildRefund Cash instant → REFUNDED', () => assert.equal(buildRefund({ order: ord, amount: 5000, reason: 'tes', actor: 'A', method: 'Cash', instant: true }).status, 'REFUNDED'));
t('buildRefund QRIS → REFUND_PROCESSING', () => assert.equal(buildRefund({ order: ord, amount: 5000, reason: 'tes', actor: 'A', method: 'QRIS' }).status, 'REFUND_PROCESSING'));
t('buildVoid menyimpan reason+actor+txId', () => { const v = buildVoid({ order: ord, reason: 'salah input', actor: 'B' }); assert.equal(v.reason, 'salah input'); assert.equal(v.originalTxId, 'o1'); assert.equal(v.amount, 50000); });

console.log('== Settlement ==');
const today = dateKeyOfMs(Date.now());
const orders = [
  { id: 'a', date: new Date().toISOString(), total: 100000, status: 'paid', paymentMethod: 'QRIS', branchId: 'PUSAT', payments: [{ method: 'QRIS', amount: 100000, status: 'CONFIRMED' }] },
  { id: 'b', date: new Date().toISOString(), total: 50000, status: 'paid', paymentMethod: 'QRIS', branchId: 'PUSAT', payments: [{ method: 'QRIS', amount: 50000, status: 'CONFIRMED' }], refunds: [{ refundId: 'r1', amount: 20000, status: 'REFUNDED' }] },
  { id: 'c', date: new Date().toISOString(), total: 30000, status: 'paid', paymentMethod: 'Cash', branchId: 'PUSAT', payments: [{ method: 'Cash', amount: 30000, status: 'CONFIRMED' }] },
  { id: 'd', date: new Date().toISOString(), total: 99000, status: 'voided', voidInfo: {}, branchId: 'PUSAT', payments: [{ method: 'QRIS', amount: 99000, status: 'CONFIRMED' }] },
];
const agg = salesByMethodForDate(orders, today, null);
t('QRIS gross = 150rb (void dikecualikan)', () => assert.equal(agg['QRIS'].gross, 150000));
t('QRIS refund = 20rb', () => assert.equal(agg['QRIS'].refunds, 20000));
t('Cash gross = 30rb', () => assert.equal(agg['Cash'].gross, 30000));
const cfg = { feePercent: 0.7, feeFixed: 0, account: 'BCA 123' };
t('feeOf 0.7% dari 150rb = 1050', () => assert.equal(feeOf(150000, cfg), 1050));
const draft = buildSettlementDraft({ orders, dateKey: today, method: 'QRIS', payment: { methods: { QRIS: cfg } }, branchId: null });
t('draft net = 150rb − 1050 − 20rb = 128.950', () => assert.equal(draft.netAmount, 128950));
t('draft punya id = settlementId', () => assert.equal(draft.id, draft.settlementId));

console.log('== Reconciliation ==');
t('MATCHED tanpa anomali', () => {
  const r = reconcile({ orders, settlement: { ...draft, status: 'SETTLED' }, dateKey: today, payment: { methods: { QRIS: cfg } } });
  assert.equal(r.status, RECON_STATUS.MATCHED);
});
t('PENDING saat settlement belum dikonfirmasi', () => {
  const r = reconcile({ orders, settlement: { ...draft, status: 'PENDING' }, dateKey: today, payment: { methods: { QRIS: cfg } } });
  assert.equal(r.status, RECON_STATUS.PENDING);
});
t('MISMATCH + alasan saat ada fee beda', () => {
  const r = reconcile({ orders, settlement: { ...draft, status: 'SETTLED', feeAmount: 5000 }, dateKey: today, payment: { methods: { QRIS: cfg } } });
  assert.equal(r.status, RECON_STATUS.MISMATCH);
  assert.ok(r.reasons.some(x => x.type === 'FEE_DIFF'));
});
t('MISMATCH + alasan tx hilang', () => {
  const r = reconcile({ orders, settlement: { ...draft, status: 'SETTLED', txIds: ['a'] }, dateKey: today, payment: { methods: { QRIS: cfg } } });
  assert.equal(r.status, RECON_STATUS.MISMATCH);
  assert.ok(r.reasons.some(x => x.type === 'MISSING_IN_SETTLEMENT'));
});

console.log('== Shift & Kas ==');
const shift = { shiftLogId: 's1', type: 'open', branchId: 'PUSAT', openedAt: Date.now() - 3600e3, openingCash: 100000, stationCode: 'STN-1' };
const t0 = Date.now();
const salesOrders = [
  { id: 'x', date: new Date(t0).toISOString(), paidAt: new Date(t0).toISOString(), total: 80000, status: 'paid', paymentMethod: 'Cash', branchId: 'PUSAT', stationCode: 'STN-1', payments: [{ method: 'Cash', amount: 80000, status: 'CONFIRMED' }] },
  { id: 'y', date: new Date(t0).toISOString(), paidAt: new Date(t0).toISOString(), total: 20000, status: 'paid', paymentMethod: 'Cash', branchId: 'PUSAT', stationCode: 'STN-1', payments: [{ method: 'Cash', amount: 20000, status: 'CONFIRMED' }], refunds: [{ refundId: 'r2', amount: 5000, status: 'REFUNDED' }] },
  { id: 'z', date: new Date(t0).toISOString(), paidAt: new Date(t0).toISOString(), total: 50000, status: 'paid', paymentMethod: 'QRIS', branchId: 'PUSAT', payments: [{ method: 'QRIS', amount: 50000, status: 'CONFIRMED' }] },
];
const evs = [
  { type: 'CASH_IN', amount: 20000, date: new Date(t0).toISOString(), shiftLogId: 's1' },
  { type: 'CASH_OUT', amount: 15000, date: new Date(t0).toISOString(), shiftLogId: 's1' },
];
const calc = expectedCashOf({ shiftLog: shift, orders: salesOrders, cashEvents: evs });
t('expected = 100rb + (80rb+15rb) + 20rb − 15rb = 200rb', () => assert.equal(calc.expected, 200000));
t('closeShift MATCHED', () => assert.equal(closeShiftResult(200000, 200000).result, 'MATCHED'));
t('closeShift SHORT −10rb', () => { const r = closeShiftResult(200000, 190000); assert.equal(r.result, 'SHORT'); assert.equal(r.difference, -10000); });
t('closeShift OVER +5rb', () => assert.equal(closeShiftResult(200000, 205000).result, 'OVER'));
t('openShiftOf menemukan shift terbuka', () => assert.equal(openShiftOf([shift, { shiftLogId: 's2', type: 'close', shiftLogId: 's3' }], { branchId: 'PUSAT', stationCode: 'STN-1' }).shiftLogId, 's1'));
t('openShiftOf null setelah close', () => {
  const logs = [shift, { id: 'c1', type: 'close', shiftLogId: 's1', branchId: 'PUSAT', closedAt: Date.now() }];
  assert.equal(openShiftOf(logs, { branchId: 'PUSAT', stationCode: 'STN-1' }), null);
});

console.log('== Normalisasi payment legacy ==');
t('legacy order tanpa payments → 1 record pseudo', () => {
  const p = normalizePayments({ status: 'paid', paymentMethod: 'Cash', total: 12000, cashTendered: 15000, change: 3000 });
  assert.equal(p.length, 1); assert.equal(p[0].status, 'CONFIRMED'); assert.equal(p[0].method, 'Cash');
});

console.log(`\nHASIL: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
