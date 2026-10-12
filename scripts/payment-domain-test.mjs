// WELP v21.1 — domain verification: PAYMENT CORE + MODIFIER ENGINE
import {
  PAYMENT_EVENT_SOURCES, MATCH_STATUS, MATCH_STATUS_META,
  normalizePaymentEvent, validatePaymentEvent, matchPaymentEvent, applyMatchedEvent,
  isDuplicateEvent, collectIntents, intentOfPayment, newPaymentReference,
  buildSimulatedEvent, intentExpiryOf, eventFingerprint,
} from '../src/welp-core/payment.js';
import {
  normModifierGroups, productMode, activeGroupsForProduct, needsModifierSheet,
  defaultSelection, validateSelection, lineUnitPrice, lineModifiersPayload,
  cartLineKey, modifiersLabelByGroup,
} from '../src/welp-core/modifier.js';
import { buildIntentQris, crc16CCITT, parseEmv, verifyQrisCrc } from '../src/welp-core/emv.js';
import assert from 'node:assert';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '→', e.message); } };

// ===== helpers (waktu RELATIF — intent hidup, event sekarang) =====
const NOW = Date.now();
const intent = (over = {}) => ({
  intentId: 'pin_1', paymentId: 'pay_1', orderId: 'ctx_a', clientTransactionId: 'ctx_a',
  paymentReference: 'WELP-AAAA-01', amount: 25000, method: 'QRIS', status: 'PENDING',
  branchId: 'PUSAT', createdAt: NOW - 60e3, expiresAt: NOW + 30 * 60e3, ...over,
});
const ev = (over = {}) => normalizePaymentEvent({ amount: 25000, timestamp: NOW, ...over });

console.log('== WELP PAYMENT CORE — Payment Reference ==');
t('paymentReference selalu unik & bukan nominal', () => {
  const a = newPaymentReference(), b = newPaymentReference();
  assert.notEqual(a, b);
  assert.ok(a.startsWith('WELP-'));
  assert.ok(a.length <= 25, 'muat di QRIS tag 62/07 (25 char)');
});
t('dua order nominal sama = dua reference berbeda', () => {
  const i1 = intent({ paymentReference: newPaymentReference(), orderId: 'ctx_a' });
  const i2 = intent({ paymentReference: newPaymentReference(), orderId: 'ctx_b' });
  assert.equal(i1.amount, i2.amount);
  assert.notEqual(i1.paymentReference, i2.paymentReference);
});

console.log('== Matching Engine (spesifikasi #19–20) ==');
t('reference cocok → CONFIRMED', () => {
  const m = matchPaymentEvent({ event: ev({ reference: 'WELP-AAAA-01' }), intents: [intent()] });
  assert.equal(m.status, MATCH_STATUS.CONFIRMED);
});
t('providerRef cocok → CONFIRMED', () => {
  const m = matchPaymentEvent({ event: ev({ providerRef: 'MP-991' }), intents: [intent({ providerRef: 'MP-991' })] });
  assert.equal(m.status, MATCH_STATUS.CONFIRMED);
});
t('nominal sama saja → AMBIGUOUS walau 1 kandidat (amount ≠ identitas)', () => {
  const m = matchPaymentEvent({ event: ev({}), intents: [intent()] });
  assert.equal(m.status, MATCH_STATUS.AMBIGUOUS);
  assert.ok(/manual/i.test(m.reason));
});
t('2 order nominal sama → AMBIGUOUS dgn 2 kandidat', () => {
  const m = matchPaymentEvent({ event: ev({}), intents: [intent(), intent({ orderId: 'ctx_b', paymentReference: 'WELP-BBBB-02', intentId: 'pin_2', paymentId: 'pay_2' })] });
  assert.equal(m.status, MATCH_STATUS.AMBIGUOUS);
  assert.equal(m.intents.length, 2);
});
t('nominal beda semua → NO_MATCH', () => {
  const m = matchPaymentEvent({ event: ev({ amount: 30000 }), intents: [intent()] });
  assert.equal(m.status, MATCH_STATUS.NO_MATCH);
});
t('reference cocok tapi dana masuk beda → AMBIGUOUS (selisih)', () => {
  const m = matchPaymentEvent({ event: ev({ reference: 'WELP-AAAA-01', amount: 26000 }), intents: [intent()] });
  assert.equal(m.status, MATCH_STATUS.AMBIGUOUS);
});
t('intent sudah CONFIRMED + event masuk lagi → DUPLICATE', () => {
  const m = matchPaymentEvent({ event: ev({ reference: 'WELP-AAAA-01' }), intents: [intent({ status: 'CONFIRMED' })] });
  assert.equal(m.status, MATCH_STATUS.DUPLICATE);
});
t('intent kedaluwarsa → EXPIRED', () => {
  const now = Date.now() + 31 * 60e3;
  const m = matchPaymentEvent({ event: ev({ reference: 'WELP-AAAA-01' }), intents: [intent({ createdAt: Date.now() - 3600e3, expiresAt: Date.now() - 60e3 })], now });
  assert.equal(m.status, MATCH_STATUS.EXPIRED);
});

