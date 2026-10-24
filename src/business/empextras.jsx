// ============================================================
// WELP v21.4, EMPLOYEE AREA EXTRAS
// ------------------------------------------------------------
// Kartu tambahan di beranda Employee Area (dilihat karyawan):
//   1. PENGUMUMAN  , siaran internal, ada tanda BELUM DIBACA.
//   2. JADWAL SAYA , shift minggu ini milik karyawan.
//   3. POIN SAYA   , poin loyalitas pribadi + tier.
//   4. TARGET SAYA , target omzet bulan ini utk cabang/kasir.
// Semua READ-ONLY: karyawan tidak bisa mengubah data manajemen.
// ============================================================
import React, { useState, useMemo, useEffect } from 'react';
import {
  RoketBuddy, Absensi, KoinBuddy, ClipboardList, Check, Tim,
} from '../welp-icons.jsx';
import { formatIDR, useTenantCol, safeParse } from '../core.jsx';
import { countsAsSale, netTotalOf } from '../welp-core/tx.js';
import { Card, Badge, EmptyState } from '../ui';
import { fmtDT, tierOf, loyaltyCfgOf, DEFAULT_LOYALTY, SHIFT_MAP, DAY_LABELS, monthKeyOf } from './kit.js';

const audienceMatch = (aud, session) => {
  if (!aud || aud === 'ALL') return true;
  if (aud.startsWith('role:')) return session?.role && aud.slice(5) === session.role;
  if (aud.startsWith('branch:')) return session?.branchId && aud.slice(7) === session.branchId;
  return false;
};

const readKeyOf = (session) => `welp_announce_read_${session?.employeeCid || session?.empId || 'anon'}`;

export const EmpExtras = ({ session }) => {
  if (!session?.lic) return null;
  return (
    <div className="space-y-4 mt-4">
      <AnnounceCard session={session} />
      <ScheduleCard session={session} />
      <PoinCard session={session} />
      <TargetCard session={session} />
    </div>
  );
};

