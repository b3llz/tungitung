// ============================================================
// TAB OPERASIONAL v8 WELP — Riwayat Transaksi, Kas Keluar,
// Diskon/Pajak. Manajemen Karyawan pindah ke src/team.jsx.
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  Search, Uang, Qris, KasKeluar, Save, Trash2, Diskon, KoinBuddy,
  GembokBuddy, GembokBuka, Toko, Omzet, PaketBuddy,
  LayarBuddy, JaringanBuddy, Riwayat
} from './welp-icons.jsx';
import { safeParse, formatIDR } from './core.jsx';
import { Button, Card, PageTitle, NumericInput, Select, Badge, EmptyState } from './ui';

/* ================= RIWAYAT TRANSAKSI ================= */
export const HistoryTab = ({ activeTab }) => {
  const [searchOrder, setSearchOrder] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [txs, setTxs] = useState([]);

  useEffect(() => {
    if (activeTab === 'history') setTxs(safeParse('pos_history_db', []));
  }, [activeTab]);

  const totalHariIni = txs
    .filter(t2 => new Date(t2.date).toDateString() === new Date().toDateString())
    .reduce((sum, t2) => sum + t2.total, 0);

  const filteredTxs = txs.filter(t2 => t2.id.toLowerCase().includes(searchOrder.toLowerCase()) || (t2.buyer && t2.buyer.toLowerCase().includes(searchOrder.toLowerCase())));

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-4">
      <PageTitle title="Riwayat Transaksi" sub="Database Penjualan" />

      <div className="card !rounded-3xl overflow-hidden">
        <div className="bg-chrome-deep px-5 py-5 flex justify-between items-center relative overflow-hidden">
          <div>
            <p className="text-apricot/80 text-[10px] font-extrabold uppercase tracking-[0.2em]">Omzet Hari Ini</p>
            <h3 className="text-2xl font-extrabold text-white money tracking-tight mt-0.5">{formatIDR(totalHariIni)}</h3>
          </div>
          <Uang className="w-12 h-12 text-apricot/40" />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search className="w-4 h-4 text-ink-faint" /></div>
        <input className="field-lg pl-10" placeholder="Cari Nomor Order / Nama Pembeli..." value={searchOrder} onChange={e => setSearchOrder(e.target.value)} />
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
        {filteredTxs.length === 0 ? <EmptyState mascot={txs.length === 0 ? "kerja" : "bingung"} title={txs.length === 0 ? "Belum ada transaksi" : "Tidak ditemukan"} desc={txs.length === 0 ? "Setiap transaksi kasir akan tercatat otomatis di sini, lengkap dengan detail item dan pembayaran." : "Coba kata kunci lain, misalnya nomor order atau nama pembeli."} /> :
          filteredTxs.map(t2 => (
            <div key={t2.id} onClick={() => setSelectedTx(t2)} className="card p-4 flex justify-between items-center hover:border-flame-300 transition cursor-pointer press">
              <div className="flex gap-3.5 items-center">
                <div className="w-10 h-10 rounded-xl bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint shrink-0">
                  {t2.paymentMethod === 'Cash' ? <Uang className="w-5 h-5" /> : <Qris className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{t2.buyer || 'Tanpa Nama'}</h4>
                  <p className="text-[10px] text-ink-faint font-mono mt-0.5">{t2.id} • {new Date(t2.date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-base text-ink dark:text-ink-inv money">{formatIDR(t2.total)}</p>
                <p className="text-[9px] font-bold text-ink-faint bg-paper dark:bg-white/5 px-2 py-0.5 rounded inline-block mt-1">{t2.items.length} Item</p>
              </div>
            </div>
          ))}
      </div>

      {selectedTx && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedTx(null)}>
          <div className="bg-surface dark:bg-surface-dark w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-pop animate-pop" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="kicker">Detail Order</p>
                <h3 className="font-extrabold text-lg text-ink dark:text-ink-inv tracking-tight mt-0.5">{selectedTx.buyer || 'Tanpa Nama'}</h3>
                <p className="text-[10px] text-ink-faint font-mono mt-0.5">{selectedTx.id}</p>
              </div>
              <Badge tone="green">Lunas</Badge>
            </div>

            <div className="bg-paper dark:bg-white/[.03] p-4 rounded-2xl space-y-3 border border-line dark:border-line-dark">
              {selectedTx.items.map((i, x) => (
                <div key={x} className="flex justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-ink-soft dark:text-ink-inv/80 block">{i.name}</span>
                    <span className="text-[10px] text-ink-faint money">{i.qty} x {formatIDR(i.price)}</span>
                  </div>
                  <span className="font-extrabold text-ink dark:text-ink-inv money">{formatIDR(i.price * i.qty)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-line dark:border-line-dark pt-3 flex justify-between font-extrabold text-sm text-ink dark:text-ink-inv">
                <span>Total Bayar</span>
                <span className="money">{formatIDR(selectedTx.total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mt-4">
              <div className="p-3 border border-line dark:border-line-dark rounded-xl">
                <p className="kicker mb-1">Metode</p>
                <p className="font-extrabold text-ink dark:text-ink-inv">{selectedTx.paymentMethod}</p>
              </div>
              <div className="p-3 border border-line dark:border-line-dark rounded-xl">
                <p className="kicker mb-1">Waktu</p>
                <p className="font-extrabold text-ink dark:text-ink-inv">{new Date(selectedTx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            <button onClick={() => setSelectedTx(null)} className="mt-5 w-full py-3 bg-chrome-deep dark:bg-flame-500 text-white dark:text-white rounded-2xl font-extrabold text-sm press">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= KAS KELUAR ================= */
export const CashOutTab = ({ triggerAlert }) => {
  const [expenses, setExpenses] = useState(safeParse('expense_db', []));
  const [form, setForm] = useState({ note: '', amount: 0, category: 'Operasional' });

  const saveExpense = () => {
    if (!form.note || form.amount <= 0) return triggerAlert("Isi catatan dan nominal dengan benar!", "error");
    const newEx = { id: `exp_${Date.now()}`, date: new Date().toISOString(), ...form };
    const updated = [newEx, ...expenses];
    setExpenses(updated);
    localStorage.setItem('expense_db', JSON.stringify(updated));
    setForm({ note: '', amount: 0, category: 'Operasional' });
    triggerAlert("Kas Keluar Berhasil Dicatat!");
  };

  // Catatan kas keluar harus bisa dikoreksi (hapus).
  const deleteExpense = (id) => {
    if (confirm("Hapus catatan pengeluaran ini?")) {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      localStorage.setItem('expense_db', JSON.stringify(updated));
      triggerAlert("Catatan pengeluaran dihapus.");
    }
  };

  const todayExpenses = expenses.filter(e => new Date(e.date).toDateString() === new Date().toDateString());
  const todayTotal = todayExpenses.reduce((a, b) => a + (b.amount || 0), 0);

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Kas Keluar" sub="Pencatatan Pengeluaran Harian" />

      <div className="card !rounded-3xl overflow-hidden">
        <div className="bg-brick-deep px-5 py-5 flex justify-between items-center">
          <div>
            <p className="text-white/60 text-[10px] font-extrabold uppercase tracking-[0.2em]">Total Kas Keluar Hari Ini</p>
            <h3 className="text-2xl font-extrabold text-white money tracking-tight mt-0.5">{formatIDR(todayTotal)}</h3>
          </div>
          <KasKeluar className="w-12 h-12 text-white/30" />
        </div>
      </div>

      <Card title="Input Pengeluaran" icon={KasKeluar}>
        <div className="space-y-4">
          <Select label="Kategori" value={form.category} options={['Operasional', 'Bahan Baku', 'Gaji/Upah', 'Lainnya']} onChange={v => setForm({ ...form, category: v })} />
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Catatan / Keterangan</label>
            <input className="field" placeholder="Contoh: Beli Es Batu" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <NumericInput label="Nominal Pengeluaran" prefix="Rp" value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
          <Button onClick={saveExpense} className="w-full py-3" icon={Save}>Simpan Pengeluaran</Button>
        </div>
      </Card>

      <div className="space-y-2.5">
        <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1">Riwayat Hari Ini</h3>
        {todayExpenses.length === 0 ? (
          <EmptyState mascot="pikir" title="Belum ada pengeluaran hari ini" desc="Catat setiap pembelian bahan, gaji harian, atau biaya operasional supaya laba harian akurat." />
        ) : todayExpenses.map(e => (
          <div key={e.id} className="card p-4 flex justify-between items-center">
            <div>
              <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{e.note}</p>
              <p className="text-[10px] text-ink-faint font-bold uppercase">{e.category} • {new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-extrabold text-brick money">- {formatIDR(e.amount)}</p>
              <button onClick={() => deleteExpense(e.id)} title="Hapus catatan" className="p-1.5 rounded-lg text-ink-faint hover:text-brick hover:bg-brick-soft dark:hover:bg-brick/10 transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ================= DISKON, PAJAK & BIAYA ================= */
export const DiscountTab = ({ triggerAlert }) => {
  // HARDENING: safeParse agar data korup tidak membuat crash.
  const [config, setConfig] = useState(safeParse('discount_tax_db', { tax: 0, service: 0, globalDiscount: 0 }));

  const saveConfig = (key, val) => {
    const newConf = { ...config, [key]: val };
    setConfig(newConf);
    localStorage.setItem('discount_tax_db', JSON.stringify(newConf));
    triggerAlert("Pengaturan Diperbarui!");
  };

  const rows = [
    { key: 'tax', title: 'Pajak (PPN)', desc: 'Persentase pajak yang dibebankan ke total tagihan pelanggan.', icon: Diskon, placeholder: 'Contoh: 11' },
    { key: 'service', title: 'Biaya Layanan (Service Charge)', desc: 'Biaya layanan tambahan (Maksimal 100%).', icon: KoinBuddy, placeholder: 'Contoh: 5' },
    { key: 'globalDiscount', title: 'Diskon Global (Promo)', desc: 'Potongan persen yang otomatis dipotong dari subtotal SETIAP transaksi kasir. Isi 0 bila tidak ada promo berjalan.', icon: Diskon, placeholder: 'Contoh: 5' }
  ];

  return (
    <div className="max-w-3xl mx-auto w-full pb-24">
      <PageTitle title="Pajak & Biaya" sub="Pengaturan PPN, Servis & Promo" />
      <Card title="Konfigurasi Tagihan" icon={Diskon} flush>
        <div className="divide-y divide-line/70 dark:divide-line-dark/70">
          {rows.map(r => (
            <div key={r.key} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-9 h-9 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><r.icon className="w-4 h-4" /></div>
                <div className="min-w-0">
                  <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{r.title}</p>
                  <p className="text-[11px] text-ink-faint font-semibold mt-0.5 leading-relaxed">{r.desc}</p>
                </div>
              </div>
              <div className="w-full sm:w-32 shrink-0">
                <NumericInput suffix="%" value={config[r.key] || 0} onChange={v => saveConfig(r.key, v)} placeholder={r.placeholder} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="mt-4 px-1">
        <p className="text-[10px] text-ink-faint font-semibold leading-relaxed">
          Urutan hitung: <span className="font-extrabold text-ink-soft dark:text-ink-inv/80">Subtotal → Diskon Global % → Pajak % → Service %</span>. Semua angka dibulatkan ke rupiah penuh dan berlaku otomatis di Kasir, Self-Order, dan struk.
        </p>
      </div>
    </div>
  );
};

/* ================= MANAJEMEN KARYAWAN ================= */
