// ============================================================
// WELP v21.4 ENTERPRISE GROWTH PACK, PEMBELIAN & TRANSFER
// ------------------------------------------------------------
// Tiga sub-panel dalam SATU tab:
//   1. PURCHASE ORDER , pesan barang ke supplier, terima barang
//                       parsial/lengkap, stok & HPP ikut otomatis.
//   2. HUTANG SUPPLIER , PO tempo tercatat otomatis, bayar
//                       sebagian/lengkap, kas keluar tercatat.
//   3. TRANSFER STOK   , nota kirim-terima barang antar cabang
//                       (stok pool terpusat; nota utk audit
//                       & tanggung jawab antar lokasi).
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Supplier, Boxes, Plus, Check, X, StokMasuk, StokKeluar, Trash2,
  Edit3, Package, ClipboardList, JaringanBuddy,
} from '../welp-icons.jsx';
import {
  formatIDR, useTenantCol, safeParse, dbSet, auditLog,
} from '../core.jsx';
import { canDo } from '../welp-core/rbac.js';
import { stockTrackingOn } from '../core.jsx';
import {
  Button, Card, PageTitle, Badge, EmptyState, Modal, ConfirmDialog,
  Select, Toggle, NumericInput, Segmented, HelpBox,
} from '../ui';
import { nid, fmtDT, fmtD } from './kit.js';

const actorOf = (licenseInfo) => ({
  actor: licenseInfo?.employeeName || licenseInfo?.tenant || 'owner',
  actorRole: licenseInfo?.currentUserRole || 'owner',
});

const branchIdOf = (licenseInfo) => licenseInfo?.branchId || 'PUSAT';
const branchNameOf = (licenseInfo, branches) => {
  const b = (branches || []).find(x => x.cid === branchIdOf(licenseInfo));
  return b?.name || licenseInfo?.branchName || 'Pusat';
};

const PO_META = {
  PESANAN: { label: 'Dipesan', tone: 'gold' },
  SEBAGIAN: { label: 'Diterima Sebagian', tone: 'teal' },
  DITERIMA: { label: 'Diterima Lunas', tone: 'green' },
  BATAL: { label: 'Dibatalkan', tone: 'red' },
};
const HUTANG_META = {
  BELUM: { label: 'Belum Dibayar', tone: 'red' },
  SEBAGIAN: { label: 'Terbayar Sebagian', tone: 'gold' },
  LUNAS: { label: 'Lunas', tone: 'green' },
};
const TRF_META = {
  DIKIRIM: { label: 'Dikirim', tone: 'gold' },
  DITERIMA: { label: 'Diterima', tone: 'green' },
  BATAL: { label: 'Dibatalkan', tone: 'red' },
};

