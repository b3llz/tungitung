// ============================================================
// WELP CORE — PAYMENT OPS v21.1 (lapisan I/O klien)
// ------------------------------------------------------------
// Jembatan antara Payment Core (pure) dan persistence:
//   • ingestPaymentEvent()  — "WELP internal webhook" versi klien:
//     dipakai PWA Simulator sekarang & dapat dipanggil Native
//     Notification Bridge fallback nanti. Alur sama dgn endpoint
//     backend (functions/index.js → welpPaymentEvents):
//       Event → Normalize → Validate → Dedup → Match
//       → CONFIRMED: order LUNAS (commitFinanceDoc idempoten)
//       → AMBIGUOUS/NO_MATCH/EXPIRED: dicatat utk review (Finance)
//   • manualConfirmEvent()  — keputusan manusia atas event AMBIGUOUS
//     (permission payment.confirm, wajib alasan, ter-audit).
//   • buildIntentQris()     — QR dinamis + paymentReference di tag 62/07.
//
// Semua tulis finansial lewat OUTBOX idempoten (sync engine) —
// offline aman, retry aman, tidak ada jalur sync kedua.
// ============================================================
import { safeParse, auditLog } from '../core.jsx';
import { commitFinanceDoc } from './sync.js';
import {
  normalizePaymentEvent, validatePaymentEvent, matchPaymentEvent, applyMatchedEvent,
  isDuplicateEvent, collectIntents, MATCH_STATUS,
} from './payment.js';
import { TX_STATE } from './tx.js';

// ------------------------------------------------------------
// LEDGER EVENT — koleksi append-only per tenant (payment_event_db)
// ------------------------------------------------------------
export const readProcessedEvents = () => {
  const rows = safeParse('payment_event_db', []);
  const map = {};
  rows.forEach(e => { if (e?.eventId) map[e.eventId] = e; });
  return map;
};

const appendEventRecord = ({ tenantId, event, matchStatus, reason, intent = null, actor }) => {
  const rec = {
    id: event.eventId,
    eventId: event.eventId,
    source: event.source,
    reference: event.reference || null,
    providerRef: event.providerRef || null,
    amount: event.amount,
    method: event.method,
    merchantId: event.merchantId || null,
    timestamp: event.timestamp,
    rawText: event.rawText || null,
    note: event.note || null,
    matchStatus,
    reason: String(reason || '').slice(0, 300),
    orderId: intent?.orderId || null,
    orderTotal: intent ? Number(intent.amount) : null,
    branchId: intent?.branchId || null,
    actor: actor || null,
    processedAt: Date.now(),
    syncStatus: 'PENDING',
  };
  // Mirror + outbox append-only (doc id = eventId → dedup server juga).
  commitFinanceDoc({ tenantId, localKey: 'payment_event_db', docId: event.eventId, data: rec });
  return rec;
};

// ------------------------------------------------------------
// INGEST — satu pintu event pembayaran di sisi klien
// ------------------------------------------------------------
// orders: gabungan mirror aktif + riwayat (order pending QRIS bisa
// sudah ter-commit ke riwayat atau masih di active_orders).
export const ingestPaymentEvent = ({ tenantId, rawEvent, orders, actor, actorRole, licenseInfo }) => {
  const event = normalizePaymentEvent(rawEvent);
  const base = { tenantId, licenseInfo, actor, actorRole, event };

  // 1) Validasi bentuk
  const v = validatePaymentEvent(event);
  if (!v.ok) {
    appendEventRecord({ ...base, matchStatus: 'INVALID', reason: v.reason });
    return { status: 'INVALID', reason: v.reason, event };
  }

  // 2) IDEMPOTENCY — eventId sudah diproses? abaikan (spec #21).
  const processed = readProcessedEvents();
  if (isDuplicateEvent(event, processed)) {
    return { status: MATCH_STATUS.DUPLICATE, reason: 'eventId sudah pernah diproses', event, duplicate: true };
  }

  // 3) MATCHING ENGINE — hanya intent QRIS/e-wallet PENDING.
  const allOrders = (orders || []).filter(o => o && (o.txState !== TX_STATE.VOIDED) && (o.status !== 'cancelled'));
  const intents = collectIntents(allOrders);
  const match = matchPaymentEvent({ event, intents });

  // 4) Terapkan keputusan.
  if (match.status === MATCH_STATUS.CONFIRMED && match.intent) {
    const order = allOrders.find(o => (o.clientTransactionId || o.id) === match.intent.orderId);
    if (!order) {
      appendEventRecord({ ...base, matchStatus: MATCH_STATUS.NO_MATCH, reason: 'order intent tidak ditemukan', intent: match.intent });
      return { status: MATCH_STATUS.NO_MATCH, reason: 'order tidak ditemukan', event };
    }
    const paid = applyMatchedEvent(order, match, event, { actor: actor || 'system' });
    if (paid) {
      delete paid._paidByEvent;
      commitFinanceDoc({ tenantId, localKey: 'pos_history_db', docId: paid.clientTransactionId || paid.id, data: paid });
    }
    appendEventRecord({ ...base, matchStatus: MATCH_STATUS.CONFIRMED, reason: match.reason, intent: match.intent });
    auditLog(licenseInfo, 'PAYMENT_EVENT_CONFIRMED', {
      target: match.intent.orderId, eventId: event.eventId, source: event.source,
      reference: event.reference, providerRef: event.providerRef, amount: event.amount,
      matchedBy: match.reason,
    }, { actor, actorRole });
    return { status: MATCH_STATUS.CONFIRMED, order: paid, intent: match.intent, reason: match.reason, event };
  }

  // 5) AMBIGUOUS / NO_MATCH / EXPIRED / DUPLICATE → ledger + audit.
  appendEventRecord({ ...base, matchStatus: match.status, reason: match.reason, intent: Array.isArray(match.intents) ? match.intents[0] : (match.intent || null) });
  auditLog(licenseInfo, 'PAYMENT_EVENT_' + match.status, {
    eventId: event.eventId, source: event.source, reference: event.reference,
    providerRef: event.providerRef, amount: event.amount, alasan: match.reason,
  }, { actor, actorRole });
  return { status: match.status, reason: match.reason, event, intents: match.intents };
};

