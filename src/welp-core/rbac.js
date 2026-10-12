// ============================================================
// WELP CORE — RBAC ENGINE v20
// ------------------------------------------------------------
// Satu sumber kebenaran untuk:
//   1. Permission granular (domain × action: view/create/edit/
//      delete/approve/export/manage) — kompatibel mundur dengan
//      14 permission key lama (v15) lewat ekspansi otomatis.
//   2. Custom role buatan Owner/Admin (tidak hard-coded):
//      Area Manager, HRD, Finance, Accounting, Purchasing,
//      Kepala Toko, Area Supervisor, Auditor, dst.
//   3. SCOPE akses berjenjang: organization (semua) → region/
//      area → branch → department → data pribadi.
//   4. Workspace resolver: menentukan user masuk WELP Business,
//      WELP Cashier (POS), atau Employee Area — berbasis role
//      & permission, bukan URL manual.
//
// ATURAN KEAMANAN:
//   - Engine ini HANYA untuk UI/UX (menu, guard halaman).
//     Otorisasi sesungguhnya tetap di Firebase Auth custom
//     claims + Firestore Rules (lihat functions/index.js &
//     firestore.enterprise.v4.rules). Tidak ada security
//     decision yang hanya hidup di frontend.
// ============================================================

// ------------------------------------------------------------
// 1. REGISTRY PERMISSION GRANULAR
// ------------------------------------------------------------
// Setiap domain punya action yang relevan. Key granular memakai
// format <domain>.<action>.
export const PERM_DOMAINS = [
  {
    key: 'dashboard', label: 'Command Center',
    desc: 'Ringkasan bisnis lintas cabang sesuai scope',
    actions: ['view'],
  },
  {
    key: 'pos', label: 'Kasir (POS)',
    desc: 'Operasional transaksi kasir',
    actions: ['view', 'use'],
  },
  {
    key: 'product', label: 'Produk & HPP',
    desc: 'Produk, harga, resep, kalkulator HPP',
    actions: ['view', 'create', 'edit', 'delete', 'manage', 'export'],
  },
  {
    key: 'inventory', label: 'Inventory',
    desc: 'Stok, opname, riwayat stok & expired',
    actions: ['view', 'create', 'edit', 'delete', 'adjust', 'manage', 'export'],
  },
  {
    key: 'purchasing', label: 'Purchasing',
    desc: 'Barang masuk/keluar & supplier',
    actions: ['view', 'create', 'edit', 'delete', 'manage', 'export'],
  },
  {
    key: 'crm', label: 'Customer / CRM',
    desc: 'Database pelanggan & riwayat belanja',
    actions: ['view', 'create', 'edit', 'delete', 'manage', 'export'],
  },
  {
    key: 'finance', label: 'Keuangan',
    desc: 'Kas keluar, diskon/pajak, metode pembayaran',
    actions: ['view', 'create', 'edit', 'delete', 'manage', 'export'],
  },
  {
    key: 'report', label: 'Laporan & Analisa',
    desc: 'Laporan penjualan, laba, analisa bisnis',
    actions: ['view', 'export'],
  },
  {
    key: 'attendance', label: 'Absensi',
    desc: 'Monitoring absensi, persetujuan cuti & pencatatan',
    actions: ['view', 'manage', 'approve', 'export', 'write'],
  },
  {
    key: 'payroll', label: 'Penggajian',
    desc: 'Payroll, approval, slip gaji',
    actions: ['view', 'create', 'edit', 'delete', 'approve', 'manage', 'export'],
  },
  {
    key: 'employee', label: 'Karyawan (HR)',
    desc: 'Data karyawan, kontrak, Employee ID & PIN',
    actions: ['view', 'create', 'edit', 'delete', 'manage', 'export'],
  },
  {
    key: 'branch', label: 'Cabang & Station',
    desc: 'Kelola cabang, station, aturan absensi',
    actions: ['view', 'create', 'edit', 'delete', 'manage'],
  },
  {
    key: 'org', label: 'Organisasi',
    desc: 'Region/area, struktur organisasi & penugasan',
    actions: ['view', 'create', 'edit', 'delete', 'manage'],
  },
  {
    key: 'approval', label: 'Pusat Persetujuan',
    desc: 'Inbox approval payroll, cuti, dan lainnya',
    actions: ['view', 'approve'],
  },
  {
    key: 'audit', label: 'Audit Log',
    desc: 'Jejak aktivitas seluruh pengguna sesuai scope',
    actions: ['view', 'export'],
  },
  {
    key: 'roles', label: 'Role & Permission',
    desc: 'Kelola role bawaan, custom role & permission',
    actions: ['view', 'manage'],
  },
  {
    key: 'settings', label: 'Pengaturan',
    desc: 'Profil toko, hardware, pengaturan utama, perusahaan',
    actions: ['view', 'manage'],
  },
  {
    key: 'refund', label: 'Refund Transaksi',
    desc: 'Batalkan / refund transaksi kasir',
    actions: ['perform'],
  },
  // v21 — domain finansial kasir (siklus transaksi penuh)
  {
    key: 'transaction', label: 'Transaksi Kasir',
    desc: 'Lihat, buat, void & refund transaksi penjualan',
    actions: ['view', 'create', 'void', 'refund'],
  },
  {
    key: 'payment', label: 'Pembayaran',
    desc: 'Pembayaran kasir: intent QRIS, event, konfirmasi ambigu',
    actions: ['view', 'confirm', 'manage'],   // v21.1: confirm = review manual event ambigu
  },
  {
    key: 'settlement', label: 'Settlement',
    desc: 'Settlement dana per metode pembayaran (gross, MDR/fee, net)',
    actions: ['view', 'manage'],
  },
  {
    key: 'reconciliation', label: 'Rekonsiliasi',
    desc: 'Rekonsiliasi penjualan vs settlement (status & alasan selisih)',
    actions: ['view'],
  },
  {
    key: 'shift', label: 'Shift & Kas',
    desc: 'Buka/tutup shift, uang masuk/keluar, hitung selisih kas',
    actions: ['open', 'close', 'view'],
  },
];

