// Seed demo dataset untuk verifikasi browser v21.1 (offline mirror mode)
import { crc16CCITT } from '../src/welp-core/emv.js';
import { writeFileSync } from 'node:fs';

const tlv = (tag, val) => tag + String(val.length).padStart(2, '0') + val;
const qrisBody =
  tlv('00', '01') + tlv('01', '11') +
  tlv('26', tlv('00', 'ID.CO.QRIS.WWW') + tlv('01', '936009143652677302') + tlv('05', 'NMID-BOJOT-001')) +
  tlv('52', '5812') + tlv('53', '360') + tlv('58', 'ID') +
  tlv('59', 'CIMOL BOJOT AA') + tlv('60', 'BANDUNG') +
  '6304';
const QRIS_PAYLOAD = qrisBody + crc16CCITT(qrisBody);

const DAY = 864e5;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// Products: 2 configurable + 3 quick (satu stok 0 utk uji tracking OFF)
const products = [
  { id: 'p_cimol', name: 'Cimol Bojot', price: 12000, stock: 40, type: 'Makanan', mode: 'configurable', modifierGroupIds: ['g1', 'g2', 'g3'], hpp: 6000 },
  { id: 'p_cimoltelur', name: 'Cimol Telur', price: 15000, stock: 25, type: 'Makanan', mode: 'configurable', modifierGroupIds: ['g1', 'g2'], hpp: 7500 },
  { id: 'p_esteh', name: 'Es Teh Manis', price: 5000, stock: 60, type: 'Minuman', hpp: 1500 },
  { id: 'p_kopi', name: 'Kopi Susu', price: 10000, stock: 30, type: 'Minuman', hpp: 4000 },
  { id: 'p_pisang', name: 'Pisang Goreng', price: 8000, stock: 0, type: 'Makanan', hpp: 3000 },
];

const modifierGroups = [
  { id: 'g1', name: 'Level Pedas', active: true, required: true, multi: false, min: 0, max: 0, sortOrder: 0, options: [
    { id: 'o1', name: 'Tidak Pedas', priceDelta: 0, active: true },
    { id: 'o2', name: 'Sedang', priceDelta: 0, active: true },
    { id: 'o3', name: 'Pedas', priceDelta: 0, active: true },
    { id: 'o4', name: 'Extra Pedas', priceDelta: 2000, active: true, isDefault: false }] },
  { id: 'g2', name: 'Bumbu', active: true, required: true, multi: false, min: 0, max: 0, sortOrder: 1, options: [
    { id: 'o5', name: 'Original', priceDelta: 0, active: true, isDefault: true },
    { id: 'o6', name: 'Balado', priceDelta: 0, active: true },
    { id: 'o7', name: 'BBQ', priceDelta: 0, active: true },
    { id: 'o8', name: 'Keju', priceDelta: 1500, active: true }] },
  { id: 'g3', name: 'Topping', active: true, required: false, multi: true, min: 0, max: 2, sortOrder: 2, options: [
    { id: 'o9', name: 'Original', priceDelta: 0, active: true },
    { id: 'o10', name: 'Mozzarella', priceDelta: 5000, active: true },
    { id: 'o11', name: 'Sosis', priceDelta: 4000, active: true }] },
];

const branches = [
  { cid: 'BR1', name: 'Cabang Cihampelas', location: 'Jl. Cihampelas 45, Bandung', payrollEnabled: true },
  { cid: 'BR2', name: 'Cabang Dipatiukur', location: 'Jl. Dipatiukur 12, Bandung', payrollEnabled: false },
];

const employees = [
  { cid: 'k1', name: 'Rani Oktaviani', branchId: 'PUSAT', role: 'kasir', status: 'aktif', employeeId: 'EMP-2026-0001' },
  { cid: 'k2', name: 'Dedi Kurnia', branchId: 'BR1', role: 'kasir', status: 'aktif', employeeId: 'EMP-2026-0002' },
  { cid: 'k3', name: 'Sinta Melia', branchId: 'BR2', role: 'kasir', status: 'aktif', employeeId: 'EMP-2026-0003' },
];

