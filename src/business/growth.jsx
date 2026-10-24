// ============================================================
// WELP v21.4 ENTERPRISE GROWTH PACK, PROMO & LOYALITAS
// ------------------------------------------------------------
// Tiga sub-panel dalam SATU tab:
//   1. LOYALITAS   , poin otomatis dari transaksi kasir, tier
//                    Bronze/Silver/Gold/Platinum dari akumulasi
//                    belanja, tukar poin jadi diskon di kasir.
//   2. VOUCHER     , kode promo (persen/nominal) dgn periode,
//                    kuota, min belanja, per cabang. Dipakai
//                    langsung di Kasir, pemakaian terhitung.
//   3. RADAR       , radar bisnis rule-based: omzet vs kemarin,
//                    produk terlaris, jam sibuk, stok kritis.
// Sumber data = transaksi kasir nyata (pos_history), tanpa dummy.
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Users, Plus, Edit3, Trash2, Search, KoinBuddy, RoketBuddy,
  BahayaBuddy, MedaliBuddy, Omzet, Diskon, Stok,
} from '../welp-icons.jsx';
import {
  formatIDR, useTenantCol, safeParse, auditLog, trustedTime,
} from '../core.jsx';
import { canDo } from '../welp-core/rbac.js';
import { countsAsSale, netTotalOf } from '../welp-core/tx.js';
import {
  Button, Card, PageTitle, Badge, EmptyState, Modal, ConfirmDialog,
  Select, Toggle, NumericInput, Segmented,
} from '../ui';
import {
  nid, fmtDT, DEFAULT_LOYALTY, TIERS, tierOf, poinValueOf, loyaltyCfgOf,
  voucherStatusOf, discOfVoucher,
} from './kit.js';

const actorOf = (licenseInfo) => ({
  actor: licenseInfo?.employeeName || licenseInfo?.tenant || 'owner',
  actorRole: licenseInfo?.currentUserRole || 'owner',
});

const tierTone = (tier) => (tier === 'Platinum' || tier === 'Gold') ? 'gold' : tier === 'Silver' ? 'teal' : 'neutral';

const toLocalInput = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* ============================================================
   PANEL 1: LOYALITAS MEMBER
   ============================================================ */
