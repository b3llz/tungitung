// WELP CORE — ORGANIZATION MODEL v20
// rbac.js adalah dependensi satu arah (rbac tidak pernah
// mengimpor org.js) sehingga tidak ada siklus modul.
import { branchesInScope as _branchesInScope } from './rbac.js';

// ============================================================
// WELP CORE — ORGANIZATION MODEL v20
// ------------------------------------------------------------
// Struktur organisasi: PUSAT → REGION/AREA → CABANG → USER.
//
// Prinsip fundamental (requirement arsitektur):
//   • Cabang adalah ORGANIZATIONAL UNIT dengan branch ID —
//     BUKAN akun login bersama dan BUKAN milik satu orang.
//   • Semua manusia login dengan AKUN PRIBADI; sistem menentukan
//     identity, role, region, branch, department & permission
//     secara otomatis (claims enterprise / assignment legacy).
//   • Assignment fleksibel: Area Manager resign/pindah → pusat
//     cukup mengganti assignment user; cabang & histori data
//     tidak berubah dan tidak ikut hilang.
//
// Penyimpanan:
//   - regions   : koleksi tenants/{lic}/regions
//       { cid, name, code?, description?, aktif:true, createdAt }
//   - cabang    : tenants/{lic}/cabang (existing) + field baru:
//       { ..., regionId: <cid regions>|null, status:'aktif'|'nonaktif' }
//   - karyawan  : tenants/{lic}/karyawan + assignment:
//       { ..., regionIds:[], branchIds:[], department, email, uid }
// ============================================================

// ------------------------------------------------------------
// REGION — CRUD helpers murni (dipakai bersama UI & halaman lain)
// ------------------------------------------------------------

// Normalisasi daftar region mentah → bentuk aman + urut nama.
export const normRegions = (rows) => (Array.isArray(rows) ? rows : [])
  .filter(r => r && (r.cid || r.id))
  .map(r => ({
    cid: r.cid || r.id,
    name: String(r.name || '').trim() || 'Area tanpa nama',
    code: r.code ? String(r.code).trim().toUpperCase() : null,
    description: r.description ? String(r.description) : null,
    aktif: r.aktif !== false,
    createdAt: r.createdAt || null,
  }))
  .sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));

// Region by id (null-safe).
export const regionById = (regions, id) =>
  id ? ((regions || []).find(r => r.cid === id) || null) : null;

// Buat ID doc region baru yang stabil & unik terhadap daftar.
export const makeRegionId = (name, existing = []) => {
  const used = new Set((existing || []).filter(Boolean));
  const slug = String(name || 'area').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'area';
  let id = slug, n = 2;
  while (used.has(id)) { id = `${slug}-${n++}`; }
  return id;
};

// ------------------------------------------------------------
// CABANG — linkage region + status
// ------------------------------------------------------------

// Branch dgn konteks region (mengembalikan record + regionName).
export const branchWithContext = (branch, regions = []) => ({
  ...branch,
  regionId: branch?.regionId || null,
  regionName: regionById(regions, branch?.regionId)?.name || null,
  status: branch?.status || 'aktif',
});

// Cabang dalam satu region.
export const branchesOfRegion = (branches = [], regionId) =>
  (branches || []).filter(b => b.regionId === regionId);

// Peta regionId → [branch] untuk render tree organisasi.
export const branchesByRegion = (branches = [], regions = []) => {
  const map = new Map();
  (normRegions(regions)).forEach(r => map.set(r.cid, []));
  const orphan = [];
  (branches || []).forEach(b => {
    if (b.regionId && map.has(b.regionId)) map.get(b.regionId).push(b);
    else orphan.push(b);
  });
  return { byRegion: map, orphan };
};

// Opsi region untuk <Select> (plus opsi tanpa region).
export const regionOptions = (regions = [], withNone = true) => {
  const opts = normRegions(regions).map(r => ({ value: r.cid, label: r.name }));
  return withNone ? [{ value: '', label: '— Tanpa Region —' }, ...opts] : opts;
};

// ------------------------------------------------------------
// ASSIGNMENT USER — fleksibel, tidak menyentuh cabang
// ------------------------------------------------------------

// Karyawan↔cabang multi (existing core.empBranchIds diperluas di sini
// agar welp-core mandiri). Urutan: primer dulu, tanpa duplikat.
export const empBranchIds = (e) => {
  const ids = [e?.branchId, ...(Array.isArray(e?.branchIds) ? e.branchIds : [])].filter(Boolean);
  return [...new Set(ids)];
};