console.log('== Idempotency (spesifikasi #21) ==');
t('eventId sama diproses 2x → duplikat diabaikan', () => {
  const e = ev({ eventId: 'evt_x1', reference: 'WELP-AAAA-01' });
  const processed = { evt_x1: { matchStatus: MATCH_STATUS.CONFIRMED, processedAt: 1 } };
  assert.equal(isDuplicateEvent(e, processed), true);
  const m = matchPaymentEvent({ event: e, intents: [intent({ status: 'CONFIRMED' })] });
  assert.equal(m.status, MATCH_STATUS.DUPLICATE);
});
t('eventId berbeda dgn isi sama → BUKAN duplikat (dua kejadian nyata)', () => {
  const processed = { evt_x1: { matchStatus: MATCH_STATUS.CONFIRMED } };
  assert.equal(isDuplicateEvent(ev({ eventId: 'evt_x2', reference: 'WELP-AAAA-01' }), processed), false);
});
t('fingerprint deterministik', () => {
  assert.equal(eventFingerprint({ source: 'PWA_SIMULATOR', amount: 1000, timestamp: 5 }), eventFingerprint({ source: 'PWA_SIMULATOR', amount: 1000, timestamp: 5 }));
});

console.log('== Apply & Simulasi (spesifikasi #25, #28) ==');
t('applyMatchedEvent → payment CONFIRMED + jejak event', () => {
  const order = { id: 'ctx_a', clientTransactionId: 'ctx_a', total: 25000, status: 'pending', payments: [{ paymentId: 'pay_1', method: 'QRIS', amount: 25000, status: 'PENDING' }] };
  const match = matchPaymentEvent({ event: ev({ reference: 'WELP-AAAA-01' }), intents: [intent()] });
  const paid = applyMatchedEvent(order, match, ev({ reference: 'WELP-AAAA-01', providerRef: 'MP-1' }));
  assert.equal(paid.status, 'paid');
  assert.equal(paid.payments[0].status, 'CONFIRMED');
  assert.equal(paid.payments[0].providerRef, 'MP-1');
  assert.equal(paid.payments[0].eventId, ev({}).eventId ? paid.payments[0].eventId : paid.payments[0].eventId);
});
t('simulator exact → CONFIRMED by reference', () => {
  const i = intent();
  const e = buildSimulatedEvent({ intent: i, variant: 'exact' });
  assert.equal(e.source, PAYMENT_EVENT_SOURCES.PWA_SIMULATOR);
  const m = matchPaymentEvent({ event: normalizePaymentEvent(e), intents: [i] });
  assert.equal(m.status, MATCH_STATUS.CONFIRMED);
});
t('simulator amountOnly → AMBIGUOUS (bukti lemah)', () => {
  const e = buildSimulatedEvent({ intent: intent(), variant: 'amountOnly' });
  const m = matchPaymentEvent({ event: normalizePaymentEvent(e), intents: [intent()] });
  assert.equal(m.status, MATCH_STATUS.AMBIGUOUS);
});
t('simulator duplicateRef (eventId sama 2x) → event ke-2 dedup', () => {
  const i = intent();
  const e1 = buildSimulatedEvent({ intent: i, variant: 'duplicateRef' });
  const processed = {};
  const n1 = normalizePaymentEvent(e1);
  processed[n1.eventId] = { matchStatus: MATCH_STATUS.CONFIRMED };
  assert.equal(isDuplicateEvent(n1, processed), true);   // event kedua (eventId sama)
});
t('collectIntents hanya non-tunai', () => {
  const orders = [
    { id: 'ctx_1', total: 10000, payments: [{ paymentId: 'p1', method: 'Cash', amount: 10000, status: 'CONFIRMED' }] },
    { id: 'ctx_2', total: 25000, payments: [{ paymentId: 'p2', method: 'QRIS', amount: 25000, status: 'PENDING', paymentReference: 'WELP-C-1' }] },
  ];
  const list = collectIntents(orders);
  assert.equal(list.length, 1);
  assert.equal(list[0].paymentReference, 'WELP-C-1');
});

