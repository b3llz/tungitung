const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast2', maxInstances: 20 });

const db = admin.firestore();
const auth = admin.auth();

// ============================================================
// WELP CORE BACKEND v20
// ------------------------------------------------------------
// v20 PERUBAHAN:
//  1. ROLE CUSTOM — whitelist ROLES lama dihapus; role kini key
//     bebas [a-z0-9_-]{2,32} buatan Owner (Area Manager, HRD,
//     Accounting, Auditor, dst). Yang tetap dikunci: PERMISSIONS
//     whitelist (superset granular v20).
//  2. SCOPE ORGANISASI — claims baru: welpRegions[], welpBranches[],
//     welpDepartment, welpScope ('org'|'region'|'branch'|'self')
//     → dipakai Firestore Rules & getWelpSession untuk scope
//     Pusat → Region → Cabang.
//  3. updateWelpUserAssignment — callable agar Owner/Direktur
//     mengganti assignment user (role/region/cabang/department)
//     TANPA menyentuh password & TANPA membuat ulang cabang;
//     penuh audit trail. Inilah alur "Area Manager resign/pindah
//     wilayah → pusat cukup mengganti assignment".
// ============================================================

const PERMISSIONS = new Set([
  // legacy v18 keys (kompatibilitas claims lama)
  'dashboard.read', 'sales.read', 'sales.write', 'sales.refund',
  'inventory.read', 'inventory.write', 'inventory.adjust',
  'employee.read', 'employee.write', 'attendance.read', 'attendance.write',
  'payroll.read', 'payroll.write', 'payroll.approve',
  'finance.read', 'finance.write', 'reports.read', 'settings.read', 'settings.write',
  'audit.read', 'company.manage', 'branch.manage',
  // v20 granular keys (serverPermKeys di welp-core/rbac.js)
  'employee.self',
  'dashboard.view',
  'pos.view', 'pos.use',
  'product.view', 'product.create', 'product.edit', 'product.delete', 'product.manage', 'product.export',
  'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.adjust', 'inventory.manage', 'inventory.export',
  'purchasing.view', 'purchasing.create', 'purchasing.edit', 'purchasing.delete', 'purchasing.manage', 'purchasing.export',
  'crm.view', 'crm.create', 'crm.edit', 'crm.delete', 'crm.manage', 'crm.export',
  'finance.view', 'finance.create', 'finance.edit', 'finance.delete', 'finance.manage', 'finance.export',
  'report.view', 'report.export',
  'attendance.view', 'attendance.manage', 'attendance.approve', 'attendance.export', 'attendance.write',
  'payroll.view', 'payroll.create', 'payroll.edit', 'payroll.delete', 'payroll.approve', 'payroll.manage', 'payroll.export',
  'employee.view', 'employee.create', 'employee.edit', 'employee.delete', 'employee.manage', 'employee.export',
  'branch.view', 'branch.create', 'branch.edit', 'branch.delete', 'branch.manage',
  'org.view', 'org.create', 'org.edit', 'org.delete', 'org.manage',
  'approval.view', 'approval.approve',
  'audit.view', 'audit.export',
  'roles.view', 'roles.manage',
  'settings.view', 'settings.manage',
  'refund.perform',
  // v21 granular keys (domain finansial kasir) — selaras welp-core/rbac.js
  'transaction.view', 'transaction.create', 'transaction.void', 'transaction.refund',
  'payment.view', 'payment.confirm', 'payment.manage',
  'settlement.view', 'settlement.manage',
  'reconciliation.view',
  'shift.open', 'shift.close', 'shift.view',
]);

const ROLE_KEY_RE = /^[a-z0-9_-]{2,32}$/;
const SCOPE_TYPES = new Set(['org', 'region', 'branch', 'self']);

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login diperlukan.');
  return request.auth;
}

function cleanPermissions(list) {
  return Array.isArray(list) ? [...new Set(list.filter(p => PERMISSIONS.has(p)))].slice(0, 120) : [];
}

function cleanIdList(list, max = 60) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(x => String(x || '').trim()).filter(x => x && x.length <= 120))].slice(0, max);
}