// Semua action yang dikenal (flattened).
export const ALL_PERM_KEYS = PERM_DOMAINS.flatMap(d => d.actions.map(a => `${d.key}.${a}`));

// ------------------------------------------------------------
// 2. KOMPATIBILITAS MUNDUR — ekspansi key legacy (v15) → granular
// ------------------------------------------------------------
// Matrix lama menyimpan key ringkas. Saat dibaca, tiap key
// legacy di-EXPAND menjadi key granular turunannya sehingga
// guard halaman granular tetap jalan tanpa migrasi data.
export const LEGACY_EXPANSION = {
  'dashboard.view': ['dashboard.view'],
  // v21: memakai POS berarti boleh membuat transaksi, melihat pembayaran,
  // dan mengelola shift kasir sendiri (open/close) — expansion otomatis
  // membuat matrix lama tetap bermakna tanpa migrasi data.
  'pos.use': ['pos.use', 'pos.view', 'transaction.view', 'transaction.create', 'payment.view', 'shift.open', 'shift.close', 'shift.view'],
  'product.manage': ['product.view', 'product.create', 'product.edit', 'product.delete', 'product.manage', 'product.export'],
  'inventory.manage': ['inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete', 'inventory.adjust', 'inventory.manage', 'inventory.export'],
  'purchasing.manage': ['purchasing.view', 'purchasing.create', 'purchasing.edit', 'purchasing.delete', 'purchasing.manage', 'purchasing.export'],
  'report.financial': ['report.view', 'report.export', 'finance.view'],
  'attendance.manage': ['attendance.view', 'attendance.manage', 'attendance.approve', 'attendance.export', 'attendance.write'],
  'payroll.view': ['payroll.view'],
  'payroll.manage': ['payroll.view', 'payroll.create', 'payroll.edit', 'payroll.approve', 'payroll.manage', 'payroll.export'],
  'employee.manage': ['employee.view', 'employee.create', 'employee.edit', 'employee.delete', 'employee.manage', 'employee.export'],
  'branch.manage': ['branch.view', 'branch.create', 'branch.edit', 'branch.delete', 'branch.manage'],
  'settings.manage': ['settings.view', 'settings.manage'],
  'role.manage': ['roles.view', 'roles.manage'],
  // v21: yang boleh refund, boleh pula void (batal sebelum settlement).
  'refund.perform': ['refund.perform', 'transaction.refund', 'transaction.void'],
};