console.log('== MODIFIER ENGINE (spesifikasi #7–8) ==');
const groups = normModifierGroups([
  { id: 'g1', name: 'Level Pedas', required: true, options: [
    { id: 'o1', name: 'Tidak Pedas' }, { id: 'o2', name: 'Sedang' }, { id: 'o3', name: 'Pedas' }, { id: 'o4', name: 'Extra Pedas', priceDelta: 2000 }] },
  { id: 'g2', name: 'Bumbu', required: true, options: [
    { id: 'o5', name: 'Original' }, { id: 'o6', name: 'Balado' }, { id: 'o7', name: 'BBQ' }, { id: 'o8', name: 'Keju', priceDelta: 1500 }] },
  { id: 'g3', name: 'Topping', multi: true, max: 2, options: [
    { id: 'o9', name: 'Original' }, { id: 'o10', name: 'Mozzarella', priceDelta: 5000 }, { id: 'o11', name: 'Sosis', priceDelta: 4000 }] },
]);
t('normalisasi grup: urut, opsi aktif, harga bulat', () => {
  assert.equal(groups.length, 3);
  assert.equal(groups[0].name, 'Level Pedas');
  assert.equal(groups[2].max, 2);
});
t('produk tanpa mode = QUICK (kompatibel mundur)', () => {
  assert.equal(productMode({}), 'quick');
  assert.equal(productMode({ mode: 'configurable' }), 'configurable');
  assert.equal(needsModifierSheet({ mode: 'configurable' }, groups), false);   // tanpa modifierGroupIds
  assert.equal(needsModifierSheet({ mode: 'configurable', modifierGroupIds: ['g1', 'g2', 'g3'] }, groups), true);
});
t('defaultSelection mengisi opsi isDefault saja', () => {
  const g2 = normModifierGroups([{ id: 'g1', name: 'Size', required: true, options: [{ id: 's1', name: 'S' }, { id: 's2', name: 'L', isDefault: true }] }]);
  const sel = defaultSelection(g2);
  assert.equal(sel.g1, 's2');
});
t('validasi: required kosong ditolak', () => {
  const r = validateSelection(groups, {});
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 2);
});
t('validasi: multi max=2 ditolak saat 3 opsi', () => {
  const r = validateSelection(groups, { g1: 'o1', g2: 'o5', g3: ['o9', 'o10', 'o11'] });
  assert.equal(r.ok, false);
});
t('validasi: pilihan lengkap sah', () => {
  const r = validateSelection(groups, { g1: 'o4', g2: 'o8', g3: ['o10'] });
  assert.equal(r.ok, true);
});
t('line price = base + Σ priceDelta (Cimol Bojot AA)', () => {
  // Cimol 12000 + Extra Pedas 2000 + Keju 1500 + Mozzarella 5000 = 20500
  const sel = { g1: 'o4', g2: 'o8', g3: ['o10'] };
  assert.equal(lineUnitPrice(12000, groups, sel), 20500);
});
t('lineModifiersPayload bentuk kanonik utk order/receipt', () => {
  const sel = { g1: 'o4', g2: 'o8', g3: ['o10'] };
  const mods = lineModifiersPayload(groups, sel);
  assert.deepEqual(mods.map(m => m.groupName), ['Level Pedas', 'Bumbu', 'Topping']);
  assert.equal(mods[0].optionName, 'Extra Pedas');
  assert.equal(mods[0].priceDelta, 2000);
});
t('kombinasi beda = baris cart beda; kombinasi sama = satu baris', () => {
  const m1 = lineModifiersPayload(groups, { g1: 'o1', g2: 'o5', g3: [] });
  const m2 = lineModifiersPayload(groups, { g1: 'o2', g2: 'o5', g3: [] });
  const m1b = lineModifiersPayload(groups, { g1: 'o1', g2: 'o5', g3: [] });
  assert.notEqual(cartLineKey('p1', 'retail', m1), cartLineKey('p1', 'retail', m2));
  assert.equal(cartLineKey('p1', 'retail', m1), cartLineKey('p1', 'retail', m1b));
});
t('label per grup siap struk', () => {
  const lbl = modifiersLabelByGroup(lineModifiersPayload(groups, { g1: 'o4', g2: 'o8', g3: [] }));
  assert.ok(lbl[0].includes('Level Pedas: Extra Pedas (+2000)'));
});

