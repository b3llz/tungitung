// ============================================================
// WELP BUSINESS — GOVERNANCE PAGES v20
// ------------------------------------------------------------
// 1. OrganizationTab  : Pusat → Region/Area → Cabang (tree),
//                       CRUD region, penetapan region per cabang,
//                       ringkasan SDM per unit organisasi.
// 2. RolesTab         : Role & Permission engine UI — role bawaan
//                       + custom role (Area Manager, HRD, Auditor,
//                       dst.) dengan matrix permission granular
//                       (view/create/edit/delete/approve/export/
//                       manage) dan scope akses.
// 3. ApprovalTab      : Pusat persetujuan — payroll & cuti yang
//                       menunggu keputusan, sesuai scope.
// 4. AuditTab         : Penjelajah audit log (append-only) dengan
//                       filter aksi/aktor/cabang sesuai scope.
//
// SEMUA halaman tunduk pada scope (org → region → branch) dan
// permission granular; otorisasi sesungguhnya tetap di server
// (claims + Firestore Rules).
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  JaringanBuddy, Cabang, Tim, Plus, Edit3, Trash2, Check, Search,
  PerisaiBuddy, BadgeCheck, History, BahayaBuddy, Lokasi, MedaliBuddy,
  Kredensial, Riwayat, StrukCetak, Toko,
} from '../welp-icons.jsx';
import {
  formatIDR, useTenantCol, trustedTime, dayLabel, auditLog,
  PAYROLL_FLOW, CUTI_FLOW, CUTI_TYPES,
} from '../core.jsx';
import {
  PERM_DOMAINS, ALL_PERM_KEYS, ROLE_PRESETS_V20, ROLE_META_V20,
  getRbacConfig, allRoleDefs, expandPerms, canDo, scopeOf, normScope,
  branchesInScope, NAV_PERMS_V20, LEGACY_EXPANSION,
} from '../welp-core/rbac.js';
import {
  normRegions, makeRegionId, regionById, branchesByRegion,
  empBranchIds, empRegionIds,
} from '../welp-core/org.js';
import { Button, Card, PageTitle, Badge, EmptyState, Modal, Select, ConfirmDialog } from '../ui';

/* ---------- util ---------- */
const fmtDT = (ms) => new Date(ms).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const LiveDot = ({ live }) => (
  <span className={`inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest ${live ? 'text-leaf-deep dark:text-leaf' : 'text-gold-deep dark:text-gold'}`}>
    <span className={`w-2 h-2 rounded-full ${live ? 'bg-leaf animate-pulse-dot' : 'bg-gold'}`} />
    {live ? 'Realtime' : 'Mode Lokal'}
  </span>
);

/* Hook kecil: employee record + scope efektif sesi (dipakai lintas halaman) */
const useSessionScope = (licenseInfo, employees) => {
  const me = useMemo(() => {
    if (!licenseInfo) return null;
    const uid = licenseInfo.uid || null;
    const email = String(licenseInfo.email || '').toLowerCase();
    if (licenseInfo.employeeCid) {
      const r = (employees || []).find(k => k.cid === licenseInfo.employeeCid);
      if (r) return r;
    }
    if (uid) {
      const r = (employees || []).find(k => k.uid === uid);
      if (r) return r;
    }
    if (email) {
      const r = (employees || []).find(k => String(k.email || '').toLowerCase() === email);
      if (r) return r;
    }
    return null;
  }, [licenseInfo, employees]);
  const scope = scopeOf(licenseInfo, me);
  return { me, scope };
};

/* ============================================================
   1. ORGANIZATION TAB — Pusat → Region → Cabang
   ============================================================ */