function requireProvisioner(authContext) {
  const email = String(authContext.token.email || '').toLowerCase();
  const verified = authContext.token.email_verified === true;
  const canProvision = authContext.token.welpCanProvision === true;
  if (!verified || (!canProvision && !email)) {
    throw new HttpsError('permission-denied', 'Akun tidak memiliki hak provisioning.');
  }
  // Bootstrap allowlist is intentionally explicit. Replace with a trusted
  // admin claim before enabling this in production.
  const allowlist = String(process.env.WELP_BOOTSTRAP_EMAILS || '')
    .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!canProvision && !allowlist.includes(email)) {
    throw new HttpsError('permission-denied', 'Akun tidak terdaftar sebagai administrator provisioning.');
  }
}

// Bangun claims lengkap (v20) dari input tervalidasi.
function claimsFor({ tenant, role, branch = null, permissions = [], regions = [], branches = [], department = null, scope = 'org' }) {
  const scopeType = SCOPE_TYPES.has(scope) ? scope : 'org';
  return {
    welpTenant: tenant,
    welpRole: role,
    welpBranch: branch || null,
    welpRegions: cleanIdList(regions),
    welpBranches: cleanIdList(branches),
    welpDepartment: department ? String(department).slice(0, 60) : null,
    welpScope: scopeType,
    welpPermissions: cleanPermissions(permissions),
    welpCanDelete: ['owner', 'direktur', 'director'].includes(role),
    welpClaimsVersion: 3,
    welpDisabled: false
  };
}