// Key legacy (dipertahankan agar matrix lama tetap valid).
export const LEGACY_KEYS = Object.keys(LEGACY_EXPANSION);

// ------------------------------------------------------------
// 3. ROLE BAWAAN (preset) — granular penuh
// ------------------------------------------------------------
const G = ALL_PERM_KEYS;
export const ROLE_PRESETS_V20 = {
  owner: G,
  direktur: G.filter(k => k !== 'roles.manage'),
  manager: [
    'dashboard.view', 'pos.view', 'pos.use',
    'product.view', 'product.manage', 'product.export',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjust', 'inventory.manage', 'inventory.export',
    'purchasing.view', 'purchasing.create', 'purchasing.manage', 'purchasing.export',
    'crm.view', 'crm.manage',
    'finance.view', 'finance.create',
    'report.view', 'report.export',
    'attendance.view', 'attendance.manage', 'attendance.approve',
    'payroll.view',
    'employee.view', 'employee.manage',
    'branch.view', 'branch.manage',
    'org.view',
    'approval.view', 'approval.approve',
    'refund.perform',
    'transaction.view', 'transaction.void', 'transaction.refund',
    'payment.view', 'payment.confirm', 'settlement.view', 'reconciliation.view',
  ],
  supervisor: [
    'dashboard.view', 'pos.view', 'pos.use',
    'inventory.view', 'inventory.adjust',
    'crm.view',
    'report.view',
    'attendance.view', 'attendance.manage', 'attendance.approve',
    'refund.perform',
    'transaction.view', 'transaction.void', 'transaction.refund',
    'payment.view', 'settlement.view', 'reconciliation.view',
  ],
  admin: G.filter(k => k !== 'roles.manage'),
  hr: [
    'dashboard.view', 'report.view',
    'attendance.view', 'attendance.manage', 'attendance.approve', 'attendance.export',
    'payroll.view', 'payroll.create', 'payroll.manage', 'payroll.export',
    'employee.view', 'employee.create', 'employee.edit', 'employee.manage', 'employee.export',
    'org.view',
    'approval.view', 'approval.approve',
  ],
  finance: [
    'dashboard.view', 'report.view', 'report.export',
    'finance.view', 'finance.create', 'finance.edit', 'finance.manage', 'finance.export',
    'payroll.view', 'payroll.approve',
    'approval.view', 'approval.approve',
    'transaction.view', 'payment.view', 'payment.confirm', 'payment.manage',
    'settlement.view', 'settlement.manage', 'reconciliation.view',
  ],
  accounting: [
    'dashboard.view', 'report.view', 'report.export',
    'finance.view', 'finance.manage', 'finance.export',
    'purchasing.view',
    'payroll.view',
    'transaction.view', 'payment.view', 'settlement.view', 'reconciliation.view',
  ],
  purchasing: [
    'dashboard.view',
    'inventory.view', 'inventory.adjust',
    'purchasing.view', 'purchasing.create', 'purchasing.edit', 'purchasing.manage', 'purchasing.export',
    'product.view',
    'crm.view',
  ],
  inventory: [
    'dashboard.view',
    'product.view', 'product.manage',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjust', 'inventory.manage', 'inventory.export',
    'purchasing.view', 'purchasing.manage',
  ],
  areamanager: [
    'dashboard.view',
    'pos.view', 'pos.use',
    'product.view',
    'inventory.view', 'inventory.adjust', 'inventory.manage',
    'purchasing.view', 'purchasing.manage',
    'crm.view', 'crm.manage',
    'finance.view',
    'report.view', 'report.export',
    'attendance.view', 'attendance.manage', 'attendance.approve',
    'payroll.view',
    'employee.view', 'employee.manage',
    'branch.view', 'branch.manage',
    'org.view',
    'approval.view', 'approval.approve',
    'audit.view',
    'transaction.view', 'transaction.void', 'transaction.refund',
    'payment.view', 'settlement.view', 'reconciliation.view',
  ],
  areasupervisor: [
    'dashboard.view', 'pos.view', 'pos.use',
    'inventory.view', 'inventory.adjust',
    'report.view',
    'attendance.view', 'attendance.manage', 'attendance.approve',
    'audit.view',
  ],
  kepala_toko: [
    'dashboard.view', 'pos.view', 'pos.use',
    'product.view', 'product.edit',
    'inventory.view', 'inventory.adjust', 'inventory.manage',
    'crm.view', 'crm.manage',
    'report.view',
    'attendance.view', 'attendance.manage', 'attendance.approve',
    'payroll.view',
    'employee.view',
    'refund.perform',
    'transaction.view', 'payment.view', 'payment.confirm', 'settlement.view', 'reconciliation.view',
  ],
  auditor: [
    'dashboard.view', 'report.view', 'report.export',
    'finance.view',
    'audit.view', 'audit.export',
    'attendance.view',
    'payroll.view',
    'inventory.view',
    'purchasing.view',
    'transaction.view', 'payment.view', 'settlement.view', 'reconciliation.view',
  ],
  // v21.1: konfirmasi manual pembayaran ambigu butuh payment.confirm;
  // kasir TIDAK mendapatkannya (eskalsi ke manager/finance/owner).
  kasir: ['dashboard.view', 'pos.view', 'pos.use', 'crm.view', 'crm.create',
    'transaction.view', 'transaction.create', 'payment.view',
    'shift.open', 'shift.close', 'shift.view'],
  employee: ['employee.view'],
};

