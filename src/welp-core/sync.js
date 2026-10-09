// ============================================================
// WELP CORE — CENTRALIZED SYNC ENGINE v21
// ------------------------------------------------------------
// Satu lapisan sinkronisasi untuk semua mutasi finansial kasir
// (transaksi, void, refund, settlement, shift, kas). Semua tulis
// melewati OUTBOX: UI → mirror lokal (instan) → outbox → Firestore.
//
// JAMINAN:
//   • IDEMPOTENT  : docId Firestore = clientTransactionId/entity id.
//     Flush berkali-kali menulis dokumen yang sama → tidak pernah
//     menghasilkan duplikat (double-tap BAYAR, retry, dua perangkat).
//   • OFFLINE-FIRST: mirror localStorage ditulis dulu (UI tetap
//     jalan tanpa internet), outbox bertahan di localStorage,
//     retry otomatis dengan exponential backoff saat online.
//   • SATU ENGINE : tidak ada sync logic tersebar di komponen.
//     Komponen hanya: commitFinanceDoc() + useSyncStatus().
//
// STATUS QUEUE: PENDING → SYNCING → SYNCED | FAILED (retry)
// STATUS UI  : ONLINE / OFFLINE / SYNCING / SYNC ERROR / SYNCED
// ============================================================
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../core.jsx';

// ------------------------------------------------------------
// 1. PETA KOLEKSI ↔ MIRROR LOKAL (sejalan DB_MAP di core.jsx)
// ------------------------------------------------------------
export const FIN_COLLECTIONS = {
  settlement_db: 'settlements',
  shift_log_db: 'shift_log',
  cash_event_db: 'cash_events',
  pos_history_db: 'pos_history',
  active_orders_db: 'orders',
  // v21.1 — WELP Payment Core
  payment_event_db: 'payment_events',
  payment_intent_db: 'payment_intents',
};
const LOCAL_KEY_BY_COL = Object.fromEntries(Object.entries(FIN_COLLECTIONS).map(([k, v]) => [v, k]));

// ------------------------------------------------------------
// 2. OUTBOX — antrean persist di localStorage
// ------------------------------------------------------------
const outboxKey = (tenantId) => `welp_outbox_${tenantId || 'unknown'}`;
const EVT = 'welp_sync_evt';

const readOutbox = (tenantId) => {
  try { return JSON.parse(localStorage.getItem(outboxKey(tenantId)) || '[]'); } catch (e) { return []; }
};
const writeOutbox = (tenantId, ops) => {
  try { localStorage.setItem(outboxKey(tenantId), JSON.stringify(ops.slice(-400))); } catch (e) { /* penuh: biarkan */ }
};
export const fireSyncEvt = () => { try { window.dispatchEvent(new Event(EVT)); } catch (e) { } };

// Backoff eksponensial (detik): 5 → 15 → 45 → 2m → 5m → 15m (cap).
const BACKOFF_S = [5, 15, 45, 120, 300, 900];
const nextBackoffMs = (attempts) => (BACKOFF_S[Math.min(attempts, BACKOFF_S.length - 1)] || 900) * 1000;

// ------------------------------------------------------------
// 3. NETWORK DETECTION
// ------------------------------------------------------------
let _online = typeof navigator !== 'undefined' ? navigator.onLine : true;
export const isOnline = () => _online;
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { _online = true; fireSyncEvt(); flushAllDue(); });
  window.addEventListener('offline', () => { _online = false; fireSyncEvt(); });
}

// ------------------------------------------------------------
// 4. MIRROR UPSERT — UI instan tanpa menunggu server
// ------------------------------------------------------------
// Setiap record finansial PUNYA field `id` = docId Firestore.
export const upsertMirror = (localKey, rec) => {
  if (!localKey || !rec?.id) return;
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) { }
  const i = rows.findIndex(r => String(r.id ?? r.cid) === String(rec.id));
  if (i >= 0) rows[i] = { ...rows[i], ...rec };
  else rows.unshift(rec);
  try { localStorage.setItem(localKey, JSON.stringify(rows)); } catch (e) { }
  try { window.dispatchEvent(new Event('welp_db_sync')); } catch (e) { }
};

// ------------------------------------------------------------
// 5. COMMIT — pintu masuk tunggal mutasi finansial
// ------------------------------------------------------------
// commitFinanceDoc({ tenantId, localKey, docId, data })
//   1. mirror lokal instan (UI langsung terlihat)
//   2. enqueue outbox (tahan offline)
//   3. flush segera bila online
// Dedup: op dengan (docId+type) yang masih PENDING diganti payload-nya.
export const commitFinanceDoc = ({ tenantId, localKey, docId, data }) => {
  if (!tenantId || !docId || !data) throw new Error('commitFinanceDoc: parameter kurang.');
  upsertMirror(localKey, data);

  const ops = readOutbox(tenantId);
  const idx = ops.findIndex(o => o.docId === docId && o.localKey === localKey && ['PENDING', 'FAILED'].includes(o.status));
  const op = {
    opId: (idx >= 0 ? ops[idx].opId : `op_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`),
    type: 'SET_DOC',
    tenantId, localKey,
    col: FIN_COLLECTIONS[localKey] || 'pos_history',
    docId,
    payload: data,
    queuedAt: Date.now(),
    attempts: idx >= 0 ? ops[idx].attempts : 0,
    nextAt: Date.now(),
    status: 'PENDING',
    error: null, syncedAt: null,
  };
  if (idx >= 0) ops[idx] = op; else ops.push(op);
  writeOutbox(tenantId, ops);
  fireSyncEvt();
  flushAllDue();                    // online → langsung kirim
  return op;
};