async function writeAudit(tenant, payload) {
  try {
    await db.collection('tenants').doc(tenant).collection('audit_log').add({
      ...payload,
      serverAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) { /* audit best-effort */ }
}

exports.setWelpUserClaims = onCall(async (request) => {
  const caller = requireAuth(request);
  requireProvisioner(caller);
  const data = request.data || {};
  const uid = String(data.uid || '').trim();
  const tenant = String(data.tenant || '').trim();
  const role = String(data.role || '').trim().toLowerCase();
  const branch = data.branch == null ? null : String(data.branch).trim();
  const permissions = cleanPermissions(data.permissions);

  if (!uid || !tenant) {
    throw new HttpsError('invalid-argument', 'uid dan tenant wajib diisi.');
  }
  if (!ROLE_KEY_RE.test(role)) {
    throw new HttpsError('invalid-argument', 'Role key tidak valid (2-32 karakter, huruf kecil/angka/_/-).');
  }
  if (tenant.length > 120 || !/^[A-Za-z0-9_-]+$/.test(tenant)) {
    throw new HttpsError('invalid-argument', 'Tenant ID tidak valid.');
  }

  const target = await auth.getUser(uid);
  if (!target.email || target.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Akun target harus memiliki email terverifikasi.');
  }

  const claims = claimsFor({
    tenant, role, branch, permissions,
    regions: data.regions, branches: data.branches,
    department: data.department || null,
    scope: data.scope || (Array.isArray(data.regions) && data.regions.length ? 'region' : 'org'),
  });
  await auth.setCustomUserClaims(uid, claims);

  await writeAudit(tenant, {
    action: 'AUTH_CLAIMS_UPDATED',
    targetUid: uid,
    targetEmail: target.email,
    role,
    branch,
    regions: claims.welpRegions,
    branches: claims.welpBranches,
    scope: claims.welpScope,
    permissionCount: permissions.length,
    actorUid: caller.uid,
    actorEmail: caller.token.email || null,
  });

  return { ok: true, uid, tenant, role, branch, scope: claims.welpScope, permissionCount: permissions.length };
});



exports.createWelpIdentity = onCall(async (request) => {
  const caller = requireAuth(request);
  requireProvisioner(caller);
  const data = request.data || {};
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  const tenant = String(data.tenant || '').trim();
  const role = String(data.role || 'owner').trim().toLowerCase();
  const branch = data.branch == null ? null : String(data.branch).trim();
  const permissions = cleanPermissions(data.permissions);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'Email akun tidak valid.');
  if (password.length < 8) throw new HttpsError('invalid-argument', 'Password akun minimal 8 karakter.');
  if (!tenant) throw new HttpsError('invalid-argument', 'Tenant wajib diisi.');
  if (!ROLE_KEY_RE.test(role)) throw new HttpsError('invalid-argument', 'Role key tidak valid (2-32 karakter, huruf kecil/angka/_/-).');

  let user;
  try {
    user = await auth.getUserByEmail(email);
    if (user.disabled) await auth.updateUser(user.uid, { disabled: false });
    user = await auth.getUser(user.uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({ email, password, emailVerified: false });
  }

  const claims = claimsFor({
    tenant, role, branch, permissions,
    regions: data.regions, branches: data.branches,
    department: data.department || null,
    scope: data.scope || (Array.isArray(data.regions) && data.regions.length ? 'region' : 'org'),
  });
  await auth.updateUser(user.uid, { password });
  await auth.setCustomUserClaims(user.uid, claims);
  await writeAudit(tenant, {
    action: 'AUTH_IDENTITY_PROVISIONED', targetUid: user.uid, targetEmail: email,
    role, branch, regions: claims.welpRegions, branches: claims.welpBranches,
    scope: claims.welpScope, permissionCount: permissions.length, actorUid: caller.uid,
  });
  return { ok: true, uid: user.uid, email, role, scope: claims.welpScope, ...{} };
});


exports.generateWelpVerificationLink = onCall(async (request) => {
  const caller = requireAuth(request);
  requireProvisioner(caller);
  const email = String(request.data?.email || '').trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'Email tidak valid.');
  const user = await auth.getUserByEmail(email);
  const link = await auth.generateEmailVerificationLink(email, {
    url: String(request.data?.continueUrl || 'https://welp.app/'),
    handleCodeInApp: true
  });
  return { ok: true, uid: user.uid, email, verificationLink: link };
});

exports.getWelpSession = onCall(async (request) => {
  const caller = requireAuth(request);
  const token = caller.token || {};
  const tenant = String(token.welpTenant || '').trim();
  const role = String(token.welpRole || '').trim().toLowerCase();
  if (!tenant || !ROLE_KEY_RE.test(role) || token.welpDisabled === true) {
    throw new HttpsError('permission-denied', 'Akun WELP belum memiliki akses aktif.');
  }
  if (token.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Verifikasi email terlebih dahulu.');
  }
  const licSnap = await db.collection('licenses').doc(tenant).get();
  if (!licSnap.exists) throw new HttpsError('not-found', 'Tenant tidak ditemukan.');
  const lic = licSnap.data() || {};
  if (lic.active !== true) throw new HttpsError('permission-denied', 'Tenant sedang dinonaktifkan.');
  if (lic.validUntil && Date.now() > Date.parse(String(lic.validUntil))) {
    throw new HttpsError('permission-denied', 'Masa aktif tenant telah berakhir.');
  }
  // v20: scope organisasi ikut dikirim — frontend (welp-core/rbac.js)
  // memakai ini untuk menu, guard, dan filter data sesuai jenjang
  // Pusat → Region → Cabang.
  const regions = Array.isArray(token.welpRegions) ? token.welpRegions : [];
  const branches = Array.isArray(token.welpBranches) ? token.welpBranches : [];
  const scope = SCOPE_TYPES.has(token.welpScope) ? token.welpScope
    : (role === 'employee' ? 'self' : 'org');
  return {
    uid: caller.uid,
    email: token.email || null,
    emailVerified: token.email_verified === true,
    id: tenant,
    tenant: lic.tenant || tenant,
    type: lic.type || 'BASIC',
    active: true,
    validUntil: lic.validUntil || null,
    currentUserRole: role,
    branchId: token.welpBranch || 'PUSAT',
    branchName: token.welpBranch || 'Pusat',
    department: token.welpDepartment || null,
    scope: { type: scope, regionIds: regions, branchIds: branches },
    welpPermissions: Array.isArray(token.welpPermissions) ? token.welpPermissions : [],
    authVersion: 2
  };
});

exports.revokeWelpUserClaims = onCall(async (request) => {
  const caller = requireAuth(request);
  requireProvisioner(caller);
  const uid = String(request.data?.uid || '').trim();
  if (!uid) throw new HttpsError('invalid-argument', 'uid wajib diisi.');
  const target = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { welpClaimsVersion: 1, welpDisabled: true });
  return { ok: true, uid: target.uid, revoked: true };
});

