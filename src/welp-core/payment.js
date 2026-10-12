// ============================================================
// WELP CORE — WELP PAYMENT CORE v21.1 (spesifikasi #15–27)
// ------------------------------------------------------------
// Domain pembayaran milik WELP — TIDAK bergantung pada payment
// gateway pihak ketiga sebagai fondasi. Provider (bila ada) hanya
// ADAPTER opsional; sumber event masuk lewat abstraksi yang sama:
//
//   PaymentEventSource
//     ├── PWA_SIMULATOR                 (fase PWA sekarang)
//     ├── ANDROID_NOTIFICATION_BRIDGE   (fase native — abstraction)
//     ├── PROVIDER_WEBHOOK              (adapter opsional)
//     └── MANUAL                        (kasir/finance, ter-audit)
//
//   Semua masuk: Payment Event → Normalize → Validate → Dedup
//   → Match → Confirm/AMBIGUOUS → Ledger → Audit
//
// ATURAN INTI:
//   • PaymentIntent punya paymentReference UNIK — nominal BUKAN id.
//   • Dua order Rp25.000 = dua intent berbeda, tidak pernah tertukar.
//   • Nominal saja TIDAK PERNAH cukup utk auto-confirm (spec #19):
//     bukti lemah → PAYMENT_MATCH_AMBIGUOUS → review manual.
//   • 1 eventId hanya diproses SEKALI (idempotency, spec #21).
//   • PURE FUNCTION — tanpa React/Firestore; I/O di paymentOps.js.
// ============================================================

import { uid } from './tx.js';

// ------------------------------------------------------------
// 1. SUMBER EVENT & STATUS MATCH
// ------------------------------------------------------------
export const PAYMENT_EVENT_SOURCES = {
  PWA_SIMULATOR: 'PWA_SIMULATOR',
  ANDROID_NOTIFICATION_BRIDGE: 'ANDROID_NOTIFICATION_BRIDGE',
  PROVIDER_WEBHOOK: 'PROVIDER_WEBHOOK',
  MANUAL: 'MANUAL',
};

export const PAYMENT_EVENT_SOURCE_META = {
  PWA_SIMULATOR: { label: 'Simulator (PWA)', tone: 'blue', trusted: false },
  ANDROID_NOTIFICATION_BRIDGE: { label: 'Notification Bridge (Android)', tone: 'gold', trusted: false },
  PROVIDER_WEBHOOK: { label: 'Provider Webhook', tone: 'green', trusted: true },
  MANUAL: { label: 'Manual (ter-audit)', tone: 'grey', trusted: true },
};

export const MATCH_STATUS = {
  CONFIRMED: 'CONFIRMED',     // bukti kuat → auto-confirm
  AMBIGUOUS: 'AMBIGUOUS',     // bukti lemah → wajib review manual
  DUPLICATE: 'DUPLICATE',     // eventId sudah pernah diproses
  EXPIRED: 'EXPIRED',         // intent kedaluwarsa
  NO_MATCH: 'NO_MATCH',       // tidak ada kandidat → log utk rekonsiliasi
  REJECTED: 'REJECTED',       // ditolak manual
};

export const MATCH_STATUS_META = {
  CONFIRMED: { label: 'Terkonfirmasi', tone: 'green' },
  AMBIGUOUS: { label: 'Perlu Review (Ambigu)', tone: 'gold' },
  DUPLICATE: { label: 'Duplikat — diabaikan', tone: 'grey' },
  EXPIRED: { label: 'Intent Kedaluwarsa', tone: 'red' },
  NO_MATCH: { label: 'Tidak Ada Kandidat', tone: 'red' },
  REJECTED: { label: 'Ditolak', tone: 'red' },
};

// ------------------------------------------------------------
// 2. PAYMENT REFERENCE — identitas pembayaran unik (spec #18)
// ------------------------------------------------------------
// Nominal BUKAN identifier. Reference unik per intent, aman dari
// bentrokan lintas perangkat/cabang, dan muat di QRIS tag 62/07
// (Bill Number, maks ~25 char EMVCo).
export const newPaymentReference = () => uid('WELP').replace('WELP_', 'WELP-').toUpperCase();

