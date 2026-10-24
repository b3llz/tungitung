// ============================================================
// WELP v21.4 ENTERPRISE GROWTH PACK, OPERASIONAL TIM
// ------------------------------------------------------------
// Empat sub-panel dalam SATU tab:
//   1. JADWAL     , grid mingguan karyawan x 7 hari, tap berganti
//                   shift (Libur/Pagi/Siang/Malam), copy minggu
//                   lalu. Karyawan melihat "Jadwal Saya".
//   2. TARGET     , target omzet bulanan per cabang / per kasir
//                   dari penjualan nyata + leaderboard kasir.
//   3. PENGUMUMAN , siaran internal (semua / role / cabang),
//                   dibaca karyawan di Employee Area.
//   4. CHECKLIST  , checklist buka/tutup toko harian per cabang.
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Tim, Plus, Trash2, Check, X, MedaliBuddy, RoketBuddy, Absensi,
  ClipboardList, ChevronLeft, ChevronRight, Copy, Omzet,
} from '../welp-icons.jsx';
import {
  formatIDR, useTenantCol, safeParse, auditLog, trustedTime,
} from '../core.jsx';
import { canDo } from '../welp-core/rbac.js';
import { countsAsSale, netTotalOf } from '../welp-core/tx.js';
import {
  Button, Card, PageTitle, Badge, EmptyState, Modal, ConfirmDialog,
  Select, Toggle, NumericInput, Segmented, HelpBox,
} from '../ui';
import {
  nid, fmtDT, fmtD, monthKeyOf, shiftWeekKey, weekMondayOf, weekKeyOf,
  SHIFT_CODES, SHIFT_MAP, DAY_LABELS, nextShiftCode,
} from './kit.js';

const actorOf = (licenseInfo) => ({
  actor: licenseInfo?.employeeName || licenseInfo?.tenant || 'owner',
  actorRole: licenseInfo?.currentUserRole || 'owner',
});

const branchIdOf = (licenseInfo) => licenseInfo?.branchId || 'PUSAT';

/* ============================================================
   PANEL 1: JADWAL SHIFT MINGGUAN
   ============================================================ */