// ============================================================
// v20 — UPDATE ASSIGNMENT (reassignment alami antar wilayah)
// ------------------------------------------------------------
// Pemanggil WAJIB sesama tenant + owner/direktur, ATAU provisioner
// resmi. Password target TIDAK disentuh sama sekali — hanya claims
// assignment (role/region/cabang/department/permissions).
// ============================================================
exports.updateWelpUserAssignment = onCall(async (request) => {
  const caller = requireAuth(request);
  const token = caller.token || {};
  const data = request.data || {};

  const uid = String(data.uid || '').trim();
  const tenant = String(data.tenant || token.welpTenant || '').trim();
  if (!uid || !tenant) throw new HttpsError('invalid-argument', 'uid dan tenant wajib diisi.');

  // Otorisasi pemanggil: sesama tenant & owner/direktur, atau provisioner.
  const isProvisioner = token.welpCanProvision === true;
  const isTenantBoss = token.welpTenant === tenant
    && ['owner', 'direktur', 'director'].includes(String(token.welpRole || '').toLowerCase())
    && token.welpDisabled !== true
    && Array.isArray(token.welpPermissions) && token.welpPermissions.includes('roles.manage');
  if (!isProvisioner && !isTenantBoss) {
    throw new HttpsError('permission-denied', 'Hanya Owner/Direktur tenant yang dapat mengubah assignment.');
  }

  const role = String(data.role || '').trim().toLowerCase();
  if (role && !ROLE_KEY_RE.test(role)) {
    throw new HttpsError('invalid-argument', 'Role key tidak valid.');
  }

  const target = await auth.getUser(uid);
  const targetToken = target.customClaims || {};
  if (targetToken.welpTenant !== tenant) {
    throw new HttpsError('permission-denied', 'Target bukan anggota tenant ini.');
  }

  const nextRole = role || String(targetToken.welpRole || 'employee');
  const nextBranch = data.branch === undefined
    ? (targetToken.welpBranch ?? null)
    : (data.branch == null ? null : String(data.branch).trim());
  const nextPermissions = data.permissions === undefined
    ? (Array.isArray(targetToken.welpPermissions) ? targetToken.welpPermissions : [])
    : cleanPermissions(data.permissions);
  const nextRegions = data.regions === undefined
    ? (Array.isArray(targetToken.welpRegions) ? targetToken.welpRegions : [])
    : cleanIdList(data.regions);
  const nextBranches = data.branches === undefined
    ? (Array.isArray(targetToken.welpBranches) ? targetToken.welpBranches : [])
    : cleanIdList(data.branches);
  const nextDepartment = data.department === undefined
    ? (targetToken.welpDepartment || null)
    : (data.department ? String(data.department).slice(0, 60) : null);
  const nextScope = data.scope || (nextRegions.length ? 'region'
    : (nextBranches.length && !['owner', 'direktur', 'director', 'hr', 'finance', 'accounting', 'auditor'].includes(nextRole) ? 'branch' : 'org'));

  const claims = claimsFor({
    tenant, role: nextRole, branch: nextBranch, permissions: nextPermissions,
    regions: nextRegions, branches: nextBranches, department: nextDepartment, scope: nextScope,
  });
  // Pertahankan status disabled target bila ada.
  if (targetToken.welpDisabled === true) claims.welpDisabled = true;

  await auth.setCustomUserClaims(uid, claims);
  await writeAudit(tenant, {
    action: 'AUTH_ASSIGNMENT_UPDATED',
    targetUid: uid,
    targetEmail: target.email || null,
    role: nextRole,
    branch: nextBranch,
    regions: claims.welpRegions,
    branches: claims.welpBranches,
    department: claims.welpDepartment,
    scope: claims.welpScope,
    permissionCount: claims.welpPermissions.length,
    actorUid: caller.uid,
    actorEmail: token.email || null,
  });

  return {
    ok: true, uid, role: nextRole, scope: claims.welpScope,
    regions: claims.welpRegions, branches: claims.welpBranches,
    permissionCount: claims.welpPermissions.length
  };
});


function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

