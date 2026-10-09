// ============================================================
// WELP v21 — KEUANGAN WORKSPACE
// ------------------------------------------------------------
// Tiga sub-panel dalam SATU tab (tanpa menu baru berlebihan):
//   1. SETTLEMENT     — dana per metode: gross − fee/MDR − refund
//                       ± adjustment = net; siklus PENDING →
//                       PROCESSING → SETTLED / MISMATCH / FAILED.
//   2. REKONSILIASI   — penjualan vs settlement, dengan ALASAN
//                       selisih (fee, refund, tx hilang, delay, dll).
//   3. KAS & SHIFT    — log buka/tutup shift, uang masuk/keluar,
//                       selisih kas per shift.
//
// ATURAN JUJUR:
//   Settlement dikonfirmasi MANUAL memakai nomor referensi dari
//   dasbor provider (Midtrans/GoPay/QRIS aggregator). Struktur
//   providerRef tersedia — bila API provider terhubung nanti,
//   konfirmasi otomatis menggantikan input manual TANPA mengubah
//   model data. TIDAK ada klaim integrasi otomatis yang belum ada.
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  Uang, Qris, Check, X, WaktuReal, PaketBuddy,
  ChevronDown, Toko, JaringanBuddy, Omzet, PerisaiBuddy, Ban, Undo2,
} from './welp-icons.jsx';
import { formatIDR, auditLog, safeParse } from './core.jsx';
import { Button, Card, PageTitle, Badge, EmptyState, NumericInput } from './ui';
import {
  salesByMethodForDate, buildSettlementDraft, methodCfgOf,
  SETTLEMENT_STATE_META, RECON_STATUS, reconcile, dateKeyOfMs,
  SHIFT_RESULT_META,
} from './welp-core/tx.js';
import { commitFinanceDoc } from './welp-core/sync.js';
import { useFinMirrors, permsOfSession, SyncPill } from './txactions.jsx';
import { MATCH_STATUS, MATCH_STATUS_META, PAYMENT_EVENT_SOURCE_META } from './welp-core/payment.js';
import { manualConfirmEvent, rejectEvent } from './welp-core/paymentOps.js';

const AUDIT = {
  create: 'SETTLEMENT_CREATE', confirm: 'SETTLEMENT_CONFIRM',
  mismatch: 'SETTLEMENT_MISMATCH_TANDA', adjust: 'SETTLEMENT_ADJUST',
};