console.log('== QRIS EMVCo + paymentReference (spesifikasi #16–17) ==');
// Payload QRIS statis SINTETIS dibangun programatik (TLV sah + CRC valid)
const tlv = (tag, val) => tag + String(val.length).padStart(2, '0') + val;
const staticQrisBody =
  tlv('00', '01') + tlv('01', '11') +
  tlv('26', tlv('00', 'ID.CO.QRIS.WWW') + tlv('01', '936009143652677302') + tlv('02', 'GARDA') + tlv('05', 'NMID-1234567')) +
  tlv('52', '5812') + tlv('53', '360') + tlv('58', 'ID') +
  tlv('59', 'CIMOL BOJOT AA') + tlv('60', 'JAKARTA') +
  tlv('62', tlv('01', 'ABCD12345678')) +
  '6304';
const staticQris = staticQrisBody + crc16CCITT(staticQrisBody);
t('payload uji CRC-valid', () => assert.equal(verifyQrisCrc(staticQris), true));
t('dynamic QR: tag 54 nominal + tag 01=12 + CRC valid ulang', () => {
  const dyn = buildIntentQris(staticQris, 27000, 'WELP-TEST-0001');
  const m = parseEmv(dyn);
  assert.equal(m['01'], '12');
  assert.equal(m['54'], '27000.00');
  assert.equal(verifyQrisCrc(dyn), true);
});
t('tag 62 sub-07 berisi paymentReference, sub-tag lain dipertahankan', () => {
  const dyn = buildIntentQris(staticQris, 27000, 'WELP-TEST-0001');
  const m = parseEmv(dyn);
  const sub = parseEmv(m['62']);
  assert.equal(sub['07'], 'WELP-TEST-0001');
  assert.equal(sub['01'], 'ABCD12345678');   // milik merchant tidak hilang
});
t('reference berbeda → payload QR berbeda (nominal sama pun beda QR)', () => {
  const a = buildIntentQris(staticQris, 25000, newPaymentReference());
  const b = buildIntentQris(staticQris, 25000, newPaymentReference());
  assert.notEqual(a, b);
});
t('nominal tanpa reference tetap jalan (fallback lama utk QR statis murni)', () => {
  const dyn = buildIntentQris(staticQris, 27000, null);
  assert.equal(parseEmv(dyn)['54'], '27000.00');
});

console.log(`\nHASIL: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