exports.submitAttendanceEvidence = onCall(async (request) => {
  const caller = requireAuth(request);
  const token = caller.token || {};
  if (token.welpDisabled === true || !token.welpTenant || !token.welpRole) {
    throw new HttpsError('permission-denied', 'Akun WELP tidak aktif.');
  }
  if (token.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Email akun belum terverifikasi.');
  }
  if (!token.welpPermissions?.includes('attendance.write')) {
    throw new HttpsError('permission-denied', 'Akun tidak memiliki hak absensi.');
  }

  const d = request.data || {};
  const tenant = String(d.tenantId || '').trim();
  const employeeCid = String(d.employeeCid || '').trim();
  const branchId = String(d.branchId || '').trim();
  const captureId = String(d.captureId || '').trim();
  const photoHash = String(d.photoHash || '').trim().toLowerCase();
  const type = String(d.type || '').trim();
  const status = String(d.status || '').trim();
  const evidenceVersion = Number(d.evidenceVersion);
  const lat = Number(d.lat);
  const lng = Number(d.lng);
  const acc = Number(d.acc);

  if (!tenant || tenant !== token.welpTenant) throw new HttpsError('permission-denied', 'Tenant tidak sesuai.');
  if (!employeeCid || !branchId || !captureId) throw new HttpsError('invalid-argument', 'Identitas absensi tidak lengkap.');
  if (!['in', 'out'].includes(type)) throw new HttpsError('invalid-argument', 'Tipe absensi tidak valid.');
  if (status !== 'verified' || evidenceVersion !== 2) throw new HttpsError('failed-precondition', 'Bukti absensi tidak memenuhi versi keamanan.');
  if (!finiteNumber(lat) || !finiteNumber(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new HttpsError('invalid-argument', 'Koordinat tidak valid.');
  }
  if (!finiteNumber(acc) || acc < 0 || acc > 100) throw new HttpsError('failed-precondition', 'Akurasi lokasi terlalu rendah.');
  if (!/^[0-9a-f]{64}$/.test(photoHash)) throw new HttpsError('invalid-argument', 'Fingerprint bukti tidak valid.');

  const attendanceId = captureId.slice(0, 180).replace(/[^A-Za-z0-9_-]/g, '_');
  if (!attendanceId) throw new HttpsError('invalid-argument', 'Capture ID tidak valid.');

  const ref = db.collection('tenants').doc(tenant).collection('absensi').doc(attendanceId);
  const existing = await ref.get();
  if (existing.exists) {
    const prior = existing.data() || {};
    if (prior.employeeUid === caller.uid && prior.photoHash === photoHash) {
      return { ok: true, duplicate: true, id: attendanceId };
    }
    throw new HttpsError('already-exists', 'Bukti absensi dengan capture ID tersebut sudah ada.');
  }

  const payload = {
    tenantId: tenant,
    employeeUid: caller.uid,
    employeeCid,
    branchId: token.welpBranch || branchId,
    type,
    status: 'verified',
    evidenceVersion: 2,
    captureMode: 'welp-camera',
    liveMotionCheck: d.liveMotionCheck === true,
    geoStatus: d.geoStatus === 'verified' ? 'verified' : 'rejected',
    far: d.far === false,
    lat, lng, acc, photoHash, captureId: attendanceId,
    serverAt: admin.firestore.FieldValue.serverTimestamp(),
    verifiedBy: 'welp-backend-v1'
  };

  if (payload.liveMotionCheck !== true || payload.geoStatus !== 'verified' || payload.far !== false) {
    throw new HttpsError('failed-precondition', 'Bukti kamera atau lokasi belum memenuhi verifikasi.');
  }

  await ref.create(payload);
  return { ok: true, duplicate: false, id: attendanceId };
});


exports.health = onRequest((req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, service: 'welp-functions', version: 'v21.1-payment-core', time: new Date().toISOString() });
});