const absensi = [
  { cid: 'a1', employeeName: 'Rani Oktaviani', branchId: 'PUSAT', branchName: 'PUSAT', type: 'in', date: new Date(now).toISOString().slice(0, 10), createdAt: now - 3 * 3600e3, dist: 12 },
  { cid: 'a2', employeeName: 'Dedi Kurnia', branchId: 'BR1', branchName: 'Cabang Cihampelas', type: 'in', date: new Date(now).toISOString().slice(0, 10), createdAt: now - 2 * 3600e3, dist: 33 },
];
const stations = [{ cid: 'st1', code: 'STN-P1', branchId: 'PUSAT', branchName: 'PUSAT', active: true }];
const pengajuan = [];

// pos_history: PUSAT tumbuh (▲), BR1 fluktuatif naik, BR2 menurun (▼)
const methodsPusat = ['Cash', 'QRIS', 'Cash', 'QRIS', 'QRIS'];
const mkTx = (i, branchId, daysAgo, total, method, items, extra = {}) => {
  const ts = now - daysAgo * DAY - (i % 9) * 3600e3;
  const subtotal = total;
  return {
    id: `ctx_seed_${branchId}_${i}_${daysAgo}`,
    clientTransactionId: `ctx_seed_${branchId}_${i}_${daysAgo}`,
    date: iso(ts), createdAtMs: ts,
    buyer: 'Tanpa Nama', paymentMethod: method,
    payments: [{ paymentId: `pay_seed_${i}_${daysAgo}_${branchId}`, method, amount: total, status: 'CONFIRMED', paidAt: iso(ts + 60e3), confirmedAt: ts + 60e3, providerRef: method === 'QRIS' ? `MP-SEED${i}${daysAgo}` : null }],
    items, subtotal, discountAmt: 0, taxAmt: 0, serviceAmt: 0,
    taxPercent: 0, servicePercent: 0, discPercent: 0, total,
    status: 'paid', txState: 'PAYMENT_CONFIRMED', syncStatus: 'SYNCED',
    branchId, stationCode: branchId === 'PUSAT' ? 'STN-P1' : null,
    employeeName: branchId === 'PUSAT' ? 'Rani Oktaviani' : branchId === 'BR1' ? 'Dedi Kurnia' : 'Sinta Melia',
    deviceId: 'dev_seed', shiftId: `${branchId}-${iso(ts).slice(0, 10)}`,
    serverAt: { seconds: Math.floor(ts / 1000) },
    ...extra,
  };
};
const itemOf = (p, qty, mods = []) => ({ id: p.id, name: p.name, qty, price: p.price, hpp: p.hpp, hppAtSale: p.hpp, modifiers: mods });

const history = [];
// 35 hari data
for (let d = 0; d < 35; d++) {
  const growth = 1 + (34 - d) / 34;              // PUSAT: makin lama makin kecil → tumbuh
  const nPusat = Math.max(1, Math.round(3 * growth));
  for (let i = 0; i < nPusat; i++) {
    const p = products[i % 2];
    const mods = p.mode === 'configurable' ? [{ groupId: 'g1', groupName: 'Level Pedas', optionId: 'o4', optionName: 'Extra Pedas', priceDelta: 2000 }] : [];
    const price = p.price + mods.reduce((a, m) => a + m.priceDelta, 0);
    history.push(mkTx(i, 'PUSAT', d, price * 2, methodsPusat[i % methodsPusat.length], [itemOf(p, 2, mods)]));
  }
  // BR1: stabil sedang
  if (d % 2 === 0) history.push(mkTx(d, 'BR1', d, 22000, d % 4 === 0 ? 'QRIS' : 'Cash', [itemOf(products[0], 1, [{ groupId: 'g2', groupName: 'Bumbu', optionId: 'o8', optionName: 'Keju', priceDelta: 1500 }]), itemOf(products[2], 2)]));
  // BR2: menurun (dulu ramai → sepi): hari lama ramai, hari ini sepi
  const decline = d > 20 ? 3 : d > 10 ? 2 : 1;
  for (let i = 0; i < decline; i++) history.push(mkTx(i, 'BR2', d, 15000, 'QRIS', [itemOf(products[3], 1), itemOf(products[2], 1)]));
}
// satu refund sebagian di PUSAT (3 hari lalu)
history.push(mkTx(99, 'PUSAT', 3, 34000, 'QRIS', [itemOf(products[0], 2, [{ groupId: 'g1', groupName: 'Level Pedas', optionId: 'o4', optionName: 'Extra Pedas', priceDelta: 2000 }])], {
  refunds: [{ refundId: 'ref_seed1', amount: 14000, status: 'REFUNDED', reason: 'sebagian uji', method: 'QRIS', requestedBy: 'Owner Demo', createdAt: now - 2 * DAY }],
}));

