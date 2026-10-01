const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast2', maxInstances: 20 });

const db = admin.firestore();
const auth = admin.auth();

const ROLES = new Set(['owner', 'director', 'manager', 'supervisor', 'hr', 'finance', 'cashier', 'employee']);
const PERMISSIONS = new Set([
  'dashboard.read', 'sales.read', 'sales.write', 'sales.refund',
  'inventory.read', 'inventory.write', 'inventory.adjust',
  'employee.read', 'employee.write', 'attendance.read', 'attendance.write',
  'payroll.read', 'payroll.write', 'payroll.approve',
  'finance.read', 'finance.write', 'reports.read', 'settings.read', 'settings.write',
  'audit.read', 'company.manage', 'branch.manage'
]);

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login diperlukan.');
  return request.auth;
}

function cleanPermissions(list) {
  return Array.isArray(list) ? [...new Set(list.filter(p => PERMISSIONS.has(p)))].slice(0, 80) : [];
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

exports.setWelpUserClaims = onCall(async (request) => {
  const caller = requireAuth(request);
  requireProvisioner(caller);
  const data = request.data || {};
  const uid = String(data.uid || '').trim();
  const tenant = String(data.tenant || '').trim();
  const role = String(data.role || '').trim().toLowerCase();
  const branch = data.branch == null ? null : String(data.branch).trim();
  const permissions = cleanPermissions(data.permissions);

  if (!uid || !tenant || !ROLES.has(role)) {
    throw new HttpsError('invalid-argument', 'uid, tenant, dan role wajib valid.');
  }
  if (tenant.length > 120 || !/^[A-Za-z0-9_-]+$/.test(tenant)) {
    throw new HttpsError('invalid-argument', 'Tenant ID tidak valid.');
  }

  const target = await auth.getUser(uid);
  if (!target.email || target.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Akun target harus memiliki email terverifikasi.');
  }

  const claims = {
    welpTenant: tenant,
    welpRole: role,
    welpBranch: branch || null,
    welpPermissions: permissions,
    welpCanDelete: ['owner', 'director'].includes(role),
    welpClaimsVersion: 1
  };
  await auth.setCustomUserClaims(uid, claims);

  await db.collection('tenants').doc(tenant).collection('audit_log').add({
    action: 'AUTH_CLAIMS_UPDATED',
    targetUid: uid,
    targetEmail: target.email,
    role,
    branch,
    permissionCount: permissions.length,
    actorUid: caller.uid,
    actorEmail: caller.token.email || null,
    serverAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { ok: true, uid, tenant, role, branch, permissionCount: permissions.length };
});



function claimsFor({ tenant, role, branch = null, permissions = [] }) {
  return {
    welpTenant: tenant,
    welpRole: role,
    welpBranch: branch || null,
    welpPermissions: cleanPermissions(permissions),
    welpCanDelete: ['owner', 'director'].includes(role),
    welpClaimsVersion: 2,
    welpDisabled: false
  };
}

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
  if (!tenant || !ROLES.has(role)) throw new HttpsError('invalid-argument', 'Tenant dan role wajib valid.');

  let user;
  try {
    user = await auth.getUserByEmail(email);
    if (user.disabled) await auth.updateUser(user.uid, { disabled: false });
    user = await auth.getUser(user.uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({ email, password, emailVerified: false });
  }

  const claims = claimsFor({ tenant, role, branch, permissions });
  await auth.updateUser(user.uid, { password });
  await auth.setCustomUserClaims(user.uid, claims);
  await db.collection('tenants').doc(tenant).collection('audit_log').add({
    action: 'AUTH_IDENTITY_PROVISIONED', targetUid: user.uid, targetEmail: email,
    role, branch, permissionCount: permissions.length, actorUid: caller.uid,
    serverAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { ok: true, uid: user.uid, email, ...claims };
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
  if (!tenant || !ROLES.has(role) || token.welpDisabled === true) {
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
  res.status(200).json({ ok: true, service: 'welp-functions', version: 'batch-7', time: new Date().toISOString() });
});