// ============================================================
// v21.1 — WELP PAYMENT WEBHOOK (endpoint internal milik WELP)
// ------------------------------------------------------------
// POST /welpPaymentEvents — pintu masuk SEMUA payment event:
//
//   Payment Event Source (simulator PWA / Android Notification
//   Bridge / provider adapter masa depan)
//     → WELP Payment Webhook (endpoint ini)
//     → Normalize → Validate → Dedup (eventId)
//     → Match (paymentReference > providerRef > konteks)
//     → CONFIRMED / AMBIGUOUS / NO_MATCH / EXPIRED
//     → Ledger (payment_events, append-only) → Audit
//
// KEAMANAN (jujur — tanpa fake):
//   • Wajib secret env WELP_PAYMENT_WEBHOOK_SECRET (HMAC-SHA256
//     atas raw body, header 'x-welp-signature'). Secret belum
//     diset → endpoint menolak dengan 503, BUKAN membuka akses.
//   • Set secret: firebase functions:secrets:set WELP_PAYMENT_WEBHOOK_SECRET
//   • Idempoten: payment_events/{eventId} memakai create() — event
//     yang sama dua kali → duplikat diabaikan (tidak ada revenue ganda).
//   • Nominal BUKAN identitas: event tanpa reference provider
//     dinyatakan AMBIGUOUS untuk review manual (spec #19).
// ============================================================
const crypto = require('crypto');

function matchDecisionServer(event, intentDocs, now) {
  const ref = String(event.reference || '').toUpperCase();
  const pref = String(event.providerRef || '').toUpperCase();
  const byRef = ref ? intentDocs.find(d => String(d.paymentReference || '').toUpperCase() === ref) : null;
  if (byRef) {
    if (byRef.status !== 'PENDING') return { status: 'DUPLICATE', intent: byRef, reason: 'intent sudah diproses' };
    if (byRef.expiresAt && byRef.expiresAt < now) return { status: 'EXPIRED', intent: byRef, reason: 'intent kedaluwarsa' };
    if (Number(byRef.amount) !== Number(event.amount)) return { status: 'AMBIGUOUS', intents: [byRef], reason: `reference cocok tapi dana masuk ${event.amount} ≠ tagihan ${byRef.amount}` };
    return { status: 'CONFIRMED', intent: byRef, reason: `cocok paymentReference ${ref}` };
  }
  const byPref = pref ? intentDocs.find(d => String(d.providerRef || '').toUpperCase() === pref) : null;
  if (byPref) {
    if (byPref.status !== 'PENDING') return { status: 'DUPLICATE', intent: byPref, reason: 'intent sudah diproses' };
    if (Number(byPref.amount) !== Number(event.amount)) return { status: 'AMBIGUOUS', intents: [byPref], reason: `providerRef cocok tapi nominal beda` };
    return { status: 'CONFIRMED', intent: byPref, reason: `cocok providerRef ${pref}` };
  }
  // Bukti lemah: nominal (+method) — TIDAK PERNAH auto-confirm.
  const cands = intentDocs.filter(d => d.status === 'PENDING' && Number(d.amount) === Number(event.amount)
    && (!d.expiresAt || d.expiresAt > now));
  if (!cands.length) return { status: 'NO_MATCH', reason: 'tidak ada intent PENDING dgn nominal cocok' };
  return { status: 'AMBIGUOUS', intents: cands, reason: `nominal sama dgn ${cands.length} order — wajib review manual` };
}

