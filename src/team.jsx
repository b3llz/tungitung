// ============================================================
// TEAM MODULE v8 — Manajemen Cabang, Manajemen Karyawan,
// Monitoring Terpusat (Multi Outlet), Kelola Absensi,
// Manajemen Penggajian (bukti transfer + slip gaji + history
// realtime), dan halaman Absensi Karyawan (realtime + lokasi +
// waktu server anti-manipulasi).
// DATA: Firestore tenants/{licenseId}/{cabang|karyawan|absensi|
// payroll} via useTenantCol (onSnapshot realtime) + mirror
// localStorage agar tetap jalan offline. Logika lama tidak
// dihapus: employee_db (PIN PUSAT) tetap berlaku.
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  Cabang, Tim, Lokasi, Kredensial, Absensi, AbsenMasuk, AbsenPulang,
  Penggajian, BuktiTransfer, SlipGaji, WaktuReal, Perangkat,
  PerisaiBuddy, Trash2, Check, GembokBuddy, GembokBuka, BahayaBuddy,
  KoinBuddy, StrukCetak, Riwayat, MedaliBuddy
} from './welp-icons.jsx';
import {
  formatIDR, useTenantCol, trustedTime, getLocation,
  distanceMeters, todayKey, fileToDataUrl,
  getAturan, DEFAULT_ATURAN, lateInfo, dateKeyOf, dayLabel, dayLabelShort, qrUrl
} from './core.jsx';
import { Button, Card, PageTitle, Badge, EmptyState, Modal, Toggle, Select } from './ui';

/* ---------- util kecil ---------- */
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ms) => new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (ms) => `${new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · ${fmtTime(ms)}`;
const RoleBadge = ({ role }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-extrabold uppercase tracking-wider ${role === 'owner' ? 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold' : role === 'admin' ? 'bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot' : 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf'}`}>
    {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin Cabang' : 'Kasir'}
  </span>
);
const EditIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const LiveDot = ({ live }) => (
  <span className={`inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest ${live ? 'text-leaf-deep dark:text-leaf' : 'text-gold-deep dark:text-gold'}`}>
    <span className={`w-2 h-2 rounded-full ${live ? 'bg-leaf animate-pulse-dot' : 'bg-gold'}`} />
    {live ? 'Realtime' : 'Mode Lokal'}
  </span>
);

/* ---------- INPUT MODERN (bukan input basic) ----------
   Kartu field dengan ikon buddy, fokus flame, dan deskripsi. */
const FieldCard = ({ icon: Icon, label, desc, children }) => (
  <div className="bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-2xl p-4 focus-within:border-flame-400 focus-within:ring-2 focus-within:ring-flame-500/20 transition-all">
    <div className="flex items-center gap-2.5 mb-2.5">
      <span className="w-8 h-8 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center shrink-0"><Icon className="w-4.5 h-4.5" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold text-ink dark:text-ink-inv uppercase tracking-wider leading-none">{label}</p>
        {desc && <p className="text-[10px] text-ink-faint font-semibold mt-1 leading-none">{desc}</p>}
      </div>
    </div>
    {children}
  </div>
);

const PinDots = ({ pin, onKey }) => (
  <div>
    <div className="flex gap-2 justify-center mb-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`w-8 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${i < pin.length ? 'border-flame-500 bg-flame-50 dark:bg-flame-900/25' : 'border-line dark:border-line-dark bg-paper dark:bg-white/5'}`}>
          {i < pin.length && <div className="w-2 h-2 rounded-full bg-flame-500" />}
        </div>
      ))}
    </div>
    <div className="grid grid-cols-6 gap-1.5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'rand', '0', 'del'].map(k => (
        <button key={k} type="button" onClick={() => onKey(k)}
          className={`h-9 rounded-lg text-sm font-extrabold transition active:scale-95 press ${k === 'del' ? 'bg-brick-soft dark:bg-brick/10 text-brick' : k === 'rand' ? 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold text-[10px] uppercase' : 'bg-paper dark:bg-white/5 text-ink dark:text-ink-inv hover:bg-flame-50 dark:hover:bg-flame-900/20'}`}>
          {k === 'del' ? '⌫' : k === 'rand' ? 'Acak' : k}
        </button>
      ))}
    </div>
  </div>
);

/* ============================================================
   MANAJEMEN CABANG (menggantikan tab karyawan lama)
   Nama + lokasi modern (alamat + titik GPS), password & PIN
   untuk login cabang, role default, saklar penggajian.
   ============================================================ */