// ------------------------------------------------------------
// REVIEW MANUAL event AMBIGUOUS (permission: payment.confirm)
// ------------------------------------------------------------
export const manualConfirmEvent = ({ tenantId, licenseInfo, eventRec, order, actor, actorRole, note }) => {
  if (!eventRec?.eventId) return { ok: false, reason: 'event tidak valid' };
  if (!order) return { ok: false, reason: 'order tujuan tidak ditemukan' };

  const now = Date.now();
  const payments = (order.payments || []).map(p =>
    p.paymentId === eventRec.matchPaymentId || (eventRec.orderId && (order.clientTransactionId || order.id) === eventRec.orderId && p.status === 'PENDING' && p.method !== 'Cash')
      ? {
        ...p,
        status: 'CONFIRMED',
        paidAt: new Date(now).toISOString(),
        confirmedAt: now,
        providerRef: eventRec.providerRef || p.providerRef || ('MANUAL-' + eventRec.eventId),
        eventId: eventRec.eventId,
        eventSource: eventRec.source,
        matchedBy: 'manual review' + (note ? `: ${note}` : ''),
        matchedAt: now, matchedActor: actor,
      }
      : p
  );
  const paid = {
    ...order, payments, status: 'paid',
    paidAt: new Date(now).toISOString(),
    txState: TX_STATE.PAYMENT_CONFIRMED, syncStatus: 'PENDING',
  };
  commitFinanceDoc({ tenantId, localKey: 'pos_history_db', docId: paid.clientTransactionId || paid.id, data: paid });
  commitFinanceDoc({
    tenantId, localKey: 'payment_event_db', docId: eventRec.eventId,
    data: { ...eventRec, matchStatus: MATCH_STATUS.CONFIRMED, confirmedBy: actor, confirmedAt: now, confirmNote: String(note || '').slice(0, 200), syncStatus: 'PENDING' },
  });
  auditLog(licenseInfo, 'PAYMENT_MANUAL_CONFIRM', {
    target: paid.clientTransactionId || paid.id, eventId: eventRec.eventId,
    amount: eventRec.amount, alasan: note || '-',
  }, { actor, actorRole });
  return { ok: true, order: paid };
};

export const rejectEvent = ({ tenantId, licenseInfo, eventRec, actor, actorRole, reason }) => {
  if (!eventRec?.eventId) return { ok: false, reason: 'event tidak valid' };
  commitFinanceDoc({
    tenantId, localKey: 'payment_event_db', docId: eventRec.eventId,
    data: { ...eventRec, matchStatus: MATCH_STATUS.REJECTED, rejectedBy: actor, rejectedAt: Date.now(), rejectReason: String(reason || '').slice(0, 200), syncStatus: 'PENDING' },
  });
  auditLog(licenseInfo, 'PAYMENT_EVENT_REJECTED', {
    eventId: eventRec.eventId, amount: eventRec.amount, alasan: reason || '-',
  }, { actor, actorRole });
  return { ok: true };
};

// ------------------------------------------------------------
// INTENT BARU pada order QRIS (dipakai pos.jsx saat checkout)
// ------------------------------------------------------------
export const paymentRecWithIntent = ({ paymentRec, merchantId, createdAtMs }) => ({
  ...paymentRec,
  intentId: 'pin_' + (paymentRec.paymentId || ''),
  paymentReference: paymentRec.paymentReference,   // dibuat pemanggil dgn newPaymentReference()
  merchantId: merchantId || null,
  createdAt: createdAtMs,
  expiresAt: createdAtMs + 30 * 60e3,              // INTENT_TTL_MIN 30 (payment.js)
});

// -----------------------------------------------------------
// QRIS DINAMIS + REFERENCE dibangun di core.jsx (buildIntentQris)
// di samping helper EMVCo yang sama (parseEmv/crc16CCITT) agar
// tidak ada duplikasi logika TLV.
// ------------------------------------------------------------