// ------------------------------------------------------------
// 4. META ROLE BAWAAN
// ------------------------------------------------------------
export const ROLE_META_V20 = {
  owner: { label: 'Owner', atasan: true, scope: 'org' },
  direktur: { label: 'Direktur', atasan: true, scope: 'org' },
  manager: { label: 'Manager', atasan: true, scope: 'branch' },
  supervisor: { label: 'Supervisor', atasan: true, scope: 'branch' },
  admin: { label: 'Admin', atasan: true, scope: 'branch' },
  hr: { label: 'HR', atasan: true, scope: 'org' },
  finance: { label: 'Finance', atasan: false, scope: 'org' },
  accounting: { label: 'Accounting', atasan: false, scope: 'org' },
  purchasing: { label: 'Purchasing', atasan: false, scope: 'org' },
  inventory: { label: 'Inventory', atasan: false, scope: 'org' },
  areamanager: { label: 'Area Manager', atasan: true, scope: 'region' },
  areasupervisor: { label: 'Area Supervisor', atasan: true, scope: 'region' },
  kepala_toko: { label: 'Kepala Toko', atasan: true, scope: 'branch' },
  auditor: { label: 'Auditor', atasan: false, scope: 'org' },
  kasir: { label: 'Kasir', atasan: false, scope: 'branch' },
  employee: { label: 'Employee', atasan: false, scope: 'self' },
};

// ------------------------------------------------------------
// 5. MATRIX READER — preset v20 + custom roles + legacy matrix
// ------------------------------------------------------------
// Struktur tersimpan di tenants/{lic}/pengaturan doc 'roles':
//   { key:'roles', matrix:{...}, customRoles:[{key,label,permissions,scope}] }
// Kompatibel dengan matrix lama (key legacy) — di-expand saat baca.
export const getRbacConfig = (settingsRows) => {
  // GUARD: pemanggil lama bisa meneruskan bukan-array (mis. hasil
  // Array.map(roleLabelOfV15) yang menyisipkan index sebagai arg ke-2).
  const rows = Array.isArray(settingsRows) ? settingsRows : [];
  const rec = rows.find(s => s.key === 'roles');
  const legacyMatrix = (rec && rec.matrix && typeof rec.matrix === 'object') ? rec.matrix : {};
  const customRoles = Array.isArray(rec?.customRoles) ? rec.customRoles : [];
  return { legacyMatrix, customRoles };
};

// Definisi role lengkap (bawaan + custom) untuk UI editor & label.
export const allRoleDefs = ({ legacyMatrix = {}, customRoles = [] } = {}) => {
  const defs = {};
  Object.keys(ROLE_PRESETS_V20).forEach(key => {
    const meta = ROLE_META_V20[key] || {};
    defs[key] = {
      key, builtin: true,
      label: meta.label || key,
      atasan: !!meta.atasan,
      scope: meta.scope || 'org',
      permissions: legacyMatrix[key] || ROLE_PRESETS_V20[key],
    };
  });
  customRoles.forEach(r => {
    if (!r || !r.key) return;
    defs[String(r.key)] = {
      key: String(r.key), builtin: false,
      label: r.label || r.key,
      atasan: r.atasan === true,
      scope: r.scope || { type: 'org' },
      permissions: Array.isArray(r.permissions) ? r.permissions : [],
    };
  });
  return defs;
};

