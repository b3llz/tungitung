// ============================================================
// WELP CORE, SHIFT REPORT / SETTLEMENT (v21.5)
// ------------------------------------------------------------
// Laporan akhir shift gaya aplikasi retail besar, dihitung PENUH
// dari data transaksi nyata (bukan input manual) supaya tidak
// bisa diakali:
//   • Periode  : tanggal, jam mulai & selesai shift
//   • Kasir    : nama petugas yang buka shift
//   • Customer : jumlah pelanggan & struk penjualan
//   • Void     : void bill (transaksi dibatalkan) & void item
//   • Summary  : penjualan, metode pembayaran, jenis pesanan
//   • Kas      : modal, penjualan tunai, masuk/keluar,
//                uang fisik dihitung, dan SELISIH
// Dua jenis cetakan:
//   X  = laporan sementara (shift masih berjalan)
//   Z  = laporan akhir hari (shift ditutup, disimpan permanen)
// Hasil Z disimpan ke eod_reports_db (append-only) sehingga bisa
// dibuka lagi dari tab Akhir Hari (rincian/ringkasan per tanggal
// dan nomor settlement) tanpa takut data berubah.
// Tanpa em-dash di semua teks UI.
// ============================================================
import { countsAsSale, netTotalOf, txStateOf, TX_STATE } from './tx.js';

const pad2 = (n) => String(n).padStart(2, '0');

export const dateKeyOf = (ms = Date.now()) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const inWindow = (ms, from, to) => ms >= (from || 0) && ms <= (to || Infinity);

const num = (v) => Number(v) || 0;

const methodOf = (t) => {
  const pays = Array.isArray(t.payments) && t.payments.length ? t.payments : null;
  if (pays) {
    const main = pays.reduce((a, b) => (num(b.amount) >= num(a?.amount || 0) ? b : a), pays[0]);
    return main?.method || t.paymentMethod || 'Lainnya';
  }
  return t.paymentMethod || 'Lainnya';
};