/* ---------- PENGUMUMAN ---------- */
const AnnounceCard = ({ session }) => {
  const { items: anns } = useTenantCol({ id: session.lic }, 'pengumuman', 'announce_db');
  const rk = readKeyOf(session);
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(rk) || '[]'); } catch (e) { return []; }
  });

  const mine = useMemo(() => (anns || [])
    .filter(a => audienceMatch(a.audience, session))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6), [anns, session]);

  const unread = mine.filter(a => !readIds.includes(a.cid));

  // Tandai terbaca otomatis saat kartu terlihat (dengan jeda singkat
  // agar badge "belum dibaca" tetap terasa di buka pertama).
  useEffect(() => {
    if (!unread.length) return;
    const t = setTimeout(() => {
      const next = [...new Set([...readIds, ...unread.map(a => a.cid)])].slice(-80);
      setReadIds(next);
      try { localStorage.setItem(rk, JSON.stringify(next)); } catch (e) { }
    }, 2500);
    return () => clearTimeout(t);
  }, [unread.length]);

  if (mine.length === 0) return null;
  return (
    <Card title="Pengumuman" icon={ClipboardList}
      action={unread.length > 0 ? <Badge tone="red">{unread.length} baru</Badge> : <Badge tone="green">Sudah dibaca</Badge>}>
      <div className="space-y-2">
        {mine.map(a => {
          const isNew = !readIds.includes(a.cid);
          return (
            <div key={a.cid} className={`p-3 rounded-2xl border ${isNew ? 'border-flame-300 dark:border-flame-800 bg-flame-50/50 dark:bg-flame-900/10' : 'border-line dark:border-line-dark bg-paper dark:bg-white/[.03]'}`}>
              <p className="font-extrabold text-[12.5px]">
                {a.pinned ? <Badge tone="gold">PENTING</Badge> : null} {a.title}
                {isNew && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-flame-500 align-middle" />}
              </p>
              <p className="text-[11.5px] font-bold text-ink-soft dark:text-ink-inv/70 mt-1 whitespace-pre-wrap">{a.body}</p>
              <p className="text-[9px] font-extrabold text-ink-faint mt-1.5 uppercase tracking-wider">oleh {a.by} · {fmtDT(a.createdAt || Date.now())}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

/* ---------- JADWAL SAYA ---------- */
const ScheduleCard = ({ session }) => {
  const { items: schedules } = useTenantCol({ id: session.lic }, 'jadwal_shift', 'schedule_db');
  const wk = useMemo(() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
    const year = thursday.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const week1Monday = new Date(year, 0, 1 - ((jan1.getDay() + 6) % 7));
    const week = Math.floor((monday - week1Monday) / 604800000) + 1;
    return `${year}-W${String(week).padStart(2, '0')}`;
  }, []);
  const rec = (schedules || []).find(s => s.weekKey === wk);
  const myRow = rec?.entries?.[session.employeeCid] || null;

  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayShift = myRow ? (SHIFT_MAP[myRow[todayIdx]] || SHIFT_MAP.L) : null;

  return (
    <Card title="Jadwal Shift Minggu Ini" icon={Absensi}
      action={todayShift ? <Badge tone={todayShift.k === 'L' ? 'neutral' : 'green'}>Hari ini: {todayShift.label}</Badge> : null}>
      {!myRow ? (
        <p className="text-[11px] font-bold text-ink-faint">Belum ada jadwal minggu ini. Owner/Manager akan menerbitkan jadwal di menu Operasional Tim.</p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS.map((d, i) => {
            const meta = SHIFT_MAP[myRow[i]] || SHIFT_MAP.L;
            const isToday = i === todayIdx;
            return (
              <div key={i} className={`flex flex-col items-center gap-1 py-1.5 rounded-xl border ${meta.cls} ${isToday ? 'ring-2 ring-flame-500' : ''}`}>
                <span className="text-[8.5px] font-extrabold opacity-70">{d}</span>
                <span className="text-[9.5px] font-extrabold">{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

/* ---------- POIN SAYA (LOYALITAS PRIBADI) ---------- */
const PoinCard = ({ session }) => {
  const { items: customers } = useTenantCol({ id: session.lic }, 'customers', 'customers_db');
  const { items: cfgRows } = useTenantCol({ id: session.lic }, 'loyalty_cfg', 'loyalty_cfg_db');
  const cfg = loyaltyCfgOf(cfgRows);
  // Poin karyawan dipakai saat dia sendiri berbelanja (nama terdaftar di CRM).
  const me = (customers || []).find(c =>
    String(c.name || '').trim().toLowerCase() === String(session.employeeName || '').trim().toLowerCase());
  const tier = tierOf(Number(me?.lifetimeSpend || 0), cfg || DEFAULT_LOYALTY);
  if (!me) return null;
  return (
    <Card title="Poin Member Saya" icon={KoinBuddy}
      action={<Badge tone={tier === 'Bronze' ? 'neutral' : 'gold'}>{tier}</Badge>}>
      <div className="flex items-center gap-4">
        <div>
          <p className="text-2xl font-extrabold money">{Number(me.poin || 0).toLocaleString('id-ID')}</p>
          <p className="text-[9.5px] font-extrabold text-ink-faint uppercase tracking-wider">poin tersedia</p>
        </div>
        <div className="flex-1 text-right">
          <p className="text-[12px] font-extrabold">{formatIDR(Number(me.lifetimeSpend || 0))}</p>
          <p className="text-[9.5px] font-extrabold text-ink-faint uppercase tracking-wider">akumulasi belanja</p>
        </div>
      </div>
      <p className="text-[10px] font-bold text-ink-faint mt-2">Poin otomatis terkumpul saat namamu dipilih kasir saat checkout. Tukar jadi potongan harga di kasir.</p>
    </Card>
  );
};

/* ---------- TARGET SAYA ---------- */
const TargetCard = ({ session }) => {
  const { items: targets } = useTenantCol({ id: session.lic }, 'target_omzet', 'target_db');
  const history = safeParse('pos_history_db', []);
  const mk = monthKeyOf();

  const myTargets = useMemo(() => (targets || []).filter(t => t.monthKey === mk && (
    (t.scope === 'branch' && t.refId === session.branchId) ||
    (t.scope === 'employee' && (String(t.refId) === String(session.employeeCid) || t.refName === session.employeeName))
  )).slice(0, 3), [targets, mk, session]);

  const achievedBranch = (refId) => history.reduce((a, t) => {
    if (!countsAsSale(t) || (t.branchId || 'PUSAT') !== refId) return a;
    const ms = t.date ? new Date(t.date).getTime() : 0;
    return monthKeyOf(ms) === mk ? a + netTotalOf(t) : a;
  }, 0);
  const achievedMe = () => history.reduce((a, t) => {
    if (!countsAsSale(t)) return a;
    if (!(String(t.employeeId || '') === String(session.employeeCid) || t.employeeName === session.employeeName)) return a;
    const ms = t.date ? new Date(t.date).getTime() : 0;
    return monthKeyOf(ms) === mk ? a + netTotalOf(t) : a;
  }, 0);

  if (myTargets.length === 0) return null;
  return (
    <Card title="Target Bulan Ini" icon={RoketBuddy}>
      <div className="space-y-3">
        {myTargets.map(t => {
          const ach = t.scope === 'branch' ? achievedBranch(t.refId) : achievedMe();
          const pct = Math.min(100, Math.round((ach / Math.max(1, Number(t.amount))) * 100));
          return (
            <div key={t.cid}>
              <div className="flex justify-between text-[10.5px] font-extrabold mb-1">
                <span>{t.scope === 'branch' ? 'Target cabang' : 'Target pribadi'}</span>
                <span className="text-ink-faint">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface dark:bg-white/[.06] overflow-hidden">
                <div className={`h-full rounded-full ${pct >= 100 ? 'bg-leaf' : 'bg-flame-500'}`} style={{ width: `${Math.max(3, pct)}%` }} />
              </div>
              <p className="text-[10px] font-bold text-ink-faint mt-1">{formatIDR(ach)} dari {formatIDR(t.amount)}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