// Fingerprint deterministik — fallback dedup bila eventId tidak ada.
export const eventFingerprint = (e) => [
  e?.source || '', e?.providerRef || '', e?.reference || '',
  Number(e?.amount) || 0, Number(e?.timestamp) || 0,
].join('|');

// ------------------------------------------------------------
// 3. PAYMENT EVENT — normalisasi semua sumber (spec #22)
// ------------------------------------------------------------
// Input mentah apa pun (simulator, notification bridge, webhook)
// dinormalkan ke SATU bentuk. Notification bridge (spec #23–24)
// mengirim teks notifikasi mentah — field `rawText` dipertahankan
// utk audit & matching berbasis teks di masa depan.
export const normalizePaymentEvent = (raw) => {
  const r = raw && typeof raw === 'object' ? raw : {};
  const amount = Math.round(Number(r.amount) || 0);
  return {
    eventId: String(r.eventId || '').trim() || uid('evt'),
    source: PAYMENT_EVENT_SOURCES[r.source] || PAYMENT_EVENT_SOURCES.PWA_SIMULATOR,
    // Bukti kuat (satu saja cukup):
    reference: String(r.reference || r.paymentReference || '').trim().toUpperCase() || null,
    providerRef: String(r.providerRef || r.transactionRef || '').trim() || null,
    // Konteks:
    amount,
    currency: String(r.currency || 'IDR'),
    method: String(r.method || 'QRIS'),
    merchantId: String(r.merchantId || '').trim() || null,
    timestamp: Number(r.timestamp) || Date.now(),
    rawText: r.rawText ? String(r.rawText).slice(0, 500) : null,
    device: r.device ? String(r.device).slice(0, 80) : null,
    note: r.note ? String(r.note).slice(0, 200) : null,
  };
};

// Validasi minimum sebelum diproses.
export const validatePaymentEvent = (event) => {
  if (!event.amount || event.amount <= 0) return { ok: false, reason: 'amount tidak valid' };
  const hasStrongEvidence = !!(event.reference || event.providerRef);
  if (!hasStrongEvidence && !event.rawText && event.source === PAYMENT_EVENT_SOURCES.MANUAL) {
    return { ok: false, reason: 'event manual tanpa referensi' };
  }
  return { ok: true, strong: hasStrongEvidence };
};

// ------------------------------------------------------------
// 4. PAYMENT INTENT — proyeksi dari order.payments[]
// ------------------------------------------------------------
// Intent TIDAK disimpan terpisah di klien: ia hidup di dalam
// payment record order (payments[].paymentReference dst). Proyeksi
// ini dipakai matching engine & UI. Order legacy tanpa reference
// tetap sah (reference = null → hanya bisa match manual).
export const intentOfPayment = (order, payment) => ({
  intentId: payment.intentId || payment.paymentId,
  paymentId: payment.paymentId,
  orderId: order.clientTransactionId || order.id,
  clientTransactionId: order.clientTransactionId || order.id,
  paymentReference: payment.paymentReference || null,
  amount: Number(payment.amount) || 0,
  method: payment.method || order.paymentMethod,
  status: payment.status || 'PENDING',
  branchId: order.branchId || null,
  stationCode: order.stationCode || null,
  merchantId: payment.merchantId || null,
  createdAt: payment.createdAt || order.createdAtMs || null,
  expiresAt: payment.expiresAt || null,
  confirmedAt: payment.confirmedAt || null,
  providerRef: payment.providerRef || null,
  eventId: payment.eventId || null,
});

export const collectIntents = (orders) => {
  const out = [];
  (orders || []).forEach(order => {
    // semua payment record QRIS/e-wallet PENDING + CONFIRMED
    normalizeOrderPayments(order).forEach(p => {
      if (p.method === 'Cash') return;                 // tunai tidak butuh intent
      out.push(intentOfPayment(order, p));
    });
  });
  return out;
};