const orderTypeOf = (t) => {
  const raw = String(t.orderType || '').trim();
  if (!raw) return 'Take away';
  const low = raw.toLowerCase();
  if (low.includes('dine') || low === 'di tempat' || low === 'makan di tempat') return 'Dine in';
  if (low.includes('delivery') || low.includes('antar')) return 'Delivery';
  if (low.includes('pickup') || low.includes('ambil')) return 'Pickup';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const fmtTime = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * Hitung laporan shift dari data nyata.
 * @param {object} p
 * @param {Array}  p.orders       pos_history (semua status)
 * @param {object} p.shiftOpen    baris shift_log type 'open' (null = laporan harian)
 * @param {object} p.shiftClose   baris shift_log type 'close' (null saat X report)
 * @param {Array}  p.cashEvents   cash_event_db
 * @param {object} p.profile      store_profile (nama toko, alamat, telp)
 */
export const computeShiftReport = ({ orders = [], shiftOpen = null, shiftClose = null, cashEvents = [], profile = {} }) => {
  const from = shiftOpen ? num(shiftOpen.openedAt) : 0;
  const to = shiftClose ? num(shiftClose.closedAt) : Date.now();
  const inShift = (t) => {
    const ms = new Date(t.date || t.createdAt || 0).getTime() || 0;
    return inWindow(ms, from, to);
  };

  const all = orders.filter(inShift);
  const sales = all.filter(countsAsSale);
  const voided = all.filter(t => txStateOf(t) === TX_STATE.VOIDED);
  const refunded = all.filter(t => {
    const st = txStateOf(t);
    return st === TX_STATE.REFUNDING || st === TX_STATE.REFUNDED;
  });

  let gross = 0, discount = 0, net = 0, qty = 0, itemLines = 0, customers = 0;
  const byMethod = new Map();
  const byType = new Map();
  sales.forEach(t => {
    const tot = num(t.total);
    gross += tot;
    discount += num(t.discountAmt) + num(t.poinValue);
    net += netTotalOf(t);
    customers += Math.max(1, num(t.guests) || 1);
    (t.items || []).forEach(i => { qty += num(i.qty); itemLines += 1; });
    const m = methodOf(t);
    const am = byMethod.get(m) || { method: m, count: 0, amount: 0 };
    am.count += 1; am.amount += netTotalOf(t);
    byMethod.set(m, am);
    const ot = orderTypeOf(t);
    const ao = byType.get(ot) || { type: ot, count: 0, amount: 0 };
    ao.count += 1; ao.amount += tot;
    byType.set(ot, ao);
  });

  let voidBillCount = voided.length, voidBillAmount = voided.reduce((s, t) => s + num(t.total), 0);
  let voidItemCount = 0, voidItemAmount = 0;
  refunded.forEach(t => {
    (t.refunds || []).forEach(r => {
      (r.items || []).forEach(i => { voidItemCount += num(i.qty); voidItemAmount += num(i.amount) || num(i.price) * num(i.qty); });
      if (!(r.items || []).length && num(r.amount)) { voidItemCount += 1; voidItemAmount += num(r.amount); }
    });
  });

  // Kas: pakai angka shift kalau ada (dihitung sistem), fallback hitung manual.
  const sid = shiftOpen?.shiftLogId || null;
  const evts = sid ? (cashEvents || []).filter(e => e.shiftLogId === sid) : (cashEvents || []).filter(e => inWindow(new Date(e.date || 0).getTime(), from, to));
  const cashSales = sales.filter(t => methodOf(t) === 'Cash').reduce((s, t) => s + netTotalOf(t), 0);
  const isIn = (e) => e.type === 'in' || e.type === 'CASH_IN';
  const isOut = (e) => e.type === 'out' || e.type === 'CASH_OUT';
  const cashIn = evts.filter(isIn).reduce((s, e) => s + num(e.amount), 0);
  const cashOut = evts.filter(isOut).reduce((s, e) => s + num(e.amount), 0);
  const opening = shiftOpen ? num(shiftOpen.openingCash) : 0;
  const expected = shiftClose ? num(shiftClose.expectedCash) : (opening + cashSales + cashIn - cashOut);
  const counted = shiftClose ? num(shiftClose.actualCash) : null;
  const selisih = counted == null ? null : counted - expected;

  const cashier = shiftClose?.employeeName || shiftClose?.closedBy || shiftOpen?.employeeName || shiftOpen?.openedBy || '';
  const reportNo = `${shiftClose ? 'Z' : 'X'}-${dateKeyOf(shiftClose ? num(shiftClose.closedAt) : Date.now()).replace(/-/g, '')}-${String(shiftOpen?.shiftLogId || sid || 'DAY').slice(-6).toUpperCase()}`;

  return {
    reportNo,
    kind: shiftClose ? 'Z' : 'X',
    dateKey: dateKeyOf(shiftClose ? num(shiftClose.closedAt) || Date.now() : Date.now()),
    branchName: shiftOpen?.branchName || shiftOpen?.branchId || '',
    stationCode: shiftOpen?.stationCode || '',
    cashier,
    startAt: from || null,
    endAt: shiftClose ? num(shiftClose.closedAt) : null,
    startTime: from ? fmtTime(from) : '',
    endTime: shiftClose ? fmtTime(num(shiftClose.closedAt)) : '',
    receipts: sales.length,
    customers,
    voidBills: { count: voidBillCount, amount: voidBillAmount },
    voidItems: { count: voidItemCount, amount: voidItemAmount },
    sales: { gross, discount, net, qty, itemLines },
    byMethod: [...byMethod.values()].sort((a, b) => b.amount - a.amount),
    byType: [...byType.values()].sort((a, b) => b.amount - a.amount),
    cash: { opening, cashSales, cashIn, cashOut, expected, counted, selisih },
    txCount: all.length,
    generatedAt: Date.now(),
    store: {
      name: profile?.name || profile?.storeName || '',
      address: profile?.address || '',
      phone: profile?.wa || profile?.phone || '',
    },
  };
};

/** Simpan bentuk ringkas utk daftar Akhir Hari (dropdown tanggal + no). */
export const eodRowOf = (r) => ({
  id: r.reportNo,
  reportNo: r.reportNo,
  kind: r.kind,
  dateKey: r.dateKey,
  cashier: r.cashier,
  branchName: r.branchName,
  receipts: r.receipts,
  customers: r.customers,
  net: r.sales.net,
  expected: r.cash.expected,
  counted: r.cash.counted,
  selisih: r.cash.selisih,
  startAt: r.startAt,
  endAt: r.endAt,
  savedAt: Date.now(),
});

export const fmtRp = (v) => 'Rp ' + (Number(v) || 0).toLocaleString('id-ID');