export const OrganizationTab = ({ licenseInfo, triggerAlert, perms }) => {
  const { items: regions, live, addRow: addRegion, updateRow: updateRegion, removeRow: removeRegion } = useTenantCol(licenseInfo, 'regions', 'regions_db');
  const { items: branches, updateRow: updateBranch } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');

  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [assignFor, setAssignFor] = useState(null);      // branch object
  const [assignRegion, setAssignRegion] = useState('');

  const reg = normRegions(regions);
  const { byRegion, orphan } = branchesByRegion(branches, reg);
  const canManage = canDo(perms, 'org.manage');

  const saveRegion = () => {
    if (!form.name.trim()) return triggerAlert('Nama region wajib diisi.', 'error');
    if (editing) {
      updateRegion(editing.cid, { name: form.name.trim(), code: form.code.trim().toUpperCase() || null, description: form.description.trim() || null });
      auditLog(licenseInfo, 'REGION_UPDATE', { target: editing.cid, name: form.name.trim() });
      triggerAlert('Region diperbarui.', 'success');
    } else {
      const id = makeRegionId(form.name, reg.map(r => r.cid));
      addRegion({ cid: id, name: form.name.trim(), code: form.code.trim().toUpperCase() || null, description: form.description.trim() || null, aktif: true });
      auditLog(licenseInfo, 'REGION_CREATE', { target: id, name: form.name.trim() });
      triggerAlert(`Region "${form.name.trim()}" dibuat. Cabang kini bisa ditugaskan ke region ini.`, 'success');
    }
    setForm({ name: '', code: '', description: '' });
    setEditing(null);
  };

  const doDeleteRegion = () => {
    const r = confirmDel;
    if (!r) return;
    const attached = (branches || []).filter(b => b.regionId === r.cid).length;
    if (attached > 0) {
      triggerAlert(`Region masih memuat ${attached} cabang. Pindahkan cabangnya dulu ke region lain.`, 'error');
      setConfirmDel(null);
      return;
    }
    removeRegion(r.cid);
    auditLog(licenseInfo, 'REGION_DELETE', { target: r.cid, name: r.name });
    triggerAlert('Region dihapus.', 'success');
    setConfirmDel(null);
  };

  const saveAssign = () => {
    if (!assignFor) return;
    updateBranch(assignFor.cid, { regionId: assignRegion || null });
    auditLog(licenseInfo, 'BRANCH_REGION_ASSIGN', { target: assignFor.cid, branch: assignFor.name, region: assignRegion || null });
    triggerAlert(`Cabang ${assignFor.name} kini berada di ${assignRegion ? (regionById(reg, assignRegion)?.name || 'region') : 'luar region'}.`, 'success');
    setAssignFor(null); setAssignRegion('');
  };

  const employeeCountForBranch = (bid) => (employees || []).filter(e => empBranchIds(e).includes(bid)).length;
  const employeeCountForRegion = (rid, brs) => (employees || []).filter(e =>
    empRegionIds(e).includes(rid) || brs.some(b => empBranchIds(e).includes(b.cid))).length;

  return (
    <div className="max-w-4xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Organisasi & Region" sub="Struktur Pusat → Region/Area → Cabang — cabang adalah unit organisasi, bukan akun login"
        right={<LiveDot live={live} />} />

      {/* ---------- FORM REGION ---------- */}
      <Card title={editing ? `Edit Region: ${editing.name}` : 'Tambah Region / Area'} icon={editing ? Edit3 : Plus}
        help="Region (area) mengelompokkan cabang untuk penugasan Area Manager. Contoh: Region Jakarta, Region Bandung. Area Manager yang ditugaskan di region otomatis mengelola semua cabang di dalamnya.">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-3">
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Nama Region</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="field" placeholder="misal: Region Jakarta" />
          </div>
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Kode (opsional)</label>
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="field font-mono uppercase" placeholder="JKT" />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={saveRegion} icon={editing ? Check : Plus}>{editing ? 'Simpan' : 'Tambah'}</Button>
            {editing && <Button variant="secondary" onClick={() => { setEditing(null); setForm({ name: '', code: '', description: '' }); }}>Batal</Button>}
          </div>
        </div>
      </Card>

      {/* ---------- ORG TREE ---------- */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv flex items-center gap-2"><JaringanBuddy className="w-4 h-4 text-flame-600 dark:text-apricot" /> Struktur Organisasi</h3>
          <span className="text-[10px] font-bold text-ink-faint">{reg.length} region · {(branches || []).length} cabang</span>
        </div>

        {/* ROOT: PUSAT */}
        <div className="card p-4.5 border-chrome-edge">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-chrome-deep text-white flex items-center justify-center shrink-0"><Toko className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-[14px] text-ink dark:text-ink-inv">Pusat (Head Office)</p>
              <p className="text-[10px] font-bold text-ink-faint">Kontrol penuh seluruh organisasi · {employeeCountForBranch('PUSAT')} karyawan tercatat di Pusat</p>
            </div>
            <Badge tone="gold">Root</Badge>
          </div>
        </div>

        {reg.length === 0 && orphan.length === (branches || []).length && (
          <EmptyState mascot="pikir" icon={JaringanBuddy} compact
            title="Belum ada region"
            desc="Cabang-cabang saat ini berdiri sendiri. Buat region (contoh: Region Jakarta) lalu tugaskan cabang ke dalamnya supaya Area Manager bisa mengelola per wilayah." />
        )}

        {reg.map(r => {
          const brs = byRegion.get(r.cid) || [];
          return (
            <div key={r.cid} className="card p-4.5">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><JaringanBuddy className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-extrabold text-[14px] text-ink dark:text-ink-inv">{r.name}</p>
                    {r.code && <Badge tone="grey">{r.code}</Badge>}
                    {r.aktif === false && <Badge tone="red">Nonaktif</Badge>}
                  </div>
                  <p className="text-[10px] font-bold text-ink-faint mt-0.5">
                    {brs.length} cabang · {employeeCountForRegion(r.cid, brs)} karyawan dalam scope
                    {r.description ? ` · ${r.description}` : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { setEditing(r); setForm({ name: r.name, code: r.code || '', description: r.description || '' }); }}
                      className="p-2 rounded-xl bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot press" aria-label="Edit region"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => setConfirmDel(r)}
                      className="p-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick press" aria-label="Hapus region"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              <div className="mt-3 ml-4 sm:ml-6 space-y-2 border-l-2 border-line dark:border-line-dark pl-3">
                {brs.length === 0 && <p className="text-[10.5px] font-bold text-ink-faint py-1.5">Belum ada cabang di region ini.</p>}
                {brs.map(b => (
                  <div key={b.cid} className="flex items-center gap-3 p-3 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
                    <span className="w-8 h-8 rounded-xl bg-surface dark:bg-white/10 text-ink-faint flex items-center justify-center shrink-0"><Cabang className="w-4 h-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[12px] text-ink dark:text-ink-inv truncate">{b.name}</p>
                      <p className="text-[9.5px] font-semibold text-ink-faint truncate flex items-center gap-1">
                        <Lokasi className="w-3 h-3 shrink-0" />{b.location || 'Lokasi belum diisi'} · {employeeCountForBranch(b.cid)} karyawan
                      </p>
                    </div>
                    {canManage && (
                      <button onClick={() => { setAssignFor(b); setAssignRegion(b.regionId || ''); }}
                        className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-extrabold bg-surface dark:bg-white/10 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70 press shrink-0">Pindah Region</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* cabang tanpa region */}
        {orphan.length > 0 && (
          <div className="card p-4.5 border-dashed">
            <p className="font-extrabold text-[12.5px] text-ink-soft dark:text-ink-inv/80 mb-2 flex items-center gap-2"><Cabang className="w-4 h-4 text-ink-faint" /> Cabang di luar region ({orphan.length})</p>
            <div className="space-y-2">
              {orphan.map(b => (
                <div key={b.cid} className="flex items-center gap-3 p-3 rounded-2xl bg-paper dark:bg-white/[.03]">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[12px] text-ink dark:text-ink-inv truncate">{b.name}</p>
                    <p className="text-[9.5px] font-semibold text-ink-faint">{employeeCountForBranch(b.cid)} karyawan</p>
                  </div>
                  {canManage && (
                    <button onClick={() => { setAssignFor(b); setAssignRegion(b.regionId || ''); }}
                      className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-extrabold bg-flame-50 dark:bg-flame-900/30 text-flame-700 dark:text-apricot press shrink-0">Tugaskan Region</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: assign region */}
      <Modal open={!!assignFor} onClose={() => setAssignFor(null)} title="Penetapan Region Cabang"
        sub={assignFor?.name} width="max-w-sm"
        footer={<>
          <Button variant="secondary" onClick={() => setAssignFor(null)}>Batal</Button>
          <Button onClick={saveAssign} icon={Check}>Simpan</Button>
        </>}>
        <p className="text-[11px] font-semibold text-ink-faint leading-relaxed mb-3">
          Menetapkan region TIDAK mengubah data, histori, atau pengguna cabang. Area Manager yang scope-nya region ini otomatis mengelola cabang berikut.
        </p>
        <Select label="Region" value={assignRegion ? (regionById(reg, assignRegion)?.name || '— Tanpa Region —') : '— Tanpa Region —'}
          options={['— Tanpa Region —', ...reg.map(r => r.name)]}
          onChange={v => setAssignRegion(v === '— Tanpa Region —' ? '' : (reg.find(r => r.name === v)?.cid || ''))} />
      </Modal>

      <ConfirmDialog open={!!confirmDel} danger title={`Hapus region "${confirmDel?.name}"?`}
        message="Region kosong saja yang bisa dihapus. Cabang & data historis tidak akan terpengaruh."
        onConfirm={doDeleteRegion} onCancel={() => setConfirmDel(null)} />
    </div>
  );
};

/* ============================================================
   2. ROLES TAB — Role & Permission Engine
   ============================================================ */
const ScopeBadge = ({ scope }) => {
  const s = normScope(scope);
  const map = { org: { tone: 'gold', label: 'Seluruh Organisasi' }, region: { tone: 'teal', label: 'Region Tertentu' }, branch: { tone: 'lime', label: 'Cabang Tertentu' }, self: { tone: 'grey', label: 'Data Pribadi' } };
  const m = map[s.type] || map.org;
  return <Badge tone={m.tone}>{m.label}</Badge>;
};

export const RolesTab = ({ licenseInfo, triggerAlert, perms }) => {
  const { items: settings, live, addRow, updateRow } = useTenantCol(licenseInfo, 'pengaturan', 'pengaturan_db');
  const { legacyMatrix, customRoles } = getRbacConfig(settings);
  const defs = allRoleDefs({ legacyMatrix, customRoles });
  const rolesRec = settings.find(s => s.key === 'roles');

  const [editingKey, setEditingKey] = useState(null);     // role key yang sedang diedit
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: '', label: '', atasan: false, scopeType: 'org', permissions: [] });
  const [keyErr, setKeyErr] = useState('');

  const canManage = canDo(perms, 'roles.manage');
  const roleList = Object.values(defs);

  const persist = (nextMatrix, nextCustom) => {
    const payload = { key: 'roles', matrix: nextMatrix, customRoles: nextCustom };
    if (rolesRec) updateRow(rolesRec.cid, payload);
    else addRow(payload);
    auditLog(licenseInfo, 'ROLE_MATRIX_UPDATE', { customRoles: nextCustom.length });
  };

  const startCreate = () => {
    setForm({ key: '', label: '', atasan: false, scopeType: 'org', permissions: ['dashboard.view'] });
    setKeyErr(''); setCreating(true);
  };
  const startEditCustom = (r) => {
    setForm({ key: r.key, label: r.label, atasan: !!r.atasan, scopeType: normScope(r.scope).type, permissions: [...(r.permissions || [])] });
    setKeyErr(''); setCreating(true);
  };

  const saveCustom = () => {
    const key = form.key.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    if (!form.label.trim()) return triggerAlert('Nama role wajib diisi (mis. Area Manager, Auditor).', 'error');
    if (!key || key.length < 3) return triggerAlert('Key role minimal 3 karakter (huruf/angka).', 'error');
    if (!editingKey && (defs[key])) return triggerAlert(`Key "${key}" sudah dipakai role lain.`, 'error');
    if (form.permissions.length === 0) return triggerAlert('Pilih minimal satu permission.', 'error');
    const scope = form.scopeType === 'org' ? { type: 'org' } : { type: form.scopeType };
    let nextCustom = [...customRoles];
    if (editingKey) {
      nextCustom = nextCustom.map(r => (r.key === editingKey ? { ...r, key, label: form.label.trim(), atasan: form.atasan, scope, permissions: form.permissions } : r));
    } else {
      nextCustom.push({ key, label: form.label.trim(), atasan: form.atasan, scope, permissions: form.permissions });
    }
    persist(legacyMatrix, nextCustom);
    auditLog(licenseInfo, editingKey ? 'ROLE_CUSTOM_UPDATE' : 'ROLE_CUSTOM_CREATE', { target: key, perms: form.permissions.length });
    triggerAlert(editingKey ? `Role ${form.label} diperbarui.` : `Role custom "${form.label}" dibuat & langsung aktif.`, 'success');
    setCreating(false); setEditingKey(null);
  };

  const deleteCustom = (r) => {
    if (!confirm(`Hapus role custom "${r.label}"? Pengguna dengan role ini akan kehilangan akses kecuali diganti.`)) return;
    persist(legacyMatrix, customRoles.filter(x => x.key !== r.key));
    auditLog(licenseInfo, 'ROLE_CUSTOM_DELETE', { target: r.key });
    triggerAlert('Role custom dihapus.', 'success');
  };

  /* Toggle permission untuk SEMUA jenis role:
     - builtin → tulis ke legacyMatrix[key] (kompatibel editor lama)
     - custom  → tulis ke customRoles[i].permissions */
  const togglePerm = (roleDef, permKey) => {
    if (!canManage) return;
    if (roleDef.builtin) {
      const current = legacyMatrix[roleDef.key] || ROLE_PRESETS_V20[roleDef.key] || [];
      const has = current.includes(permKey);
      const next = has ? current.filter(k => k !== permKey) : [...current, permKey];
      // Owner tidak boleh kehilangan roles.manage agar tidak mengunci dirinya.
      if (roleDef.key === 'owner' && permKey === 'roles.manage' && has) {
        return triggerAlert('Owner selalu memegang kontrol Role & Permission.', 'error');
      }
      persist({ ...legacyMatrix, [roleDef.key]: next }, customRoles);
    } else {
      const nextCustom = customRoles.map(r => {
        if (r.key !== roleDef.key) return r;
        const has = (r.permissions || []).includes(permKey);
        return { ...r, permissions: has ? r.permissions.filter(k => k !== permKey) : [...(r.permissions || []), permKey] };
      });
      persist(legacyMatrix, nextCustom);
    }
  };

  const currentPermsOf = (roleDef) => expandPerms(roleDef.permissions);

  return (
    <div className="max-w-5xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Role & Permission" sub="Custom role bebas (Area Manager, HRD, Auditor, ...) + permission granular per aksi"
        right={<LiveDot live={live} />}
      />

      <Card title="Cara Kerja" icon={PerisaiBuddy}
        help="Permission granular = domain.aksi. Contoh: payroll.approve berarti boleh menyetujui payroll. Scope menentukan data mana yang terlihat: seluruh organisasi, region tertentu, atau cabang tertentu. Untuk akun enterprise (Akun WELP), perubahan role diterapkan ke claims server melalui provisioning agar otorisasi backend ikut berubah.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold">
          {[['view', 'Melihat data'], ['create', 'Membuat'], ['edit', 'Mengubah'], ['delete', 'Menghapus'], ['approve', 'Menyetujui'], ['export', 'Mengunduh'], ['manage', 'Kontrol penuh'], ['use', 'Mengoperasikan']].map(([k, v]) => (
            <div key={k} className="p-2.5 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark">
              <p className="font-mono text-[10px] text-flame-700 dark:text-apricot">.{k}</p>
              <p className="text-ink-faint mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </Card>

      {canManage && (
        <Button onClick={startCreate} icon={Plus}>Buat Role Custom</Button>
      )}

      {/* Daftar role */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {roleList.map(r => {
          const p = currentPermsOf(r);
          const isBuiltin = r.builtin;
          return (
            <div key={r.key} className="card p-4.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-extrabold text-[13.5px] text-ink dark:text-ink-inv">{r.label}</p>
                    {isBuiltin ? <Badge tone="grey">Bawaan</Badge> : <Badge tone="lime">Custom</Badge>}
                    {r.atasan && <Badge tone="gold">Atasan</Badge>}
                  </div>
                  <p className="text-[9.5px] font-mono text-ink-faint mt-0.5 truncate">{r.key}</p>
                </div>
                <ScopeBadge scope={isBuiltin ? { type: (ROLE_META_V20[r.key] || {}).scope || 'org' } : r.scope} />
              </div>
              <p className="text-[10.5px] font-bold text-ink-faint mt-2.5">{p.size} permission aktif</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {[...p].slice(0, 8).map(k => (
                  <span key={k} className="px-1.5 py-0.5 rounded-md bg-paper dark:bg-white/5 text-[8.5px] font-mono font-bold text-ink-faint">{k}</span>
                ))}
                {p.size > 8 && <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold text-ink-faint">+{p.size - 8} lainnya</span>}
              </div>
              {canManage && (
                <div className="flex gap-1.5 mt-3">
                  <Button variant="secondary" className="flex-1 py-2 text-[11px]" icon={Edit3}
                    onClick={() => { setEditingKey(r.key); }}>{editingKey === r.key ? 'Sedang Diedit' : 'Edit Permission'}</Button>
                  {!isBuiltin && (
                    <button onClick={() => deleteCustom(r)} className="p-2 rounded-xl bg-brick-soft dark:bg-brick/10 text-brick press" aria-label="Hapus role"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Editor matrix granular */}
      {editingKey && defs[editingKey] && (
        <Card title={`Permission — ${defs[editingKey].label}`} icon={Kredensial}
          help="Kartu hijau = permission aktif untuk role ini. Perubahan tersimpan realtime per tenant dan langsung dipakai menu, guard halaman, halaman monitoring, payroll & absensi.">
          <div className="space-y-4">
            {PERM_DOMAINS.map(dom => {
              const domPerms = dom.actions.map(a => `${dom.key}.${a}`);
              const activeCount = domPerms.filter(k => currentPermsOf(defs[editingKey]).has(k)).length;
              return (
                <div key={dom.key} className="p-3.5 rounded-2xl bg-paper dark:bg-white/[.03] border border-line dark:border-line-dark">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[12px] text-ink dark:text-ink-inv">{dom.label}</p>
                      <p className="text-[9.5px] font-semibold text-ink-faint">{dom.desc}</p>
                    </div>
                    <span className={`text-[9px] font-extrabold px-2 py-1 rounded-full shrink-0 ${activeCount === domPerms.length ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf' : activeCount > 0 ? 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold' : 'bg-paper dark:bg-white/5 text-ink-faint'}`}>
                      {activeCount}/{domPerms.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {domPerms.map(k => {
                      const on = currentPermsOf(defs[editingKey]).has(k);
                      return (
                        <button key={k} onClick={() => togglePerm(defs[editingKey], k)} disabled={!canManage}
                          className={`px-2.5 py-1.5 rounded-xl text-[9.5px] font-mono font-extrabold border transition press disabled:opacity-60 ${on
                            ? 'bg-leaf-soft dark:bg-leaf/15 border-leaf/30 text-leaf-deep dark:text-leaf'
                            : 'bg-surface dark:bg-white/5 border-line dark:border-line-dark text-ink-faint hover:border-flame-300'}`}>
                          {on ? '✓ ' : ''}{k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setEditingKey(null)}>Selesai</Button>
          </div>
        </Card>
      )}

      {/* MODAL: create/edit custom role meta */}
      <Modal open={creating} onClose={() => { setCreating(false); setEditingKey(null); }}
        title={editingKey ? 'Edit Role Custom' : 'Buat Role Custom'}
        sub="Contoh: Area Manager, HRD, Finance, Accounting, Purchasing, Kepala Toko, Auditor" width="max-w-md"
        footer={<>
          <Button variant="secondary" onClick={() => { setCreating(false); setEditingKey(null); }}>Batal</Button>
          <Button onClick={saveCustom} icon={Check}>Simpan Role</Button>
        </>}>
        <div className="space-y-3.5">
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Nama Role (tampil di UI)</label>
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="field" placeholder="misal: Area Manager" />
          </div>
          {!editingKey && (
            <div>
              <label className="kicker block mb-1.5 ml-0.5">Key (unik, tanpa spasi)</label>
              <input value={form.key} onChange={e => { setForm({ ...form, key: e.target.value.toLowerCase() }); setKeyErr(''); }} className="field font-mono" placeholder="misal: area_manager" />
              {keyErr && <p className="text-[10px] font-bold text-brick mt-1">{keyErr}</p>}
            </div>
          )}
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Scope Data Default</label>
            <Select
              value={form.scopeType === 'org' ? 'Seluruh Organisasi (org-wide)' : form.scopeType === 'region' ? 'Region Tertentu (assignment per karyawan)' : 'Cabang Tertentu (assignment per karyawan)'}
              onChange={(v) => setForm({ ...form, scopeType: v.startsWith('Region') ? 'region' : v.startsWith('Cabang') ? 'branch' : 'org' })}
              options={[
                'Seluruh Organisasi (org-wide)',
                'Region Tertentu (assignment per karyawan)',
                'Cabang Tertentu (assignment per karyawan)',
              ]} />
            <p className="text-[9.5px] font-semibold text-ink-faint mt-1.5 leading-relaxed">
              Untuk region/cabang: tiap pemegang role ditugaskan lewat Manajemen Karyawan (regionIds / branchIds). Pusat cukup mengganti assignment tanpa menyentuh cabang.
            </p>
          </div>
          <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-paper dark:bg-white/[.03] cursor-pointer">
            <input type="checkbox" checked={form.atasan} onChange={e => setForm({ ...form, atasan: e.target.checked })} className="w-4 h-4 accent-[#D84312]" />
            <span className="text-[11px] font-bold text-ink-soft dark:text-ink-inv/80">Role atasan (bisa menyetujui pengajuan bawahannya)</span>
          </label>
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Permission Awal (bisa diubah setelahnya)</label>
            <Select
              value={form.permissions.length === 0 ? 'Kosong (atur manual)' : `Custom (${form.permissions.length} permission terpilih)`}
              onChange={(v) => {
                if (v === 'Kosong (atur manual)') setForm({ ...form, permissions: [] });
                else if (v === 'Preset: Area Manager') setForm({ ...form, permissions: [...ROLE_PRESETS_V20.areamanager] });
                else if (v === 'Preset: HR') setForm({ ...form, permissions: [...ROLE_PRESETS_V20.hr] });
                else if (v === 'Preset: Auditor (read-only)') setForm({ ...form, permissions: [...ROLE_PRESETS_V20.auditor] });
              }}
              options={[
                form.permissions.length ? `Custom (${form.permissions.length} permission terpilih)` : 'Pilih preset...',
                'Preset: Area Manager',
                'Preset: HR',
                'Preset: Auditor (read-only)',
                'Kosong (atur manual)',
              ]} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ============================================================
   3. APPROVAL TAB — Pusat Persetujuan
   ============================================================ */
export const ApprovalTab = ({ licenseInfo, triggerAlert, perms, sessionRole }) => {
  const { items: payroll, live, updateRow: updatePayroll } = useTenantCol(licenseInfo, 'payroll', 'payroll_db');
  const { items: pengajuan, updateRow: updatePengajuan } = useTenantCol(licenseInfo, 'pengajuan', 'pengajuan_db');
  const { items: branches } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { scope } = useSessionScope(licenseInfo, employees);

  const [rejectFor, setRejectFor] = useState(null);   // {kind:'payroll'|'cuti', rec}
  const [rejectNote, setRejectNote] = useState('');
  const [seg, setSeg] = useState('payroll');

  const scopedBranches = branchesInScope(scope, branches);
  const allowed = new Set(scopedBranches.map(b => b.cid));
  const inScope = (row) => normScope(scope).type === 'org' || !row.branchId || allowed.has(row.branchId);

  const canApprovePayroll = canDo(perms, 'payroll.approve');
  const canApproveCuti = canDo(perms, 'attendance.approve');

  const pendingPayroll = (payroll || []).filter(p => p.status === 'DIAJUKAN' && inScope(p))
    .sort((a, b) => trustedTime(a).ms - trustedTime(b).ms);
  const pendingCuti = (pengajuan || []).filter(p => (p.status === 'DIAJUKAN' || p.status === 'DITINJAU') && inScope(p))
    .sort((a, b) => trustedTime(a).ms - trustedTime(b).ms);

  const actor = licenseInfo?.employeeName || licenseInfo?.tenant || 'Atasan';
  const theRole = sessionRole || licenseInfo?.currentUserRole || 'owner';

  const approvePayroll = (rec) => {
    const approvals = [...(Array.isArray(rec.approvals) ? rec.approvals : []), { action: 'approve', by: actor, role: theRole, at: Date.now(), method: 'Akun WELP', note: 'Disetujui lewat Pusat Persetujuan' }];
    updatePayroll(rec.cid, {
      status: 'DISETUJUI',
      history: [...(Array.isArray(rec.history) ? rec.history : []), { from: rec.status, to: 'DISETUJUI', by: actor, role: theRole, at: Date.now(), note: 'Disetujui lewat Pusat Persetujuan' }],
      approvals,
    });
    auditLog(licenseInfo, 'PAYROLL_APPROVE', { target: rec.cid, karyawan: rec.employeeName, periode: rec.period });
    triggerAlert(`Payroll ${rec.employeeName} (${rec.period}) disetujui. Lanjut ke Manajemen Penggajian untuk pembayaran.`, 'success');
  };

  const reviewCuti = (rec, to, note = '') => {
    updatePengajuan(rec.cid, {
      status: to,
      ...(to === 'DITOLAK' ? { rejectReason: note } : {}),
      history: [...(Array.isArray(rec.history) ? rec.history : []), { from: rec.status, to, by: actor, role: theRole, at: Date.now(), note }],
    });
    auditLog(licenseInfo, 'PENGAJUAN_' + to, { target: rec.cid, karyawan: rec.employeeName, jenis: rec.type, note });
    triggerAlert(to === 'DISETUJUI' ? `Pengajuan ${rec.employeeName} disetujui.` : 'Pengajuan ditolak, alasannya dikirim ke yang bersangkutan.', 'success');
  };

  const doReject = () => {
    if (!rejectFor || !rejectNote.trim()) return triggerAlert('Tulis dulu alasannya.', 'error');
    if (rejectFor.kind === 'payroll') {
      const rec = rejectFor.rec;
      const approvals = [...(Array.isArray(rec.approvals) ? rec.approvals : []), { action: 'reject', by: actor, role: theRole, at: Date.now(), method: 'Akun WELP', note: rejectNote.trim() }];
      updatePayroll(rec.cid, {
        status: 'DITOLAK', rejectReason: rejectNote.trim(),
        history: [...(Array.isArray(rec.history) ? rec.history : []), { from: rec.status, to: 'DITOLAK', by: actor, role: theRole, at: Date.now(), note: rejectNote.trim() }],
        approvals,
      });
      auditLog(licenseInfo, 'PAYROLL_REJECT', { target: rec.cid, karyawan: rec.employeeName, note: rejectNote.trim() });
    } else {
      reviewCuti(rejectFor.rec, 'DITOLAK', rejectNote.trim());
    }
    setRejectFor(null); setRejectNote('');
    triggerAlert('Keputusan ditolak tercatat & dikirim ke pemohon.', 'success');
  };

  const totalPending = pendingPayroll.length + pendingCuti.length;

  return (
    <div className="max-w-4xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Pusat Persetujuan" sub={`${totalPending} keputusan menunggu${normScope(scope).type !== 'org' ? ' · sesuai scope Anda' : ''}`}
        right={<LiveDot live={live} />} />

      <div className="flex gap-1.5 p-1 bg-surface dark:bg-white/5 rounded-2xl border border-line dark:border-line-dark w-fit">
        {[
          { id: 'payroll', label: `Payroll (${pendingPayroll.length})` },
          { id: 'cuti', label: `Cuti & Izin (${pendingCuti.length})` },
        ].map(it => (
          <button key={it.id} onClick={() => setSeg(it.id)}
            className={`px-4 py-2 rounded-xl text-[11px] font-extrabold transition press ${seg === it.id ? 'bg-flame-500 text-white shadow-card' : 'text-ink-faint hover:text-ink-soft dark:hover:text-ink-inv'}`}>
            {it.label}
          </button>
        ))}
      </div>

      {seg === 'payroll' && (
        <div className="space-y-3">
          {pendingPayroll.length === 0 ? (
            <EmptyState mascot="proud-mantap" icon={BadgeCheck} title="Tidak ada payroll menunggu"
              desc="Semua pengajuan payroll dalam scope Anda sudah diputuskan. Item baru akan muncul di sini secara realtime." />
          ) : pendingPayroll.map(p => {
            const flow = PAYROLL_FLOW[p.status] || PAYROLL_FLOW.DIAJUKAN;
            return (
              <div key={p.cid} className="card p-4.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-extrabold text-[14px] text-ink dark:text-ink-inv">{p.employeeName || 'Karyawan'}</p>
                      <Badge tone="gold">{flow.label}</Badge>
                      {p.branchName && <Badge tone="grey">{p.branchName}</Badge>}
                    </div>
                    <p className="text-[10.5px] font-bold text-ink-faint mt-1">
                      Periode {p.period} · {p.empId || '-'} · HK {p.hk ?? '-'}{p.telat ? ` · Telat ${p.telat}x` : ''}
                    </p>
                  </div>
                  <p className="text-xl font-extrabold money text-ink dark:text-ink-inv shrink-0">{formatIDR(p.amount)}</p>
                </div>
                {canApprovePayroll && (
                  <div className="flex gap-2 mt-3.5">
                    <Button onClick={() => approvePayroll(p)} icon={Check} className="flex-1 py-2.5 text-xs">Setujui</Button>
                    <Button variant="danger" onClick={() => setRejectFor({ kind: 'payroll', rec: p })} icon={BahayaBuddy} className="py-2.5 text-xs">Tolak</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {seg === 'cuti' && (
        <div className="space-y-3">
          {pendingCuti.length === 0 ? (
            <EmptyState mascot="senang" icon={BadgeCheck} title="Tidak ada pengajuan menunggu"
              desc="Semua pengajuan cuti/izin dalam scope Anda sudah diputuskan." />
          ) : pendingCuti.map(c => {
            const flow = CUTI_FLOW[c.status] || CUTI_FLOW.DIAJUKAN;
            const ct = CUTI_TYPES.find(x => x.id === c.type);
            return (
              <div key={c.cid} className="card p-4.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-extrabold text-[14px] text-ink dark:text-ink-inv">{c.employeeName || 'Karyawan'}</p>
                      <Badge tone="gold">{flow.label}</Badge>
                      <Badge tone="grey">{ct?.label || c.type}</Badge>
                      {c.branchName && <Badge tone="grey">{c.branchName}</Badge>}
                    </div>
                    <p className="text-[10.5px] font-bold text-ink-faint mt-1">
                      {c.startDate}{c.endDate && c.endDate !== c.startDate ? ` s/d ${c.endDate}` : ''} · {c.days} hari
                    </p>
                    {c.reason && <p className="text-[10.5px] font-semibold text-ink-soft dark:text-ink-inv/70 mt-1.5 leading-relaxed max-w-md">"{c.reason}"</p>}
                  </div>
                  {c.letter && (
                    <img src={c.letter} alt="Surat pendukung" className="w-14 h-14 rounded-xl object-cover border border-line dark:border-line-dark shrink-0" />
                  )}
                </div>
                {canApproveCuti && (
                  <div className="flex gap-2 mt-3.5">
                    <Button onClick={() => reviewCuti(c, 'DISETUJUI')} icon={Check} className="flex-1 py-2.5 text-xs">Setujui</Button>
                    <Button variant="danger" onClick={() => setRejectFor({ kind: 'cuti', rec: c })} icon={BahayaBuddy} className="py-2.5 text-xs">Tolak</Button>
                    {c.status === 'DIAJUKAN' && (
                      <Button variant="secondary" onClick={() => reviewCuti(c, 'DITINJAU')} className="py-2.5 text-xs">Tandai Ditinjau</Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL tolak */}
      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Tolak dengan alasan"
        sub={rejectFor ? (rejectFor.kind === 'payroll' ? `Payroll ${rejectFor.rec.employeeName}` : `Pengajuan ${rejectFor.rec.employeeName}`) : ''} width="max-w-sm"
        footer={<>
          <Button variant="secondary" onClick={() => setRejectFor(null)}>Batal</Button>
          <Button variant="danger" onClick={doReject} icon={BahayaBuddy}>Tolak</Button>
        </>}>
        <label className="kicker block mb-1.5 ml-0.5">Alasan (dikirim ke pemohon)</label>
        <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} className="field resize-none" placeholder="misal: angka lembur perlu dicek ulang dulu" />
      </Modal>
    </div>
  );
};

/* ============================================================
   4. AUDIT TAB — Penjelajah Audit Log
   ============================================================ */
export const AuditTab = ({ licenseInfo, perms }) => {
  const { items: audit, live } = useTenantCol(licenseInfo, 'audit_log', 'audit_log_db');
  const { items: branches } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { scope } = useSessionScope(licenseInfo, employees);

  const [q, setQ] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [limit, setLimit] = useState(60);

  const canView = canDo(perms, 'audit.view');
  const scopedBranches = branchesInScope(scope, branches);
  const allowed = new Set(scopedBranches.map(b => b.cid));

  const rows = useMemo(() => {
    if (!canView) return [];
    let list = [...(audit || [])];
    if (normScope(scope).type !== 'org') {
      list = list.filter(a => !a.branchId || allowed.has(a.branchId));
    }
    if (branchFilter) list = list.filter(a => (a.branchId || 'PUSAT') === branchFilter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(a =>
        String(a.action || '').toLowerCase().includes(needle) ||
        String(a.actor || '').toLowerCase().includes(needle) ||
        JSON.stringify(a.detail || {}).toLowerCase().includes(needle));
    }
    return list.sort((a, b) => trustedTime(b).ms - trustedTime(a).ms).slice(0, limit);
  }, [audit, q, branchFilter, limit, canView, scope]);

  if (!canView) {
    return (
      <div className="max-w-3xl mx-auto w-full pb-24">
        <PageTitle title="Audit Log" />
        <EmptyState mascot="bahaya" icon={PerisaiBuddy} title="Akses ditolak"
          desc="Role kamu tidak memiliki permission audit.view. Minta Owner menambahkannya di Role & Permission." />
      </div>
    );
  }

  const branchNameOf = (id) => (branches || []).find(b => b.cid === id)?.name || (id === 'PUSAT' ? 'Pusat' : id || '-');

  return (
    <div className="max-w-4xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Audit Log" sub="Jejak aktivitas append-only — tidak bisa diubah/dihapus oleh siapa pun"
        right={<LiveDot live={live} />} />

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
          <div>
            <label className="kicker block mb-1.5 ml-0.5">Cari aksi / aktor / detail</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input value={q} onChange={e => setQ(e.target.value)} className="field !pl-10" placeholder="misal: LOGIN, PAYROLL, nama..." />
            </div>
          </div>
          <Select label="Cabang" value={branchFilter} onChange={setBranchFilter}
            options={[{ value: '', label: 'Semua (scope saya)' }, { value: 'PUSAT', label: 'Pusat' }, ...(scopedBranches.map(b => ({ value: b.cid, label: b.name })))]} />
        </div>
      </Card>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <EmptyState mascot="pikir" icon={History} title="Belum ada aktivitas cocok"
            desc="Audit log mencatat aksi penting (login, payroll, absensi, perubahan data). Coba ubah filter atau lakukan aksi dulu." />
        ) : rows.map(a => {
          const t = trustedTime(a);
          const tone = /HAPUS|DELETE|REJECT|TOLAK|BANNED/.test(a.action || '') ? 'red' : /APPROVE|SETUJUI|CREATE|DIBAYAR/.test(a.action || '') ? 'green' : 'grey';
          return (
            <div key={a.cid} className="card p-3.5 flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${tone === 'red' ? 'bg-brick' : tone === 'green' ? 'bg-leaf' : 'bg-ink-faint/50'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-extrabold text-[12px] text-ink dark:text-ink-inv font-mono">{a.action || 'AKTIVITAS'}</p>
                  {a.branchId && <Badge tone="grey">{branchNameOf(a.branchId)}</Badge>}
                </div>
                <p className="text-[10px] font-bold text-ink-faint mt-0.5">
                  {a.actor || '-'} ({a.actorRole || '-'}) · {fmtDT(t.ms)}{t.source === 'server' ? ' · waktu server' : ''}
                </p>
                {a.detail && Object.keys(a.detail).length > 0 && (
                  <p className="text-[9.5px] font-mono text-ink-faint/80 mt-1 break-all leading-relaxed">
                    {Object.entries(a.detail).slice(0, 6).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 40)}`).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {rows.length >= limit && (
          <Button variant="secondary" onClick={() => setLimit(l => l + 60)} className="w-full py-3 text-xs">Muat lebih banyak</Button>
        )}
      </div>
    </div>
  );
};