// fallback normalizePayments ringan (hindari import silang dgn tx.js —
// tx.js diimport penuh oleh UI; di sini cukup bentuk minimal).
const normalizeOrderPayments = (order) => {
  if (!order) return [];
  if (Array.isArray(order.payments) && order.payments.length) return order.payments;
  if (!order.paymentMethod) return [];
  return [{
    paymentId: order.paymentId, method: order.paymentMethod,
    amount: Number(order.total) || 0,
    status: order.status === 'paid' ? 'CONFIRMED' : 'PENDING',
  }];
};

// ------------------------------------------------------------
// 5. MATCHING ENGINE (spec #19–20) — prioritas ketat
// ------------------------------------------------------------
//   1. paymentReference  (bukti kuat → auto-confirm)
//   2. providerRef       (bukti kuat → auto-confirm)
//   3. reference di dalam teks notifikasi (bridge) → auto-confirm
//   4. amount + method + window + merchant  (bukti LEMAH → AMBIGUOUS,
//      walau kandidatnya hanya satu — nominal tidak pernah cukup)
//
// Return { status: MATCH_STATUS, intent?, reason }
export const matchPaymentEvent = ({ event, intents, now = Date.now(), matchWindowMs = 24 * 3600e3 }) => {
  const ref = (event.reference || '').toUpperCase();
  const pref = (event.providerRef || '').toUpperCase();

  // 1) Reference match — bukti terkuat. intentDecision memutuskan
  //    PENDING → CONFIRMED / sudah final → DUPLICATE / expired → EXPIRED.
  if (ref) {
    const hit = intents.find(i => (i.paymentReference || '').toUpperCase() === ref);
    if (hit) return intentDecision(hit, event, now, `cocok paymentReference ${ref}`);
  }

  // 2) Provider transaction reference.
  if (pref) {
    const hit = intents.find(i => (i.providerRef || '').toUpperCase() === pref);
    if (hit) return intentDecision(hit, event, now, `cocok providerRef ${pref}`);
  }

  // 3) Reference tertanam dalam teks notifikasi (Android bridge).
  if (event.rawText && ref) {
    const hit = intents.find(i => (i.paymentReference || '').toUpperCase() === ref);
    if (hit) return intentDecision(hit, event, now, 'reference ditemukan dalam teks notifikasi');
  }

  // 4) Bukti lemah: amount (+method/merchant/window). TIDAK PERNAH
  //    auto-confirm — selalu AMBIGUOUS agar manusia memutuskan.
  const windowMs = matchWindowMs;
  const cands = intents.filter(i =>
    i.status === 'PENDING'
    && Number(i.amount) === event.amount
    && (i.expiresAt == null || i.expiresAt > now)
    && (i.createdAt == null || (event.timestamp - i.createdAt) < windowMs && (i.createdAt - event.timestamp) < windowMs)
    // merchant identity mempersempit TAPI tetap bukan bukti kuat:
    // dua order Rp25.000 di merchant sama tetap ambigu.
  );
  if (cands.length === 0) {
    // cek intent kedaluwarsa dgn nominal sama → EXPIRED lebih jelas
    const expired = intents.filter(i => Number(i.amount) === event.amount && i.expiresAt != null && i.expiresAt <= now && i.status === 'PENDING');
    if (expired.length) return { status: MATCH_STATUS.EXPIRED, intents: expired, reason: 'intent kedaluwarsa, nominal sama' };
    return { status: MATCH_STATUS.NO_MATCH, reason: 'tidak ada intent PENDING dgn nominal & window cocok' };
  }
  return {
    status: MATCH_STATUS.AMBIGUOUS,
    intents: cands,
    reason: `nominal sama dgn ${cands.length} order — butuh konfirmasi manual (nominal bukan identitas)`,
  };
};

