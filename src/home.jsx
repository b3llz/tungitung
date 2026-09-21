// ============================================================
// BERANDA WELP v5 — halaman pembuka untuk pemilik bisnis.
// Semua angka diambil dari data nyata aplikasi (pos_history_db,
// expense_db, product_stock_db). Tidak ada data karangan.
// Laba kotor hanya tampil untuk owner/admin (RBAC sama seperti
// tab Laporan) dan dihitung dari hppAtSale transaksi.
// ============================================================
import React, { useState, useEffect } from 'react';
import { safeParse, formatIDR } from './core.jsx';
import { Badge, EmptyState, Mascot } from './ui';
import {
  Kasir, HppCalc, Stok, Riwayat, KasKeluar, Laporan, Karyawan,
  Supplier, Uang, Qris, Perhatian,
  ArrowUpCircle, ArrowDownCircle, Terang
} from './welp-icons.jsx';

const sameDay = (iso) => { try { return new Date(iso).toDateString() === new Date().toDateString(); } catch (e) { return false; } };

const MetricCard = ({ label, value, sub, icon: Icon, tone = 'light' }) => (
  <div className={`card p-4 sm:p-5 flex flex-col gap-2 ${tone === 'flame' ? '!bg-flame-600 !border-flame-500 text-white' : ''}`}>
    <div className="flex items-center justify-between">
      <p className={`kicker ${tone === 'flame' ? '!text-white/70' : ''}`}>{label}</p>
      {Icon && <Icon className={`w-6 h-6 ${tone === 'flame' ? 'text-white/80' : 'text-flame-500 dark:text-apricot'}`} />}
    </div>
    <p className={`text-xl sm:text-[26px] font-extrabold money tracking-tight leading-none ${tone === 'flame' ? 'text-white' : 'text-ink dark:text-ink-inv'}`}>{value}</p>
    {sub && <p className={`text-[10.5px] font-bold ${tone === 'flame' ? 'text-white/70' : 'text-ink-faint'}`}>{sub}</p>}
  </div>
);