// Ekspansi daftar key (legacy + granular) → Set permission granular.
export const expandPerms = (keys) => {
  const out = new Set();
  (keys || []).forEach(k => {
    out.add(k);
    (LEGACY_EXPANSION[k] || []).forEach(x => out.add(x));
  });
  return out;
};

// permsOf(role, settingsRows) — API utama (kompatibel pemanggil lama).
export const permsOf = (role, settingsRows) => {
  const { legacyMatrix, customRoles } = getRbacConfig(settingsRows);
  const defs = allRoleDefs({ legacyMatrix, customRoles });
  const def = defs[role] || defs.employee;
  return expandPerms(def.permissions);
};

export const canDo = (perms, key) => !!(perms && typeof perms.has === 'function' && perms.has(key));

// Label role (bawaan + custom).
export const roleLabelOf = (role, settingsRows) => {
  const { legacyMatrix, customRoles } = getRbacConfig(settingsRows);
  const defs = allRoleDefs({ legacyMatrix, customRoles });
  return (defs[role] || {}).label || 'Karyawan';
};

export const isAtasanRole = (role, settingsRows) => {
  const { legacyMatrix, customRoles } = getRbacConfig(settingsRows);
  const defs = allRoleDefs({ legacyMatrix, customRoles });
  const def = defs[role];
  if (!def) return false;
  if (def.builtin) return !!(ROLE_META_V20[role] || {}).atasan;
  return !!def.atasan;
};

// ------------------------------------------------------------
// 6. SCOPE ENGINE
// ------------------------------------------------------------
// scope = { type:'org'|'region'|'branch'|'self', regionIds:[], branchIds:[] }
// Sumber:
//   - Enterprise (Firebase claims): session.scope dari getWelpSession
//   - Legacy (sesi lisensi): role default + assignment karyawan
export const normScope = (s) => {
  if (!s || typeof s !== 'object') return { type: 'org', regionIds: [], branchIds: [] };
  const type = ['org', 'region', 'branch', 'self'].includes(s.type) ? s.type : 'org';
  return {
    type,
    regionIds: Array.isArray(s.regionIds) ? s.regionIds.filter(Boolean) : [],
    branchIds: Array.isArray(s.branchIds) ? s.branchIds.filter(Boolean) : [],
  };
};

// Scope default dari role bila tidak ada assignment eksplisit.
export const defaultScopeForRole = (role, session = {}) => {
  const meta = ROLE_META_V20[role] || {};
  const type = meta.scope || 'org';
  const branchIds = Array.isArray(session.branchIds) ? session.branchIds.filter(Boolean)
    : (session.branchId && session.branchId !== 'PUSAT' ? [session.branchId] : []);
  if (type === 'org') return { type: 'org', regionIds: [], branchIds: [] };
  if (type === 'region') return { type: 'region', regionIds: session.regionIds || [], branchIds: branchIds };
  if (type === 'branch') return { type: 'branch', regionIds: [], branchIds };
  return { type: 'self', regionIds: [], branchIds };
};

// Scope efektif sesi: assignment eksplisit menang atas default role.
export const scopeOf = (session, employee = null) => {
  if (!session) return normScope(null);
  if (session.scope) return normScope(session.scope);
  const empRegionIds = Array.isArray(employee?.regionIds) ? employee.regionIds.filter(Boolean) : [];
  const empBranchIds = Array.isArray(employee?.branchIds) ? employee.branchIds.filter(Boolean) : [];
  if (empRegionIds.length) return { type: 'region', regionIds: empRegionIds, branchIds: empBranchIds };
  if (empBranchIds.length > 1) return { type: 'branch', regionIds: [], branchIds: empBranchIds };
  return defaultScopeForRole(session.currentUserRole || session.role || 'employee', {
    branchId: session.branchId, branchIds: empBranchIds, regionIds: empRegionIds,
  });
};