const poNoOf = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `PO-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
};
const trfNoOf = poNoOf;

/* ============================================================
   PANEL 1: PURCHASE ORDER
   ============================================================ */
const EMPTY_ITEM = { productId: '', name: '', qty: 0, harga: 0 };

const PoPanel = ({ licenseInfo, triggerAlert, perms }) => {
  const { items: pos, addRow, updateRow, removeRow } = useTenantCol(licenseInfo, 'purchase_order', 'po_db');
  const { items: suppliers } = useTenantCol(licenseInfo, 'supplier', 'supplier_db');
  const { items: payableRows, addRow: addPayable } = useTenantCol(licenseInfo, 'hutang', 'payable_db');
  const { items: branches } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const [products, setProducts] = useState(safeParse('product_stock_db', []));
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ supplierCid: '', expectedAt: '', note: '', tempo: false });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [receiveFor, setReceiveFor] = useState(null);
  const [recv, setRecv] = useState({});
  const [recvTempo, setRecvTempo] = useState(false);
  const [delFor, setDelFor] = useState(null);
  const { actor, actorRole } = actorOf(licenseInfo);
  const track = stockTrackingOn();

  const supplier = (suppliers || []).find(s => s.cid === form.supplierCid);
  const total = items.reduce((a, b) => a + (Number(b.qty) || 0) * (Number(b.harga) || 0), 0);

  const setItem = (i, patch) => setItems(prev => prev.map((it, x) => x === i ? { ...it, ...patch } : it));
  const pickProduct = (i, pid) => {
    const p = products.find(x => x.id === pid);
    setItem(i, { productId: pid, name: p?.name || '', harga: Number(p?.hpp) || 0 });
  };

  const createPO = () => {
    if (!form.supplierCid) return triggerAlert('Pilih supplier dulu.', 'error');
    const valid = items.filter(it => it.productId && Number(it.qty) > 0);
    if (!valid.length) return triggerAlert('Minimal satu item dengan jumlah lebih dari 0.', 'error');
    const rec = {
      poNo: poNoOf(), supplierCid: form.supplierCid, supplierName: supplier?.name || 'Supplier',
      cabangId: branchIdOf(licenseInfo), cabangName: branchNameOf(licenseInfo, branches),
      items: valid.map(it => ({ productId: it.productId, name: it.name, qty: Number(it.qty), qtyReceived: 0, harga: Number(it.harga) || 0 })),
      total, status: 'PESANAN',
      expectedAt: form.expectedAt ? new Date(form.expectedAt).getTime() : null,
      note: form.note || '', createdBy: actor,
    };
    addRow(rec);
    auditLog(licenseInfo, 'PO_CREATE', { target: rec.poNo, supplier: rec.supplierName, total, items: valid.length }, { actor, actorRole });
    setOpenForm(false); setItems([{ ...EMPTY_ITEM }]); setForm({ supplierCid: '', expectedAt: '', note: '', tempo: false });
    triggerAlert('Purchase Order dibuat.', 'success');
  };

  const openReceive = (po) => {
    setReceiveFor(po);
    setRecvTempo(false);
    const init = {};
    (po.items || []).forEach(it => { init[it.productId] = { qty: Math.max(0, it.qty - (it.qtyReceived || 0)), harga: it.harga }; });
    setRecv(init);
  };

  const recvValue = receiveFor
    ? (receiveFor.items || []).reduce((a, it) => a + (Number(recv[it.productId]?.qty) || 0) * (Number(recv[it.productId]?.harga) || 0), 0)
    : 0;

  const confirmReceive = () => {
    const po = receiveFor;
    if (!po) return;
    const lines = (po.items || [])
      .map(it => ({ it, q: Number(recv[it.productId]?.qty) || 0, h: Number(recv[it.productId]?.harga) || 0 }))
      .filter(x => x.q > 0);
    if (!lines.length) return triggerAlert('Isi jumlah barang yang diterima.', 'error');

    let updatedProducts = [...products];
    const logs = safeParse('stock_history_db', []);
    lines.forEach(({ it, q, h }) => {
      const idx = updatedProducts.findIndex(p => p.id === it.productId);
      if (idx >= 0) {
        const p = updatedProducts[idx];
        const oldStock = Number(p.stock || 0);
        const oldHpp = Number(p.hpp);
        // HPP rata-rata bergerak saat harga beli baru diketahui
        if (h > 0 && stockTrackingOn()) {
          const newStock = oldStock + q;
          if (!Number.isNaN(oldHpp) && oldHpp > 0) p.hpp = Math.round(((oldStock * oldHpp) + (q * h)) / newStock);
          else p.hpp = h;
        }
        p.stock = oldStock + q;
        logs.push({
          id: `log_${Date.now()}_${idx}`, date: new Date().toISOString(),
          productName: p.name, type: 'Masuk', qty: q,
          note: `Penerimaan PO ${po.poNo} dari ${po.supplierName}`,
        });
      }
    });

    const nextItems = (po.items || []).map(it => ({
      ...it, qtyReceived: (it.qtyReceived || 0) + (Number(recv[it.productId]?.qty) || 0),
      harga: (Number(recv[it.productId]?.harga) || 0) > 0 ? Number(recv[it.productId].harga) : it.harga,
    }));
    const done = nextItems.every(it => (it.qtyReceived || 0) >= it.qty);
    updateRow(po.cid, { items: nextItems, status: done ? 'DITERIMA' : 'SEBAGIAN', receivedAt: done ? Date.now() : po.receivedAt || null });

    if (recvTempo && recvValue > 0) {
      addPayable({
        poCid: po.cid, poNo: po.poNo, supplierName: po.supplierName,
        amount: recvValue, paid: 0, status: 'BELUM',
        dueAt: po.expectedAt || (Date.now() + 30 * 86400000),
        branchId: po.cabangId, createdBy: actor, note: 'Tempo dari penerimaan PO',
      });
    }

    dbSet(licenseInfo?.id, 'product_stock_db', updatedProducts);
    dbSet(licenseInfo?.id, 'stock_history_db', logs);
    setProducts(updatedProducts);
    auditLog(licenseInfo, 'PO_RECEIVE', { target: po.poNo, itemDiterima: lines.length, nilai: recvValue, tempo: recvTempo }, { actor, actorRole });
    setReceiveFor(null);
    triggerAlert(done ? 'PO diterima lengkas. Stok & HPP diperbarui.' : 'Penerimaan sebagian tercatat.', 'success');
  };

  const list = useMemo(() => (pos || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [pos]);
  const openCount = list.filter(p => p.status === 'PESANAN' || p.status === 'SEBAGIAN').length;
  const totalOpen = list.filter(p => p.status !== 'BATAL' && p.status !== 'DITERIMA').reduce((a, b) => a + Number(b.total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">PO Berjalan</p><p className="text-xl font-extrabold mt-1">{openCount}</p></div>
        <div className="card p-4"><p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Nilai Belum Tuntas</p><p className="text-xl font-extrabold mt-1 money">{formatIDR(totalOpen)}</p></div>
      </div>

      <Card title={`Purchase Order (${list.length})`} icon={Boxes}
        action={perms ? <Button onClick={() => setOpenForm(true)} className="!py-2 !text-[11px]"><Plus className="w-3.5 h-3.5" /> PO Baru</Button> : null}
        help="Terima barang parsial didukung: stok masuk sesuai jumlah diterima, sisanya tetap terbuka.">
        {list.length === 0 ? (
          <EmptyState icon={Boxes} compact title="Belum ada PO"
            desc="Buat PO ke supplier, lalu tekan Terima Barang saat pengiriman datang. Stok dan HPP terisi otomatis." />
        ) : (
          <div className="space-y-2">
            {list.map(po => {
              const meta = PO_META[po.status] || PO_META.PESANAN;
              const recvCount = (po.items || []).filter(it => (it.qtyReceived || 0) > 0).length;
              return (
                <div key={po.cid} className="rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-extrabold text-[12px]">{po.poNo}</p>
                      <p className="font-extrabold text-[13px] truncate mt-0.5">{po.supplierName} · {formatIDR(po.total)}</p>
                      <p className="text-[10px] font-bold text-ink-faint mt-0.5">
                        {po.items?.length || 0} item · {recvCount} diterima · dibuat {fmtDT(po.createdAt)}
                        {po.expectedAt ? ` · target ${fmtD(po.expectedAt)}` : ''}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(po.items || []).map((it, i) => (
                      <span key={i} className="text-[9.5px] font-bold px-2 py-1 rounded-lg bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70">
                        {it.name} {it.qtyReceived || 0}/{it.qty}
                      </span>
                    ))}
                  </div>
                  {po.status !== 'BATAL' && po.status !== 'DITERIMA' && (
                    <div className="flex gap-2 mt-3">
                      <Button onClick={() => openReceive(po)} className="!py-1.5 !text-[10.5px] flex-1"><StokMasuk className="w-3.5 h-3.5" /> Terima Barang</Button>
                      <Button variant="secondary" onClick={() => { updateRow(po.cid, { status: 'BATAL' }); auditLog(licenseInfo, 'PO_CANCEL', { target: po.poNo }, { actor, actorRole }); }} className="!py-1.5 !text-[10.5px]"><X className="w-3.5 h-3.5" /> Batal</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Form PO baru */}
      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Purchase Order Baru" width="max-w-lg"
        sub="Pesan barang ke supplier, bisa beberapa item sekaligus."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpenForm(false)}>Batal</Button>
            <Button className="flex-1" onClick={createPO}>Buat PO</Button>
          </div>
        }>
        <div className="space-y-3">
          <Select label="Supplier" value={form.supplierCid} onChange={v => setForm(f => ({ ...f, supplierCid: v }))}
            options={[{ value: '', label: 'Pilih supplier' }, ...(suppliers || []).map(s => ({ value: s.cid, label: s.name || 'Supplier' }))]} />
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">Target tanggal datang (opsional)</label>
            <input type="date" className="field mt-1" value={form.expectedAt} onChange={e => setForm(f => ({ ...f, expectedAt: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">Item Pesanan</p>
            {items.map((it, i) => (
              <div key={i} className="p-3 rounded-xl bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark space-y-2">
                <div className="flex gap-2">
                  <Select value={it.productId} onChange={v => pickProduct(i, v)} className="flex-1"
                    options={[{ value: '', label: 'Pilih produk' }, ...products.map(p => ({ value: p.id, label: `${p.name} (stok ${p.stock || 0})` }))]} />
                  {items.length > 1 && (
                    <button onClick={() => setItems(prev => prev.filter((_, x) => x !== i))} className="w-10 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick flex items-center justify-center shrink-0"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumericInput label="Jumlah" value={it.qty} onChange={v => setItem(i, { qty: v })} />
                  <NumericInput label="Harga beli per unit" value={it.harga} onChange={v => setItem(i, { harga: v })} prefix="Rp" />
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])} className="w-full"><Plus className="w-4 h-4" /> Tambah Item</Button>
          </div>
          <div className="flex justify-between items-center p-3 rounded-xl bg-flame-50 dark:bg-flame-900/20 border border-flame-200 dark:border-flame-900/40">
            <span className="font-extrabold text-[12px]">Total PO</span>
            <span className="font-extrabold money">{formatIDR(total)}</span>
          </div>
          <input className="field" placeholder="Catatan (opsional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
      </Modal>

      {/* Terima barang */}
      <Modal open={!!receiveFor} onClose={() => setReceiveFor(null)} title={`Terima Barang ${receiveFor?.poNo || ''}`}
        sub={`Supplier: ${receiveFor?.supplierName || ''}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setReceiveFor(null)}>Batal</Button>
            <Button className="flex-1" onClick={confirmReceive}>Konfirmasi Terima</Button>
          </div>
        }>
        <div className="space-y-3">
          {(receiveFor?.items || []).map((it, i) => {
            const sisa = it.qty - (it.qtyReceived || 0);
            return (
              <div key={i} className="p-3 rounded-xl bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-extrabold text-[12px] truncate">{it.name}</p>
                  <span className="text-[10px] font-bold text-ink-faint shrink-0 ml-2">sisa {Math.max(0, sisa)} / {it.qty}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumericInput label="Terima sekarang" value={recv[it.productId]?.qty ?? 0} onChange={v => setRecv(r => ({ ...r, [it.productId]: { ...(r[it.productId] || {}), qty: Math.min(v, Math.max(0, sisa)) } }))} />
                  <NumericInput label="Harga beli aktual" value={recv[it.productId]?.harga ?? it.harga} onChange={v => setRecv(r => ({ ...r, [it.productId]: { ...(r[it.productId] || {}), harga: v } }))} prefix="Rp" />
                </div>
              </div>
            );
          })}
          <div className="flex justify-between items-center p-3 rounded-xl bg-flame-50 dark:bg-flame-900/20 border border-flame-200 dark:border-flame-900/40">
            <span className="font-extrabold text-[12px]">Nilai diterima</span>
            <span className="font-extrabold money">{formatIDR(recvValue)}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark">
            <div>
              <p className="font-extrabold text-[12.5px]">Catat sebagai hutang (tempo)</p>
              <p className="text-[10px] font-bold text-ink-faint">Muncul di panel Hutang Supplier.</p>
            </div>
            <Toggle on={recvTempo} onClick={() => setRecvTempo(v => !v)} />
          </div>
          {track === false && <HelpBox text="Stock Tracking sedang OFF: penerimaan tetap tercatat sebagai riwayat, tapi stok produk tidak diubah." />}
        </div>
      </Modal>

      <ConfirmDialog open={!!delFor} danger title="Hapus PO?" typeWord={delFor?.poNo}
        message="PO yang sudah menerima barang sebaiknya tidak dihapus. Pembatalan lebih aman."
        onCancel={() => setDelFor(null)} onConfirm={() => { removeRow(delFor.cid); setDelFor(null); }} />
    </div>
  );
};