export const HomeTab = ({ licenseInfo, setActive, activeTab }) => {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (activeTab !== 'home' && activeTab) return;
    const txs = safeParse('pos_history_db', []);
    const expenses = safeParse('expense_db', []);
    const products = safeParse('product_stock_db', []);
    const threshold = parseInt(localStorage.getItem('low_stock_threshold')) || 5;

    const todayTxs = txs.filter(t2 => sameDay(t2.date));
    const omzetToday = todayTxs.reduce((s, t2) => s + (t2.total || 0), 0);
    const expenseToday = expenses.filter(e => sameDay(e.date)).reduce((s, e) => s + (e.amount || 0), 0);

    // Laba kotor hari ini: hanya dari transaksi yang punya HPP saat penjualan.
    let grossProfit = 0, profitKnown = false;
    todayTxs.forEach(t2 => (t2.items || []).forEach(i => {
      if (typeof i.hppAtSale === 'number') { grossProfit += (i.price - i.hppAtSale) * i.qty; profitKnown = true; }
      else if (typeof i.hpp === 'number') { grossProfit += (i.price - i.hpp) * i.qty; profitKnown = true; }
    }));

    const lowStock = products.filter(p => (p.stock || 0) <= threshold).sort((a, b) => (a.stock || 0) - (b.stock || 0));

    setSnapshot({ txs, todayTxs, omzetToday, expenseToday, grossProfit, profitKnown, lowStock, products });
  }, [activeTab]);

  if (!snapshot) return <div className="max-w-6xl mx-auto w-full pb-24" />;

  const role = licenseInfo?.currentUserRole || 'owner';
  const isOwnerLike = role === 'owner' || role === 'admin';
  const canSeeCash = role === 'owner' || role === 'kasir';
  const profile = safeParse('store_profile', {});
  const greetName = profile.adminName || licenseInfo?.tenant || 'Bos';
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = now.getHours();
  const dayGreet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';

  const quickActions = [
    { id: 'pos', label: 'Jualan', icon: Kasir },
    { id: 'stock', label: 'Stok', icon: Stok },
    { id: 'calc', label: 'Hitung HPP', icon: HppCalc },
    { id: 'history', label: 'Riwayat', icon: Riwayat },
  ].filter(a => a.id === 'pos' || a.id === 'stock' || a.id === 'calc' || a.id === 'history');

  const latest = [...snapshot.txs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const nothingAtAll = snapshot.txs.length === 0 && snapshot.products.length === 0;

  return (
    <div className="max-w-6xl mx-auto w-full pb-24 space-y-5 animate-rise">

      {/* SAPAAN */}
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <p className="text-[11px] font-bold text-flame-600 dark:text-apricot flex items-center gap-1.5">{dateStr}</p>
          <h1 className="text-[24px] md:text-3xl font-display font-extrabold tracking-tight text-ink dark:text-ink-inv mt-0.5">
            {dayGreet}, {greetName}!
          </h1>
          <p className="text-xs text-ink-faint font-bold mt-1">Semoga hari ini ramai ya!</p>
        </div>
        {licenseInfo?.type && <Badge tone="gold" className="mb-1">{String(licenseInfo.type)}</Badge>}
      </div>

      {/* ONBOARDING: toko masih kosong */}
      {nothingAtAll && (
        <div className="card p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <Mascot pose="menyapa" className="w-28 h-28 object-contain shrink-0 animate-floaty" alt="Maskot WELP menyapa" />
          <div className="text-center sm:text-left">
            <h2 className="font-display font-extrabold text-xl text-ink dark:text-ink-inv">Tokomu masih kosong nih</h2>
            <p className="text-xs text-ink-soft dark:text-ink-inv/70 font-semibold mt-1 leading-relaxed max-w-md">
              Mulai dengan mengisi Stok Barang, atau hitung dulu harga pokok produk di Kalkulator HPP. Setelah itu, jualan bisa langsung dimulai.
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-4">
              <button onClick={() => setActive('stock')} className="px-4 py-2.5 rounded-2xl bg-flame-600 text-white text-xs font-extrabold hover:bg-flame-500 transition press">Isi Stok Barang</button>
              <button onClick={() => setActive('calc')} className="px-4 py-2.5 rounded-2xl bg-surface dark:bg-surface-dark border-2 border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/80 text-xs font-extrabold hover:border-flame-300 transition press">Hitung HPP</button>
            </div>
          </div>
        </div>
      )}

      {/* METRIK HARI INI (dari data nyata) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Omzet Hari Ini" value={formatIDR(snapshot.omzetToday)} sub={`${snapshot.todayTxs.length} transaksi`} icon={Uang} />
        <MetricCard label="Transaksi" value={String(snapshot.todayTxs.length)} sub="tercatat hari ini" icon={Riwayat} />
        {canSeeCash && <MetricCard label="Kas Keluar" value={formatIDR(snapshot.expenseToday)} sub="pengeluaran hari ini" icon={ArrowDownCircle} />}
        {isOwnerLike && (
          snapshot.profitKnown
            ? <MetricCard label="Laba Kotor" value={formatIDR(snapshot.grossProfit)} sub="dari HPP saat penjualan" icon={ArrowUpCircle} tone="flame" />
            : <MetricCard label="Laba Kotor" value="Belum terhitung" sub="lengkapi resep HPP produk" icon={ArrowUpCircle} />
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* TRANSAKSI TERAKHIR (nyata) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display font-extrabold text-lg text-ink dark:text-ink-inv">Transaksi Terakhir</h2>
            <button onClick={() => setActive('history')} className="text-[11px] font-extrabold text-flame-600 dark:text-apricot hover:underline">Lihat semua</button>
          </div>
          {latest.length === 0 ? (
            <EmptyState mascot="pikir" title="Belum ada transaksi" desc="Setiap penjualan di Kasir akan otomatis tercatat di sini." />
          ) : latest.map(t2 => (
            <div key={t2.id} className="card p-4 flex justify-between items-center">
              <div className="flex gap-3.5 items-center min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-paper dark:bg-white/5 flex items-center justify-center shrink-0">
                  {t2.paymentMethod === 'Cash' ? <Uang className="w-5 h-5 text-ink-faint" /> : <Qris className="w-5 h-5 text-ink-faint" />}
                </div>
                <div className="min-w-0">
                  <h4 className="font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{t2.buyer || 'Tanpa Nama'}</h4>
                  <p className="text-[10px] text-ink-faint font-bold mt-0.5">{new Date(t2.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {(t2.items || []).length} item</p>
                </div>
              </div>
              <p className="font-extrabold text-flame-700 dark:text-apricot money shrink-0">{formatIDR(t2.total)}</p>
            </div>
          ))}

          {/* AKSI CEPAT */}
          <div className="grid grid-cols-4 gap-2.5 pt-1">
            {quickActions.map(a => (
              <button key={a.id} onClick={() => setActive(a.id)}
                className="card p-3 sm:p-4 flex flex-col items-center gap-2 hover:border-flame-300 dark:hover:border-flame-600 transition press">
                <a.icon className="w-8 h-8" />
                <span className="text-[10px] font-extrabold text-ink-soft dark:text-ink-inv/75 text-center leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* STOK MENIPIS (nyata) */}
        <div className="space-y-3">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-line/70 dark:border-line-dark/70">
              <h2 className="font-display font-extrabold text-[15px] text-ink dark:text-ink-inv flex items-center gap-2">
                <Perhatian className="w-5 h-5" /> Stok Menipis
              </h2>
              {snapshot.lowStock.length > 0 && <Badge tone="red">{snapshot.lowStock.length} item</Badge>}
            </div>
            {snapshot.lowStock.length === 0 ? (
              <div className="p-5 text-center">
                <Terang className="w-10 h-10 mx-auto mb-2 text-gold" />
                <p className="text-xs font-bold text-ink-soft dark:text-ink-inv/75">Stok aman terkendali!</p>
                <p className="text-[10px] text-ink-faint mt-0.5">Tidak ada produk di bawah batas minimum.</p>
              </div>
            ) : (
              <div className="divide-y divide-line/60 dark:divide-line-dark/60">
                {snapshot.lowStock.slice(0, 5).map(p => (
                  <div key={p.id} className="px-4 py-3 flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-ink dark:text-ink-inv truncate">{p.name}</p>
                      <p className="text-[10px] text-ink-faint font-bold">{p.type || 'Produk'}</p>
                    </div>
                    <Badge tone={(p.stock || 0) <= 0 ? 'red' : 'gold'}>{p.stock || 0} left</Badge>
                  </div>
                ))}
              </div>
            )}
            {snapshot.lowStock.length > 0 && (
              <div className="p-3">
                <button onClick={() => setActive('stock')} className="w-full py-2.5 rounded-2xl bg-flame-600 text-white text-xs font-extrabold hover:bg-flame-500 transition press">Restock Sekarang</button>
              </div>
            )}
          </div>

          {/* Kartu_isi pasir: akses owner */}
          {isOwnerLike && (
            <button onClick={() => setActive('report')} className="card p-5 w-full text-left hover:border-flame-300 dark:hover:border-flame-600 transition press group">
              <Laporan className="w-9 h-9 mb-2" />
              <p className="font-display font-extrabold text-[15px] text-ink dark:text-ink-inv">Laporan & Analisa</p>
              <p className="text-[11px] text-ink-faint font-semibold mt-1 leading-relaxed">Lihat omzet, produk terlaris, dan margin tiap produk.</p>
              <span className="inline-block mt-2 text-[11px] font-extrabold text-flame-600 dark:text-apricot group-hover:translate-x-0.5 transition-transform">Buka laporan →</span>
            </button>
          )}
          {role === 'owner' && (
            <button onClick={() => setActive('employee')} className="card p-5 w-full text-left hover:border-flame-300 dark:hover:border-flame-600 transition press group">
              <Karyawan className="w-9 h-9 mb-2" />
              <p className="font-display font-extrabold text-[15px] text-ink dark:text-ink-inv">Tim & Akses</p>
              <p className="text-[11px] text-ink-faint font-semibold mt-1 leading-relaxed">Atur PIN karyawan supaya kasir bisa login sendiri.</p>
              <span className="inline-block mt-2 text-[11px] font-extrabold text-flame-600 dark:text-apricot group-hover:translate-x-0.5 transition-transform">Kelola tim →</span>
            </button>
          )}
        </div>
      </div>

      {/* Catatan kecil khas WELP */}
      <p className="text-center font-hand text-lg text-flame-600/80 dark:text-apricot/70 pt-1" style={{ transform: 'rotate(-1deg)' }}>
        catat tiap hari, untungnya kelihatan
      </p>
    </div>
  );
};