// satu order QRIS PENDING dengan intent (utk simulator POS + Lab)
const pendingRef = 'WELP-DEMO-0001';
const activeOrders = [{
  id: 'ctx_pending_demo', clientTransactionId: 'ctx_pending_demo',
  date: iso(now - 5 * 60e3), createdAtMs: now - 5 * 60e3,
  buyer: 'Tanpa Nama', paymentMethod: 'QRIS',
  payments: [{ paymentId: 'pay_pending_demo', method: 'QRIS', amount: 27000, status: 'PENDING', paidAt: null, confirmedAt: null, providerRef: null, intentId: 'pin_pay_pending_demo', paymentReference: pendingRef, merchantId: 'NMID-BOJOT-001', createdAt: now - 5 * 60e3, expiresAt: now + 25 * 60e3 }],
  items: [itemOf(products[0], 1, [{ groupId: 'g1', groupName: 'Level Pedas', optionId: 'o4', optionName: 'Extra Pedas', priceDelta: 2000 }, { groupId: 'g3', groupName: 'Topping', optionId: 'o10', optionName: 'Mozzarella', priceDelta: 5000 }])],
  subtotal: 19000, discountAmt: 0, taxAmt: 0, serviceAmt: 0, taxPercent: 0, servicePercent: 0, discPercent: 0, total: 19000,
  // NOTE: total harus = 12000+2000+5000 = 19000; amount di payments dihitung dari computeOrderTotals
  status: 'pending', txState: 'PAYMENT_PENDING', syncStatus: 'PENDING',
  branchId: 'PUSAT', stationCode: 'STN-P1', employeeName: 'Rani Oktaviani', deviceId: 'dev_seed',
  shiftId: 'PUSAT-x', orderType: 'Take away', tableNo: '', notes: '',
}];

// sinkronkan amount payments + harga item dgn total (12000+2000+5000)
activeOrders[0].payments[0].amount = 19000;
activeOrders[0].items[0].price = 19000;

const storeProfile = {
  name: 'Cimol Bojot AA', address: 'Jl. Bojot No. 9, Bandung', wa: '08123456789',
  payment: {
    qrisPayload: QRIS_PAYLOAD,
    qrisMeta: { type: 'statis', merchant: 'CIMOL BOJOT AA', city: 'BANDUNG', merchantId: 'NMID-BOJOT-001', nmid: 'NMID-BOJOT-001', crcValid: true, country: 'ID', currency: '360' },
    qris: null, ewallets: [{ type: 'ShopeePay', number: '08123456789' }], bank: [],
    methods: { QRIS: { feePercent: 0.7, feeFixed: 0 } },
  },
};

const bizconfig = { tax: 0, service: 0, globalDiscount: 0, stockTracking: true };

const out = { app_license: null, products, modifierGroups, branches, employees, absensi, stations, pengajuan, history, activeOrders, storeProfile, bizconfig, pendingRef, QRIS_PAYLOAD };
writeFileSync(new URL('./seed-data.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('seed-data.json written. QRIS payload valid:', QRIS_PAYLOAD.length, 'chars');