// ------------------------------------------------------------
// 6. FLUSH — kirim antrean (idempotent, backoff, aman dipanggil bebas)
// ------------------------------------------------------------
let _flushing = false;
export const flushAllDue = async () => {
  if (_flushing || !db) return;
  _flushing = true;
  try {
    const tenantIds = new Set();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('welp_outbox_')) tenantIds.add(k.slice('welp_outbox_'.length));
      }
    } catch (e) { }
    for (const t of tenantIds) await flushTenant(t);
  } finally { _flushing = false; fireSyncEvt(); }
};

const flushTenant = async (tenantId) => {
  if (!isOnline()) return;
  const ops = readOutbox(tenantId);
  let changed = false;
  const due = ops.filter(o => o.status !== 'SYNCED' && (o.status === 'PENDING' || (o.status === 'FAILED' && (o.nextAt || 0) <= Date.now())));
  for (const op of due) {
    op.status = 'SYNCING'; changed = true;
    try {
      await setDoc(doc(db, 'tenants', tenantId, op.col, op.docId), { ...op.payload, serverAt: serverTimestamp() }, { merge: true });
      op.status = 'SYNCED'; op.syncedAt = Date.now(); op.error = null;
      // v21: perbarui status sinkron di mirror agar badge per-transaksi akurat.
      upsertMirror(op.localKey, { id: op.docId, syncStatus: 'SYNCED', syncedAt: Date.now() });
      try {
        const cur = JSON.parse(localStorage.getItem('welp_sync_last') || '{}');
        localStorage.setItem('welp_sync_last', JSON.stringify({ ...cur, [tenantId]: Date.now() }));
      } catch (e) { }
    } catch (err) {
      // Bukan error final (mis. permission sementara / jaringan putus) → retry.
      op.status = 'FAILED';
      op.attempts = (op.attempts || 0) + 1;
      op.nextAt = Date.now() + nextBackoffMs(op.attempts);
      op.error = String(err?.code || err?.message || 'gagal sinkron');
      upsertMirror(op.localKey, { id: op.docId, syncStatus: 'FAILED', syncError: op.error });
    }
    changed = true;
  }
  if (changed) {
    // Simpan SYNCED maksimal 200 terakhir (jejak ringan), buang sisanya.
    const synced = ops.filter(o => o.status === 'SYNCED').slice(-200);
    const rest = ops.filter(o => o.status !== 'SYNCED');
    writeOutbox(tenantId, [...rest, ...synced]);
    fireSyncEvt();
  }
};

export const forceFlush = () => flushAllDue();

// ------------------------------------------------------------
// 7. HOOK STATUS — satu pintu UI (POS badge, Finance, Home)
// ------------------------------------------------------------
import { useState, useEffect } from 'react';

export const useSyncStatus = (tenantId) => {
  const [st, setSt] = useState(() => snapshotStatus(tenantId));
  useEffect(() => {
    const h = () => setSt(snapshotStatus(tenantId));
    window.addEventListener(EVT, h);
    window.addEventListener('welp_db_sync', h);
    const iv = setInterval(() => { flushAllDue(); }, 30000);   // denyut per 30s
    return () => { window.removeEventListener(EVT, h); window.removeEventListener('welp_db_sync', h); clearInterval(iv); };
  }, [tenantId]);
  return st;
};

export const snapshotStatus = (tenantId) => {
  const ops = readOutbox(tenantId);
  const pending = ops.filter(o => o.status === 'PENDING' || o.status === 'FAILED').length;
  const syncing = ops.some(o => o.status === 'SYNCING');
  const failed = ops.filter(o => o.status === 'FAILED').length;
  let lastSyncAt = 0;
  try { lastSyncAt = (JSON.parse(localStorage.getItem('welp_sync_last') || '{}')[tenantId]) || 0; } catch (e) { }
  const online = isOnline();
  let state = 'ONLINE';
  if (!online) state = 'OFFLINE';
  else if (syncing) state = 'SYNCING';
  else if (failed > 0) state = 'SYNC_ERROR';
  else if (pending > 0) state = 'SYNCING';
  return { online, pending, failed, syncing, lastSyncAt, state };
};

export const SYNC_STATE_META = {
  ONLINE:     { label: 'Online',           tone: 'green' },
  OFFLINE:    { label: 'Offline — antrean lokal aktif', tone: 'gold' },
  SYNCING:    { label: 'Menyinkronkan…',   tone: 'blue' },
  SYNC_ERROR: { label: 'Sinkron gagal — diulang otomatis', tone: 'red' },
};