const LoyaltyPanel = ({ licenseInfo, triggerAlert, canManage, canEdit }) => {
  const { items: customers, updateRow } = useTenantCol(licenseInfo, 'customers', 'customers_db');
  const { items: cfgRows, addRow: addCfgRow } = useTenantCol(licenseInfo, 'loyalty_cfg', 'loyalty_cfg_db');
  const { items: logs, addRow: addLog } = useTenantCol(licenseInfo, 'loyalty_log', 'loyalty_log_db');
  const cfg = loyaltyCfgOf(cfgRows);
  const [q, setQ] = useState('');
  const [showCfg, setShowCfg] = useState(false);
  const [form, setForm] = useState(cfg);
  const [adjustFor, setAdjustFor] = useState(null);   // customer rec
  const [adj, setAdj] = useState({ amount: 0, note: '' });
  const [openId, setOpenId] = useState(null);
  const { actor, actorRole } = actorOf(licenseInfo);

  const saveCfg = () => {
    const next = {
      ...cfg, cid: 'cfg', aktif: !!form.aktif,
      earnPerRp: Math.max(1000, Number(form.earnPerRp) || DEFAULT_LOYALTY.earnPerRp),
      poinWorth: Math.max(1, Number(form.poinWorth) || DEFAULT_LOYALTY.poinWorth),
      minRedeem: Math.max(0, Number(form.minRedeem) || 0),
      tiers: {
        silver: Math.max(0, Number(form.tiers?.silver) || 0),
        gold: Math.max(0, Number(form.tiers?.gold) || 0),
        platinum: Math.max(0, Number(form.tiers?.platinum) || 0),
      },
    };
    const exists = (cfgRows || []).some(r => r.cid === 'cfg');
    if (exists) updateRow('cfg', next); else addCfgRow(next);
    triggerAlert('Pengaturan loyalitas tersimpan.', 'success');
    auditLog(licenseInfo, 'LOYALTY_CFG_UPDATE', { earnPerRp: next.earnPerRp, poinWorth: next.poinWorth }, { actor, actorRole });
  };

  const stats = useMemo(() => {
    const rows = customers || [];
    const tierCount = { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 };
    let poinTotal = 0;
    rows.forEach(c => {
      const spend = Number(c.lifetimeSpend || 0);
      tierCount[tierOf(spend, cfg)] += 1;
      poinTotal += Number(c.poin || 0);
    });
    return { total: rows.length, tierCount, poinTotal };
  }, [customers, cfg]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (customers || [])
      .filter(c => !needle ||
        String(c.name || '').toLowerCase().includes(needle) ||
        String(c.phone || '').includes(needle))
      .sort((a, b) => Number(b.poin || 0) - Number(a.poin || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'id'));
  }, [customers, q]);

  const logsOf = (cid) => (logs || []).filter(l => l.memberCid === cid).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12);

  const applyAdjust = () => {
    const amt = Math.round(Number(adj.amount) || 0);
    if (!adjustFor || amt === 0) return triggerAlert('Isi jumlah poin (boleh minus).', 'error');
    const nextPoin = Math.max(0, Number(adjustFor.poin || 0) + amt);
    updateRow(adjustFor.cid, { poin: nextPoin });
    addLog({ memberCid: adjustFor.cid, memberName: adjustFor.name, type: 'adjust', poin: amt, amount: 0, orderId: null, note: adj.note || 'Penyesuaian manual', at: Date.now(), by: actor });
    auditLog(licenseInfo, 'LOYALTY_POIN_ADJUST', { target: adjustFor.name, poin: amt, note: adj.note }, { actor, actorRole });
    setAdjustFor(null); setAdj({ amount: 0, note: '' });
    triggerAlert('Poin disesuaikan.', 'success');
  };

  return (
    <div className="space-y-4">
      {/* KPI ringkas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4"><p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Total Member</p><p className="text-xl font-extrabold mt-1 money">{stats.total}</p></div>
        <div className="card p-4"><p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Poin Beredar</p><p className="text-xl font-extrabold mt-1 money">{stats.poinTotal.toLocaleString('id-ID')}</p></div>
        <div className="card p-4"><p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Nilai Poin</p><p className="text-xl font-extrabold mt-1 money">{formatIDR(poinValueOf(stats.poinTotal, cfg))}</p></div>
        <div className="card p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Tier</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {TIERS.map(t => <Badge key={t} tone={t === 'Bronze' ? 'neutral' : 'gold'}>{t} {stats.tierCount[t]}</Badge>)}
          </div>
        </div>
      </div>

      {/* Pengaturan poin */}
      <Card title="Aturan Poin & Tier" icon={KoinBuddy}
        action={<Button variant="secondary" onClick={() => { setShowCfg(v => !v); setForm(cfg); }} className="!py-2 !text-[11px]">{showCfg ? 'Tutup' : 'Ubah'}</Button>}
        help={canManage ? 'Aturan ini otomatis dipakai Kasir saat transaksi.' : 'Hanya Owner/Admin yang bisa mengubah aturan.'}>
        {!showCfg ? (
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <Badge tone={cfg.aktif ? 'green' : 'neutral'}>{cfg.aktif ? 'Program Aktif' : 'Program Mati'}</Badge>
            <Badge>1 poin / {formatIDR(cfg.earnPerRp)}</Badge>
            <Badge>1 poin = {formatIDR(cfg.poinWorth)}</Badge>
            <Badge>tukar min {cfg.minRedeem} poin</Badge>
            <Badge>Silver ≥ {formatIDR(cfg.tiers.silver)}</Badge>
            <Badge>Gold ≥ {formatIDR(cfg.tiers.gold)}</Badge>
            <Badge>Platinum ≥ {formatIDR(cfg.tiers.platinum)}</Badge>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark">
              <div>
                <p className="font-extrabold text-[12.5px]">Program Loyalitas Aktif</p>
                <p className="text-[10px] font-bold text-ink-faint">Mati = Kasir berhenti mengumpulkan & menukar poin.</p>
              </div>
              <Toggle on={!!form.aktif} onClick={() => setForm(f => ({ ...f, aktif: !f.aktif }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumericInput label="1 poin tiap belanja (Rp)" value={form.earnPerRp} onChange={v => setForm(f => ({ ...f, earnPerRp: v }))} prefix="Rp" />
              <NumericInput label="Nilai 1 poin saat tukar (Rp)" value={form.poinWorth} onChange={v => setForm(f => ({ ...f, poinWorth: v }))} prefix="Rp" />
              <NumericInput label="Minimal tukar (poin)" value={form.minRedeem} onChange={v => setForm(f => ({ ...f, minRedeem: v }))} />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">Batas tier (akumulasi belanja)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumericInput label="Silver mulai dari" value={form.tiers?.silver} onChange={v => setForm(f => ({ ...f, tiers: { ...f.tiers, silver: v } }))} prefix="Rp" />
              <NumericInput label="Gold mulai dari" value={form.tiers?.gold} onChange={v => setForm(f => ({ ...f, tiers: { ...f.tiers, gold: v } }))} prefix="Rp" />
              <NumericInput label="Platinum mulai dari" value={form.tiers?.platinum} onChange={v => setForm(f => ({ ...f, tiers: { ...f.tiers, platinum: v } }))} prefix="Rp" />
            </div>
            <Button onClick={saveCfg} disabled={!canManage} className="w-full sm:w-auto">Simpan Aturan</Button>
          </div>
        )}
      </Card>

      {/* Daftar member */}
      <Card title={`Member (${list.length})`} icon={Users}
        action={
          <div className="relative w-40 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input className="field !py-2 !pl-9 !text-[11px]" placeholder="Cari nama / telepon" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        }>
        {list.length === 0 ? (
          <EmptyState icon={Users} compact title="Belum ada member"
            desc="Tambahkan pelanggan di menu Customer (CRM). Poin otomatis terkumpul saat nama pelanggan dipilih di Kasir." />
        ) : (
          <div className="space-y-2">
            {list.map(c => {
              const tier = tierOf(Number(c.lifetimeSpend || 0), cfg);
              const open = openId === c.cid;
              return (
                <div key={c.cid} className="rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03] overflow-hidden">
                  <button onClick={() => setOpenId(open ? null : c.cid)} className="w-full p-3.5 flex items-center gap-3 text-left press">
                    <span className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold shrink-0">{c.name?.[0] || '?'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[13px] truncate">{c.name}</p>
                      <p className="text-[10px] font-bold text-ink-faint truncate">{c.phone || 'Tanpa telepon'} · akumulasi {formatIDR(Number(c.lifetimeSpend || 0))}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge tone={tierTone(tier)}>{tier}</Badge>
                      <p className="text-[12px] font-extrabold mt-1 money">{Number(c.poin || 0).toLocaleString('id-ID')} poin</p>
                    </div>
                  </button>
                  {open && (
                    <div className="px-3.5 pb-3.5 space-y-2 animate-rise">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => { setAdjustFor(c); setAdj({ amount: 0, note: '' }); }} disabled={!canEdit} className="!py-2 !text-[11px]"><KoinBuddy className="w-3.5 h-3.5" /> Sesuaikan Poin</Button>
                      </div>
                      <div className="rounded-xl bg-surface dark:bg-white/[.03] border border-line dark:border-line-dark p-3">
                        <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint mb-2">Riwayat Poin</p>
                        {logsOf(c.cid).length === 0 ? (
                          <p className="text-[10.5px] font-bold text-ink-faint">Belum ada mutasi poin. Poin muncul otomatis dari transaksi kasir.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {logsOf(c.cid).map(l => (
                              <div key={l.cid} className="flex justify-between items-center gap-2 text-[10.5px]">
                                <span className="font-bold text-ink-soft dark:text-ink-inv/70 truncate">
                                  <span className={l.poin >= 0 ? 'text-leaf font-extrabold' : 'text-brick font-extrabold'}>{l.poin >= 0 ? '+' : ''}{l.poin}</span>
                                  {' '}{l.type === 'earn' ? 'dari transaksi' : l.type === 'redeem' ? 'ditukar diskon' : l.note || 'penyesuaian'}
                                </span>
                                <span className="text-ink-faint font-bold shrink-0">{fmtDT(l.at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal sesuaikan poin */}
      <Modal open={!!adjustFor} onClose={() => setAdjustFor(null)} title={`Sesuaikan Poin: ${adjustFor?.name || ''}`}
        sub={`Poin sekarang ${Number(adjustFor?.poin || 0).toLocaleString('id-ID')}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAdjustFor(null)}>Batal</Button>
            <Button className="flex-1" onClick={applyAdjust}>Simpan</Button>
          </div>
        }>
        <div className="space-y-3">
          <NumericInput label="Jumlah poin (minus untuk mengurangi)" value={adj.amount} onChange={v => setAdj(a => ({ ...a, amount: v }))} />
          <input className="field" placeholder="Alasan (misal koreksi sistem lama)" value={adj.note} onChange={e => setAdj(a => ({ ...a, note: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================
   PANEL 2: VOUCHER & PROMO
   ============================================================ */
const EMPTY_VOUCHER = {
  code: '', type: 'percent', value: 0, minBelanja: 0, maxDisc: 0,
  startAt: '', endAt: '', kuota: 0, cabangId: 'ALL', aktif: true, note: '',
};

const VoucherPanel = ({ licenseInfo, triggerAlert, canManage, canEdit, canDelete }) => {
  const { items: vouchers, addRow, updateRow, removeRow } = useTenantCol(licenseInfo, 'voucher', 'voucher_db');
  const { items: branches } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [delFor, setDelFor] = useState(null);
  const [form, setForm] = useState(EMPTY_VOUCHER);
  const { actor, actorRole } = actorOf(licenseInfo);

  const openCreate = () => { setEditing(null); setForm(EMPTY_VOUCHER); setOpenForm(true); };
  const openEdit = (v) => {
    setEditing(v);
    setForm({
      ...EMPTY_VOUCHER, ...v,
      startAt: v.startAt ? toLocalInput(new Date(v.startAt).getTime()) : '',
      endAt: v.endAt ? toLocalInput(new Date(v.endAt).getTime()) : '',
    });
    setOpenForm(true);
  };

  const save = () => {
    const code = String(form.code || '').trim().toUpperCase();
    if (!code) return triggerAlert('Kode voucher wajib diisi.', 'error');
    if (Number(form.value) <= 0) return triggerAlert('Nilai voucher harus lebih dari 0.', 'error');
    if (form.type === 'percent' && Number(form.value) > 100) return triggerAlert('Diskon persen maksimal 100.', 'error');
    const dup = (vouchers || []).some(v => v.code === code && v.cid !== editing?.cid);
    if (dup) return triggerAlert('Kode voucher sudah dipakai.', 'error');
    const rec = {
      code, type: form.type, value: Number(form.value) || 0,
      minBelanja: Number(form.minBelanja) || 0, maxDisc: Number(form.maxDisc) || 0,
      startAt: form.startAt ? new Date(form.startAt).getTime() : null,
      endAt: form.endAt ? new Date(form.endAt).getTime() : null,
      kuota: Number(form.kuota) || 0, cabangId: form.cabangId || 'ALL',
      aktif: form.aktif !== false, note: form.note || '',
    };
    if (editing) { updateRow(editing.cid, rec); auditLog(licenseInfo, 'VOUCHER_UPDATE', { target: code }, { actor, actorRole }); }
    else { addRow({ ...rec, used: 0 }); auditLog(licenseInfo, 'VOUCHER_CREATE', { target: code, nilai: rec.value }, { actor, actorRole }); }
    setOpenForm(false);
    triggerAlert(editing ? 'Voucher diperbarui.' : 'Voucher baru siap dipakai di Kasir.', 'success');
  };

  const toggleV = (v) => updateRow(v.cid, { aktif: v.aktif === false });

  return (
    <div className="space-y-4">
      <Card title={`Voucher & Promo (${(vouchers || []).length})`} icon={Diskon}
        action={canManage ? <Button onClick={openCreate} className="!py-2 !text-[11px]"><Plus className="w-3.5 h-3.5" /> Voucher Baru</Button> : null}
        help="Kasir tinggal ketik kode voucher saat checkout. Kuota & periode dijaga otomatis.">
        {(vouchers || []).length === 0 ? (
          <EmptyState icon={Diskon} compact title="Belum ada voucher"
            desc="Buat kode promo misal HEMAT10 (10%, maks 20rb) untuk menarik pelanggan balik lagi." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {vouchers.map(v => {
              const st = voucherStatusOf(v);
              return (
                <div key={v.cid} className="rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-extrabold text-[15px] tracking-wide truncate">{v.code}</p>
                      <p className="text-[11px] font-bold text-ink-soft dark:text-ink-inv/70 mt-0.5">
                        {v.type === 'percent' ? `Diskon ${v.value}%${Number(v.maxDisc) > 0 ? ` maks ${formatIDR(v.maxDisc)}` : ''}` : `Potongan ${formatIDR(v.value)}`}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] font-bold text-ink-faint">
                    {Number(v.minBelanja) > 0 && <span>Min. {formatIDR(v.minBelanja)}</span>}
                    <span>{Number(v.used || 0)} dipakai{Number(v.kuota) > 0 ? ` / ${v.kuota}` : ''}</span>
                    {v.endAt && <span>s.d. {fmtDT(v.endAt)}</span>}
                    {v.cabangId && v.cabangId !== 'ALL' && <span>{(branches.find(b => b.cid === v.cabangId) || {}).name || 'Cabang'}</span>}
                  </div>
                  {canManage && (
                    <div className="flex gap-2 mt-3">
                      <Button variant="secondary" onClick={() => openEdit(v)} disabled={!canEdit} className="!py-1.5 !text-[10.5px] flex-1"><Edit3 className="w-3 h-3" /> Ubah</Button>
                      <Button variant="secondary" onClick={() => toggleV(v)} disabled={!canEdit} className="!py-1.5 !text-[10.5px] flex-1">{v.aktif === false ? 'Aktifkan' : 'Matikan'}</Button>
                      <Button variant="secondary" onClick={() => setDelFor(v)} disabled={!canDelete} className="!py-1.5 !text-[10.5px] !text-brick"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={openForm} onClose={() => setOpenForm(false)} title={editing ? 'Ubah Voucher' : 'Voucher Baru'}
        sub="Kode besar/kecil dianggap sama saat kasir mengetik."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpenForm(false)}>Batal</Button>
            <Button className="flex-1" onClick={save}>Simpan</Button>
          </div>
        }>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">Kode</label>
              <input className="field mt-1 font-mono uppercase" placeholder="HEMAT10" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <Select label="Jenis" value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
              options={[{ value: 'percent', label: 'Persen (%)' }, { value: 'nominal', label: 'Nominal (Rp)' }]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumericInput label={form.type === 'percent' ? 'Nilai (% disc)' : 'Nilai potongan (Rp)'} value={form.value}
              onChange={v => setForm(f => ({ ...f, value: v }))} prefix={form.type === 'nominal' ? 'Rp' : ''} />
            <NumericInput label={form.type === 'percent' ? 'Maks potongan (Rp, 0 bebas)' : 'Min belanja (Rp)'} value={form.type === 'percent' ? form.maxDisc : form.minBelanja}
              onChange={v => setForm(f => (form.type === 'percent' ? { ...f, maxDisc: v } : { ...f, minBelanja: v }))} prefix="Rp" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumericInput label="Min belanja (Rp, 0 bebas)" value={form.minBelanja} onChange={v => setForm(f => ({ ...f, minBelanja: v }))} prefix="Rp" />
            <NumericInput label="Kuota pemakaian (0 tanpa batas)" value={form.kuota} onChange={v => setForm(f => ({ ...f, kuota: v }))} />
          </div>
          {form.type === 'percent' && (
            <NumericInput label="Maks potongan (Rp, 0 bebas)" value={form.maxDisc} onChange={v => setForm(f => ({ ...f, maxDisc: v }))} prefix="Rp" />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">Mulai</label>
              <input type="datetime-local" className="field mt-1" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-ink-faint">Berakhir</label>
              <input type="datetime-local" className="field mt-1" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} />
            </div>
          </div>
          <Select label="Berlaku di cabang" value={form.cabangId} onChange={v => setForm(f => ({ ...f, cabangId: v }))}
            options={[{ value: 'ALL', label: 'Semua Cabang' }, ...(branches || []).map(b => ({ value: b.cid, label: b.name || 'Cabang' }))]} />
          <input className="field" placeholder="Catatan (opsional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          <div className="flex items-center justify-between p-3 rounded-xl bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark">
            <p className="font-extrabold text-[12.5px]">Voucher Aktif</p>
            <Toggle on={form.aktif !== false} onClick={() => setForm(f => ({ ...f, aktif: f.aktif === false }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!delFor} danger title="Hapus voucher?" typeWord={delFor?.code}
        message="Riwayat pemakaian di transaksi lama tetap tersimpan. Voucher hanya berhenti bisa dipakai."
        onCancel={() => setDelFor(null)}
        onConfirm={() => { removeRow(delFor.cid); auditLog(licenseInfo, 'VOUCHER_DELETE', { target: delFor.code }, { actor, actorRole }); setDelFor(null); triggerAlert('Voucher dihapus.', 'success'); }} />
    </div>
  );
};

/* ============================================================
   PANEL 3: RADAR BISNIS (rule-based insight)
   ============================================================ */
const RadarPanel = () => {
  const history = safeParse('pos_history_db', []);
  const products = safeParse('product_stock_db', []);
  const lowThreshold = parseInt(localStorage.getItem('low_stock_threshold')) || 5;

  const r = useMemo(() => {
    const todayK = new Date().toLocaleDateString('id-CA');
    const yestK = new Date(Date.now() - 86400000).toLocaleDateString('id-CA');
    const dayKey = (ms) => new Date(ms).toLocaleDateString('id-CA');
    let omzetToday = 0, omzetYest = 0, txToday = 0;
    const prod7 = new Map();
    const hour7 = Array(24).fill(0);
    const now = Date.now();
    (history || []).forEach(o => {
      if (!countsAsSale(o)) return;
      const t = o.date ? new Date(o.date).getTime() : (trustedTime(o).ms || 0);
      if (!t) return;
      const net = netTotalOf(o);
      if (dayKey(t) === todayK) { omzetToday += net; txToday += 1; }
      if (dayKey(t) === yestK) omzetYest += net;
      if (now - t <= 7 * 86400000) {
        (o.items || []).forEach(i => {
          const cur = prod7.get(i.name) || { qty: 0, omzet: 0 };
          cur.qty += Number(i.qty || 0); cur.omzet += Number(i.price || 0) * Number(i.qty || 0);
          prod7.set(i.name, cur);
        });
        hour7[new Date(t).getHours()] += 1;
      }
    });
    const delta = omzetYest > 0 ? Math.round(((omzetToday - omzetYest) / omzetYest) * 100) : (omzetToday > 0 ? 100 : 0);
    const top = [...prod7.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.omzet - a.omzet).slice(0, 5);
    const maxHour = Math.max(...hour7);
    const busyHour = maxHour > 0 ? hour7.indexOf(maxHour) : -1;
    const low = products.filter(p => (p.stock || 0) <= lowThreshold);
    return { omzetToday, omzetYest, txToday, delta, top, busyHour, low };
  }, [history, products, lowThreshold]);

  const insights = [];
  if (r.delta > 0) insights.push(`Omzet hari ini naik ${r.delta}% dibanding kemarin. Jaga momentum: pastikan produk terlaris tidak kosong.`);
  else if (r.omzetYest > 0) insights.push(`Omzet hari ini turun ${Math.abs(r.delta)}% dari kemarin. Coba dorong voucher atau promo sore hari.`);
  if (r.top[0]) insights.push(`Produk juara 7 hari terakhir: ${r.top[0].name} (${r.top[0].qty} pcs, ${formatIDR(r.top[0].omzet)}).`);
  if (r.busyHour >= 0) insights.push(`Jam paling sibuk sekitar ${r.busyHour}:00. Siapkan kasir & stok ekstra sebelum jam itu.`);
  if (r.low.length > 0) insights.push(`${r.low.length} produk stok kritis: ${r.low.slice(0, 3).map(p => p.name).join(', ')}${r.low.length > 3 ? ', dll' : ''}. Segera buat Purchase Order.`);
  if (!insights.length) insights.push('Belum cukup data transaksi minggu ini. Radar akan makin pintar seiring penjualan berjalan.');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Omzet Hari Ini</p>
          <p className="text-lg font-extrabold mt-1 money">{formatIDR(r.omzetToday)}</p>
          <p className={`text-[10px] font-extrabold mt-0.5 ${r.delta >= 0 ? 'text-leaf' : 'text-brick'}`}>
            {r.delta >= 0 ? 'Naik' : 'Turun'} {Math.abs(r.delta)}% vs kemarin
          </p>
        </div>
        <div className="card p-4"><p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Transaksi Hari Ini</p><p className="text-lg font-extrabold mt-1 money">{r.txToday}</p></div>
        <div className="card p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Jam Tersibuk</p>
          <p className="text-lg font-extrabold mt-1">{r.busyHour >= 0 ? `${r.busyHour}:00` : 'Belum ada'}</p>
          <p className="text-[10px] font-bold text-ink-faint mt-0.5">7 hari terakhir</p>
        </div>
        <div className="card p-4">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-ink-faint">Stok Kritis</p>
          <p className={`text-lg font-extrabold mt-1 ${r.low.length ? 'text-brick' : ''}`}>{r.low.length} produk</p>
        </div>
      </div>

      <Card title="Saran Cepat" icon={RoketBuddy}>
        <div className="space-y-2">
          {insights.map((s, i) => (
            <div key={i} className="flex gap-2.5 p-3 rounded-xl bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark">
              <span className="w-6 h-6 rounded-lg bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot flex items-center justify-center text-[10px] font-extrabold shrink-0">{i + 1}</span>
              <p className="text-[11.5px] font-bold text-ink-soft dark:text-ink-inv/75 leading-snug">{s}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Produk Terlaris (7 Hari)" icon={MedaliBuddy}>
        {r.top.length === 0 ? (
          <EmptyState icon={Omzet} compact title="Belum ada penjualan" desc="Grafik terisi otomatis setelah kasir jalan." />
        ) : (
          <div className="space-y-2">
            {r.top.map((p, i) => {
              const max = r.top[0].omzet || 1;
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-[11px] font-extrabold mb-1">
                    <span className="truncate"><span className="inline-flex w-4 h-4 mr-1.5 rounded bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot text-[9px] items-center justify-center align-middle">{i + 1}</span>{p.name}</span>
                    <span className="text-ink-faint shrink-0 ml-2">{p.qty} pcs · {formatIDR(p.omzet)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-paper dark:bg-white/[.06] overflow-hidden">
                    <div className="h-full rounded-full bg-flame-500" style={{ width: `${Math.max(6, (p.omzet / max) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ============================================================
   TAB UTAMA
   ============================================================ */
export const GrowthTab = ({ licenseInfo, triggerAlert, perms }) => {
  const [seg, setSeg] = useState('member');
  const canManage = canDo(perms, 'crm.manage');
  const canEdit = canDo(perms, 'crm.edit') || canManage;
  const canDelete = canDo(perms, 'crm.delete') || canManage;

  return (
    <div className="space-y-5">
      <PageTitle title="Promo & Loyalitas" mascot
        sub="Poin member otomatis dari kasir, kode voucher, dan radar bisnis harian."
        right={<Segmented value={seg} onChange={setSeg} items={[
          { id: 'member', label: 'Loyalitas' },
          { id: 'voucher', label: 'Voucher' },
          { id: 'radar', label: 'Radar' },
        ]} />} />
      {seg === 'member' && <LoyaltyPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} canManage={canManage} canEdit={canEdit} />}
      {seg === 'voucher' && <VoucherPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} canManage={canManage} canEdit={canEdit} canDelete={canDelete} />}
      {seg === 'radar' && <RadarPanel />}
    </div>
  );
};

// poin value utk dipakai modul lain (pos.jsx)
export { poinValueOf, discOfVoucher };