// Apakah sebuah branchId berada dalam scope? (branches utk resolusi region)
export const branchInScope = (scope, branchId, branches = []) => {
  const s = normScope(scope);
  if (s.type === 'org') return true;
  if (s.type === 'self') return false;
  if (s.type === 'branch') return s.branchIds.includes(branchId);
  if (s.type === 'region') {
    if (s.branchIds.includes(branchId)) return true;
    const b = (branches || []).find(x => x.cid === branchId);
    return !!b && !!b.regionId && s.regionIds.includes(b.regionId);
  }
  return false;
};

// Daftar branch yang boleh dilihat sesuai scope.
export const branchesInScope = (scope, branches = []) => {
  const s = normScope(scope);
  if (s.type === 'org') return [...(branches || [])];
  if (s.type === 'self') return [];
  return (branches || []).filter(b => branchInScope(s, b.cid, branches));
};

// Owner-ish = boleh melintasi seluruh organisasi.
export const isOrgWide = (scope) => normScope(scope).type === 'org';

// ------------------------------------------------------------
// 7. WORKSPACE RESOLVER — ke mana user mendarat setelah login?
// ------------------------------------------------------------
// role employee          → Employee Area (di dalam WELP Cashier)
// role kasir / station   → POS (WELP Cashier)
// role lain dgn izin mgmt→ WELP Business
// fallback tanpa izin    → Employee Area
export const resolveWorkspace = (session, perms, settingsRows) => {
  if (!session) return 'employee';
  const role = String(session.currentUserRole || session.role || '').toLowerCase();

  if (session.isStation) return 'cashier';
  if (role === 'employee') return 'employee';
  if (role === 'kasir' || role === 'cashier') return 'cashier';

  const p = (perms instanceof Set) ? perms : permsOf(role, settingsRows);
  const hasMgmt = ['dashboard.view', 'report.view', 'inventory.manage', 'attendance.manage', 'payroll.manage', 'employee.manage', 'branch.manage', 'org.manage', 'settings.manage']
    .some(k => p.has(k));
  const hasPos = p.has('pos.use');
  if (hasMgmt) return 'business';
  if (hasPos) return 'cashier';
  return 'employee';
};

// ------------------------------------------------------------
// 8. NAV PERMISSION MAP (Business & Cashier)
// ------------------------------------------------------------
// id tab → permission granular minimal. null = semua sesi sah.
export const NAV_PERMS_V20 = {
  home: 'dashboard.view',
  outlet: 'branch.view',
  pos: 'pos.use',
  area: null,                        // Employee Area pribadi
  calc: 'product.manage',
  history: 'report.view',
  cashout: 'finance.view',
  discount: 'finance.manage',
  customers: 'crm.view',
  stock: 'inventory.manage',
  opname: 'inventory.adjust',
  inout: 'purchasing.manage',
  stockhistory: 'inventory.view',
  supplier: 'purchasing.manage',
  report: 'report.view',
  karyawan: 'employee.manage',
  absensi: 'attendance.manage',
  payroll: 'payroll.view',
  employee: 'branch.manage',
  organization: 'org.view',   // lihat struktur; aksi tulis dicek org.manage di halaman
  approval: 'approval.view',
  audit: 'audit.view',
  finance2: 'settlement.view',   // v21: Keuangan (Settlement/Rekonsiliasi/Kas & Shift)
  roles: 'roles.manage',
  perusahaan: 'settings.manage',
  profile: 'settings.manage',
  payment: 'settings.manage',
  hardware: 'settings.manage',
  settings: 'settings.manage',
};

// ------------------------------------------------------------
// 9. WHITELIST PERMISSION UNTUK CLAIMS SERVER
// ------------------------------------------------------------
// Harus selalu superset dari whitelist PERMISSIONS di
// functions/index.js. Dipakai saat provisioning akun enterprise.
export const serverPermKeys = () => {
  const legacy = [
    'dashboard.read', 'sales.read', 'sales.write', 'sales.refund',
    'inventory.read', 'inventory.write', 'inventory.adjust',
    'employee.read', 'employee.write', 'attendance.read', 'attendance.write',
    'payroll.read', 'payroll.write', 'payroll.approve',
    'finance.read', 'finance.write', 'reports.read', 'settings.read', 'settings.write',
    'audit.read', 'company.manage', 'branch.manage', 'employee.self',
  ];
  return [...new Set([...legacy, ...ALL_PERM_KEYS])];
};