exports.welpPaymentEvents = onRequest(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-welp-signature');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  const secret = String(process.env.WELP_PAYMENT_WEBHOOK_SECRET || '');
  if (!secret) {
    // Fail-closed: tanpa secret, endpoint TIDAK terbuka untuk publik.
    return res.status(503).json({ ok: false, error: 'WEBHOOK_SECRET_NOT_CONFIGURED', hint: 'firebase functions:secrets:set WELP_PAYMENT_WEBHOOK_SECRET' });
  }
  const raw = JSON.stringify(req.body || {});
  const sig = String(req.get('x-welp-signature') || '');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, error: 'INVALID_SIGNATURE' });
  }

  const d = req.body || {};
  const tenant = String(d.tenantId || '').trim();
  const eventId = String(d.eventId || '').trim();
  const amount = Math.round(Number(d.amount) || 0);
  if (!tenant || !eventId || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'VALIDATION', need: ['tenantId', 'eventId', 'amount>0'] });
  }

  const now = Date.now();
  const event = {
    eventId,
    source: String(d.source || 'PROVIDER_WEBHOOK').slice(0, 40),
    reference: String(d.reference || d.paymentReference || '').trim().toUpperCase() || null,
    providerRef: String(d.providerRef || d.transactionRef || '').trim().toUpperCase() || null,
    amount, currency: String(d.currency || 'IDR').slice(0, 8),
    method: String(d.method || 'QRIS').slice(0, 24),
    merchantId: d.merchantId ? String(d.merchantId).slice(0, 64) : null,
    timestamp: Number(d.timestamp) || now,
    rawText: d.rawText ? String(d.rawText).slice(0, 500) : null,
  };

  const tRef = db.collection('tenants').doc(tenant);
  const evRef = tRef.collection('payment_events').doc(eventId);

  try {
    const result = await db.runTransaction(async (tx) => {
      // 1) IDEMPOTENCY — create() gagal bila eventId sudah ada.
      const evSnap = await tx.get(evRef);
      if (evSnap.exists) {
        return { status: 'DUPLICATE', reason: 'eventId sudah pernah diproses' };
      }

      // 2) MATCHING — payment_intents per tenant (ditulis saat checkout).
      let intents = [];
      if (event.reference) {
        const byRef = await tRef.collection('payment_intents').where('paymentReference', '==', event.reference).limit(5).get();
        intents = intents.concat(byRef.docs.map(x => ({ id: x.id, ...x.data() })));
      }
      if (event.providerRef) {
        const byPref = await tRef.collection('payment_intents').where('providerRef', '==', event.providerRef).limit(5).get();
        intents = intents.concat(byPref.docs.map(x => ({ id: x.id, ...x.data() })));
      }
      if (!intents.length) {
        // kandidat nominal sama (equality-only → aman tanpa composite index)
        const byAmt = await tRef.collection('payment_intents').where('status', '==', 'PENDING').where('amount', '==', amount).limit(10).get();
        intents = byAmt.docs.map(x => ({ id: x.id, ...x.data() }));
      }
      const decision = matchDecisionServer(event, intents, now);

      // 3) LEDGER — event append-only (audit + dedup permanen).
      tx.set(evRef, {
        ...event,
        matchStatus: decision.status,
        reason: decision.reason || '',
        orderId: decision.intent ? (decision.intent.orderId || decision.intent.clientTransactionId || null) : null,
        processedAt: now,
        serverAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4) CONFIRMED → intent + order lunas (satu transaksi atomik).
      if (decision.status === 'CONFIRMED' && decision.intent) {
        const it = decision.intent;
        const intentRef = tRef.collection('payment_intents').doc(it.id);
        tx.set(intentRef, {
          status: 'CONFIRMED', confirmedAt: now, providerRef: event.providerRef || it.providerRef || null,
          eventId, matchedBy: decision.reason, serverAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const orderId = it.orderId || it.clientTransactionId;
        if (orderId) {
          const orderRef = tRef.collection('pos_history').doc(orderId);
          const orderSnap = await tx.get(orderRef);
          if (orderSnap.exists) {
            const order = orderSnap.data() || {};
            const payments = (Array.isArray(order.payments) ? order.payments : []).map(p =>
              p.paymentId === it.paymentId
                ? { ...p, status: 'CONFIRMED', paidAt: new Date(now).toISOString(), confirmedAt: now, providerRef: event.providerRef || p.providerRef || null, eventId, eventSource: event.source, matchedBy: decision.reason, matchedActor: 'payment-webhook' }
                : p
            );
            tx.set(orderRef, {
              payments, status: 'paid', paidAt: new Date(now).toISOString(),
              txState: 'PAYMENT_CONFIRMED',
              serverAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          }
        }
      }
      return { status: decision.status, reason: decision.reason || '', orderId: decision.intent ? (decision.intent.orderId || decision.intent.clientTransactionId || null) : null };
    });

    await writeAudit(tenant, {
      action: 'PAYMENT_EVENT_' + result.status, target: eventId,
      source: event.source, reference: event.reference, providerRef: event.providerRef,
      amount, orderId: result.orderId || null, alasan: result.reason,
      actor: 'welpPaymentEvents', actorRole: 'system',
      createdAt: now,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('welpPaymentEvents', e);
    return res.status(500).json({ ok: false, error: 'INTERNAL', detail: String(e?.message || e).slice(0, 200) });
  }
});
