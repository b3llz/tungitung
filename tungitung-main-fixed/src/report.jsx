// ============================================================
// LAPORAN & ANALISA v5 WELP — strip KPI 4 tile + grafik area
// flame. Logika statistik dipertahankan 100%: filter periode,
// grafik harian, laba kotor dari hppAtSale, margin health,
// stock velocity nyata, export Excel (ExcelJS).
// ============================================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Laporan, Omzet, LabaKotor, Keranjang, UnduhBuddy, MedaliBuddy,
  BahayaBuddy, RoketBuddy, Uang, Qris, Stok, HppCalc, Riwayat
} from './welp-icons.jsx';
import { safeParse, formatIDR, loadExcelJS } from './core.jsx';
import { Button, Card, Badge, EmptyState, Segmented, PageTitle } from './ui';

export const ReportTab = ({ licenseInfo, triggerAlert, activeTab }) => {
  const [filter, setFilter] = useState('month');
  const [txs, setTxs] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [focusedPoint, setFocusedPoint] = useState(null);

  // AUTO REFRESH: tarik data transaksi terbaru saat tab dibuka
  useEffect(() => {
    if (activeTab === 'report') {
      setTxs(safeParse('pos_history_db', []));
    }
  }, [activeTab]);

  const formatDateIndo = (dateStr) => new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatDayName = (dateStr) => new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long' });

  // --- LOGIKA STATISTIK ---
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filteredTxs = txs.filter(t2 => {
      const d = new Date(t2.date);
      if (filter === 'today') return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === currentYear;
      if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === currentYear;
      if (filter === 'year') return d.getFullYear() === currentYear;
      return true;
    });

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      date: new Date(currentYear, currentMonth, i + 1).toISOString(),
      total: 0,
      count: 0
    }));

    txs.filter(t2 => new Date(t2.date).getMonth() === currentMonth && new Date(t2.date).getFullYear() === currentYear)
      .forEach(t2 => {
        const day = new Date(t2.date).getDate();
        if (dailyData[day - 1]) {
          dailyData[day - 1].total += t2.total;
          dailyData[day - 1].count += 1;
        }
      });

    const maxDaily = Math.max(...dailyData.map(d => d.total), 1000);

    const productSales = {};
    filteredTxs.forEach(t2 => {
      t2.items.forEach(item => {
        productSales[item.name] = (productSales[item.name] || 0) + item.qty;
      });
    });
    const topProducts = Object.entries(productSales)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      rev: filteredTxs.reduce((a, b) => a + b.total, 0),
      count: filteredTxs.length,
      list: filteredTxs.reverse(),
      dailyData,
      maxDaily,
      topProducts
    };
  }, [filter, txs]);

  // --- GEOMETRI GRAFIK (Area + Line + Moving Average) ---
  const chart = useMemo(() => {
    const data = stats.dailyData;
    const n = data.length || 1;
    const max = stats.maxDaily || 1;
    const H = 100;
    const pts = data.map((d, i) => ({
      ...d,
      x: data.length > 1 ? (i / (data.length - 1)) * 100 : 0,
      y: H - (d.total / max) * H
    }));
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const areaPath = pts.length ? `${linePath} L100,100 L0,100 Z` : '';
    const totalRev = data.reduce((a, b) => a + b.total, 0);
    const avg = totalRev / n;
    const avgY = H - (avg / max) * H;
    const peak = data.reduce((a, b) => (b.total > a.total ? b : a), data[0] || { total: 0, day: 0 });
    const activeDays = data.filter(d => d.total > 0).length;
    return { pts, linePath, areaPath, avg, avgY, peak, activeDays, max };
  }, [stats]);

  const fmtK = (v) => v >= 1000000 ? (v / 1000000).toFixed(1) + 'jt' : v >= 1000 ? Math.round(v / 1000) + 'rb' : Math.round(v).toString();

  // --- PENGUKURAN PLOT (pixel-perfect utk kurva, titik & tooltip) ---
  const plotRef = useRef(null);
  const [plotSize, setPlotSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setPlotSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- GEOMETRI KURVA MONOTONE (Fritsch-Carlson) ---
  // Kurva halus seperti referensi dashboard: bezier monotone yang
  // TIDAK pernah overshoot melewati titik data / di bawah nol.
  const geom = useMemo(() => {
    const w = plotSize.w, h = plotSize.h;
    const data = stats.dailyData;
    const n = data.length;
    if (!w || !h || !n) return null;
    const max = chart.max || 1;
    const padX = 8;
    const X = i => n > 1 ? padX + (i / (n - 1)) * (w - padX * 2) : w / 2;
    const Y = v => (1 - Math.min(v / max, 1)) * h;
    const pts = data.map((d, i) => ({ ...d, x: X(i), y: Y(d.total) }));

    let line = '', area = '';
    if (n > 1) {
      const delta = [], tan = [];
      for (let i = 0; i < n - 1; i++) delta.push((pts[i + 1].y - pts[i].y) / Math.max(pts[i + 1].x - pts[i].x, 1e-6));
      tan[0] = delta[0]; tan[n - 1] = delta[n - 2];
      for (let i = 1; i < n - 1; i++) {
        tan[i] = (delta[i - 1] + delta[i]) / 2;
        if (delta[i - 1] * delta[i] <= 0) tan[i] = 0;
      }
      for (let i = 0; i < n - 1; i++) {
        if (delta[i] === 0) { tan[i] = 0; tan[i + 1] = 0; continue; }
        const a = tan[i] / delta[i], b = tan[i + 1] / delta[i];
        const s = a * a + b * b;
        if (s > 9) { const t3 = 3 / Math.sqrt(s); tan[i] = t3 * a * delta[i]; tan[i + 1] = t3 * b * delta[i]; }
      }
      const f1 = v => v.toFixed(2);
      const segs = [];
      for (let i = 0; i < n - 1; i++) {
        const dx = (pts[i + 1].x - pts[i].x) / 3;
        segs.push(`C${f1(pts[i].x + dx)},${f1(pts[i].y + tan[i] * dx)} ${f1(pts[i + 1].x - dx)},${f1(pts[i + 1].y - tan[i + 1] * dx)} ${f1(pts[i + 1].x)},${f1(pts[i + 1].y)}`);
      }
      line = `M${f1(pts[0].x)},${f1(pts[0].y)} ` + segs.join(' ');
      area = `${line} L${f1(pts[n - 1].x)},${f1(h)} L${f1(pts[0].x)},${f1(h)} Z`;
    }
    return { pts, line, area, avgY: Y(chart.avg) };
  }, [plotSize, stats, chart]);

  // LABA NYATA: dihitung dari hppAtSale (snapshot saat checkout)
  const profitStats = useMemo(() => {
    let cogs = 0, netSales = 0, knownQty = 0, totalQty = 0;
    stats.list.forEach(tx => {
      const items = tx.items || [];
      items.forEach(it => {
        const hpp = (typeof it.hppAtSale === 'number') ? it.hppAtSale : (typeof it.hpp === 'number' ? it.hpp : null);
        totalQty += it.qty;
        if (hpp != null) { cogs += hpp * it.qty; knownQty += it.qty; }
      });
      netSales += (tx.subtotal != null ? tx.subtotal : items.reduce((a, b) => a + b.price * b.qty, 0)) - (tx.discountAmt || 0);
    });
    const grossProfit = netSales - cogs;
    const coverage = totalQty ? Math.round((knownQty / totalQty) * 100) : 100;
    const marginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    return { grossProfit, coverage, marginPct };
  }, [stats]);

  // MARGIN HEALTH: peringkat produk dengan margin terendah (read-only)
  const marginHealth = useMemo(() => {
    const byProd = {};
    stats.list.forEach(tx => {
      (tx.items || []).forEach(it => {
        const hpp = (typeof it.hppAtSale === 'number') ? it.hppAtSale : (typeof it.hpp === 'number' ? it.hpp : null);
        if (!byProd[it.name]) byProd[it.name] = { name: it.name, sales: 0, cogs: 0, qty: 0, known: true };
        byProd[it.name].sales += (it.price || 0) * (it.qty || 0);
        byProd[it.name].qty += (it.qty || 0);
        if (hpp == null) byProd[it.name].known = false; else byProd[it.name].cogs += hpp * (it.qty || 0);
      });
    });
    return Object.values(byProd)
      .filter(p => p.known && p.sales > 0)
      .map(p => ({ ...p, marginPct: ((p.sales - p.cogs) / p.sales) * 100 }))
      .sort((a, b) => a.marginPct - b.marginPct)
      .slice(0, 5);
  }, [stats]);

  // STOCK VELOCITY NYATA (deterministik dari penjualan 30 hari)
  const velocity = useMemo(() => {
    const prods = safeParse('product_stock_db', []);
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sold = {};
    txs.forEach(tx => {
      if (new Date(tx.date).getTime() >= since) {
        (tx.items || []).forEach(it => { sold[it.name] = (sold[it.name] || 0) + it.qty; });
      }
    });
    return prods.map(p => {
      const perDay = (sold[p.name] || 0) / 30;
      const stock = p.stock || 0;
      return { name: p.name, stock, perDay, daysLeft: perDay > 0 ? Math.floor(stock / perDay) : null };
    })
      .filter(v => v.perDay > 0 && v.daysLeft !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 2);
  }, [txs]);

  const handleDownloadReport = async () => {
    if (stats.list.length === 0) return triggerAlert("Belum ada data untuk diexport.", "error");
    setIsDownloading(true);
    try {
      const ExcelJS = await loadExcelJS();
      const prof = safeParse('store_profile', {});
      const wb = new ExcelJS.Workbook();
      wb.creator = 'WELP POS';
      wb.created = new Date();
      const ws = wb.addWorksheet('Laporan Penjualan', { views: [{ state: 'frozen', ySplit: 4 }], pageSetup: { fitToWidth: 1, orientation: 'landscape' } });

      const headers = ['No', 'ID Order', 'Tanggal', 'Jam', 'Pembeli', 'Metode Bayar', 'Item Dibeli', 'Subtotal', 'Diskon', 'Pajak', 'Servis', 'Total'];
      ws.columns = [{ width: 5 }, { width: 16 }, { width: 13 }, { width: 9 }, { width: 18 }, { width: 15 }, { width: 42 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }];

      ws.mergeCells(1, 1, 1, headers.length);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = (prof.name || 'WELP POS').toUpperCase() + '  -  LAPORAN PENJUALAN';
      titleCell.font = { bold: true, size: 16, color: { argb: 'FF1B1F24' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getRow(1).height = 28;

      ws.mergeCells(2, 1, 2, headers.length);
      const subCell = ws.getCell(2, 1);
      const periodLabel = ({ today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini', all: 'Semua Waktu' })[filter] || filter;
      subCell.value = 'Periode: ' + periodLabel + '       Dicetak: ' + new Date().toLocaleString('id-ID');
      subCell.font = { italic: true, size: 10, color: { argb: 'FF7C8590' } };
      ws.getRow(2).height = 18;

      const headerRow = ws.getRow(4);
      headers.forEach((h, i) => {
        const cc = headerRow.getCell(i + 1);
        cc.value = h;
        cc.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD84312' } };
        cc.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cc.border = { top: { style: 'thin', color: { argb: 'FF1B1F24' } }, bottom: { style: 'thin', color: { argb: 'FF1B1F24' } }, left: { style: 'thin', color: { argb: 'FFFEC9A4' } }, right: { style: 'thin', color: { argb: 'FFFEC9A4' } } };
      });
      headerRow.height = 24;

      let totSub = 0, totDisc = 0, totTax = 0, totSvc = 0, totAll = 0;
      stats.list.forEach((tx, idx) => {
        const d = new Date(tx.date);
        const items = tx.items || [];
        const sub = tx.subtotal != null ? tx.subtotal : items.reduce((a, b) => a + b.price * b.qty, 0);
        const disc = tx.discountAmt || 0, tax = tx.taxAmt || 0, svc = tx.serviceAmt || 0;
        totSub += sub; totDisc += disc; totTax += tax; totSvc += svc; totAll += (tx.total || 0);
        const row = ws.addRow([idx + 1, tx.id, d.toLocaleDateString('id-ID'), d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), tx.buyer || '-', tx.paymentMethod || '-', items.map(i => i.name + ' (' + i.qty + ')').join(', '), sub, disc, tax, svc, tx.total || 0]);
        const band = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFBF1E3';
        row.eachCell((cc, col) => {
          cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: band } };
          cc.border = { bottom: { style: 'hair', color: { argb: 'FFE6E8ED' } } };
          cc.alignment = { vertical: 'middle', wrapText: col === 7 };
          if (col >= 8) { cc.numFmt = '"Rp"#,##0'; cc.alignment = { vertical: 'middle', horizontal: 'right' }; }
          if (col === 1) cc.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });

      const totalRow = ws.addRow(['', '', '', '', '', '', 'TOTAL', totSub, totDisc, totTax, totSvc, totAll]);
      totalRow.eachCell((cc, col) => {
        cc.font = { bold: true, color: { argb: 'FF1B1F24' }, size: 11 };
        cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4EB' } };
        cc.border = { top: { style: 'double', color: { argb: 'FFD84312' } } };
        if (col >= 8) { cc.numFmt = '"Rp"#,##0'; cc.alignment = { horizontal: 'right' }; }
        if (col === 7) cc.alignment = { horizontal: 'right' };
      });
      totalRow.height = 22;

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Laporan_Penjualan_' + filter + '_' + new Date().toISOString().split('T')[0] + '.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      triggerAlert("Laporan Excel profesional berhasil didownload!", "success");
    } catch (e) { triggerAlert("Gagal download: " + e.message, "error"); }
    setIsDownloading(false);
  };

  /* ---------- tile KPI (ikon bebas, tanpa kotak) ---------- */
  const Kpi = ({ icon: Icon, label, value, note, tone = 'plain', valueClass = '' }) => (
    <div className={`card !rounded-3xl p-4 ${tone === 'hero' ? '!bg-chrome-deep !border-chrome-edge' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-6 h-6 shrink-0 ${tone === 'hero' ? 'text-apricot' : 'text-flame-500 dark:text-apricot'}`} />
        <p className={`text-[9px] font-extrabold uppercase tracking-widest ${tone === 'hero' ? 'text-ink-inv/60' : 'text-ink-faint'}`}>{label}</p>
      </div>
      <p className={`text-xl font-extrabold money tracking-tight ${tone === 'hero' ? 'text-white' : 'text-ink dark:text-ink-inv'} ${valueClass}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 leading-snug ${tone === 'hero' ? 'text-ink-inv/50' : 'text-ink-faint'}`}>{note}</p>}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto w-full pb-24 space-y-5">

      {/* header + filter periode */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <p className="kicker">Ringkasan Performa</p>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-ink dark:text-ink-inv">Dashboard Bisnis</h1>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          items={[{ id: 'today', label: 'Hari Ini' }, { id: 'month', label: 'Bulan Ini' }, { id: 'year', label: 'Tahun Ini' }, { id: 'all', label: 'Semua' }]}
        />
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Omzet} label={`Omzet (${filter})`} value={formatIDR(stats.rev)} tone="hero" note={`${stats.count} transaksi tercatat`} />
        <Kpi icon={LabaKotor} label="Laba Kotor" value={formatIDR(profitStats.grossProfit)}
          valueClass={profitStats.grossProfit < 0 ? '!text-brick' : ''}
          note={`Margin ${profitStats.marginPct.toFixed(1)}% · dari HPP nyata (cakupan ${profitStats.coverage}%)`} />
        <Kpi icon={Keranjang} label="Transaksi" value={stats.count} note="order selesai" />
        <Kpi icon={Laporan} label="Rata-rata / Hari" value={formatIDR(chart.avg)} note={`${chart.activeDays} hari aktif bulan ini`} />
      </div>

      {/* GRAFIK — kurva halus + area gradien + titik data (gaya referensi) */}
      <Card title="Penjualan Harian (Bulan Ini)" icon={Laporan} action={<Badge tone="lime">Puncak: Tgl {chart.peak.day || '-'}</Badge>}>
        <div className="relative h-64 w-full select-none">
          {/* tooltip chip gelap: mengikuti titik terfokus, dijepit agar tak terpotong */}
          <div className="absolute top-0 left-11 right-0 h-0 z-20 pointer-events-none">
            {focusedPoint && geom && geom.pts[focusedPoint.day - 1] ? (
              <div className="absolute -translate-x-1/2 animate-pop"
                style={{ left: Math.min(Math.max(geom.pts[focusedPoint.day - 1].x, 80), Math.max(plotSize.w - 80, 80)) }}>
                <div className="bg-chrome-deep text-white px-4 py-2.5 rounded-2xl shadow-pop flex flex-col items-center">
                  <span className="text-[9px] font-extrabold text-apricot/80 uppercase tracking-widest">{formatDayName(focusedPoint.date)}</span>
                  <span className="text-xs font-extrabold">{formatDateIndo(focusedPoint.date)}</span>
                  <span className="text-lg font-extrabold text-apricot mt-0.5 money">{formatIDR(focusedPoint.total)}</span>
                  <span className="text-[9px] text-ink-inv/50">{focusedPoint.count} Transaksi</span>
                </div>
                <div className="w-2.5 h-2.5 bg-chrome-deep rotate-45 -mt-1.5 mx-auto"></div>
              </div>
            ) : (
              <div className="absolute left-1/2 -translate-x-1/2 top-1.5 bg-paper/90 dark:bg-white/5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-ink-faint backdrop-blur">Sentuh grafik untuk detail tanggal</div>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-6 top-20">
            {/* grid putus-putus + label */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[1, 0.75, 0.5, 0.25, 0].map((g, gi) => (
                <div key={gi} className="flex items-center gap-2 w-full">
                  <span className="text-[8px] font-mono text-ink-faint/60 w-9 text-right shrink-0 money">{fmtK(chart.max * g)}</span>
                  <div className="flex-1 border-t border-dashed border-line dark:border-line-dark"></div>
                </div>
              ))}
            </div>

            {/* area plot terukur */}
            <div ref={plotRef} className="absolute left-11 right-0 top-0 bottom-0">
              {geom && (
                <svg className="absolute inset-0 overflow-visible" width={plotSize.w} height={plotSize.h}>
                  <defs>
                    <linearGradient id="areaGradV7" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F4622E" stopOpacity="0.30" />
                      <stop offset="55%" stopColor="#F4622E" stopOpacity="0.09" />
                      <stop offset="100%" stopColor="#F4622E" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* garis rata-rata (emas, putus-putus) */}
                  <line x1="0" y1={geom.avgY} x2={plotSize.w} y2={geom.avgY} stroke="#E8A13D" strokeWidth="1.6" strokeDasharray="7 6" strokeLinecap="round" opacity="0.85" />

                  {geom.area && <path d={geom.area} fill="url(#areaGradV7)" />}
                  {geom.line && <path d={geom.line} fill="none" stroke="#D84312" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}

                  {/* titik data: hari aktif (puncak = emas) */}
                  {geom.pts.map((p, i) => p.total > 0 ? (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill="#FFFFFF" stroke={chart.peak.day === p.day ? '#E8A13D' : '#F4622E'} strokeWidth="2" className="dark:fill-surface-dark" />
                  ) : null)}

                  {/* titik fokus: halo + inti besar */}
                  {focusedPoint && geom.pts[focusedPoint.day - 1] && (
                    <g>
                      <circle cx={geom.pts[focusedPoint.day - 1].x} cy={geom.pts[focusedPoint.day - 1].y} r="9" fill="#F4622E" opacity="0.15" />
                      <circle cx={geom.pts[focusedPoint.day - 1].x} cy={geom.pts[focusedPoint.day - 1].y} r="4.5" fill="#D84312" stroke="#FFFFFF" strokeWidth="2.5" />
                    </g>
                  )}
                </svg>
              )}

              {/* kolom interaksi (hover / tap) */}
              <div className="absolute inset-0 flex">
                {stats.dailyData.map((d, i) => (
                  <div key={i} className="flex-1 h-full cursor-pointer" onMouseEnter={() => setFocusedPoint(d)} onClick={() => setFocusedPoint(d)}></div>
                ))}
              </div>

              {/* chip nilai rata-rata di ujung kanan garis emas */}
              {geom && (
                <div className="absolute right-0 -translate-y-1/2 pointer-events-none z-10" style={{ top: geom.avgY }}>
                  <span className="badge bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold money normal-case">Rata-rata {fmtK(chart.avg)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="absolute left-11 right-0 bottom-0 flex justify-between text-[9px] font-mono text-ink-faint/60">
            {stats.dailyData.filter((d, i) => i === 0 || (i + 1) % 5 === 0).map(d => <span key={d.day}>{d.day}</span>)}
          </div>
        </div>
        {/* legenda DI LUAR area plot (tidak lagi menimpa chip petunjuk) */}
        <div className="flex items-center gap-4 mt-2 justify-center">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-ink-faint"><span className="w-4 h-[3px] rounded-full bg-gradient-to-r from-flame-500 to-flame-600"></span> Omzet harian</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-ink-faint"><span className="w-3 h-[2px] rounded bg-gold"></span> Rata-rata</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-ink-faint"><span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-flame-500 dark:bg-surface-dark"></span> Hari aktif</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* TOP PRODUK */}
        <Card title="Top 5 Produk Terlaris" icon={MedaliBuddy}>
          {stats.topProducts.length === 0 ? (
            <EmptyState mascot="pikir" title="Belum ada penjualan" desc="Data produk terlaris muncul setelah ada transaksi kasir." />
          ) : (
            <div className="space-y-3.5">
              {stats.topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${i === 0 ? 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold' : i === 1 ? 'bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot' : 'bg-paper dark:bg-white/5 text-ink-faint'}`}>#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs font-extrabold mb-1">
                      <span className="text-ink dark:text-ink-inv truncate">{p.name}</span>
                      <span className="text-ink-faint shrink-0 ml-2">{p.qty} terjual</span>
                    </div>
                    <div className="h-1.5 w-full bg-paper dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-flame-500 rounded-full transition-all duration-500" style={{ width: `${(p.qty / stats.topProducts[0].qty) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* MARGIN HEALTH */}
        <Card title="Produk Margin Terendah" icon={BahayaBuddy}>
          {marginHealth.length === 0 ? (
            <EmptyState mascot="pikir" title="Belum bisa dihitung" desc="Margin per produk muncul otomatis setelah ada transaksi yang menyimpan HPP (hppAtSale) dari resep produk." />
          ) : (
            <div className="space-y-2">
              {marginHealth.map(p => {
                const bad = p.marginPct < 20, warn = p.marginPct < 40;
                return (
                  <div key={p.name} className="flex justify-between items-center p-3 rounded-xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs text-ink dark:text-ink-inv truncate">{p.name}</p>
                      <p className="text-[9px] font-bold text-ink-faint uppercase money">{p.qty} terjual · {formatIDR(p.sales)} · HPP {formatIDR(p.cogs)}</p>
                    </div>
                    <Badge tone={bad ? 'red' : warn ? 'gold' : 'green'} className="shrink-0 ml-2">{p.marginPct.toFixed(0)}%</Badge>
                  </div>
                );
              })}
              <p className="text-[9px] text-ink-faint mt-1 leading-relaxed">Margin = (harga jual − HPP saat penjualan) / harga jual. Merah &lt;20%, kuning &lt;40%. Pertimbangkan menaikkan harga atau menekan biaya resep.</p>
            </div>
          )}
        </Card>

        {/* STOCK VELOCITY */}
        <Card title="Perkiraan Stok Habis" icon={RoketBuddy}>
          <p className="text-[10px] text-ink-faint mb-3 font-semibold">Dihitung dari kecepatan penjualan nyata 30 hari terakhir (unit/hari) vs stok saat ini.</p>
          <div className="space-y-2">
            {velocity.map((v, i) => (
              <div key={i} className="flex justify-between items-center bg-paper dark:bg-white/[.03] p-3 rounded-xl border border-line dark:border-line-dark">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${v.daysLeft <= 7 ? 'bg-brick animate-pulse-dot' : 'bg-leaf'}`}></span>
                  <div>
                    <span className="text-xs font-extrabold text-ink dark:text-ink-inv">{v.name}</span>
                    <p className="text-[9px] text-ink-faint font-bold money">Stok {v.stock} · terjual {v.perDay.toFixed(1)}/hari</p>
                  </div>
                </div>
                <Badge tone={v.daysLeft <= 7 ? 'red' : 'green'}>{v.stock <= 0 ? 'Habis' : `± ${v.daysLeft} hari lagi`}</Badge>
              </div>
            ))}
            {velocity.length === 0 && <p className="text-xs text-ink-faint italic">Belum ada cukup data penjualan 30 hari terakhir.</p>}
          </div>
        </Card>

        {/* RIWAYAT */}
        <Card title="Riwayat Transaksi" icon={Riwayat} action={
          <Button onClick={handleDownloadReport} icon={UnduhBuddy} variant="secondary" className="py-1.5 h-8 text-[10px]">{isDownloading ? 'Mengekspor…' : 'Export Excel'}</Button>
        }>
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {stats.list.length === 0 && <EmptyState mascot="kerja" title="Belum ada transaksi" desc="Belum ada transaksi pada periode ini." />}
            {stats.list.map(t2 => (
              <div key={t2.id} onClick={() => setSelectedTx(t2)} className="bg-paper dark:bg-white/[.03] p-3 rounded-xl border border-line dark:border-line-dark flex justify-between items-center hover:border-flame-300 transition cursor-pointer press group">
                <div className="flex gap-3 items-center">
                  <div className="w-9 h-9 rounded-lg bg-surface dark:bg-white/5 flex items-center justify-center text-ink-faint group-hover:text-flame-600 dark:group-hover:text-apricot transition shrink-0">
                    {t2.paymentMethod === 'Cash' ? <Uang className="w-4 h-4" /> : <Qris className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-ink dark:text-ink-inv truncate max-w-[130px]">{t2.buyer || 'Tanpa Nama'}</h4>
                    <p className="text-[10px] text-ink-faint font-mono">{new Date(t2.date).toLocaleDateString()} • {new Date(t2.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-sm text-ink dark:text-ink-inv money">{formatIDR(t2.total)}</p>
                  <p className="text-[9px] font-bold text-ink-faint bg-surface dark:bg-white/5 px-1.5 py-0.5 rounded inline-block mt-0.5">{t2.items.length} Item</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* DETAIL TRANSAKSI */}
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

            <button onClick={() => setSelectedTx(null)} className="mt-5 w-full py-3 bg-chrome-deep dark:bg-chrome-panel text-white rounded-xl font-extrabold text-sm press">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
};