// Region efektif milik karyawan (assignment eksplisit).
export const empRegionIds = (e) =>
  Array.isArray(e?.regionIds) ? e.regionIds.filter(Boolean) : [];

// Daftar cabang yang dikelola karyawan (assignment → resolusi region).
export const managedBranchesOf = (employee, branches = []) => {
  if (!employee) return [];
  const rids = new Set(empRegionIds(employee));
  const bids = new Set(empBranchIds(employee));
  return (branches || []).filter(b =>
    bids.has(b.cid) || (b.regionId && rids.has(b.regionId)));
};

// Department — string bebas, dipakai filter scope & laporan HR.
export const DEPARTMENTS = [
  'Operasional', 'Kasir', 'Gudang', 'Purchasing', 'Finance', 'Accounting',
  'HRD', 'Marketing', 'IT', 'Manajemen',
];
export const departmentOf = (e) => (e?.department ? String(e.department) : null);

// Ringkasan assignment utk kartu profil organisasi.
export const assignmentSummary = (employee, branches = [], regions = []) => {
  const ids = empBranchIds(employee);
  const rids = empRegionIds(employee);
  return {
    branches: ids.map(id => ({
      id,
      name: (branches || []).find(b => b.cid === id)?.name || id,
    })),
    regions: rids.map(id => ({
      id,
      name: regionById(regions, id)?.name || id,
    })),
    department: departmentOf(employee),
  };
};

// ------------------------------------------------------------
// SCOPE → FILTER DATA OPERASIONAL
// ------------------------------------------------------------
// Semua halaman Business memfilter data operasional lewat helper
// ini supaya Area Manager/Store Manager hanya melihat cabang
// dalam scope mereka. (Rules Firestore menegakkan di server;
// helper ini menyaring tampilan + query agar konsisten.)

export const filterByScope = (rows, scope, branches, key = 'branchId') => {
  if (!scope || scope.type === 'org') return rows || [];
  const allowed = new Set(_branchesInScope(scope, branches).map(b => b.cid));
  return (rows || []).filter(r => !r[key] || allowed.has(r[key]));
};

// ------------------------------------------------------------
// ORG TREE — struktur lengkap utk halaman Organization
// ------------------------------------------------------------
export const buildOrgTree = (branches = [], regions = [], employees = []) => {
  const reg = normRegions(regions);
  const root = {
    id: 'PUSAT',
    name: 'Pusat (Head Office)',
    type: 'root',
    children: [],
  };
  const { byRegion, orphan } = branchesByRegion(branches, reg);
  reg.forEach(r => {
    const brs = byRegion.get(r.cid) || [];
    root.children.push({
      id: r.cid, name: r.name, code: r.code, type: 'region',
      aktif: r.aktif,
      branchCount: brs.length,
      employeeCount: (employees || []).filter(e =>
        empRegionIds(e).includes(r.cid) ||
        e.regionId === r.cid ||
        brs.some(b => empBranchIds(e).includes(b.cid))).length,
      children: brs.map(b => ({
        id: b.cid, name: b.name, type: 'branch',
        regionId: r.cid, status: b.status || 'aktif',
        location: b.location || null,
        employeeCount: (employees || []).filter(e => empBranchIds(e).includes(b.cid)).length,
      })),
    });
  });
  orphan.forEach(b => {
    root.children.push({
      id: b.cid, name: b.name, type: 'branch',
      regionId: null, status: b.status || 'aktif',
      location: b.location || null,
      employeeCount: (employees || []).filter(e => empBranchIds(e).includes(b.cid)).length,
      children: [],
    });
  });
  return root;
};

// ------------------------------------------------------------
// VALIDASI SEBELUM TULIS (mencegah data organisasi rusak)
// ------------------------------------------------------------
export const validateRegion = (name) => {
  const n = String(name || '').trim();
  if (n.length < 2) return 'Nama region minimal 2 karakter.';
  if (n.length > 60) return 'Nama region maksimal 60 karakter.';
  return null;
};

export const validateBranchRegion = (branchId, regionId, branches = [], regions = []) => {
  if (regionId && !regionById(regions, regionId)) return 'Region tidak ditemukan.';
  return null;
};