const intentDecision = (intent, event, now, reason) => {
  if (intent.status !== 'PENDING') return { status: MATCH_STATUS.DUPLICATE, intent, reason: 'intent sudah diproses' };
  if (intent.expiresAt && intent.expiresAt < now) return { status: MATCH_STATUS.EXPIRED, intent, reason: 'intent kedaluwarsa' };
  // Dana masuk ≠ tagihan → jangan auto-confirm penuh; selisih wajib
  // review manusia (partial payment / salah nominal provider).
  if (Number(event.amount) !== Number(intent.amount)) {
    return { status: MATCH_STATUS.AMBIGUOUS, intents: [intent], reason: `reference cocok tapi dana masuk ${event.amount} ≠ tagihan ${intent.amount}` };
  }
  return { status: MATCH_STATUS.CONFIRMED, intent, reason };
};

// ------------------------------------------------------------
// 6. IDEMPOTENCY (spec #21) — satu event, satu konfirmasi
// ------------------------------------------------------------
// processedEvents: Map/objek { [eventId]: { processedAt, matchStatus } }
export const isDuplicateEvent = (event, processedEvents) => {
  if (!event?.eventId) return false;
  const rec = processedEvents?.[event.eventId];
  return !!rec && rec.matchStatus !== MATCH_STATUS.REJECTED; // reject boleh di-retrial manual
};

// ------------------------------------------------------------
// 7. APLIKASI HASIL MATCH KE ORDER (pure — tanpa I/O)
// ------------------------------------------------------------
// CONFIRMED → payment record jadi CONFIRMED + jejak event.
// Return order baru (immutable) atau null bila tidak berlaku.
export const applyMatchedEvent = (order, match, event, { actor = 'system', now = Date.now() } = {}) => {
  if (!order || match.status !== MATCH_STATUS.CONFIRMED || !match.intent) return null;
  const payments = (order.payments || []).map(p =>
    p.paymentId === match.intent.paymentId
      ? {
        ...p,
        status: 'CONFIRMED',
        paidAt: new Date(now).toISOString(),
        confirmedAt: now,
        providerRef: event.providerRef || p.providerRef || null,
        eventId: event.eventId,
        eventSource: event.source,
        matchedBy: match.reason,
        matchedAt: now,
        matchedActor: actor,
      }
      : p
  );
  return {
    ...order,
    payments,
    status: 'paid',
    paidAt: new Date(now).toISOString(),
    txState: 'PAYMENT_CONFIRMED',
    syncStatus: 'PENDING',
    _paidByEvent: { eventId: event.eventId, source: event.source, matchedBy: match.reason },
  };
};

// ------------------------------------------------------------
// 8. PWA PAYMENT EVENT SIMULATOR (spec #25)
// ------------------------------------------------------------
// Membangun event uji DARI intent nyata. Sumber eksplisit
// PWA_SIMULATOR — hasilnya ter-audit sbg simulasi, tidak pernah
// dianggap pembayaran nyata dari jaringan.
export const buildSimulatedEvent = ({ intent, amount, variant = 'exact', now = Date.now() }) => {
  const amt = Number(amount) || Number(intent.amount) || 0;
  const ev = {
    eventId: uid('evt'),
    source: PAYMENT_EVENT_SOURCES.PWA_SIMULATOR,
    amount: amt,
    method: intent.method || 'QRIS',
    timestamp: now,
    device: 'pwa-simulator',
    note: `simulasi ${variant}`,
  };
  if (variant === 'exact') {
    ev.reference = intent.paymentReference;          // bukti kuat → CONFIRMED
  } else if (variant === 'duplicateRef') {
    ev.reference = intent.paymentReference;
    ev.eventId = 'evt_fixed_dup_001';                // eventId sama → uji dedup
  } else if (variant === 'amountOnly') {
    // tanpa reference — uji aturan "nominal saja tidak cukup"
  } else if (variant === 'wrongAmount') {
    ev.amount = amt + 1000;
    ev.reference = intent.paymentReference;          // reference benar, dana beda → AMBIGUOUS (selisih wajib review)
  } else if (variant === 'differentRef') {
    ev.reference = newPaymentReference();            // reference tak dikenal → NO_MATCH
  }
  return ev;
};

// Batas umur intent QRIS (menit) — dipakai saat membuat payment record.
export const INTENT_TTL_MIN = 30;
export const intentExpiryOf = (createdAtMs = Date.now()) =>
  createdAtMs + INTENT_TTL_MIN * 60e3;