const JadwalPanel = ({ licenseInfo, triggerAlert, canEdit, karyawan, branches }) => {
  const { items: schedules, addRow, updateRow } = useTenantCol(licenseInfo, 'jadwal_shift', 'schedule_db');
  const [weekOffset, setWeekOffset] = useState(0);
  const weekKey = shiftWeekKey(weekOffset);
  // Record jadwal dicari lewat field weekKey (addRow membuat cid sendiri,
  // jadi cid TIDAK bisa dipakai sebagai kunci minggu).
  const rec = (schedules || []).find(s => s.weekKey === weekKey);
  const entries = rec?.entries || {};
  const { actor, actorRole } = actorOf(licenseInfo);
  const monday = weekMondayOf(weekKey);
  const staff = (karyawan || []).filter(k => k.status !== 'nonaktif');

  const codeOf = (empCid, dayIdx) => (entries[empCid]?.[dayIdx]) || 'L';
  const setCode = (empCid, dayIdx) => {
    if (!canEdit) return;
    const next = { ...entries };
    const row = { ...(next[empCid] || {}) };
    row[dayIdx] = nextShiftCode(row[dayIdx]);
    next[empCid] = row;
    if (rec) updateRow(rec.cid, { entries: next, updatedAt: Date.now(), updatedBy: actor });
    else addRow({ weekKey, entries: next });
  };

  const copyLastWeek = () => {
    if (!canEdit) return;
    const prevKey = shiftWeekKey(weekOffset - 1);
    const prevRec = (schedules || []).find(s => s.weekKey === prevKey);
    if (!prevRec) return triggerAlert('Jadwal minggu lalu belum ada.', 'error');
    if (rec) updateRow(rec.cid, { entries: prevRec.entries || {}, updatedAt: Date.now(), updatedBy: actor });
    else addRow({ weekKey, entries: prevRec.entries || {} });
    triggerAlert('Jadwal minggu lalu tersalin.', 'success');
  };

  const saveWeek = () => {
    if (!canEdit) return;
    const clean = {};
    Object.keys(entries).forEach(k => {
      const row = entries[k];
      if (row && Object.keys(row).length) {
        const vals = {};
        Object.keys(row).forEach(d => { if (row[d]) vals[d] = row[d]; });
        clean[k] = vals;
      }
    });
    if (rec) updateRow(rec.cid, { entries: clean, updatedAt: Date.now(), updatedBy: actor });
    else addRow({ weekKey, entries: clean });
    auditLog(licenseInfo, 'JADWAL_SAVE', { target: weekKey, karyawan: Object.keys(clean).length }, { actor, actorRole });
    triggerAlert('Jadwal tersimpan. Tim melihatnya di aplikasi masing-masing.', 'success');
  };

  const workDaysOf = (empCid) => DAY_LABELS.reduce((a, _, i) => a + (codeOf(empCid, i) !== 'L' ? 1 : 0), 0);

  return (
    <div className="space-y-4">
      <Card
        title={weekOffset === 0 ? 'Minggu Ini' : weekOffset > 0 ? `Minggu +${weekOffset}` : `Minggu ${weekOffset}`}
        icon={Absensi}
        action={
          <div className="flex items-center gap-1.5">
            <button onClick={() => setWeekOffset(o => o - 1)} className="w-8 h-8 rounded-xl bg-surface dark:bg-white/5 border border-line dark:border-line-dark flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-[10px] font-extrabold text-ink-faint w-20 text-center truncate">
              {monday ? `${fmtD(monday.getTime())}` : weekKey}
            </span>
            <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))} className="w-8 h-8 rounded-xl bg-surface dark:bg-white/5 border border-line dark:border-line-dark flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
          </div>
        }
        help="Tap kolom hari untuk ganti shift: Libur, Pagi, Siang, Malam. Jangan lupa simpan.">
        {staff.length === 0 ? (
          <EmptyState icon={Tim} compact title="Belum ada karyawan" desc="Tambahkan karyawan dulu di menu Manajemen Karyawan." />
        ) : (
          <div className="space-y-2">
            {staff.map(k => (
              <div key={k.cid} className="p-3 rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-extrabold text-[12.5px] truncate">{k.name}</p>
                  <Badge tone={workDaysOf(k.cid) > 0 ? 'green' : 'neutral'}>{workDaysOf(k.cid)} hari</Badge>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_LABELS.map((d, i) => {
                    const code = codeOf(k.cid, i);
                    const meta = SHIFT_MAP[code] || SHIFT_MAP.L;
                    return (
                      <button key={i} onClick={() => setCode(k.cid, i)} disabled={!canEdit}
                        className={`flex flex-col items-center gap-1 py-1.5 rounded-xl border transition press ${meta.cls} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                        <span className="text-[8.5px] font-extrabold opacity-70">{d}</span>
                        <span className="text-[9.5px] font-extrabold">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {canEdit && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={saveWeek} className="flex-1 min-w-[140px]"><Check className="w-4 h-4" /> Simpan Jadwal</Button>
                <Button variant="secondary" onClick={copyLastWeek} className="flex-1 min-w-[140px]"><Copy className="w-4 h-4" /> Salin Minggu Lalu</Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ============================================================
   PANEL 2: TARGET OMZET & LEADERBOARD
   ============================================================ */
const TargetPanel = ({ licenseInfo, triggerAlert, canEdit, karyawan, branches }) => {
  const { items: targets, addRow, removeRow, updateRow } = useTenantCol(licenseInfo, 'target_omzet', 'target_db');
  const [monthKey, setMonthKey] = useState(monthKeyOf());
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ scope: 'branch', refId: '', amount: 0 });
  const history = safeParse('pos_history_db', []);
  const { actor, actorRole } = actorOf(licenseInfo);

  const monthLabel = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [monthKey]);

  const inMonth = (t) => {
    if (!countsAsSale(t)) return 0;
    const ms = t.date ? new Date(t.date).getTime() : (trustedTime(t).ms || 0);
    return monthKeyOf(ms) === monthKey ? netTotalOf(t) : 0;
  };

  const achievedOf = (tg) => (tg.scope === 'branch'
    ? history.reduce((a, t) => a + ((t.branchId || 'PUSAT') === tg.refId ? inMonth(t) : 0), 0)
    : history.reduce((a, t) => a + (String(t.employeeId || '') === String(tg.refId) || t.employeeName === tg.refName ? inMonth(t) : 0), 0));

  const board = useMemo(() => {
    const map = new Map();
    history.forEach(t => {
      const v = inMonth(t);
      if (!v) return;
      const key = t.employeeId || t.employeeName || 'tanpa-nama';
      const cur = map.get(key) || { name: t.employeeName || key, omzet: 0, trx: 0 };
      cur.omzet += v; cur.trx += 1;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.omzet - a.omzet).slice(0, 8);
  }, [history, monthKey]);

  const createTarget = () => {
    const ref = form.scope === 'branch' ? (branches || []).find(b => b.cid === form.refId) : (karyawan || []).find(k => k.cid === form.refId);
    if (!form.refId) return triggerAlert('Pilih cabang atau karyawan dulu.', 'error');
    if (Number(form.amount) <= 0) return triggerAlert('Nominal target harus lebih dari 0.', 'error');
    addRow({ monthKey, scope: form.scope, refId: form.refId, refName: ref?.name || 'Target', amount: Number(form.amount), createdBy: actor });
    auditLog(licenseInfo, 'TARGET_CREATE', { periode: monthKey, target: ref?.name, nominal: form.amount }, { actor, actorRole });
    setOpenForm(false);
    triggerAlert('Target tersimpan.', 'success');
  };

  const list = (targets || []).filter(t => t.monthKey === monthKey);
  const prevKey = monthKeyOf(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime());
  const totalTarget = list.reduce((a, b) => a + (b.scope === 'branch' ? Number(b.amount || 0) : 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-extrabold text-ink-faint">Periode: <span className="text-ink dark:text-ink-inv">{monthLabel}</span></p>
        <div className="flex gap-1.5">
          <button onClick={() => setMonthKey(prevKey)} className="text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-surface dark:bg-white/5 border border-line dark:border-line-dark">Bulan Lalu</button>
          {monthKey !== monthKeyOf() && (
            <button onClick={() => setMonthKey(monthKeyOf())} className="text-[10px] font-extrabold px-3 py-1.5 rounded-xl bg-flame-600 text-white">Bulan Ini</button>
          )}
        </div>
      </div>

      <Card title={`Target Omzet (${list.length})`} icon={RoketBuddy}
        action={canEdit ? <Button onClick={() => { setForm({ scope: 'branch', refId: '', amount: 0 }); setOpenForm(true); }} className="!py-2 !text-[11px]"><Plus className="w-3.5 h-3.5" /> Target</Button> : null}
        help="Progress dihitung dari transaksi kasir nyata bulan berjalan.">
        {list.length === 0 ? (
          <EmptyState icon={RoketBuddy} compact title="Belum ada target bulan ini"
            desc="Pasang target untuk cabang atau kasir supaya tim punya arah yang jelas." />
        ) : (
          <div className="space-y-3">
            {list.map(tg => {
              const achieved = achievedOf(tg);
              const pct = Math.min(100, Math.round((achieved / Math.max(1, Number(tg.amount))) * 100));
              return (
                <div key={tg.cid} className="p-3.5 rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03]">
                  <div className="flex justify-between items-center gap-2">
                    <p className="font-extrabold text-[12.5px] truncate">
                      <Badge tone={tg.scope === 'branch' ? 'teal' : 'gold'}>{tg.scope === 'branch' ? 'Cabang' : 'Kasir'}</Badge>
                      <span className="ml-1.5">{tg.refName}</span>
                    </p>
                    {canEdit && <button onClick={() => { removeRow(tg.cid); }} className="text-brick shrink-0"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                  <div className="flex justify-between text-[10.5px] font-extrabold mt-2 mb-1">
                    <span className="money">{formatIDR(achieved)}</span>
                    <span className="text-ink-faint">target {formatIDR(tg.amount)} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface dark:bg-white/[.06] overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-leaf' : 'bg-flame-500'}`} style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                </div>
              );
            })}
            {totalTarget > 0 && (
              <p className="text-[10px] font-bold text-ink-faint">Target gabungan cabang: {formatIDR(totalTarget)} / bulan.</p>
            )}
          </div>
        )}
      </Card>

      <Card title="Leaderboard Kasir" icon={MedaliBuddy}
        help="Peringkat omzet kasir bulan terpilih, otomatis dari transaksi.">
        {board.length === 0 ? (
          <EmptyState icon={MedaliBuddy} compact title="Belum ada transaksi bulan ini" desc="Peringkat muncul otomatis saat kasir mulai bertransaksi." />
        ) : (
          <div className="space-y-2">
            {board.map((b, i) => (
              <div key={b.name} className={`flex items-center gap-3 p-3 rounded-2xl border ${i === 0 ? 'border-gold/50 bg-gold-soft/40 dark:bg-gold/10' : 'border-line dark:border-line-dark bg-paper dark:bg-white/[.03]'}`}>
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-[11px] shrink-0 ${i === 0 ? 'bg-gold text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-surface dark:bg-white/10 text-ink-faint'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-[12.5px] truncate">{b.name}</p>
                  <p className="text-[10px] font-bold text-ink-faint">{b.trx} transaksi</p>
                </div>
                <p className="font-extrabold text-[12px] money shrink-0">{formatIDR(b.omzet)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Target Omzet Baru" sub={monthLabel}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpenForm(false)}>Batal</Button>
            <Button className="flex-1" onClick={createTarget}>Simpan</Button>
          </div>
        }>
        <div className="space-y-3">
          <Select label="Jenis target" value={form.scope} onChange={v => setForm(f => ({ ...f, scope: v, refId: '' }))}
            options={[{ value: 'branch', label: 'Per Cabang' }, { value: 'employee', label: 'Per Kasir' }]} />
          {form.scope === 'branch' ? (
            <Select label="Cabang" value={form.refId} onChange={v => setForm(f => ({ ...f, refId: v }))}
              options={[{ value: '', label: 'Pilih cabang' }, ...(branches || []).map(b => ({ value: b.cid, label: b.name || 'Cabang' }))]} />
          ) : (
            <Select label="Karyawan" value={form.refId} onChange={v => setForm(f => ({ ...f, refId: v }))}
              options={[{ value: '', label: 'Pilih karyawan' }, ...(karyawan || []).map(k => ({ value: k.cid, label: k.name || 'Karyawan' }))]} />
          )}
          <NumericInput label="Nominal target" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} prefix="Rp" />
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================
   PANEL 3: PENGUMUMAN INTERNAL
   ============================================================ */
const AnnouncePanel = ({ licenseInfo, triggerAlert, canEdit, karyawan, branches }) => {
  const { items: anns, addRow, removeRow } = useTenantCol(licenseInfo, 'pengumuman', 'announce_db');
  const [form, setForm] = useState({ title: '', body: '', audience: 'ALL', refId: '', pinned: false });
  const [delFor, setDelFor] = useState(null);
  const { actor, actorRole } = actorOf(licenseInfo);

  const publish = () => {
    if (!form.title.trim() || !form.body.trim()) return triggerAlert('Judul dan isi pengumuman wajib diisi.', 'error');
    let audience = 'ALL';
    if (form.audience === 'role') {
      if (!form.refId) return triggerAlert('Tentukan role tujuan.', 'error');
      audience = `role:${form.refId}`;
    }
    if (form.audience === 'branch') {
      if (!form.refId) return triggerAlert('Pilih cabang tujuan.', 'error');
      audience = `branch:${form.refId}`;
    }
    const refName = form.audience === 'role' ? (form.refId) : form.audience === 'branch' ? ((branches || []).find(b => b.cid === form.refId) || {}).name : 'Semua';
    addRow({ title: form.title.trim(), body: form.body.trim(), audience, audienceLabel: refName || 'Semua', pinned: !!form.pinned, by: actor, byRole: actorRole });
    auditLog(licenseInfo, 'PENGUMUMAN_KIRIM', { target: form.title, audiens: refName }, { actor, actorRole });
    setForm({ title: '', body: '', audience: 'ALL', refId: '', pinned: false });
    triggerAlert('Pengumuman terkirim ke aplikasi tim.', 'success');
  };

  const list = (anns || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="space-y-4">
      <Card title="Buat Pengumuman" icon={RoketBuddy} help="Pengumuman tampil di beranda Employee Area karyawan, lengkap dengan tanda belum dibaca.">
        <div className="space-y-3">
          <input className="field" placeholder="Judul (misal Rapat singkat besok 08.00)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <textarea className="field min-h-[90px]" placeholder="Isi pengumuman..." value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Kirim ke" value={form.audience} onChange={v => setForm(f => ({ ...f, audience: v, refId: '' }))}
              options={[
                { value: 'ALL', label: 'Semua Karyawan' },
                { value: 'role', label: 'Role Tertentu' },
                { value: 'branch', label: 'Cabang Tertentu' },
              ]} />
            {form.audience === 'role' && (
              <Select label="Role tujuan" value={form.refId} onChange={v => setForm(f => f0(f, v))}
                options={[
                  { value: '', label: 'Pilih role' },
                  { value: 'kasir', label: 'Kasir' },
                  { value: 'manager', label: 'Manager' },
                  { value: 'supervisor', label: 'Supervisor' },
                  { value: 'hr', label: 'HRD' },
                  { value: 'gudang', label: 'Gudang' },
                ]} />
            )}
            {form.audience === 'branch' && (
              <Select label="Cabang tujuan" value={form.refId} onChange={v => setForm(f => ({ ...f, refId: v }))}
                options={[{ value: '', label: 'Pilih cabang' }, ...(branches || []).map(b => ({ value: b.cid, label: b.name || 'Cabang' }))]} />
            )}
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-paper dark:bg-white/[.04] border border-line dark:border-line-dark">
            <div>
              <p className="font-extrabold text-[12.5px]">Pin ke atas</p>
              <p className="text-[10px] font-bold text-ink-faint">Pengumuman penting selalu tampil paling atas.</p>
            </div>
            <Toggle on={form.pinned} onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))} />
          </div>
          <Button onClick={publish} disabled={!canEdit} className="w-full">Kirim Pengumuman</Button>
        </div>
      </Card>

      <Card title={`Riwayat (${list.length})`} icon={ClipboardList}>
        {list.length === 0 ? (
          <EmptyState icon={ClipboardList} compact title="Belum ada pengumuman" desc="Pengumuman yang sudah dikirim muncul di sini." />
        ) : (
          <div className="space-y-2">
            {list.map(a => (
              <div key={a.cid} className="p-3.5 rounded-2xl border border-line dark:border-line-dark bg-paper dark:bg-white/[.03]">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-extrabold text-[12.5px]">{a.pinned ? 'DISEMATKAN' : ''} {a.title}</p>
                  {canEdit && <button onClick={() => setDelFor(a)} className="text-brick shrink-0"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <p className="text-[11.5px] font-bold text-ink-soft dark:text-ink-inv/70 mt-1 whitespace-pre-wrap">{a.body}</p>
                <p className="text-[9.5px] font-extrabold text-ink-faint mt-2 uppercase tracking-wider">Untuk: {a.audienceLabel || 'Semua'} · oleh {a.by} · {fmtDT(a.createdAt || Date.now())}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog open={!!delFor} danger title="Hapus pengumuman?" typeWord={delFor?.title}
        message="Pengumuman hilang dari aplikasi semua karyawan."
        onCancel={() => setDelFor(null)} onConfirm={() => { removeRow(delFor.cid); setDelFor(null); }} />
    </div>
  );
};
const f0 = (f, v) => ({ ...f, refId: v });

/* ============================================================
   PANEL 4: CHECKLIST OPERASIONAL HARIAN
   ============================================================ */
const ChecklistPanel = ({ licenseInfo, triggerAlert, canEdit, branches }) => {
  const { items: tpls, addRow: addTpl, updateRow: updTpl } = useTenantCol(licenseInfo, 'checklist_template', 'checklist_tpl_db');
  const { items: logs, addRow: addLog, updateRow: updLog } = useTenantCol(licenseInfo, 'checklist_log', 'checklist_log_db');
  const [branchId, setBranchId] = useState(branchIdOf(licenseInfo));
  const [newLabel, setNewLabel] = useState('');
  const { actor, actorRole } = actorOf(licenseInfo);

  // Template disimpan sebagai SATU record dgn field key='default'
  // (cid dibuat otomatis oleh addRow, jadi kunci logika = key).
  const tpl = (tpls || []).find(t => t.key === 'default');
  const tplItems = tpl?.items || [
    { id: 'd1', label: 'Rapikan meja & display' },
    { id: 'd2', label: 'Cek kas awal (modal)' },
    { id: 'd3', label: 'Cek stok produk terlaris' },
  ];

  const todayK = new Date().toLocaleDateString('id-CA');
  const logKey = `${todayK}:${branchId}`;
  // Log harian dicari lewat field logKey, bukan cid.
  const log = (logs || []).find(l => l.logKey === logKey);
  const doneMap = {};
  (log?.items || []).forEach(li => { doneMap[li.label] = li; });

  const saveTpl = (items) => {
    if (tpl) updTpl(tpl.cid, { key: 'default', items });
    else addTpl({ key: 'default', items });
  };

  const addTplItem = () => {
    if (!newLabel.trim()) return triggerAlert('Tulis nama tugasnya dulu.', 'error');
    saveTpl([...tplItems, { id: nid('ck'), label: newLabel.trim() }]);
    setNewLabel('');
  };

  const toggleItem = (label) => {
    const items = tplItems.map(it => {
      const st = doneMap[it.label]?.done;
      return { label: it.label, done: it.label === label ? !st : !!st, by: it.label === label ? actor : (doneMap[it.label]?.by || null), at: it.label === label ? Date.now() : (doneMap[it.label]?.at || null) };
    });
    const rec = { logKey, dateKey: todayK, branchId, items, by: actor, at: Date.now() };
    if (log) updLog(log.cid, rec); else addLog(rec);
  };

  const doneCount = tplItems.filter(it => doneMap[it.label]?.done).length;
  const pct = tplItems.length ? Math.round((doneCount / tplItems.length) * 100) : 0;
  const branchName = (branches || []).find(b => b.cid === branchId)?.name || 'Pusat';

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toLocaleDateString('id-CA');
    const lg = (logs || []).find(l => l.logKey === `${k}:${branchId}`);
    const done = (lg?.items || []).filter(x => x.done).length;
    return { k, d, total: (lg?.items || []).length, done, pct: (lg?.items || []).length ? Math.round((done / lg.items.length) * 100) : null };
  });

  return (
    <div className="space-y-4">
      <Card title="Checklist Hari Ini" icon={ClipboardList}
        action={
          <Select value={branchId} onChange={setBranchId} className="!w-40"
            options={[{ value: 'PUSAT', label: 'Pusat' }, ...(branches || []).map(b => ({ value: b.cid, label: b.name || 'Cabang' }))]} />
        }
        help="Centang progres rutin buka/tutup toko. Riwayat 7 hari terakhir tampil di bawah.">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2.5 rounded-full bg-surface dark:bg-white/[.06] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-leaf' : 'bg-flame-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] font-extrabold shrink-0">{doneCount}/{tplItems.length} · {pct}%</span>
        </div>
        <div className="space-y-1.5">
          {tplItems.map(it => {
            const st = !!doneMap[it.label]?.done;
            return (
              <button key={it.id || it.label} onClick={() => toggleItem(it.label)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition press ${st ? 'border-leaf/40 bg-leaf-soft/40 dark:bg-leaf/10' : 'border-line dark:border-line-dark bg-paper dark:bg-white/[.03]'}`}>
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${st ? 'bg-leaf text-white' : 'bg-surface dark:bg-white/10 text-ink-faint'}`}>{st ? <Check className="w-3.5 h-3.5" /> : ''}</span>
                <div className="min-w-0 flex-1">
                  <p className={`font-extrabold text-[12.5px] truncate ${st ? 'line-through opacity-60' : ''}`}>{it.label}</p>
                  {st && doneMap[it.label]?.by && <p className="text-[9.5px] font-bold text-ink-faint">oleh {doneMap[it.label].by} · {fmtDT(doneMap[it.label].at || Date.now())}</p>}
                </div>
              </button>
            );
          })}
        </div>
        {canEdit && (
          <div className="flex gap-2 mt-3">
            <input className="field flex-1" placeholder="Tambah tugas rutin baru" value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTplItem(); }} />
            <Button onClick={addTplItem} className="!px-3"><Plus className="w-4 h-4" /></Button>
          </div>
        )}
      </Card>

      <Card title="7 Hari Terakhir" icon={Omzet} help={`Lokasi: ${branchName}`}>
        <div className="space-y-1.5">
          {last7.map(h => (
            <div key={h.k} className="flex items-center gap-3">
              <span className="text-[10.5px] font-extrabold text-ink-faint w-20 shrink-0">{fmtD(h.d.getTime())}</span>
              <div className="flex-1 h-2 rounded-full bg-surface dark:bg-white/[.06] overflow-hidden">
                <div className={`h-full rounded-full ${h.pct === 100 ? 'bg-leaf' : h.pct == null ? 'bg-line dark:bg-line-dark' : 'bg-gold'}`} style={{ width: `${h.pct == null ? 0 : Math.max(4, h.pct)}%` }} />
              </div>
              <span className="text-[10px] font-extrabold text-ink-faint w-14 text-right shrink-0">{h.pct == null ? 'kosong' : `${h.done}/${h.total}`}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

/* ============================================================
   TAB UTAMA
   ============================================================ */
export const PeoplePlusTab = ({ licenseInfo, triggerAlert, perms }) => {
  const [seg, setSeg] = useState('jadwal');
  const { items: karyawan } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: branches } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const canEdit = canDo(perms, 'employee.edit') || canDo(perms, 'employee.manage');

  return (
    <div className="space-y-5">
      <PageTitle title="Operasional Tim"
        sub="Jadwal shift, target omzet, pengumuman, dan checklist harian."
        right={<Segmented value={seg} onChange={setSeg} items={[
          { id: 'jadwal', label: 'Jadwal' },
          { id: 'target', label: 'Target' },
          { id: 'umum', label: 'Pengumuman' },
          { id: 'checklist', label: 'Checklist' },
        ]} />} />
      {seg === 'jadwal' && <JadwalPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} canEdit={canEdit} karyawan={karyawan} branches={branches} />}
      {seg === 'target' && <TargetPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} canEdit={canEdit} karyawan={karyawan} branches={branches} />}
      {seg === 'umum' && <AnnouncePanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} canEdit={canEdit} karyawan={karyawan} branches={branches} />}
      {seg === 'checklist' && <ChecklistPanel licenseInfo={licenseInfo} triggerAlert={triggerAlert} canEdit={canEdit} branches={branches} />}
    </div>
  );
};