export const BranchTab = ({ licenseInfo, triggerAlert }) => {
  const { items: branches, live, addRow, updateRow, removeRow } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const [form, setForm] = useState({ name: '', location: '', password: '', pin: '', role: 'admin', payrollEnabled: false, jamMasuk: DEFAULT_ATURAN.jamMasuk, toleransi: DEFAULT_ATURAN.toleransi, radius: DEFAULT_ATURAN.radius });
  const [pin, setPin] = useState('');
  const [geo, setGeo] = useState(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => { setForm({ name: '', location: '', password: '', pin: '', role: 'admin', payrollEnabled: false, jamMasuk: DEFAULT_ATURAN.jamMasuk, toleransi: DEFAULT_ATURAN.toleransi, radius: DEFAULT_ATURAN.radius }); setPin(''); setGeo(null); setEditingId(null); };

  const pickGeo = async () => {
    setGeoBusy(true);
    try { const g = await getLocation(); setGeo(g); triggerAlert('Titik lokasi cabang berhasil diambil.', 'success'); }
    catch (e) { triggerAlert('Gagal ambil lokasi: ' + (e.message || 'izin ditolak'), 'error'); }
    setGeoBusy(false);
  };

  const save = () => {
    if (!form.name.trim()) return triggerAlert('Nama cabang wajib diisi!', 'error');
    if (!form.password) return triggerAlert('Password cabang wajib diisi (dipakai login cabang)!', 'error');
    if (pin.length !== 6) return triggerAlert('PIN 6 digit wajib diisi (dipakai login cabang)!', 'error');
    const payload = {
      name: form.name.trim(), location: form.location.trim(),
      password: form.password, pin, role: form.role, payrollEnabled: !!form.payrollEnabled,
      aturan: {
        jamMasuk: form.jamMasuk || DEFAULT_ATURAN.jamMasuk,
        toleransi: Math.max(0, parseInt(form.toleransi, 10) || 0),
        radius: Math.max(20, parseInt(form.radius, 10) || DEFAULT_ATURAN.radius)
      },
      lat: geo?.lat ?? null, lng: geo?.lng ?? null, geoAcc: geo?.acc ?? null
    };
    if (editingId) { updateRow(editingId, payload); triggerAlert('Cabang diperbarui!', 'success'); }
    else { addRow(payload); triggerAlert('Cabang baru tersimpan & bisa langsung login!', 'success'); }
    resetForm();
  };

  const startEdit = (b) => {
    const at = getAturan(b);
    setEditingId(b.cid);
    setForm({ name: b.name || '', location: b.location || '', password: b.password || '', pin: '', role: b.role || 'admin', payrollEnabled: !!b.payrollEnabled, jamMasuk: at.jamMasuk, toleransi: at.toleransi, radius: at.radius });
    setPin(''); setGeo(b.lat != null ? { lat: b.lat, lng: b.lng, acc: b.geoAcc } : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Manajemen Cabang" sub="Data cabang + kredensial login (password & PIN)"
        right={<LiveDot live={live} />} />

      <Card title={editingId ? 'Ubah Cabang' : 'Tambah Cabang Baru'} icon={Cabang}>
        <div className="space-y-3.5">
          <FieldCard icon={Cabang} label="Nama Cabang" desc="Contoh: WELP Cabang Kemang">
            <input className="field" placeholder="Nama cabang yang jelas & unik" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </FieldCard>

          <FieldCard icon={Lokasi} label="Lokasi Cabang" desc="Alamat teks + titik GPS untuk validasi absensi">
            <textarea className="field h-20 resize-none" placeholder="Alamat lengkap cabang..."
              value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <div className="flex items-center gap-2 mt-2">
              <Button variant="secondary" onClick={pickGeo} className="py-2.5 px-3.5 text-xs" icon={geoBusy ? WaktuReal : Lokasi}>
                {geoBusy ? 'Mengambil...' : 'Ambil Titik GPS'}
              </Button>
              {geo ? (
                <span className="text-[10px] font-extrabold text-leaf-deep dark:text-leaf flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)} (±{geo.acc}m)
                </span>
              ) : editingId && form.location ? null : (
                <span className="text-[10px] text-ink-faint font-semibold">Belum ada titik GPS</span>
              )}
            </div>
          </FieldCard>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <FieldCard icon={Kredensial} label="Password Cabang" desc="Dipakai di layar login, mode Cabang">
              <div className="flex gap-2">
                <input className="field min-w-0 flex-1" type={showPw ? 'text' : 'password'} placeholder="Password cabang"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="px-2.5 rounded-xl bg-paper dark:bg-white/5 text-ink-faint hover:text-ink-soft transition">
                  {showPw ? <GembokBuka className="w-4 h-4" /> : <GembokBuddy className="w-4 h-4" />}
                </button>
              </div>
            </FieldCard>
            <FieldCard icon={PerisaiBuddy} label="Role Default Cabang" desc="Akses sesi yang login dari cabang ini">
              <Select value={form.role === 'admin' ? 'Admin (akses penuh cabang)' : 'Kasir (kasir & absen saja)'}
                options={['Admin (akses penuh cabang)', 'Kasir (kasir & absen saja)']}
                onChange={v => setForm({ ...form, role: v.startsWith('Admin') ? 'admin' : 'kasir' })} />
            </FieldCard>
          </div>

          <FieldCard icon={Absensi} label="PIN Login Cabang (6 digit)" desc="Masuk sebagai staf cabang ini">
            <PinDots pin={pin} onKey={(k) => {
              if (k === 'del') setPin(p => p.slice(0, -1));
              else if (k === 'rand') setPin(String(Math.floor(100000 + Math.random() * 900000)));
              else setPin(p => (p.length < 6 ? p + k : p));
            }} />
            {editingId && <p className="text-[10px] text-ink-faint font-semibold mt-2">Biarkan kosong bila tidak ingin mengganti PIN lama.</p>}
          </FieldCard>

          {/* ATURAN ABSENSI (rules) — dipakai halaman absensi karyawan */}
          <FieldCard icon={WaktuReal} label="Aturan Absensi Karyawan" desc="Dipakai otomatis di halaman absensi & monitoring owner">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="kicker block mb-1.5">Jam Masuk</label>
                <input type="time" className="field !px-3" value={form.jamMasuk}
                  onChange={e => setForm({ ...form, jamMasuk: e.target.value })} />
              </div>
              <div>
                <label className="kicker block mb-1.5">Toleransi (mnt)</label>
                <input type="number" min="0" max="120" className="field !px-3" placeholder="15" value={form.toleransi}
                  onChange={e => setForm({ ...form, toleransi: e.target.value })} />
              </div>
              <div>
                <label className="kicker block mb-1.5">Radius (m)</label>
                <input type="number" min="20" max="5000" step="10" className="field !px-3" placeholder="150" value={form.radius}
                  onChange={e => setForm({ ...form, radius: e.target.value })} />
              </div>
            </div>
            <p className="text-[10px] text-ink-faint font-semibold mt-2.5 leading-relaxed flex items-start gap-1.5">
              <Lokasi className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Absen lebih dari jam masuk + toleransi otomatis dikategorikan TELAT. Jarak melebihi radius tetap tercatat, tapi ditandai di luar area untuk owner.
            </p>
          </FieldCard>

          <div className="flex items-center justify-between gap-3 bg-gold-soft/60 dark:bg-gold/[.07] border border-gold/30 rounded-2xl p-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-gold/20 text-gold-deep dark:text-gold flex items-center justify-center shrink-0"><Penggajian className="w-5 h-5" /></span>
              <div className="min-w-0">
                <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">Manajemen Penggajian</p>
                <p className="text-[10px] text-ink-faint font-semibold leading-snug">ON bila cabang sudah punya manajer yang mengelola gaji sendiri.</p>
              </div>
            </div>
            <Toggle on={!!form.payrollEnabled} onClick={() => setForm(f => ({ ...f, payrollEnabled: !f.payrollEnabled }))} />
          </div>

          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 py-3.5" icon={Check}>{editingId ? 'Simpan Perubahan' : 'Simpan Cabang'}</Button>
            {editingId && <Button variant="secondary" onClick={resetForm} className="py-3.5">Batal</Button>}
          </div>
        </div>
      </Card>

      <div className="space-y-2.5">
        <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1 flex items-center gap-2">
          Daftar Cabang ({branches.length})
        </h3>
        {branches.length === 0 && <EmptyState mascot="kerja" title="Belum ada cabang" desc="Tambahkan cabang pertama — lengkap dengan password & PIN, langsung bisa dipakai login dari perangkat lain." />}
        {branches.map(b => {
          const staff = employees.filter(e => e.branchId === b.cid).length;
          return (
            <div key={b.cid} className="card p-4.5 hover:border-flame-300 transition-all">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-ink dark:text-ink-inv text-[15px]">{b.name}</h4>
                    <RoleBadge role={b.role} />
                    {b.payrollEnabled && <Badge tone="gold"><Penggajian className="w-3 h-3" /> Gaji ON</Badge>}
                  </div>
                  <p className="text-[11px] text-ink-faint font-semibold mt-1 flex items-center gap-1.5">
                    <Lokasi className="w-3.5 h-3.5 shrink-0" /> {b.location || 'Lokasi belum diisi'}
                    {b.lat != null && <span className="text-leaf-deep dark:text-leaf">· GPS OK</span>}
                  </p>
                  <p className="text-[10px] text-ink-faint font-bold uppercase tracking-wider mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Tim className="w-3.5 h-3.5" /> {staff} karyawan</span>
                    <span className="flex items-center gap-1"><Kredensial className="w-3.5 h-3.5" /> PIN {b.pin ? '••••••' : '-'}</span>
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => startEdit(b)} aria-label="Ubah cabang" className="bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot p-2.5 rounded-xl hover:bg-flame-100 dark:hover:bg-flame-900/70 transition press"><EditIcon /></button>
                  <button onClick={() => { if (confirm(`Hapus cabang "${b.name}"?`)) removeRow(b.cid); }} className="bg-brick-soft dark:bg-brick/10 text-brick p-2.5 rounded-xl hover:bg-brick hover:text-white transition press"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================
   MANAJEMEN KARYAWAN (BARU) — hanya nama + role + cabang.
   PIN login lama (employee_db PUSAT) tetap berlaku.
   ============================================================ */
export const KaryawanTab = ({ licenseInfo, triggerAlert }) => {
  const { items: employees, live, addRow, removeRow, updateRow } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: branches } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const [form, setForm] = useState({ name: '', role: 'kasir', branchId: 'PUSAT' });
  const [editingId, setEditingId] = useState(null);

  const branchName = (id) => id === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === id)?.name || 'Cabang');
  const reset = () => { setForm({ name: '', role: 'kasir', branchId: 'PUSAT' }); setEditingId(null); };

  const save = () => {
    if (!form.name.trim()) return triggerAlert('Nama karyawan wajib diisi!', 'error');
    const payload = { name: form.name.trim(), role: form.role, branchId: form.branchId };
    if (editingId) { updateRow(editingId, payload); triggerAlert('Data karyawan diperbarui!', 'success'); }
    else { addRow(payload); triggerAlert('Karyawan ditambahkan!', 'success'); }
    reset();
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Manajemen Karyawan" sub="Nama & role tim per cabang"
        right={<LiveDot live={live} />} />

      <Card title={editingId ? 'Ubah Karyawan' : 'Tambah Karyawan'} icon={Tim}>
        <div className="space-y-3.5">
          <FieldCard icon={Tim} label="Nama Karyawan" desc="Nama panggilan yang terbaca di absensi & gaji">
            <input className="field" placeholder="Contoh: Rani" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </FieldCard>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <FieldCard icon={PerisaiBuddy} label="Role" desc="Menentukan menu yang terlihat">
              <Select value={form.role === 'kasir' ? 'Kasir' : 'Admin'} options={['Kasir', 'Admin']}
                onChange={v => setForm({ ...form, role: v.toLowerCase() })} />
            </FieldCard>
            <FieldCard icon={Cabang} label="Cabang" desc="Tempat tugas karyawan ini">
              <Select value={branchName(form.branchId)}
                options={['Pusat', ...branches.map(b => b.name)]}
                onChange={v => setForm({ ...form, branchId: v === 'Pusat' ? 'PUSAT' : (branches.find(b => b.name === v)?.cid || 'PUSAT') })} />
            </FieldCard>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 py-3.5" icon={Check}>{editingId ? 'Simpan Perubahan' : 'Tambah Karyawan'}</Button>
            {editingId && <Button variant="secondary" onClick={reset} className="py-3.5">Batal</Button>}
          </div>
        </div>
      </Card>

      <div className="space-y-2.5">
        <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1">Tim ({employees.length})</h3>
        {employees.length === 0 && <EmptyState mascot="menyapa" title="Belum ada karyawan" desc="Tambahkan nama & role; karyawan bisa langsung absen dari halaman Absensi Saya." />}
        {['PUSAT', ...branches.map(b => b.cid)].map(bid => {
          const list = employees.filter(e => (e.branchId || 'PUSAT') === bid);
          if (!list.length) return null;
          return (
            <div key={bid}>
              <p className="kicker px-1 mb-2 mt-3">{branchName(bid)}</p>
              <div className="space-y-2">
                {list.map(e => (
                  <div key={e.cid} className="card p-3.5 flex justify-between items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center rounded-2xl font-extrabold shrink-0">{e.name[0]}</div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{e.name}</p>
                        <RoleBadge role={e.role} />
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => { setEditingId(e.cid); setForm({ name: e.name, role: e.role, branchId: e.branchId || 'PUSAT' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot p-2.5 rounded-xl hover:bg-flame-100 dark:hover:bg-flame-900/70 transition press">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button onClick={() => { if (confirm(`Hapus karyawan ${e.name}?`)) removeRow(e.cid); }} className="bg-brick-soft dark:bg-brick/10 text-brick p-2.5 rounded-xl hover:bg-brick hover:text-white transition press"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


/* ============================================================
   MULTI OUTLET — MONITORING TERPUSAT (realtime)
   Ringkasan semua cabang: staf, kehadiran hari ini, status
   penggajian, plus feed aktivitas absensi terbaru.
   ============================================================ */
export const OutletTab = ({ licenseInfo }) => {
  const { items: branches, live } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: absensi } = useTenantCol(licenseInfo, 'absensi', 'absensi_db');
  const { items: payroll } = useTenantCol(licenseInfo, 'payroll', 'payroll_db');

  const today = todayKey();
  const inToday = absensi.filter(a => a.date === today && a.type === 'in');
  const presentCount = new Set(inToday.map(a => a.employeeName + '|' + a.branchId)).size;
  const payrollOn = branches.filter(b => b.payrollEnabled).length;
  const feed = [...absensi].sort((a, b) => (trustedTime(b).ms) - (trustedTime(a).ms)).slice(0, 8);

  const stats = [
    { label: 'Total Cabang', value: branches.length, icon: Cabang, tone: 'text-flame-700 dark:text-apricot' },
    { label: 'Total Karyawan', value: employees.length, icon: Tim, tone: 'text-flame-700 dark:text-apricot' },
    { label: 'Hadir Hari Ini', value: presentCount, icon: Absensi, tone: 'text-leaf-deep dark:text-leaf' },
    { label: 'Gaji Aktif', value: payrollOn, icon: Penggajian, tone: 'text-gold-deep dark:text-gold' },
  ];

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Multi Outlet" sub="Monitoring terpusat seluruh cabang — realtime"
        right={<LiveDot live={live} />} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card !rounded-3xl p-4">
            <s.icon className={`w-6 h-6 mb-2.5 ${s.tone}`} />
            <p className="text-2xl font-extrabold text-ink dark:text-ink-inv money leading-none">{s.value}</p>
            <p className="kicker mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        <h3 className="font-extrabold text-[13px] text-ink dark:text-ink-inv px-1">Status Cabang</h3>
        {branches.length === 0 && <EmptyState mascot="pikir" title="Belum ada cabang" desc="Tambahkan cabang di menu Manajemen Cabang, lalu pantau semuanya dari sini secara realtime." />}
        {branches.map(b => {
          const staff = employees.filter(e => e.branchId === b.cid);
          const inList = inToday.filter(a => a.branchId === b.cid);
          const present = new Set(inList.map(a => a.employeeName)).size;
          const lastTs = inList.length ? Math.max(...inList.map(a => trustedTime(a).ms)) : null;
          return (
            <div key={b.cid} className="card p-4.5">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-ink dark:text-ink-inv text-[15px]">{b.name}</h4>
                    {b.payrollEnabled ? <Badge tone="gold"><Penggajian className="w-3 h-3" /> Gaji ON</Badge> : <Badge tone="grey">Gaji OFF</Badge>}
                  </div>
                  <p className="text-[11px] text-ink-faint font-semibold mt-1 flex items-center gap-1.5"><Lokasi className="w-3.5 h-3.5 shrink-0" />{b.location || 'Lokasi belum diisi'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-2xl font-extrabold money leading-none ${present > 0 ? 'text-leaf-deep dark:text-leaf' : 'text-ink-faint'}`}>{present}<span className="text-sm text-ink-faint">/{staff.length}</span></p>
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-ink-faint mt-1">hadir</p>
                </div>
              </div>
              {lastTs && (
                <p className="text-[10px] text-ink-faint font-bold mt-2.5 flex items-center gap-1.5">
                  <WaktuReal className="w-3.5 h-3.5" /> Aktivitas terakhir {fmtTime(lastTs)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Card title="Aktivitas Absensi Terbaru" icon={WaktuReal}>
        {feed.length === 0 ? (
          <div className="py-6 text-center">
            <Absensi className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada aktivitas absensi.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {feed.map(a => {
              const t = trustedTime(a);
              return (
                <div key={a.cid} className="flex items-center gap-3 p-2.5 rounded-xl bg-paper dark:bg-white/[.03]">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.type === 'in' ? 'bg-leaf-soft dark:bg-leaf/15 text-leaf-deep dark:text-leaf' : 'bg-gold-soft dark:bg-gold/15 text-gold-deep dark:text-gold'}`}>
                    {a.type === 'in' ? <AbsenMasuk className="w-5 h-5" /> : <AbsenPulang className="w-5 h-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-extrabold text-ink dark:text-ink-inv truncate">{a.employeeName} <span className="text-ink-faint font-bold">· {a.branchName}</span></p>
                    <p className="text-[10px] text-ink-faint font-semibold">{a.type === 'in' ? 'Absen masuk' : 'Absen pulang'} · {fmtDateTime(t.ms)}
                      {t.source === 'server' && <span className="text-leaf-deep dark:text-leaf font-extrabold"> · ✓ server</span>}
                      {a.dist != null && <span className={a.dist > 500 ? 'text-gold-deep dark:text-gold' : ''}> · {a.dist}m dari cabang</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ============================================================
   KELOLA ABSENSI (owner/admin) v10 — monitoring per HARI.
   • Statistik hari ini (hadir / telat / belum absen / total staf)
   • Kehadiran hari ini dgn foto selfie, jam server, kategori
     Tepat Waktu / Telat (dari Aturan Absensi cabang)
   • Rekap 7 hari per karyawan
   • Riwayat dikelompokkan per hari: "Senin, 22 September 2025"
   • QR + link halaman absensi karyawan (?absen=1 — terpisah
     dari aplikasi kasir)
   ============================================================ */
export const AbsensiTab = ({ licenseInfo, triggerAlert }) => {
  const { items: branches, live } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: absensi } = useTenantCol(licenseInfo, 'absensi', 'absensi_db');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [viewRec, setViewRec] = useState(null);
  const [copied, setCopied] = useState(false);

  const today = todayKey();
  const scope = (a) => filterBranch === 'ALL' || a.branchId === filterBranch;
  const branchOf = (a) => branches.find(b => b.cid === a.branchId) || null;
  const aturanOf = (a) => getAturan(branchOf(a));

  // Enrichment: waktu server, tanggal, kategori telat, status radius.
  const enrich = (list) => list.map(a => {
    const t = trustedTime(a);
    const at = aturanOf(a);
    const li = a.type === 'in' ? lateInfo(t.ms, at) : null;
    const far = a.dist != null && a.dist > at.radius;
    return { ...a, _t: t.ms, _src: t.source, _date: dateKeyOf(t.ms), _late: li, _far: far, _aturan: at };
  }).sort((x, y) => y._t - x._t);

  const all = enrich(absensi.filter(scope));
  const todayRows = all.filter(a => a._date === today);
  const staffScope = employees.filter(e => filterBranch === 'ALL' || (e.branchId || 'PUSAT') === filterBranch);

  const stats = [
    { label: 'Hadir Hari Ini', value: new Set(todayRows.filter(a => a.type === 'in').map(a => a.employeeName + '|' + a.branchId)).size, icon: AbsenMasuk, tone: 'text-leaf-deep dark:text-leaf' },
    { label: 'Telat Hari Ini', value: new Set(todayRows.filter(a => a.type === 'in' && a._late?.status === 'telat').map(a => a.employeeName + '|' + a.branchId)).size, icon: WaktuReal, tone: 'text-gold-deep dark:text-gold' },
    { label: 'Belum Absen', value: Math.max(0, staffScope.length - new Set(todayRows.filter(a => a.type === 'in').map(a => a.employeeName + '|' + a.branchId)).size), icon: BahayaBuddy, tone: 'text-brick-deep dark:text-brick' },
    { label: 'Total Karyawan', value: staffScope.length, icon: Tim, tone: 'text-flame-700 dark:text-apricot' },
  ];

  // Rekap 7 hari per karyawan
  const weekAgo = Date.now() - 7 * 864e5;
  const week = all.filter(a => a._t >= weekAgo);
  const rekap = staffScope.map(e => {
    const bid = filterBranch !== 'ALL' ? filterBranch : (e.branchId || 'PUSAT');
    const mine = week.filter(a => a.employeeName === e.name && a.branchId === bid && a.type === 'in');
    const days = new Set(mine.map(a => a._date));
    const telat = mine.filter(a => a._late?.status === 'telat').length;
    return { ...e, bid, hadir: days.size, telat };
  });

  // Riwayat dikelompokkan per hari (14 hari terakhir)
  const histAgo = Date.now() - 14 * 864e5;
  const hist = all.filter(a => a._t >= histAgo);
  const byDay = [];
  for (const a of hist) {
    let g = byDay.find(x => x.date === a._date);
    if (!g) { g = { date: a._date, ms: a._t, rows: [] }; byDay.push(g); }
    g.rows.push(a);
  }
  byDay.sort((a, b) => b.ms - a.ms);

  const absenUrl = `${window.location.origin}${window.location.pathname}?absen=1${licenseInfo?.id ? '&lic=' + encodeURIComponent(licenseInfo.id) : ''}`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(absenUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); triggerAlert('Link halaman absensi dikopi!', 'success'); }
    catch (e) { triggerAlert('Gagal mengopi link — salin manual dari kolom.', 'error'); }
  };

  const StatusBadge = ({ a }) => {
    if (a.type !== 'in') return <Badge tone="gold"><AbsenPulang className="w-3 h-3" /> Pulang</Badge>;
    if (!a._late) return <Badge tone="grey">—</Badge>;
    return a._late.status === 'telat'
      ? <Badge tone="gold"><WaktuReal className="w-3 h-3" /> Telat {a._late.telatMin}m</Badge>
      : <Badge tone="green"><Check className="w-3 h-3" /> Tepat Waktu</Badge>;
  };

  const PhotoThumb = ({ rec, size = 'w-11 h-11' }) => (
    <button onClick={() => rec.photo && setViewRec(rec)} className={`${size} rounded-xl overflow-hidden shrink-0 border border-line dark:border-line-dark bg-paper dark:bg-white/5 flex items-center justify-center ${rec.photo ? 'cursor-zoom-in press' : 'cursor-default'}`} aria-label="Foto selfie absensi">
      {rec.photo ? <img src={rec.photo} alt="Selfie absensi" className="w-full h-full object-cover" />
        : <span className="font-extrabold text-ink-faint/60 text-[10px]">{rec.employeeName?.[0] || '?'}</span>}
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Kelola Absensi" sub="Kehadiran semua karyawan — dikelompokkan per hari"
        right={<LiveDot live={live} />} />

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[{ cid: 'ALL', name: 'Semua Cabang' }, ...branches].map(b => (
          <button key={b.cid} onClick={() => setFilterBranch(b.cid)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all border ${filterBranch === b.cid ? 'bg-flame-600 text-white border-flame-600 shadow-card' : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark hover:border-flame-300'}`}>
            <Cabang className="w-3.5 h-3.5" /> {b.name}
          </button>
        ))}
      </div>

      {/* STATISTIK HARI INI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="card !rounded-3xl p-4">
            <s.icon className={`w-6 h-6 mb-2.5 ${s.tone}`} />
            <p className="text-2xl font-extrabold text-ink dark:text-ink-inv money leading-none">{s.value}</p>
            <p className="kicker mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* HALAMAN ABSENSI KARYAWAN (terpisah dari kasir) */}
      <Card title="Halaman Absensi Karyawan" icon={PerisaiBuddy}>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white p-2.5 rounded-2xl border-2 border-dashed border-line dark:border-line-dark shrink-0">
            <img src={qrUrl(absenUrl, 200)} width="120" height="120" className="w-[120px] h-[120px]" alt="QR Halaman Absensi" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[12.5px] font-extrabold text-ink dark:text-ink-inv">Aplikasi Absen terpisah</p>
            <p className="text-[11px] text-ink-faint font-semibold leading-relaxed mt-1">
              Karyawan membuka alamat di bawah (atau scan QR) di HP masing-masing. Login pakai <b>PIN cabang</b> + pilih nama, lalu absen dengan <b>selfie + lokasi + waktu server</b> yang tidak bisa diubah. Datanya masuk realtime ke halaman ini.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <input readOnly value={absenUrl} className="field !py-2 !text-[10.5px] min-w-0 flex-1 font-mono" onFocus={e => e.target.select()} />
              <Button onClick={copyLink} className="py-2.5 px-3.5 text-xs shrink-0" icon={copied ? Check : KoinBuddy}>{copied ? 'Terkopi' : 'Copy'}</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* KEHADIRAN HARI INI */}
      <Card title={`Hari Ini · ${dayLabel(Date.now())}`} icon={Absensi}>
        {staffScope.length === 0 ? (
          <EmptyState mascot="bingung" title="Belum ada karyawan" desc="Tambahkan karyawan lewat menu Manajemen Karyawan, lalu arahkan ke cabangnya." />
        ) : todayRows.length === 0 && (
          <div className="py-6 text-center">
            <Absensi className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada yang absen hari ini.</p>
          </div>
        )}
        <div className="space-y-2">
          {['PUSAT', ...branches.map(b => b.cid)].filter(bid => filterBranch === 'ALL' || bid === filterBranch).map(bid => {
            const list = employees.filter(e => (e.branchId || 'PUSAT') === bid);
            if (!list.length) return null;
            const bRec = branches.find(b => b.cid === bid);
            const bName = bid === 'PUSAT' ? 'Pusat' : (bRec?.name || 'Cabang');
            const at = getAturan(bRec);
            return (
              <div key={bid}>
                <p className="kicker px-0.5 mb-2 mt-1 flex items-center gap-2">{bName}
                  <span className="text-[9px] font-extrabold normal-case tracking-normal text-ink-faint/70">masuk {at.jamMasuk} ±{at.toleransi}mnt · radius {at.radius}m</span>
                </p>
                <div className="space-y-2">
                  {list.map(e => {
                    const inRec = todayRows.find(a => a.employeeName === e.name && a.branchId === bid && a.type === 'in');
                    const outRec = todayRows.find(a => a.employeeName === e.name && a.branchId === bid && a.type === 'out');
                    return (
                      <div key={e.cid} className="flex items-center gap-3 p-3 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
                        <PhotoThumb rec={inRec || { employeeName: e.name }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{e.name}</p>
                            {inRec && <StatusBadge a={inRec} />}
                            {inRec?._far && <Badge tone="gold"><Lokasi className="w-3 h-3" /> di luar radius</Badge>}
                          </div>
                          <div className="flex gap-3 mt-0.5 text-[10px] font-bold flex-wrap">
                            {inRec ? (
                              <span className="text-leaf-deep dark:text-leaf flex items-center gap-1"><AbsenMasuk className="w-3 h-3" /> Masuk {fmtTime(inRec._t)}{inRec._src === 'server' ? ' ✓' : ''}
                                {inRec.dist != null && <span className="text-ink-faint"> · {inRec.dist}m</span>}
                              </span>
                            ) : <span className="text-ink-faint">Belum absen masuk</span>}
                            {outRec && <span className="text-gold-deep dark:text-gold flex items-center gap-1"><AbsenPulang className="w-3 h-3" /> Pulang {fmtTime(outRec._t)}{outRec._src === 'server' ? ' ✓' : ''}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* REKAP 7 HARI */}
      <Card title="Rekap 7 Hari per Karyawan" icon={MedaliBuddy}>
        {rekap.length === 0 ? (
          <EmptyState mascot="pikir" title="Belum ada karyawan" desc="Rekap kehadiran mingguan muncul otomatis di sini." />
        ) : (
          <div className="space-y-2">
            {rekap.map(r => (
              <div key={r.cid} className="flex items-center gap-3 p-3 rounded-2xl bg-paper dark:bg-white/[.03]">
                <div className="w-9 h-9 rounded-xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold text-xs shrink-0">{r.name[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-[12.5px] text-ink dark:text-ink-inv truncate">{r.name}</p>
                  <p className="text-[10px] text-ink-faint font-bold">{r.bid === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === r.bid)?.name || '-')}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Badge tone={r.hadir >= 5 ? 'green' : r.hadir > 0 ? 'gold' : 'grey'}>{r.hadir}/7 hadir</Badge>
                  {r.telat > 0 && <Badge tone="gold">telat {r.telat}x</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* RIWAYAT PER HARI */}
      <Card title="Riwayat Absensi (14 Hari)" icon={Riwayat}>
        {byDay.length === 0 ? (
          <div className="py-6 text-center">
            <Riwayat className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada riwayat absensi.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {byDay.map(g => (
              <div key={g.date}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="w-8 h-8 rounded-xl bg-chrome-deep dark:bg-white/5 text-ink-inv dark:text-ink-inv/80 text-[9px] font-extrabold uppercase flex flex-col items-center justify-center leading-none shrink-0">
                    <span>{new Date(g.ms).toLocaleDateString('id-ID', { day: 'numeric' })}</span>
                    <span className="mt-0.5">{new Date(g.ms).toLocaleDateString('id-ID', { month: 'short' })}</span>
                  </span>
                  <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{new Date(g.ms).toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                  <span className="text-[10px] font-bold text-ink-faint">{new Date(g.ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span className="ml-auto text-[10px] font-extrabold text-ink-faint uppercase tracking-wider">{g.rows.length} catatan</span>
                </div>
                <div className="space-y-2">
                  {g.rows.map(a => (
                    <div key={a.cid} className="flex items-center gap-3 p-2.5 rounded-xl bg-paper dark:bg-white/[.03]">
                      <PhotoThumb rec={a} size="w-10 h-10" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-extrabold text-ink dark:text-ink-inv truncate">
                          {a.employeeName} <span className="text-ink-faint font-bold">· {a.branchName || a.branchId}</span>
                        </p>
                        <p className="text-[10px] text-ink-faint font-semibold">
                          {a.type === 'in' ? 'Absen masuk' : 'Absen pulang'} {fmtTime(a._t)}
                          {a._src === 'server' ? <span className="text-leaf-deep dark:text-leaf font-extrabold"> · ✓ server</span> : <span className="text-gold-deep dark:text-gold font-extrabold"> · waktu perangkat</span>}
                          {a.dist != null && ` · ${a.dist}m`}
                          {a._far && <span className="text-gold-deep dark:text-gold font-extrabold"> · luar radius</span>}
                        </p>
                      </div>
                      {a.type === 'in' && <StatusBadge a={a} />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MODAL FOTO SELFIE + DETAIL */}
      <Modal open={!!viewRec} onClose={() => setViewRec(null)} title="Bukti Absensi">
        {viewRec && (
          <div className="space-y-3">
            {viewRec.photo ? (
              <img src={viewRec.photo} alt="Selfie absensi" className="w-full rounded-2xl border border-line dark:border-line-dark" />
            ) : (
              <div className="py-8 text-center text-ink-faint text-xs font-bold">Catatan ini tanpa foto selfie.</div>
            )}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
              <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Karyawan</p><p className="text-ink dark:text-ink-inv">{viewRec.employeeName}</p></div>
              <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Cabang</p><p className="text-ink dark:text-ink-inv">{viewRec.branchName || viewRec.branchId || '-'}</p></div>
              <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Waktu (server)</p><p className="text-ink dark:text-ink-inv">{new Date(trustedTime(viewRec).ms).toLocaleString('id-ID')}</p></div>
              <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Jenis</p><p className="text-ink dark:text-ink-inv">{viewRec.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'}</p></div>
              {viewRec.lat != null && <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Koordinat</p><p className="text-ink dark:text-ink-inv font-mono text-[10px]">{Number(viewRec.lat).toFixed(5)}, {Number(viewRec.lng).toFixed(5)}</p></div>}
              {viewRec.dist != null && <div className="p-3 rounded-xl bg-paper dark:bg-white/[.03]"><p className="kicker mb-1">Jarak ke Cabang</p><p className={`text-ink dark:text-ink-inv ${viewRec.dist > (viewRec._aturan?.radius || 500) ? 'text-gold-deep dark:text-gold' : ''}`}>{viewRec.dist} meter</p></div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};



/* ============================================================
   MANAJEMEN PENGAJIAN — catat gaji per karyawan cabang,
   upload bukti transfer, cetak slip gaji, history realtime.
   Owner: semua cabang. Admin: hanya cabangnya & bila di-ON-kan.
   ============================================================ */
const PERIODE = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const periodeNow = () => PERIODE[new Date().getMonth()] + ' ' + new Date().getFullYear();

export const PayrollTab = ({ licenseInfo, triggerAlert, sessionRole, sessionBranchId }) => {
  const { items: branches, live } = useTenantCol(licenseInfo, 'cabang', 'cabang_db');
  const { items: employees } = useTenantCol(licenseInfo, 'karyawan', 'karyawan_db');
  const { items: payroll, addRow } = useTenantCol(licenseInfo, 'payroll', 'payroll_db');
  const [selBranch, setSelBranch] = useState(sessionRole === 'admin' ? (sessionBranchId || 'PUSAT') : 'ALL');
  const [payFor, setPayFor] = useState(null);           // karyawan yg dibayar
  const [form, setForm] = useState({ period: periodeNow(), amount: '', note: '' });
  const [proof, setProof] = useState(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [viewProof, setViewProof] = useState(null);

  const myBranch = sessionRole === 'admin' ? branches.find(b => b.cid === sessionBranchId) : null;
  const blocked = sessionRole === 'admin' && myBranch && !myBranch.payrollEnabled;
  const shownBranch = selBranch === 'ALL' ? null : branches.find(b => b.cid === selBranch);
  const list = employees.filter(e => (sessionRole === 'admin' ? e.branchId === sessionBranchId : (selBranch === 'ALL' || e.branchId === selBranch)));
  const history = [...payroll]
    .filter(p => sessionRole === 'admin' ? p.branchId === sessionBranchId : (selBranch === 'ALL' || p.branchId === selBranch))
    .sort((a, b) => trustedTime(b).ms - trustedTime(a).ms);

  const lastPay = (empName, bid) => history.find(h => h.employeeName === empName && h.branchId === bid);

  const openPay = (e, bid) => {
    setPayFor({ ...e, branchId: bid, branchName: bid === 'PUSAT' ? 'Pusat' : (branches.find(b => b.cid === bid)?.name || '-') });
    setForm({ period: periodeNow(), amount: '', note: '' }); setProof(null);
  };

  const pickProof = async (file) => {
    if (!file) return;
    setProofBusy(true);
    try { setProof(await fileToDataUrl(file, 720, 0.66)); }
    catch (e) { triggerAlert('Gagal memuat gambar: ' + e.message, 'error'); }
    setProofBusy(false);
  };

  const savePay = () => {
    if (!payFor) return;
    const amt = Number(String(form.amount).replace(/[^0-9]/g, ''));
    if (!amt) return triggerAlert('Nominal gaji wajib diisi!', 'error');
    addRow({
      branchId: payFor.branchId, branchName: payFor.branchName,
      employeeCid: payFor.cid || '', employeeName: payFor.name, role: payFor.role,
      period: form.period, amount: amt, note: form.note.trim(), proof: proof || null
    });
    setPayFor(null); setProof(null);
    triggerAlert('Pembayaran gaji tercatat (waktu terverifikasi server).', 'success');
  };

  /* Cetak slip gaji: window terpisah + print (aman dari CSS app) */
  const printSlip = (rec) => {
    const t = trustedTime(rec);
    const w = window.open('', '_blank', 'width=480,height=720');
    if (!w) return triggerAlert('Popup diblokir browser. Izinkan popup untuk mencetak slip.', 'error');
    const no = 'SG-' + String(rec.cid || '').slice(-8).toUpperCase();
    w.document.write('<!DOCTYPE html><html><head><title>Slip Gaji ' + rec.employeeName + '</title><style>'
      + '*{box-sizing:border-box;margin:0;padding:0}body{font-family:Segoe UI,Arial,sans-serif;padding:28px;color:#1B1F24;max-width:430px;margin:auto}'
      + '.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #F4622E;padding-bottom:14px;margin-bottom:18px}'
      + '.lg{font-size:26px;font-weight:900;letter-spacing:-1px;color:#1B1F24}.lg span{color:#F4622E}'
      + '.sub{font-size:10px;color:#7C8590;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-align:right}'
      + 'h1{font-size:17px;margin-bottom:2px}.per{font-size:12px;color:#7C8590;font-weight:600;margin-bottom:16px}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:14px}td{padding:7px 0;border-bottom:1px dashed #E6E8ED;font-size:13px}td:first-child{color:#4E5761;font-weight:600}td:last-child{text-align:right;font-weight:800}'
      + '.tot td{border-bottom:none;border-top:2px solid #1B1F24;font-size:16px;font-weight:900;padding-top:10px}'
      + '.amt{font-size:26px;font-weight:900;color:#D84312;margin:8px 0 16px}'
      + '.prf{margin:12px 0}.prf img{max-width:100%;border:1px solid #E6E8ED;border-radius:10px}'
      + '.cap{font-size:10px;color:#7C8590;margin-top:4px;font-weight:600}'
      + '.ft{margin-top:26px;display:flex;justify-content:space-between;font-size:11px;color:#4E5761;font-weight:700}'
      + '.sig{border-top:1.5px solid #1B1F24;padding-top:4px;min-width:120px;text-align:center}'
      + '.badge{display:inline-block;background:#E7F5EC;color:#23734A;font-size:10px;font-weight:800;padding:3px 8px;border-radius:99px;margin-bottom:10px}'
      + '@media print{body{padding:8px}}</style></head><body>'
      + '<div class="hd"><div class="lg">WELP<span>.</span></div><div class="sub">Slip Gaji Karyawan<br/>by JUSTru Group</div></div>'
      + '<span class="badge">TERBAYAR · ' + no + '</span>'
      + '<h1>' + rec.employeeName + '</h1><p class="per">' + (rec.branchName || '-') + ' · Periode ' + rec.period + '</p>'
      + '<div class="amt">' + formatIDR(rec.amount) + '</div>'
      + '<table><tr><td>Nama Karyawan</td><td>' + rec.employeeName + '</td></tr>'
      + '<tr><td>Cabang</td><td>' + (rec.branchName || '-') + '</td></tr>'
      + '<tr><td>Role</td><td>' + (rec.role || '-') + '</td></tr>'
      + '<tr><td>Periode</td><td>' + rec.period + '</td></tr>'
      + '<tr><td>Dibayar</td><td>' + new Date(t.ms).toLocaleString('id-ID') + '</td></tr>'
      + (rec.note ? '<tr><td>Catatan</td><td>' + rec.note + '</td></tr>' : '')
      + '<tr class="tot"><td>Total Diterima</td><td>' + formatIDR(rec.amount) + '</td></tr></table>'
      + (rec.proof ? '<div class="prf"><img src="' + rec.proof + '" alt="Bukti transfer"/><div class="cap">Bukti transfer terlampir</div></div>' : '')
      + '<div class="ft"><div class="sig">Penerima</div><div class="sig">WELP · ' + (licenseInfo?.tenant || 'Toko') + '</div></div>'
      + '<script>setTimeout(function(){window.print()},400)<\/script></body></html>');
    w.document.close();
  };

  if (blocked) {
    return (
      <div className="max-w-3xl mx-auto w-full pb-24">
        <PageTitle title="Manajemen Penggajian" sub={myBranch?.name || 'Cabang'} />
        <EmptyState mascot="capek" title="Penggajian dimatikan Owner"
          desc="Untuk cabang ini, penggajian masih dikelola langsung oleh Owner pusat. Minta Owner mengaktifkan saklar Manajemen Penggajian pada cabangmu bila sudah dikelola manajer." />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 space-y-5">
      <PageTitle title="Manajemen Penggajian" sub="Catat pembayaran, bukti transfer & slip gaji"
        right={<LiveDot live={live} />} />

      {sessionRole !== 'admin' && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[{ cid: 'ALL', name: 'Semua Cabang' }, ...branches].map(b => (
            <button key={b.cid} onClick={() => setSelBranch(b.cid)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all border ${selBranch === b.cid ? 'bg-flame-600 text-white border-flame-600 shadow-card' : 'bg-surface dark:bg-surface-dark text-ink-faint border-line dark:border-line-dark hover:border-flame-300'}`}>
              <Cabang className="w-3.5 h-3.5" /> {b.name}
            </button>
          ))}
        </div>
      )}

      <Card title={`Daftar Gaji Karyawan${shownBranch ? ' · ' + shownBranch.name : ''}`} icon={Penggajian}>
        {list.length === 0 ? (
          <EmptyState mascot="pikir" title="Belum ada karyawan di cabang ini" desc="Tambahkan karyawan terlebih dulu di menu Manajemen Karyawan, lalu catat pembayaran gajinya di sini." />
        ) : (
          <div className="space-y-2">
            {list.map(e => {
              const bid = e.branchId || 'PUSAT';
              const last = lastPay(e.name, bid);
              return (
                <div key={e.cid} className="flex items-center gap-3 p-3 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
                  <div className="w-10 h-10 rounded-2xl bg-flame-50 dark:bg-flame-900/40 text-flame-700 dark:text-apricot flex items-center justify-center font-extrabold shrink-0">{e.name[0]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv truncate">{e.name}</p>
                    {last ? (
                      <p className="text-[10px] font-bold text-leaf-deep dark:text-leaf truncate">
                        Terakhir: {last.period} · {formatIDR(last.amount)} · {fmtDateTime(trustedTime(last).ms)}
                      </p>
                    ) : <p className="text-[10px] font-bold text-ink-faint">Belum ada pembayaran tercatat</p>}
                  </div>
                  <Button onClick={() => openPay(e, bid)} className="py-2.5 px-3.5 text-xs" icon={KoinBuddy}>Bayar</Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="History Pembayaran Gaji" icon={Riwayat}>
        {history.length === 0 ? (
          <div className="py-6 text-center">
            <Riwayat className="w-10 h-10 text-ink-faint/40 mx-auto mb-2" />
            <p className="text-xs text-ink-faint font-bold">Belum ada pembayaran tercatat.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.map(h => {
              const t = trustedTime(h);
              return (
                <div key={h.cid} className="p-3.5 rounded-2xl border border-line dark:border-line-dark bg-surface dark:bg-surface-dark">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[13px] text-ink dark:text-ink-inv">{h.employeeName} <span className="text-ink-faint font-bold text-[11px]">· {h.branchName}</span></p>
                      <p className="text-[10px] text-ink-faint font-bold">{h.period}{h.note ? ' · ' + h.note : ''}</p>
                      <p className="text-[10px] font-bold mt-0.5 flex items-center gap-1 text-ink-faint">
                        <WaktuReal className="w-3 h-3" /> {new Date(t.ms).toLocaleString('id-ID')}
                        {t.source === 'server' && <span className="text-leaf-deep dark:text-leaf">· ✓ realtime server</span>}
                      </p>
                    </div>
                    <p className="font-extrabold money text-flame-700 dark:text-apricot text-sm shrink-0">{formatIDR(h.amount)}</p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => printSlip(h)} className="flex-1 py-2.5 rounded-xl bg-flame-600 hover:bg-flame-500 text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 press"><SlipGaji className="w-4 h-4" /> Cetak Slip Gaji</button>
                    {h.proof && <button onClick={() => setViewProof(h)} className="flex-1 py-2.5 rounded-xl bg-paper dark:bg-white/5 border border-line dark:border-line-dark text-ink-soft dark:text-ink-inv/70 text-[11px] font-extrabold flex items-center justify-center gap-1.5 press"><BuktiTransfer className="w-4 h-4" /> Bukti</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal catat pembayaran */}
      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Catat Pembayaran Gaji">
        {payFor && (
          <div className="space-y-3.5">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-flame-50 dark:bg-flame-900/25">
              <div className="w-10 h-10 rounded-2xl bg-flame-600 text-white flex items-center justify-center font-extrabold">{payFor.name[0]}</div>
              <div><p className="font-extrabold text-sm text-ink dark:text-ink-inv">{payFor.name}</p><p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">{payFor.branchName} · {payFor.role}</p></div>
            </div>
            <FieldCard icon={WaktuReal} label="Periode Gaji" desc="Bulan yang dibayarkan">
              <Select value={form.period} options={PERIODE.map(p => p + ' ' + new Date().getFullYear())} onChange={v => setForm({ ...form, period: v })} />
            </FieldCard>
            <FieldCard icon={KoinBuddy} label="Nominal Gaji (Rp)" desc="Jumlah yang ditransfer">
              <input className="field money" inputMode="numeric" placeholder="Contoh: 2.500.000" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, '') })} />
              {form.amount && <p className="text-[11px] font-extrabold text-flame-700 dark:text-apricot mt-2 money">{formatIDR(Number(form.amount.replace(/[^0-9]/g, '') || 0))}</p>}
            </FieldCard>
            <FieldCard icon={BuktiTransfer} label="Bukti Transfer" desc="Foto/screenshot bukti (opsional, tersimpan terenkapsulasi)">
              {proof ? (
                <div className="relative rounded-xl overflow-hidden border border-line dark:border-line-dark">
                  <img src={proof} alt="Bukti transfer" className="w-full h-36 object-cover" />
                  <button onClick={() => setProof(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-brick text-white text-xs font-extrabold">✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-line dark:border-line-dark rounded-xl cursor-pointer hover:border-flame-400 transition">
                  {proofBusy ? <><WaktuReal className="w-6 h-6 text-flame-500 animate-spin" /><p className="text-[10px] font-bold text-ink-faint mt-1.5">Memproses gambar...</p></> : <>
                    <BuktiTransfer className="w-8 h-8 text-ink-faint/50 mb-1.5" />
                    <p className="text-[11px] font-extrabold text-ink-soft dark:text-ink-inv/70">Pilih / Foto Bukti Transfer</p>
                    <p className="text-[9px] text-ink-faint font-semibold mt-0.5">JPG/PNG — dikompres otomatis</p>
                  </>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => pickProof(e.target.files[0])} />
                </label>
              )}
            </FieldCard>
            <FieldCard icon={StrukCetak} label="Catatan" desc="Opsional — mis. bonus THR">
              <input className="field" placeholder="Catatan pembayaran..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </FieldCard>
            <Button onClick={savePay} className="w-full py-3.5" icon={Check}>Simpan & Tandai Terbayar</Button>
          </div>
        )}
      </Modal>

      {/* Modal lihat bukti */}
      <Modal open={!!viewProof} onClose={() => setViewProof(null)} title="Bukti Transfer">
        {viewProof && (
          <div>
            <img src={viewProof.proof} alt="Bukti transfer" className="w-full rounded-2xl border border-line dark:border-line-dark" />
            <p className="text-center text-[11px] font-bold text-ink-faint mt-3">
              {viewProof.employeeName} · {viewProof.period} · {formatIDR(viewProof.amount)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