export const FinanceTab = ({ licenseInfo, triggerAlert, activeTab, perms }) => {
  const [seg, setSeg] = useState('settlement');
  const { history, activeOrders, settlements, shiftLogs, cashEvents, profile } = useFinMirrors(activeTab);
  const p = perms || permsOfSession(licenseInfo);
  const canManage = p.has('settlement.manage');
  const canRecon = p.has('reconciliation.view');
  const canShift = p.has('shift.view') || p.has('shift.open') || p.has('shift.close');

  const [dateKey, setDateKey] = useState(dateKeyOfMs(Date.now()));
  const [openId, setOpenId] = useState(null);      // settlement detail terbuka
  const [confirmFor, setConfirmFor] = useState(null);   // {rec, mode}
  const actor = licenseInfo?.employeeName || licenseInfo?.tenant || '-';
  const actorRole = licenseInfo?.currentUserRole || 'owner';

  // v21: order lunas bisa ada di history DAN active_orders (mirror berbeda).
  // Dedup: ambil yang belum lunas dari active orders saja (pending/workshop),
  // sisanya dari pos_history sebagai sumber tunggal kebenaran.
  const allOrders = useMemo(() => [
    ...(history || []),
    ...(activeOrders || []).filter(o => !o.paidAt),
  ], [history, activeOrders]);
  const paymentCfg = profile?.payment || {};

  // ---------- SETTLEMENT ----------
  const byMethod = useMemo(() => salesByMethodForDate(allOrders, dateKey, null), [allOrders, dateKey]);
  const existingByMethod = {};
  (settlements || []).forEach(s => {
    if (s.periodDate === dateKey) existingByMethod[s.method] = s;
  });

  const saveSettlement = (rec) => commitFinanceDoc({ tenantId: licenseInfo?.id, localKey: 'settlement_db', docId: rec.id, data: rec });

  const createSettlement = (method) => {
    const draft = buildSettlementDraft({ orders: allOrders, dateKey, method, payment: paymentCfg, branchId: null });
    if (!draft) return triggerAlert('Tidak ada penjualan ' + method + ' pada tanggal itu.', 'error');
    draft.createdBy = actor; draft.createdByRole = actorRole;
    saveSettlement(draft);
    auditLog(licenseInfo, AUDIT.create, {
      target: draft.settlementId, metode: method, periode: dateKey,
      gross: draft.grossAmount, fee: draft.feeAmount, refund: draft.refundAmount, net: draft.netAmount,
    }, { actor, actorRole });
    triggerAlert(`Draft settlement ${method} dibuat (PENDING).`, 'success');
  };

  const settleConfirm = (rec, reference, note) => {
    const upd = {
      ...rec, status: 'SETTLED', referenceNumber: reference || rec.referenceNumber,
      settlementDate: Date.now(), confirmedAt: Date.now(), confirmedBy: actor, note: note || rec.note || '',
    };
    saveSettlement(upd);
    auditLog(licenseInfo, AUDIT.confirm, { target: rec.settlementId, metode: rec.method, referensi: reference, net: rec.netAmount }, { actor, actorRole });
    setConfirmFor(null);
    triggerAlert('Settlement dikonfirmasi masuk. Rekonsiliasi diperbarui.', 'success');
  };
  const markMismatch = (rec, note) => {
    const upd = { ...rec, status: 'MISMATCH', note: note || rec.note || '', confirmedAt: Date.now(), confirmedBy: actor };
    saveSettlement(upd);
    auditLog(licenseInfo, AUDIT.mismatch, { target: rec.settlementId, metode: rec.method, note }, { actor, actorRole });
    setConfirmFor(null);
    triggerAlert('Settlement ditandai selisih — cek Rekonsiliasi untuk alasan.', 'error');
  };
  const adjustSettlement = (rec, amount, reason) => {
    const adj = (Number(rec.adjustment) || 0) + (Number(amount) || 0);
    const upd = {
      ...rec, adjustment: adj, adjustmentReason: reason || rec.adjustmentReason || '',
      netAmount: rec.grossAmount - rec.feeAmount - rec.refundAmount + adj,
    };
    saveSettlement(upd);
    auditLog(licenseInfo, AUDIT.adjust, { target: rec.settlementId, adjustment: amount, alasan: reason }, { actor, actorRole });
    setConfirmFor(null);
    triggerAlert('Penyesuaian dicatat.', 'success');
  };

  // ---------- REKONSILIASI ----------
  // (reconMethod dideklarasikan SEBELUM dipakai — hindari TDZ crash)
  const [reconMethod, setReconMethod] = useState('QRIS');
  const reconResult = useMemo(() => {
    const stl = (settlements || []).find(s => s.periodDate === dateKey && s.method === (reconMethod || 'QRIS'));
    if (!stl) return null;
    return reconcile({ orders: allOrders, settlement: stl, dateKey, payment: paymentCfg });
  }, [settlements, allOrders, dateKey, paymentCfg]);
  const reconStl = (settlements || []).find(s => s.periodDate === dateKey && s.method === reconMethod);

  const toneCls = (tone) => ({
    green: 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf',
    gold: 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold',
    red: 'bg-brick-soft dark:bg-brick/10 text-brick-deep dark:text-brick',
    blue: 'bg-paper dark:bg-white/10 text-ink-soft dark:text-ink-inv/80',
    grey: 'bg-paper dark:bg-white/5 text-ink-faint',
  }[tone] || 'bg-paper text-ink-faint');

  // ---------- v21.1 PEMBAYARAN (Payment Core ledger + review ambigu) ----------
  const [payEvents, setPayEvents] = useState(() => safeParse('payment_event_db', []));
  const [reviewEv, setReviewEv] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  useEffect(() => { if (activeTab === 'finance2' || seg === 'payments') setPayEvents(safeParse('payment_event_db', [])); }, [activeTab, seg]);
  const ambigCount = payEvents.filter(e => e.matchStatus === MATCH_STATUS.AMBIGUOUS).length;
  const canConfirmPay = p.has('payment.confirm');

  const refreshEvents = () => setPayEvents(safeParse('payment_event_db', []));
  const orderById = (orderId) => allOrders.find(o => (o.clientTransactionId || o.id) === orderId);

  const doManualConfirm = () => {
    const ev = reviewEv;
    const order = orderById(ev.orderId);
    const res = manualConfirmEvent({
      tenantId: licenseInfo?.id, licenseInfo, eventRec: ev, order,
      actor, actorRole, note: reviewNote,
    });
    if (!res.ok) return triggerAlert(res.reason || 'Gagal konfirmasi.', 'error');
    setReviewEv(null); setReviewNote(''); refreshEvents();
    triggerAlert('Pembayaran dikonfirmasi manual — ter-audit (payment.confirm).', 'success');
  };
  const doReject = () => {
    rejectEvent({ tenantId: licenseInfo?.id, licenseInfo, eventRec: reviewEv, actor, actorRole, reason: reviewNote });
    setReviewEv(null); setReviewNote(''); refreshEvents();
    triggerAlert('Event ditolak dan dicatat di ledger.', 'success');
  };

  return (
    <div className="max-w-5xl mx-auto w-full pb-24 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageTitle title="Keuangan" sub="Settlement · Rekonsiliasi · Kas & Shift" />
        <SyncPill licenseInfo={licenseInfo} compact />
      </div>

      {/* segmen sub-panel */}
      <div className="flex gap-1.5 bg-surface dark:bg-surface-dark p-1 rounded-xl border border-line dark:border-line-dark shadow-card inline-flex max-w-full overflow-x-auto no-scrollbar">
        <button onClick={() => setSeg('settlement')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition whitespace-nowrap ${seg === 'settlement' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}><Omzet className="w-4 h-4" /> Settlement</button>
        <button onClick={() => setSeg('payments')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition whitespace-nowrap ${seg === 'payments' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}><Qris className="w-4 h-4" /> Pembayaran{ambigCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brick text-white">{ambigCount}</span>}</button>
        {canRecon && <button onClick={() => setSeg('recon')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition whitespace-nowrap ${seg === 'recon' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}><JaringanBuddy className="w-4 h-4" /> Rekonsiliasi</button>}
        {canShift && <button onClick={() => setSeg('shift')} className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition whitespace-nowrap ${seg === 'shift' ? 'bg-flame-600 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft'}`}><Toko className="w-4 h-4" /> Kas & Shift</button>}
      </div>

      {/* ======== SETTLEMENT ======== */}
      {seg === 'settlement' && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Periode (tanggal penjualan)</label>
              <input type="date" value={dateKey} onChange={e => setDateKey(e.target.value)} className="field !w-auto" />
            </div>
            <p className="text-[10px] font-bold text-ink-faint max-w-xs leading-relaxed pb-1.5">
              Settlement = dana bersih yang seharusnya masuk rekening per metode. Konfirmasi manual memakai nomor referensi dari dasbor provider.
            </p>
          </div>

          {/* ringkasan per metode hari tsb */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Object.keys(byMethod).length === 0 && (
              <div className="sm:col-span-2 xl:col-span-3"><EmptyState mascot="pikir" title={`Belum ada penjualan ${dateKey}`} desc="Buat settlement otomatis muncul di sini setelah ada transaksi lunas pada tanggal yang dipilih." /></div>
            )}
            {Object.entries(byMethod).map(([m, agg]) => {
              const stl = existingByMethod[m];
              const cfg = methodCfgOf(paymentCfg, m);
              const fee = Math.round(agg.gross * cfg.feePercent / 100 + cfg.feeFixed);
              const net = agg.gross - fee - agg.refunds;
              return (
                <div key={m} className="card p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <p className="font-extrabold text-ink dark:text-ink-inv text-sm flex items-center gap-2">
                      {m === 'Cash' ? <Uang className="w-4 h-4 text-ink-faint" /> : m === 'QRIS' ? <Qris className="w-4 h-4 text-flame-600" /> : <PaketBuddy className="w-4 h-4 text-ink-faint" />}
                      {m}
                    </p>
                    {stl ? <Badge tone={SETTLEMENT_STATE_META[stl.status]?.tone === 'green' ? 'green' : SETTLEMENT_STATE_META[stl.status]?.tone === 'red' ? 'red' : 'gold'}>{SETTLEMENT_STATE_META[stl.status]?.label || stl.status}</Badge>
                      : <Badge tone="grey">Belum dibuat</Badge>}
                  </div>
                  <div className="text-[11px] font-bold space-y-1">
                    <div className="flex justify-between"><span className="text-ink-faint">Gross ({agg.txIds.length} tx)</span><span className="money text-ink dark:text-ink-inv">{formatIDR(agg.gross)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-faint">Fee/MDR {cfg.feePercent ? `${cfg.feePercent}%` : ''}{cfg.feeFixed ? ` + ${formatIDR(cfg.feeFixed)}` : ''}</span><span className="money text-brick">- {formatIDR(fee)}</span></div>
                    {agg.refunds > 0 && <div className="flex justify-between"><span className="text-ink-faint">Refund</span><span className="money text-brick">- {formatIDR(agg.refunds)}</span></div>}
                    <div className="flex justify-between border-t border-dashed border-line dark:border-line-dark pt-1"><span className="text-ink-faint font-extrabold">Net</span><span className="money font-extrabold text-leaf-deep dark:text-leaf">{formatIDR(net)}</span></div>
                  </div>
                  {!stl ? (
                    <Button onClick={() => createSettlement(m)} disabled={!canManage} className="w-full !py-2.5 !text-[11px]" icon={Omzet}>Buat Settlement</Button>
                  ) : (
                    <button onClick={() => setOpenId(openId === stl.id ? null : stl.id)} className="w-full py-2 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-[11px] font-extrabold text-ink-soft dark:text-ink-inv/80 press flex items-center justify-center gap-1.5">
                      Detail <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openId === stl.id ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {stl && openId === stl.id && (
                    <div className="pt-1 space-y-2 animate-rise">
                      <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark text-[11px] font-bold space-y-1">
                        <div className="flex justify-between"><span className="text-ink-faint">Net tercatat</span><span className="money">{formatIDR(stl.netAmount)}</span></div>
                        {stl.adjustment ? <div className="flex justify-between"><span className="text-ink-faint">Penyesuaian</span><span className="money">{formatIDR(stl.adjustment)}{stl.adjustmentReason ? ` — ${stl.adjustmentReason}` : ''}</span></div> : null}
                        <div className="flex justify-between"><span className="text-ink-faint">Referensi</span><span className="font-mono">{stl.referenceNumber || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-ink-faint">Rekening tujuan</span><span className="truncate max-w-[140px]">{stl.destination || 'belum diatur'}</span></div>
                      </div>
                      {canManage && ['PENDING', 'PROCESSING', 'MISMATCH'].includes(stl.status) && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => setConfirmFor({ rec: stl, mode: 'confirm' })} className="!py-2.5 !text-[11px]" icon={Check}>Konfirmasi Masuk</Button>
                          <Button onClick={() => setConfirmFor({ rec: stl, mode: 'mismatch' })} className="!py-2.5 !text-[11px] !bg-brick hover:!bg-brick-deep" icon={Ban}>Tandai Selisih</Button>
                        </div>
                      )}
                      {canManage && stl.status === 'SETTLED' && (
                        <Button onClick={() => setConfirmFor({ rec: stl, mode: 'adjust' })} className="w-full !py-2.5 !text-[11px]" icon={Undo2}>Tambah Penyesuaian</Button>
                      )}
                      {!stl.providerRef && (
                        <p className="text-[9px] font-bold text-ink-faint leading-relaxed flex gap-1.5"><PerisaiBuddy className="w-3 h-3 shrink-0 mt-0.5" /> Mode manual: konfirmasi memakai nomor referensi dari dasbor provider. Integrasi API otomatis menyusul tanpa mengubah model data.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* riwayat settlement */}
          <div className="space-y-2 pt-2">
            <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1">Riwayat Settlement</h3>
            {(settlements || []).length === 0 ? (
              <EmptyState mascot="kerja" title="Belum ada settlement" desc="Buat settlement per metode dari ringkasan di atas begitu ada penjualan." />
            ) : [...(settlements || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 30).map(s => (
              <div key={s.id} className="card p-4 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv">{s.method} · {s.periodDate}</p>
                  <p className="text-[10px] font-bold text-ink-faint">Net <span className="money">{formatIDR(s.netAmount)}</span> · gross {formatIDR(s.grossAmount)} · fee {formatIDR(s.feeAmount)}{s.referenceNumber ? ` · ref ${s.referenceNumber}` : ''}</p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-extrabold ${toneCls(SETTLEMENT_STATE_META[s.status]?.tone)}`}>{SETTLEMENT_STATE_META[s.status]?.label || s.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ======== REKONSILIASI ======== */}
      {/* ======== PEMBAYARAN (v21.1 — WELP Payment Core) ======== */}
      {seg === 'payments' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Total Event</p>
              <p className="text-xl font-extrabold text-ink dark:text-ink-inv mt-1 money">{payEvents.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Perlu Review</p>
              <p className={`text-xl font-extrabold mt-1 money ${ambigCount > 0 ? 'text-gold-deep dark:text-gold' : 'text-ink dark:text-ink-inv'}`}>{ambigCount}</p>
            </div>
            <div className="card p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Terkonfirmasi</p>
              <p className="text-xl font-extrabold text-leaf-deep dark:text-leaf mt-1 money">{payEvents.filter(e => e.matchStatus === MATCH_STATUS.CONFIRMED).length}</p>
            </div>
          </div>

          <Card title="Antrean Review Manual (AMBIGUOUS)" icon={PerisaiBuddy}
            help="Event tanpa bukti kuat (nominal sama saja) TIDAK pernah auto-confirm. Keputusan manual dicatat: siapa, kapan, alasan.">
            {(() => {
              const amb = payEvents.filter(e => e.matchStatus === MATCH_STATUS.AMBIGUOUS);
              if (!amb.length) return <p className="text-[11px] font-bold text-ink-faint py-2 text-center">Tidak ada antrean. Matching engine menahan event ambigu di sini.</p>;
              return (
                <div className="space-y-2">
                  {amb.map(e => (
                    <div key={e.eventId} className="flex justify-between items-center gap-3 p-3 rounded-xl bg-gold-soft/60 dark:bg-gold/10 border border-gold/25">
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv money">{formatIDR(e.amount)} · {e.method}</p>
                        <p className="text-[9.5px] font-bold text-ink-faint truncate">{e.eventId} · {e.reference || e.providerRef || 'tanpa ref'} · {PAYMENT_EVENT_SOURCE_META[e.source]?.label || e.source}</p>
                        <p className="text-[9px] font-bold text-gold-deep dark:text-gold truncate">{e.reason}</p>
                      </div>
                      {canConfirmPay ? (
                        <button onClick={() => { setReviewEv(e); setReviewNote(''); }} className="px-3 py-2 rounded-xl bg-flame-600 text-white text-[10px] font-extrabold shrink-0 press">Review</button>
                      ) : <Badge tone="grey">butuh payment.confirm</Badge>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          <Card title="Ledger Event Pembayaran" icon={Qris} flush>
            {payEvents.length === 0 ? (
              <p className="text-[11px] font-bold text-ink-faint py-4 text-center">Belum ada event. Simulator ada di Pengaturan → Metode Pembayaran (Payment Lab); nanti juga menerima Notification Bridge & provider adapter.</p>
            ) : (
              <div className="divide-y divide-line/60 dark:divide-line-dark/60 max-h-[420px] overflow-y-auto custom-scrollbar">
                {[...payEvents].sort((a, b) => (b.processedAt || 0) - (a.processedAt || 0)).map(e => (
                  <div key={e.eventId} className="flex justify-between items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv money">{formatIDR(e.amount)} <span className="text-ink-faint font-bold text-[9.5px]">· {e.method}</span></p>
                      <p className="text-[9px] font-bold text-ink-faint truncate">{e.eventId} · {e.reference || e.providerRef || 'tanpa ref'}{e.orderId ? ` · order #${String(e.orderId).slice(-5)}` : ''}</p>
                      {e.reason && <p className="text-[9px] font-bold text-ink-faint/80 truncate">{e.reason}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[8.5px] font-extrabold px-2 py-1 rounded-full ${toneCls(e.matchStatus === MATCH_STATUS.CONFIRMED ? 'green' : e.matchStatus === MATCH_STATUS.AMBIGUOUS ? 'gold' : e.matchStatus === MATCH_STATUS.DUPLICATE ? 'grey' : 'red')}`}>{MATCH_STATUS_META[e.matchStatus]?.label || e.matchStatus}</span>
                      <p className="text-[8.5px] font-bold text-ink-faint mt-1">{PAYMENT_EVENT_SOURCE_META[e.source]?.label || e.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {seg === 'recon' && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Periode</label>
              <input type="date" value={dateKey} onChange={e => setDateKey(e.target.value)} className="field !w-auto" />
            </div>
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Metode</label>
              <select value={reconMethod} onChange={e => setReconMethod(e.target.value)} className="field !w-auto">
                {['QRIS', 'Cash', ...Object.keys(byMethod).filter(m => m !== 'QRIS' && m !== 'Cash')].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {!reconStl ? (
            <EmptyState mascot="bingung" title="Belum ada settlement untuk kombinasi ini" desc="Buat dulu settlement metode tersebut pada tab Settlement untuk tanggal yang sama, lalu rekonsiliasi bisa dijalankan." />
          ) : !reconResult ? null : (
            <div className="space-y-3">
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${reconResult.status === RECON_STATUS.MATCHED ? 'bg-leaf-soft/60 dark:bg-leaf/10 border-leaf/30' : reconResult.status === RECON_STATUS.PENDING ? 'bg-gold-soft/60 dark:bg-gold/10 border-gold/30' : 'bg-brick-soft/60 dark:bg-brick/10 border-brick/30'}`}>
                <div>
                  <p className="kicker">Status Rekonsiliasi {reconMethod} · {dateKey}</p>
                  <p className="font-extrabold text-lg text-ink dark:text-ink-inv">
                    {reconResult.status === RECON_STATUS.MATCHED ? 'COCOK' : reconResult.status === RECON_STATUS.PENDING ? 'MENUNGGU SETTLEMENT' : 'SELISIH'}
                  </p>
                </div>
                {reconResult.status === RECON_STATUS.MATCHED ? <Check className="w-8 h-8 text-leaf-deep dark:text-leaf" /> : <WaktuReal className="w-8 h-8 text-ink-faint" />}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="card p-4 space-y-1.5 text-[11.5px] font-bold">
                  <p className="kicker mb-1">Sisi WELP (settlement tercatat)</p>
                  <div className="flex justify-between"><span className="text-ink-faint">Gross</span><span className="money">{formatIDR(reconResult.expected.gross)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-faint">Fee/MDR</span><span className="money">- {formatIDR(reconResult.expected.fee)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-faint">Refund</span><span className="money">- {formatIDR(reconResult.expected.refunds)}</span></div>
                  <div className="flex justify-between border-t border-dashed border-line dark:border-line-dark pt-1"><span className="text-ink-faint font-extrabold">Net</span><span className="money font-extrabold">{formatIDR(reconResult.expected.net)}</span></div>
                </div>
                <div className="card p-4 space-y-1.5 text-[11.5px] font-bold">
                  <p className="kicker mb-1">Sisi Penjualan (transaksi nyata)</p>
                  <div className="flex justify-between"><span className="text-ink-faint">Jumlah transaksi</span><span>{reconResult.actual.txCount}</span></div>
                  <div className="flex justify-between"><span className="text-ink-faint">Gross penjualan</span><span className="money">{formatIDR(reconResult.actual.gross)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-faint">Refund penjualan</span><span className="money">{formatIDR(reconResult.actual.refunds)}</span></div>
                </div>
              </div>

              <div className="card p-4">
                <p className="kicker mb-2.5">Mengapa bisa berbeda?</p>
                {reconResult.reasons.length === 0 ? (
                  <p className="text-xs font-bold text-leaf-deep dark:text-leaf">Tidak ada selisih — semua komponen sesuai perhitungan.</p>
                ) : (
                  <div className="space-y-2">
                    {reconResult.reasons.map((r, i) => (
                      <div key={i} className="p-3 rounded-xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-flame-700 dark:text-apricot">{r.type.replace(/_/g, ' ')}</span>
                          {r.amount != null && <span className="text-[11px] font-extrabold money text-ink dark:text-ink-inv">{formatIDR(r.amount)}</span>}
                        </div>
                        <p className="text-[11px] font-bold text-ink-soft dark:text-ink-inv/80 mt-1 leading-relaxed">{r.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ======== KAS & SHIFT ======== */}
      {seg === 'shift' && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="card !rounded-3xl p-4">
              <p className="kicker">Uang Masuk (7 hari)</p>
              <p className="text-xl font-extrabold money text-leaf-deep dark:text-leaf mt-1">
                {formatIDR((cashEvents || []).filter(e => e.type === 'CASH_IN' && Date.parse(e.date) > Date.now() - 7 * 864e5).reduce((a, e) => a + e.amount, 0))}
              </p>
            </div>
            <div className="card !rounded-3xl p-4">
              <p className="kicker">Uang Keluar (7 hari)</p>
              <p className="text-xl font-extrabold money text-brick mt-1">
                {formatIDR((cashEvents || []).filter(e => e.type === 'CASH_OUT' && Date.parse(e.date) > Date.now() - 7 * 864e5).reduce((a, e) => a + e.amount, 0))}
              </p>
            </div>
            <div className="card !rounded-3xl p-4">
              <p className="kicker">Shift Ditutup (7 hari)</p>
              <p className="text-xl font-extrabold text-ink dark:text-ink-inv mt-1">
                {(shiftLogs || []).filter(l => l.type === 'close' && (l.closedAt || 0) > Date.now() - 7 * 864e5).length}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1">Riwayat Shift</h3>
            {(shiftLogs || []).length === 0 ? (
              <EmptyState mascot="kerja" title="Belum ada aktivitas shift" desc="Shift dibuka/ditutup dari halaman Kasir. Hasil perhitungan kas muncul di sini." />
            ) : [...(shiftLogs || [])].sort((a, b) => (b.closedAt || b.openedAt || 0) - (a.closedAt || a.openedAt || 0)).slice(0, 40).map(l => l.type === 'open' ? (
              <div key={l.id} className="card p-4 flex justify-between items-center gap-3">
                <div>
                  <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv">Shift dibuka — {l.employeeName || '-'}</p>
                  <p className="text-[10px] font-bold text-ink-faint">{new Date(l.openedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · modal {formatIDR(l.openingCash)} · {l.branchId || 'PUSAT'}{l.stationCode ? ` · ${l.stationCode}` : ''}</p>
                </div>
                <Badge tone="gold">AKTIF</Badge>
              </div>
            ) : (
              <div key={l.id} className="card p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv">Shift ditutup — {l.closedBy || l.employeeName || '-'}</p>
                    <p className="text-[10px] font-bold text-ink-faint">
                      {new Date(l.closedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · tunai {formatIDR(l.cashSales)} · masuk {formatIDR(l.cashIn)} · keluar {formatIDR(l.cashOut)}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-extrabold ${toneCls(SHIFT_RESULT_META[l.result]?.tone)}`}>
                    {SHIFT_RESULT_META[l.result]?.label || l.result} {formatIDR(Math.abs(l.difference || 0))}
                  </span>
                </div>
                <div className="mt-2.5 p-3 rounded-xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark text-[11px] font-bold grid grid-cols-3 gap-2">
                  <div><p className="text-ink-faint text-[9.5px] uppercase tracking-wider">Seharusnya</p><p className="money mt-0.5">{formatIDR(l.expectedCash)}</p></div>
                  <div><p className="text-ink-faint text-[9.5px] uppercase tracking-wider">Dihitung</p><p className="money mt-0.5">{formatIDR(l.actualCash)}</p></div>
                  <div><p className="text-ink-faint text-[9.5px] uppercase tracking-wider">Selisih</p><p className={`money mt-0.5 ${(l.difference || 0) < 0 ? 'text-brick' : (l.difference || 0) > 0 ? 'text-gold-deep dark:text-gold' : 'text-leaf-deep dark:text-leaf'}`}>{(l.difference || 0) >= 0 ? '+' : ''}{formatIDR(l.difference || 0)}</p></div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1">Uang Masuk / Keluar Terakhir</h3>
            {(cashEvents || []).length === 0 ? (
              <EmptyState mascot="pikir" title="Belum ada catatan kas" desc="Catat uang masuk/keluar dari panel shift di halaman Kasir — semuanya masuk audit log." />
            ) : [...(cashEvents || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20).map(e => (
              <div key={e.id} className="card p-3.5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-[12px] text-ink dark:text-ink-inv truncate">{e.note || (e.type === 'CASH_IN' ? 'Uang masuk' : 'Uang keluar')}</p>
                  <p className="text-[10px] font-bold text-ink-faint">{e.employeeName || '-'} · {new Date(e.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <p className={`font-extrabold text-sm money shrink-0 ${e.type === 'CASH_IN' ? 'text-leaf-deep dark:text-leaf' : 'text-brick'}`}>{e.type === 'CASH_IN' ? '+' : '−'}{formatIDR(e.amount)}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== modal konfirmasi / selisih / penyesuaian ===== */}
      {confirmFor && <SettlementActionModal
        mode={confirmFor.mode} rec={confirmFor.rec}
        onClose={() => setConfirmFor(null)}
        onConfirm={(ref, note) => settleConfirm(confirmFor.rec, ref, note)}
        onMismatch={(note) => markMismatch(confirmFor.rec, note)}
        onAdjust={(amt, note) => adjustSettlement(confirmFor.rec, amt, note)}
      />}

      {/* ===== v21.1 modal review event AMBIGUOUS (payment.confirm) ===== */}
      {reviewEv && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={() => setReviewEv(null)}>
          <div className="card w-full sm:max-w-sm shadow-pop rounded-t-3xl sm:rounded-3xl animate-pop" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-line/70 dark:border-line-dark/70">
              <p className="kicker">Review Manual Pembayaran</p>
              <h3 className="font-extrabold text-base text-ink dark:text-ink-inv mt-0.5 money">{formatIDR(reviewEv.amount)} · {reviewEv.method}</h3>
              <p className="text-[10px] font-bold text-ink-faint mt-1 break-all">{reviewEv.eventId}</p>
            </div>
            <div className="p-5 space-y-3">
              <div className="p-3 rounded-xl bg-gold-soft dark:bg-gold/10 border border-gold/25 text-[10.5px] font-bold text-gold-deep dark:text-gold">
                {reviewEv.reason || 'Nominal sama saja — bukti tidak cukup untuk konfirmasi otomatis.'}
              </div>
              {reviewEv.orderId && (() => {
                const o = orderById(reviewEv.orderId);
                return o ? (
                  <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark text-[10.5px] font-bold text-ink-soft dark:text-ink-inv/80">
                    Order #{String(o.clientTransactionId || o.id).slice(-5)} · {formatIDR(o.total)} · {o.buyer || 'Tanpa Nama'} · {o.branchId || 'PUSAT'}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-brick-soft dark:bg-brick/10 border border-brick/25 text-[10.5px] font-bold text-brick-deep dark:text-brick">
                    Order tujuan tidak ditemukan di mirror perangkat ini — buka di perangkat cabang, atau konfirmasi lewat Riwayat Transaksi.
                  </div>
                );
              })()}
              <div>
                <label className="kicker block mb-1.5 ml-0.5">Catatan keputusan (wajib utk konfirmasi)</label>
                <input className="field" placeholder="mis. sudah cek rekening, dana masuk…" value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" className="flex-1 py-3" onClick={doReject} icon={Ban}>Tolak Event</Button>
                <Button className="flex-1 py-3" onClick={doManualConfirm} icon={Check}>Konfirmasi Lunas</Button>
              </div>
              <p className="text-[9px] font-bold text-ink-faint text-center">Semua keputusan tercatat: aktor, role, waktu, alasan (audit + ledger).</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---- Modal aksi settlement (konfirmasi/selisih/adjust) ---- */
const SettlementActionModal = ({ mode, rec, onClose, onConfirm, onMismatch, onAdjust }) => {
  const [ref, setRef] = useState(rec.referenceNumber || '');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState(0);
  const [err, setErr] = useState('');
  const title = mode === 'confirm' ? 'Konfirmasi Dana Masuk' : mode === 'mismatch' ? 'Tandai Selisih Settlement' : 'Tambah Penyesuaian';
  return (
    <div className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center sm:p-4 bg-chrome-deep/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-surface dark:bg-surface-dark w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-pop animate-pop p-5 space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="kicker">{title}</p>
            <p className="text-[11px] font-bold text-ink-faint mt-0.5">{rec.method} · {rec.periodDate} · net {formatIDR(rec.netAmount)}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-paper dark:bg-white/5 flex items-center justify-center text-ink-faint hover:text-brick transition"><X className="w-4 h-4" /></button>
        </div>
        {mode === 'confirm' && (
          <>
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Nomor Referensi Provider (wajib)</label>
              <input className="field font-mono" placeholder="mis. MP-20251008-99182" value={ref} onChange={e => setRef(e.target.value)} />
              <p className="text-[10px] font-bold text-ink-faint mt-1.5">Salin dari dasbor provider (Midtrans/QRIS aggregator/bank). Tersimpan permanen sebagai bukti.</p>
            </div>
            <input className="field" placeholder="Catatan (opsional)" value={note} onChange={e => setNote(e.target.value)} />
            {err && <p className="px-3 py-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick text-xs font-bold">{err}</p>}
            <Button onClick={() => { if (!ref.trim()) { setErr('Nomor referensi wajib diisi.'); return; } onConfirm(ref.trim(), note); }} className="w-full py-3" icon={Check}>Konfirmasi SETTLED</Button>
          </>
        )}
        {mode === 'mismatch' && (
          <>
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Keterangan selisih (wajib)</label>
              <textarea className="field resize-none" rows={2} placeholder="mis. ada refund terlambat, dana belum masuk penuh…" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <Button onClick={() => { if (!note.trim()) { setErr('Keterangan wajib diisi.'); return; } onMismatch(note.trim()); }} className="w-full py-3 !bg-brick hover:!bg-brick-deep" icon={Ban}>Tandai MISMATCH</Button>
          </>
        )}
        {mode === 'adjust' && (
          <>
            <NumericInput label="Nominal penyesuaian (boleh minus, tulis minus di catatan)" prefix="Rp" value={amount} onChange={setAmount} />
            <input className="field" placeholder="Alasan penyesuaian (wajib)" value={note} onChange={e => setNote(e.target.value)} />
            <Button onClick={() => { if (!note.trim() || amount === 0) return; onAdjust(amount, note.trim()); }} className="w-full py-3" icon={Undo2}>Simpan Penyesuaian</Button>
          </>
        )}
      </div>
    </div>
  );
};