/* ============================================================
   PANEL 2: HUTANG SUPPLIER
   ============================================================ */
const HutangPanel = ({ licenseInfo, triggerAlert, perms }) => {
  const { items: payables, updateRow } = useTenantCol(licenseInfo, 'hutang', 'payable_db');
  const [payFor, setPayFor] = useState(null);
  const [payAmt, setPayAmt] = useState(0);
  const { actor, actorRole } = actorOf(licenseInfo);

  const sisaOf = (h) => Math.max(0, Number(h.amount || 0) - Number(h.paid || 0));
  const totalSisa = (payables || []).filter(h => h.status !== 'LUNAS').reduce((a, b) => a + sisaOf(b), 0);
  const overdue = (payables || []).filter(h => h.status !== 'LUNAS' && h.dueAt && Date.now() > h.dueAt).length;

  const openPay = (h) => { setPayFor(h); setPayAmt(sisaOf(h)); };

  const confirmPay = () => {
    const h = payFor;
    const amt = Math.round(Number(payAmt) || 0);
    if (!h || amt <= 0) return triggerAlert('Nominal pembayaran harus lebih dari 0.', 'error');
    if (amt > sisaOf(h)) return triggerAlert('Nominal melebihi sisa hutang.', 'error');
    const paid = Number(h.paid || 0) + amt;
    const status = paid >= Number(h.amount || 0) ? 'LUNAS' : 'SEBAGIAN';
    updateRow(h.cid, { paid, status, lastPaidAt: Date.now(), lastPaidBy: actor });

    // Kas keluar otomatis (mirror expense_db = sumber tab Kas Keluar)
    const expenses = safeParse('expense_db', []);
    expenses.unshift({
      id: `exp_${Date.now()}`, date: new Date().toISOString(),
      note: `Pembayaran hutang PO ${h.poNo} ke ${h.supplierName}`,
      amount: amt, category: 'Pembayaran Hutang',
    });
    dbSet(licenseInfo?.id, 'expense_db', expenses);

    auditLog(licenseInfo, 'HUTANG_BAYAR', { target: h.poNo, nominal: amt, status }, { actor, actorRole });
    setPayFor(null);
    triggerAlert(status === 'LUNAS' ? 'Hutang lunas. Kas keluar tercatat.' : 'Pembayaran sebagian tercatat.', 'success');
  };

  const list = useMemo(() => (payables || []).slice().sort((a, b) => {
    const sa = a.status === 'LUNAS' ? 1 : 0, sb = b.status === 'LUNAS' ? 1 : 0;
    return sa - sb || (a.dueAt || 0) - (b.dueAt || 0);
  }), [payables]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Total Sisa Hutang</p><p className="text-xl font-extrabold mt-1 money">{formatIDR(totalSisa)}</p></div>
        <div className="card p-4"><p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Jatuh Tempo</p><p className={`text-xl font-extrabold mt-1 ${overdue ? 'text-brick' : ''}`}>{overdue} PO</p></div>
      </div>

      <Card title={`Hutang Supplier (${list.length})`} icon={Supplier}
        help="Hutang muncul otomatis saat penerimaan PO ditandai tempo. Pembayaran otomatis masuk ke Kas Keluar.">
        {list.length === 0 ? (
          <EmptyState icon={Supplier} compact title="Tidak ada hutang"
            desc="Centang Catat sebagai hutang saat menerima barang PO tempo, hutang muncul di sini." />
        ) : (
          <div className="space-y-2">
            {list.map(h => {
              const meta = HUTANG_META[h.status] || HUTANG_META.BELUM;
              const late = h.status !== 'LUNAS' && h.dueAt && Date.now() > h.dueAt;
              return (
                <div key={h.cid} className={`rounded-2xl border p-4 bg-paper dark:bg-white/[.03] ${late ? 'border-brick/40' : 'border-line dark:border-line-dark'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[13px] truncate">{h.supplierName}</p>
                      <p className="font-mono text-[10.5px] font-bold text-ink-faint">{h.poNo}</p>
                      <p className="text-[10px] font-bold text-ink-faint mt-0.5">
                        {formatIDR(Number(h.paid || 0))} dibayar dari {formatIDR(h.amount)}
                        {h.dueAt ? ` · tempo ${fmtD(h.dueAt)}` : ''}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{late ? 'Lewat Tempo' : meta.label}</Badge>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface dark:bg-white/[.06] overflow-hidden mt-2.5">
                    <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.min(100, (Number(h.paid || 0) / Math.max(1, Number(h.amount || 1))) * 100)}%` }} />
                  </div>
                  {h.status !== 'LUNAS' && (
                    <Button onClick={() => openPay(h)} className="!py-1.5 !text-[10.5px] mt-3 w-full">Bayar Hutang</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={`Bayar Hutang ${payFor?.poNo || ''}`}
        sub={`${payFor?.supplierName || ''} · sisa ${formatIDR(payFor ? sisaOf(payFor) : 0)}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPayFor(null)}>Batal</Button>
            <Button className="flex-1" onClick={confirmPay}>Bayar</Button>
          </div>
        }>
        <NumericInput label="Nominal bayar" value={payAmt} onChange={setPayAmt} prefix="Rp" />
        <p className="text-[10.5px] font-bold text-ink-faint mt-2">Pembayaran otomatis tercatat sebagai Kas Keluar kategori Pembayaran Hutang.</p>
      </Modal>
    </div>
  );
};

/* ============================================================
   PANEL 3: TRANSFER STOK ANTAR CABANG
   ============================================================ */
const TransferPanel = ({ licenseInfo, triggerAlert, perms }) => {
  const { items: transfers, addRow, updateRow } = useTenantCol(licenseInfo, 'transfer_stok', 'transfer_db');
  const { items: branches } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const [products, setProducts] = useState(safeParse('product_stock_db', []));
  const [openForm, setOpenForm] = useState(false);
  const [toBranch, setToBranch] = useState('');
  const [items, setItems] = useState([{ productId: '', name: '', qty: 0 }]);
  const [note, setNote] = useState('');
  const { actor, actorRole } = actorOf(licenseInfo);

  const fromId = branchIdOf(licenseInfo);
  const fromName = branchNameOf(licenseInfo, branches);
  const target = (branches || []).find(b => b.cid === toBranch);

  const setItem = (i, patch) => setItems(prev => prev.map((it, x) => x === i ? { ...it, ...patch } : it));

  const createTransfer = () => {
    if (!toBranch) return triggerAlert('Pilih cabang tujuan.', 'error');
    const valid = items.filter(it => it.productId && Number(it.qty) > 0);
    if (!valid.length) return triggerAlert('Minimal satu item dengan jumlah lebih dari 0.', 'error');
    for (const it of valid) {
      const p = products.find(x => x.id === it.productId);
      if (p && Number(p.stock || 0) < Number(it.qty)) {
        return triggerAlert(`Stok ${p.name} tidak cukup (${p.stock || 0} tersisa).`, 'error');
      }
    }
    const rec = {
      trfNo: trfNoOf(), fromBranchId: fromId, fromBranchName: fromName,
      toBranchId: toBranch, toBranchName: target?.name || 'Cabang',
      items: valid.map(it => ({ productId: it.productId, name: it.name, qty: Number(it.qty) })),
      status: 'DIKIRIM', note: note || '', sentBy: actor,
    };
    addRow(rec);
    auditLog(licenseInfo, 'TRANSFER_KIRIM', { target: rec.trfNo, tujuan: rec.toBranchName, items: valid.length }, { actor, actorRole });
    setOpenForm(false); setItems([{ productId: '', name: '', qty: 0 }]); setNote('');
    triggerAlert('Nota transfer dibuat. Cabang tujuan tinggal menekan Terima.', 'success');
  };

  const receiveTransfer = (tr) => {
    updateRow(tr.cid, { status: 'DITERIMA', receivedAt: Date.now(), receivedBy: actor });
    auditLog(licenseInfo, 'TRANSFER_TERIMA', { target: tr.trfNo, dari: tr.fromBranchName }, { actor, actorRole });
    triggerAlert('Transfer diterima. Riwayat lengkap tersimpan.', 'success');
  };

  const list = useMemo(() => (transfers || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [transfers]);

  return (
    <div className="space-y-4">
      <HelpBox text="Stok WELP terpusat, jadi transfer mencatat pergerakan barang antar lokasi untuk keperluan audit dan tanggung jawab pengiriman. Selisih fisik tetap dijaga lewat Stok Opname per cabang." />
      <Card title={`Nota Transfer (${list.length})`} icon={JaringanBuddy}
        action={perms ? <Button onClick={() => setOpenForm(true)} className="!py-2 !text-[11px]"><Plus className="w-3.5 h-3.5" /> Transfer Baru</Button> : null}>
        {list.length === 0 ? (
          <EmptyState icon={JaringanBuddy} compact title="Belum ada transfer"
            desc="Buat nota kirim barang ke cabang lain, lalu cabang tujuan menekan Terima saat barang datang." />
        ) : (
          <div className="space-y-2">
            {list.map(tr => {
              const meta = TRF_META[tr.status] || TRF_META.DIKIRIM;
              return (
                <div key={tr.cid} className="rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-extrabold text-[12px]">{tr.trfNo}</p>
                      <p className="font-extrabold text-[13px] truncate mt-0.5">{tr.fromBranchName} ke {tr.toBranchName}</p>
                      <p className="text-[10px] font-bold text-ink-faint mt-0.5">
                        {tr.items?.length || 0} item · dikirim {fmtDT(tr.createdAt || Date.now())}
                        {tr.receivedAt ? ` · diterima ${fmtDT(tr.receivedAt)}` : ''}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(tr.items || []).map((it, i) => (
                      <span key={i} className="text-[9.5px] font-bold px-2 py-1 rounded-lg bg-surface dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70">{it.name} x{it.qty}</span>
                    ))}
                  </div>
                  {tr.status === 'DIKIRIM' && (
                    <Button onClick={() => receiveTransfer(tr)} className="!py-1.5 !text-[10.5px] mt-3 w-full"><Check className="w-3.5 h-3.5" /> Terima Barang</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Transfer Barang Antar Cabang"
        sub={`Dikirim dari: ${fromName}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpenForm(false)}>Batal</Button>
            <Button className="flex-1" onClick={createTransfer}>Kirim Nota</Button>
          </div>
        }>
        <div className="space-y-3">
          <Select label="Cabang tujuan" value={toBranch} onChange={setToBranch}
            options={[{ value: '', label: 'Pilih cabang tujuan' }, ...(branches || []).filter(b => b.cid !== fromId).map(b => ({ value: b.cid, label: b.name || 'Cabang' }))]} />
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="p-3 rounded-xl bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark space-y-2">
                <div className="flex gap-2">
                  <Select value={it.productId} className="flex-1"
                    onChange={v => {
                      const p = products.find(x => x.id === v);
                      setItem(i, { productId: v, name: p?.name || '' });
                    }}
                    options={[{ value: '', label: 'Pilih produk' }, ...products.map(p => ({ value: p.id, label: `${p.name} (stok ${p.stock || 0})` }))]} />
                  {items.length > 1 && (
                    <button onClick={() => setItems(prev => prev.filter((_, x) => x !== i))} className="w-10 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick flex items-center justify-center shrink-0"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <NumericInput label="Jumlah kirim" value={it.qty} onChange={v => setItem(i, { qty: v })} />
              </div>
            ))}
            <Button variant="outline" onClick={() => setItems(prev => [...prev, { productId: '', name: '', qty: 0 }])} className="w-full"><Plus className="w-4 h-4" /> Tambah Item</Button>
          </div>
          <input className="field" placeholder="Catatan pengiriman (opsional)" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================
   TAB UTAMA
   ============================================================ */
export const SupplyTab = ({ licenseInfo, triggerAlert, perms }) => {
  const [seg, setSeg] = useState('po');
  const canManage = canDo(perms, 'purchasing.manage');
  const canCreate = canDo(perms, 'purchasing.create') || canManage;

  return (
    <div className="space-y-5">
      <PageTitle title="Pembelian & Transfer"
        sub="PO ke supplier, hutang tempo, dan nota transfer antar cabang."
        right={<Segmented value={seg} onChange={setSeg} items={[
          { id: 'po', label: 'PO' },
          { id: 'hutang', label: 'Hutang' },
          { id: 'transfer', label: 'Transfer' },
        ]} />} />
      {seg === 'po' && <PoPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} perms={canCreate} />}
      {seg === 'hutang' && <HutangPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} perms={canManage} />}
      {seg === 'transfer' && <TransferPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} perms={canCreate} />}
    </div>
  );
};
